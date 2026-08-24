// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {StreakVault} from "../src/StreakVault.sol";
import {IBinaryMarketsModule, IERC20, MarketRecord} from "../src/interfaces/IDreamDex.sol";

interface ITestUSDC is IERC20 {
    function faucet(uint256 amount) external;
}

/// Fork test against live Shannon state. Pass a currently-Trading market:
///   MARKET_ID=0x... PRICE_YES=650000 forge test --fork-url shannon -vvv
contract StreakVaultForkTest is Test {
    address constant MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;
    address constant OUTCOME = 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9;
    address constant TUSDC = 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E;

    StreakVault vault;
    address user = address(0xBEEF);
    address keeper = address(0xCAFE);
    bytes32 marketId;
    uint256 priceYes;

    function setUp() public {
        marketId = vm.envBytes32("MARKET_ID");
        priceYes = vm.envUint("PRICE_YES");
        MarketRecord memory m = IBinaryMarketsModule(MODULE).markets(marketId);
        vault = new StreakVault(MODULE, OUTCOME, TUSDC, m.originVenueId, keeper);

        vm.startPrank(user);
        ITestUSDC(TUSDC).faucet(1000e6);
        ITestUSDC(TUSDC).approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function test_createExecuteLeg_fromContract() public {
        uint8[] memory dirs = new uint8[](2);
        dirs[0] = vault.UP();
        dirs[1] = vault.DOWN();
        uint256[] memory caps = new uint256[](2);
        caps[0] = 990000; // 0.99 — cap loose on purpose; this test proves plumbing, not pricing
        caps[1] = 990000;

        vm.prank(user);
        uint256 runId = vault.createRun(dirs, caps, 100e6);
        assertEq(vault.getRun(runId).balance, 100e6);

        // The critical assertion of the whole architecture: a CONTRACT can place
        // an IOC order on the pool with a plain ERC-20 approve, and receives the
        // outcome tokens itself.
        vm.prank(keeper);
        vault.executeLeg(runId, marketId, priceYes, 20e6, bytes32("ETH-300s"));

        StreakVault.Run memory r = vault.getRun(runId);
        assertTrue(r.balance < 100e6, "collateral was spent");
        assertEq(uint8(r.state), uint8(StreakVault.RunState.PositionHeld));
    }

    function test_cancelRefunds() public {
        uint8[] memory dirs = new uint8[](1);
        dirs[0] = vault.UP();
        uint256[] memory caps = new uint256[](1);
        caps[0] = 990000;

        vm.startPrank(user);
        uint256 runId = vault.createRun(dirs, caps, 50e6);
        uint256 before = ITestUSDC(TUSDC).balanceOf(user);
        vault.cancelRun(runId);
        assertEq(ITestUSDC(TUSDC).balanceOf(user) - before, 50e6);
        vm.stopPrank();
    }
}
