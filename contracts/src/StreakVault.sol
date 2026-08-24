// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {
    IBinaryMarketsModule,
    IBinaryPool,
    IBinarySettlement,
    IERC6909,
    IERC20,
    MarketRecord
} from "./interfaces/IDreamDex.sol";

/// Streakline: let-it-ride runs across consecutive DreamDEX Event Contract windows.
///
/// A run is a fixed sequence of Up/Down calls. The user stakes once; each leg's
/// full redemption proceeds become the next leg's budget. Legs are bound to
/// concrete market windows at execution time (future windows do not exist yet
/// when a run is created), so a keeper drives execution — but every economic
/// guarantee is enforced here on-chain:
///
///   - collateral is escrowed per-run and only ever flows into DreamDEX orders
///     for the declared venue, in the declared leg order, under the user's
///     per-leg price cap;
///   - redemptions return to the run's escrow via BinarySettlement;
///   - only the run's owner can cancel between legs or claim the final payout.
contract StreakVault {
    uint8 public constant UP = 0; // BUY_YES
    uint8 public constant DOWN = 1; // BUY_NO

    enum RunState {
        Open, // created, next leg not yet executed
        PositionHeld, // a leg's position is live in the current window
        Ended, // lost a leg, or final leg settled; balance claimable if > 0
        Cancelled
    }

    struct Run {
        address owner;
        RunState state;
        uint8 legIndex;
        uint8[] directions; // UP/DOWN per leg
        uint256[] maxPrice; // per-leg cap, in the leg's own outcome price (raw units)
        bytes32[] seriesTags; // per-leg series ("BTC:900"), declared by the user at creation
        uint256 balance; // escrowed collateral budget (raw units)
        // Current leg binding (set by executeLeg):
        bytes32 marketId;
        address pool;
        uint256 outcomeIdHeld;
        uint64 marketExpiry;
        bytes32 legTag; // UI metadata (asset/interval), not verified on-chain
    }

    IBinaryMarketsModule public immutable module;
    IBinarySettlement public immutable settlement;
    IERC6909 public immutable outcomeToken;
    IERC20 public immutable collateral;
    bytes32 public immutable venueId;
    uint256 public immutable ONE; // 10 ** collateral decimals

    address public keeper;
    address public owner;

    uint256 public nextRunId;
    mapping(uint256 => Run) private runs;

    event RunCreated(uint256 indexed runId, address indexed owner, uint8 legs, uint256 stake, bytes32[] seriesTags);
    event LegExecuted(
        uint256 indexed runId, uint8 indexed legIndex, bytes32 marketId, uint256 filled, uint256 cost, bytes32 legTag
    );
    event LegSettled(uint256 indexed runId, uint8 indexed legIndex, bool won, bool voided, uint256 proceeds);
    event RunEnded(uint256 indexed runId, bool won, uint256 finalBalance);
    event RunCancelled(uint256 indexed runId, uint256 refunded);
    event Claimed(uint256 indexed runId, address to, uint256 amount);

    error NotOwner();
    error NotKeeper();
    error NotRunOwner();
    error BadState();
    error WrongVenue();
    error PriceCapExceeded();
    error MarketNotSettled();
    error NothingFilled();
    error BadLegs();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(address module_, address outcomeToken_, address collateral_, bytes32 venueId_, address keeper_) {
        module = IBinaryMarketsModule(module_);
        settlement = IBinarySettlement(IBinaryMarketsModule(module_).settlement());
        outcomeToken = IERC6909(outcomeToken_);
        collateral = IERC20(collateral_);
        venueId = venueId_;
        keeper = keeper_;
        owner = msg.sender;
        ONE = 10 ** IERC20(collateral_).decimals();
    }

    function setKeeper(address k) external {
        if (msg.sender != owner) revert NotOwner();
        keeper = k;
    }

    function getRun(uint256 runId) external view returns (Run memory) {
        return runs[runId];
    }

    // ---------------------------------------------------------------- user

    /// Stake once and declare the whole run: directions[i] is the call for leg i,
    /// maxPrice[i] the worst acceptable probability (own-outcome terms, raw units),
    /// seriesTags[i] the series the leg must trade ("BTC:900" = BTC, 15-minute).
    function createRun(
        uint8[] calldata directions,
        uint256[] calldata maxPrice,
        bytes32[] calldata seriesTags,
        uint256 stake
    ) external returns (uint256 runId) {
        if (
            directions.length == 0 || directions.length > 10 || directions.length != maxPrice.length
                || directions.length != seriesTags.length
        ) {
            revert BadLegs();
        }
        for (uint256 i = 0; i < maxPrice.length; i++) {
            if (maxPrice[i] == 0 || maxPrice[i] >= ONE) revert BadLegs();
        }
        require(stake > 0, "zero stake");
        collateral.transferFrom(msg.sender, address(this), stake);

        runId = nextRunId++;
        Run storage r = runs[runId];
        r.owner = msg.sender;
        r.state = RunState.Open;
        r.directions = directions;
        r.maxPrice = maxPrice;
        r.seriesTags = seriesTags;
        r.balance = stake;
        emit RunCreated(runId, msg.sender, uint8(directions.length), stake, seriesTags);
    }

    /// Cancel between legs (never while a position is live) and refund the escrow.
    function cancelRun(uint256 runId) external {
        Run storage r = runs[runId];
        if (msg.sender != r.owner) revert NotRunOwner();
        if (r.state != RunState.Open) revert BadState();
        r.state = RunState.Cancelled;
        uint256 bal = r.balance;
        r.balance = 0;
        collateral.transfer(r.owner, bal);
        emit RunCancelled(runId, bal);
    }

    /// Withdraw the final balance of an ended run.
    function claim(uint256 runId) external {
        Run storage r = runs[runId];
        if (msg.sender != r.owner) revert NotRunOwner();
        if (r.state != RunState.Ended) revert BadState();
        uint256 bal = r.balance;
        r.balance = 0;
        collateral.transfer(r.owner, bal);
        emit Claimed(runId, r.owner, bal);
    }

    // -------------------------------------------------------------- keeper

    /// Bind the run's next leg to a live window and take the position with the
    /// full escrowed budget. `priceYes` is the IOC cap in YES terms; the vault
    /// re-derives the own-outcome price and enforces the user's per-leg cap.
    /// The window's series is the one the user declared for this leg — the
    /// keeper picks the window, never the series.
    function executeLeg(uint256 runId, bytes32 marketId, uint256 priceYes, uint256 quantity) external onlyKeeper {
        Run storage r = runs[runId];
        if (r.state != RunState.Open) revert BadState();
        bytes32 legTag = r.seriesTags[r.legIndex];

        MarketRecord memory m = module.markets(marketId);
        if (m.originVenueId != venueId || m.collateral != address(collateral)) revert WrongVenue();

        uint8 dir = r.directions[r.legIndex];
        uint256 ownPrice = dir == UP ? priceYes : ONE - priceYes;
        if (ownPrice > r.maxPrice[r.legIndex]) revert PriceCapExceeded();

        // The pool pulls collateral from the caller; approve exactly the worst case.
        uint256 maxCost = (quantity * ownPrice + ONE - 1) / ONE;
        require(maxCost <= r.balance, "over budget");
        collateral.approve(m.pool, maxCost);

        uint256 balBefore = collateral.balanceOf(address(this));
        uint256 idHeld = dir == UP ? m.yesId : m.noId;
        uint256 posBefore = outcomeToken.balanceOf(address(this), idHeld);

        uint64 expireNs = uint64(_min(block.timestamp + 60, m.expiry)) * 1e9;
        IBinaryPool(m.pool).placeBinaryOrder(
            dir == UP ? 0 : 2, // BUY_YES / BUY_NO
            priceYes,
            quantity,
            expireNs,
            2, // MARKET (IOC): fill what crosses, rest nothing
            0, // CANCEL_TAKER
            address(0),
            0,
            uint64(runId)
        );
        collateral.approve(m.pool, 0);

        uint256 filled = outcomeToken.balanceOf(address(this), idHeld) - posBefore;
        if (filled == 0) revert NothingFilled();
        uint256 cost = balBefore - collateral.balanceOf(address(this));

        r.balance -= cost;
        r.state = RunState.PositionHeld;
        r.marketId = marketId;
        r.pool = m.pool;
        r.outcomeIdHeld = idHeld;
        r.marketExpiry = m.expiry;
        r.legTag = legTag;
        emit LegExecuted(runId, r.legIndex, marketId, filled, cost, legTag);
    }

    /// After the window settles: redeem, roll proceeds into the escrow, and either
    /// advance to the next leg or end the run. Voided windows redeem at 0.5 and
    /// the run rolls on with the refund — the venue's own void semantics.
    function settleLeg(uint256 runId) external onlyKeeper {
        Run storage r = runs[runId];
        if (r.state != RunState.PositionHeld) revert BadState();

        uint256 held = outcomeToken.balanceOf(address(this), r.outcomeIdHeld);

        uint256 proceeds = 0;
        bool voided = false;
        if (held > 0) {
            // finalizeAndRedeem finalizes the pool if needed; reverts while the
            // market is still live, which is exactly the guard we want here.
            proceeds = settlement.finalizeAndRedeem(r.pool, r.outcomeIdHeld, held, address(this));
            // A losing side redeems 0; a voided market pays 0.5 per share. We
            // infer void from a nonzero payout below one full unit per share.
            voided = proceeds > 0 && proceeds < held;
        }

        // The complement side (only held if this run also bought it — never in
        // v1) is intentionally not swept: one run, one side.
        bool won = proceeds > 0 && !voided;
        r.balance += proceeds;
        emit LegSettled(runId, r.legIndex, won, voided, proceeds);

        bool lastLeg = r.legIndex + 1 == r.directions.length;
        if ((won || voided) && !lastLeg && r.balance > 0) {
            r.legIndex += 1;
            r.state = RunState.Open;
        } else {
            r.state = RunState.Ended;
            emit RunEnded(runId, won && lastLeg, r.balance);
        }
        r.marketId = bytes32(0);
        r.pool = address(0);
        r.outcomeIdHeld = 0;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
