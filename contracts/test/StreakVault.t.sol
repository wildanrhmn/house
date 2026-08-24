// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {StreakVault} from "../src/StreakVault.sol";
import {MarketRecord} from "../src/interfaces/IDreamDex.sol";

// ---------------------------------------------------------------- mocks

contract MockERC20 {
    string public name = "tUSDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
        return true;
    }

    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[t] += a;
        return true;
    }
}

contract Mock6909 {
    mapping(address => mapping(uint256 => uint256)) public balanceOf;

    function mint(address to, uint256 id, uint256 amt) external {
        balanceOf[to][id] += amt;
    }

    function burn(address from, uint256 id, uint256 amt) external {
        balanceOf[from][id] -= amt;
    }
}

/// Fakes a pool crossing: fills `fillShares` at `fillPrice` (own-outcome terms).
contract MockPool {
    MockERC20 public collateral;
    Mock6909 public outcome;
    uint256 public yesId;
    uint256 public noId;
    uint256 public fillShares; // 0 = fill nothing
    uint256 public fillPrice; // raw, own-outcome

    constructor(MockERC20 c, Mock6909 o, uint256 y, uint256 n) {
        collateral = c;
        outcome = o;
        yesId = y;
        noId = n;
    }

    function setFill(uint256 shares, uint256 price) external {
        fillShares = shares;
        fillPrice = price;
    }

    function placeBinaryOrder(uint8 kind, uint256, uint256 quantity, uint64, uint8, uint8, address, uint96, uint64)
        external
        returns (bool, uint128)
    {
        uint256 shares = fillShares < quantity ? fillShares : quantity;
        if (shares == 0) return (false, 0);
        uint256 cost = (shares * fillPrice) / 1e6;
        collateral.transferFrom(msg.sender, address(this), cost);
        outcome.mint(msg.sender, kind == 0 ? yesId : noId, shares);
        return (true, 1);
    }
}

/// Settlement paying `payoutPerShare` (raw per 1e6 shares) for one outcome id.
contract MockSettlement {
    MockERC20 public collateral;
    Mock6909 public outcome;
    mapping(uint256 => uint256) public payoutPerShare;

    constructor(MockERC20 c, Mock6909 o) {
        collateral = c;
        outcome = o;
    }

    function setPayout(uint256 id, uint256 p) external {
        payoutPerShare[id] = p;
    }

    function finalizeAndRedeem(address, uint256 id, uint256 amount, address to) external returns (uint256) {
        outcome.burn(to, id, amount);
        uint256 pay = (amount * payoutPerShare[id]) / 1e6;
        collateral.mint(to, pay);
        return pay;
    }
}

contract MockModule {
    address public settlement;
    mapping(bytes32 => MarketRecord) public recs;

    constructor(address s) {
        settlement = s;
    }

    function set(bytes32 id, MarketRecord memory r) external {
        recs[id] = r;
    }

    function markets(bytes32 id) external view returns (MarketRecord memory) {
        return recs[id];
    }
}

// ---------------------------------------------------------------- tests

contract StreakVaultTest is Test {
    bytes32 constant MKT = bytes32(uint256(100));
    uint256 constant YES = 11;
    uint256 constant NO = 12;

    MockERC20 usdc;
    Mock6909 outcome;
    MockPool pool;
    MockSettlement settle;
    MockModule module;
    StreakVault vault;

    address user = address(0xBEEF);
    address keeper = address(0xCAFE);
    bytes32 venue = keccak256("venue");

    function setUp() public {
        usdc = new MockERC20();
        outcome = new Mock6909();
        settle = new MockSettlement(usdc, outcome);
        module = new MockModule(address(settle));
        pool = new MockPool(usdc, outcome, YES, NO);
        module.set(
            MKT,
            MarketRecord({
                oracleQuestionId: 1,
                outcomeSlotCount: 2,
                voidPolicy: 0,
                collateral: address(usdc),
                originOperatorId: 1,
                originVenueId: venue,
                oracleAdapter: address(0),
                creator: address(0),
                market: address(0xd0d0),
                pool: address(pool),
                yesId: YES,
                noId: NO,
                tradingStart: uint64(block.timestamp),
                expiry: uint64(block.timestamp + 900)
            })
        );
        vault = new StreakVault(address(module), address(outcome), address(usdc), venue, keeper);
        usdc.mint(user, 1_000e6);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _run(uint8 legs, uint256 stake) internal returns (uint256 id) {
        uint8[] memory dirs = new uint8[](legs);
        uint256[] memory caps = new uint256[](legs);
        bytes32[] memory tags = new bytes32[](legs);
        for (uint256 i; i < legs; i++) {
            dirs[i] = 0;
            caps[i] = 800000;
            tags[i] = bytes32("BTC:60");
        }
        vm.prank(user);
        id = vault.createRun(dirs, caps, tags, stake);
    }

    function test_createRun_validation() public {
        uint8[] memory dirs = new uint8[](0);
        uint256[] memory caps = new uint256[](0);
        bytes32[] memory tags = new bytes32[](0);
        vm.prank(user);
        vm.expectRevert(StreakVault.BadLegs.selector);
        vault.createRun(dirs, caps, tags, 10e6);

        dirs = new uint8[](1);
        caps = new uint256[](1);
        tags = new bytes32[](1);
        caps[0] = 1e6; // cap must be < 1.0
        vm.prank(user);
        vm.expectRevert(StreakVault.BadLegs.selector);
        vault.createRun(dirs, caps, tags, 10e6);
    }

    function test_onlyKeeperExecutes() public {
        uint256 id = _run(1, 100e6);
        vm.prank(user);
        vm.expectRevert(StreakVault.NotKeeper.selector);
        vault.executeLeg(id, MKT, 500000, 10e6);
    }

    function test_priceCapEnforced() public {
        uint256 id = _run(1, 100e6);
        vm.prank(keeper);
        vm.expectRevert(StreakVault.PriceCapExceeded.selector);
        vault.executeLeg(id, MKT, 900000, 10e6); // own price 0.90 > cap 0.80
    }

    function test_wrongVenueRejected() public {
        bytes32 alien = bytes32(uint256(999));
        MarketRecord memory r = module.markets(MKT);
        r.originVenueId = keccak256("other-venue");
        module.set(alien, r);

        uint256 id = _run(1, 100e6);
        vm.prank(keeper);
        vm.expectRevert(StreakVault.WrongVenue.selector);
        vault.executeLeg(id, alien, 500000, 10e6);
    }

    function test_fullRun_winThenClaim() public {
        uint256 id = _run(2, 100e6);
        pool.setFill(200e6, 500000); // fills at 0.50

        vm.prank(keeper);
        vault.executeLeg(id, MKT, 500000, 200e6); // spends 100 → 200 shares

        settle.setPayout(YES, 1e6); // win: 1.00 per share
        vm.prank(keeper);
        vault.settleLeg(id); // leg 0 won → balance 200, leg 1 open

        StreakVault.Run memory run = vault.getRun(id);
        assertEq(run.balance, 200e6);
        assertEq(run.legIndex, 1);
        assertEq(uint8(run.state), uint8(StreakVault.RunState.Open));

        pool.setFill(400e6, 500000);
        vm.prank(keeper);
        vault.executeLeg(id, MKT, 500000, 400e6); // roll all 200 → 400 shares
        vm.prank(keeper);
        vault.settleLeg(id); // final leg won → Ended, 400

        run = vault.getRun(id);
        assertEq(uint8(run.state), uint8(StreakVault.RunState.Ended));
        assertEq(run.balance, 400e6);

        uint256 before = usdc.balanceOf(user);
        vm.prank(user);
        vault.claim(id);
        assertEq(usdc.balanceOf(user) - before, 400e6); // 100 staked → 400 back
    }

    function test_lossEndsRun() public {
        uint256 id = _run(3, 100e6);
        pool.setFill(200e6, 500000);
        vm.prank(keeper);
        vault.executeLeg(id, MKT, 500000, 200e6);

        settle.setPayout(YES, 0); // lost
        vm.prank(keeper);
        vault.settleLeg(id);

        StreakVault.Run memory run = vault.getRun(id);
        assertEq(uint8(run.state), uint8(StreakVault.RunState.Ended));
        assertEq(run.balance, 0);
    }

    function test_voidRollsForwardAtHalf() public {
        uint256 id = _run(2, 100e6);
        pool.setFill(200e6, 500000);
        vm.prank(keeper);
        vault.executeLeg(id, MKT, 500000, 200e6);

        settle.setPayout(YES, 500000); // void: 0.50 per share
        vm.prank(keeper);
        vault.settleLeg(id);

        StreakVault.Run memory run = vault.getRun(id);
        // 200 shares × 0.5 = 100 back; run continues to leg 1
        assertEq(run.balance, 100e6);
        assertEq(run.legIndex, 1);
        assertEq(uint8(run.state), uint8(StreakVault.RunState.Open));
    }

    function test_cancelOnlyBetweenLegs() public {
        uint256 id = _run(1, 100e6);
        pool.setFill(200e6, 500000);
        vm.prank(keeper);
        vault.executeLeg(id, MKT, 500000, 200e6);

        vm.prank(user);
        vm.expectRevert(StreakVault.BadState.selector);
        vault.cancelRun(id); // position live — no exit mid-window
    }

    function test_strangerCannotClaim() public {
        uint256 id = _run(1, 100e6);
        pool.setFill(200e6, 500000);
        vm.prank(keeper);
        vault.executeLeg(id, MKT, 500000, 200e6);
        settle.setPayout(YES, 1e6);
        vm.prank(keeper);
        vault.settleLeg(id);

        vm.prank(address(0xBAD));
        vm.expectRevert(StreakVault.NotRunOwner.selector);
        vault.claim(id);
    }
}
