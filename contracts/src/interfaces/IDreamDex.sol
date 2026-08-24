// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// DreamDEX Event Contracts — external surface used by StreakVault.
/// Signatures extracted from @somnia-chain/markets-sdk ABIs (v0.28.1) and
/// verified against the live Shannon deployment.

/// Registry entry for one binary market window.
struct MarketRecord {
    uint256 oracleQuestionId;
    uint8 outcomeSlotCount;
    uint8 voidPolicy;
    address collateral;
    uint32 originOperatorId;
    bytes32 originVenueId;
    address oracleAdapter;
    address creator;
    address market;
    address pool;
    uint256 yesId;
    uint256 noId;
    uint64 tradingStart;
    uint64 expiry;
}

interface IBinaryMarketsModule {
    function markets(bytes32 marketId) external view returns (MarketRecord memory);
    function settlement() external view returns (address);
}

/// Order kinds: 0=BUY_YES 1=SELL_YES 2=BUY_NO 3=SELL_NO.
/// Order types: 0=LIMIT 1=FILL_OR_KILL 2=MARKET(IOC) 3=POST_ONLY.
interface IBinaryPool {
    function placeBinaryOrder(
        uint8 kind,
        uint256 price,
        uint256 quantity,
        uint64 expireTimestampNs,
        uint8 orderType,
        uint8 selfMatchingOption,
        address builder,
        uint96 builderFeeBpsTimes1k,
        uint64 userData
    ) external returns (bool filled, uint128 orderId);

    function cancelOrder(uint128 orderId) external;
    function mintSet(address yesTo, address noTo, uint256 amount) external;
    function burnSet(uint256 amount) external;
}

interface IBinarySettlement {
    /// Finalizes the pool's settled market if needed, then redeems in one call.
    function finalizeAndRedeem(address pool, uint256 outcomeId, uint256 amount, address to)
        external
        returns (uint256 payout);

    function redeem(uint256 outcomeId, uint256 amount, address to) external returns (uint256 payout);
    function isFinalized(uint256 outcomeId) external view returns (bool);
    function owed(address user, address token) external view returns (uint256);
    function claimOwed(address token) external returns (uint256);
}

/// Outcome positions: ERC-6909 ids on one shared singleton.
interface IERC6909 {
    function balanceOf(address owner, uint256 id) external view returns (uint256);
    function approve(address spender, uint256 id, uint256 amount) external returns (bool);
    function setOperator(address spender, bool approved) external returns (bool);
    function transfer(address receiver, uint256 id, uint256 amount) external returns (bool);
    function transferFrom(address sender, address receiver, uint256 id, uint256 amount)
        external
        returns (bool);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}
