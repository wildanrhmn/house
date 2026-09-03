# markets-sdk 0.29.0 feedback from building HOUSE

Notes from a week on Shannon building a two-sided quoter for Event Contracts. Everything below was hit in practice, with the workaround we shipped.

## Things that cost us time

1. **Gas envelope.** Every signed write reserves 10,000,000 gas at 60 gwei, so the node rejects a transaction with `insufficient balance` unless the wallet holds 0.6 STT, even though the actual burn is a few thousandths. The error message says nothing about gas. A one-line note in the write docs, or a lower default with `gas` as the escape hatch, would save every newcomer an hour.

2. **Fills and open orders lag in the indexer by minutes.** `getUserFills` showed a fill about thirty minutes after it landed, and `getOpenOrders` did not return an order placed seconds earlier. `getOwnOpenOrdersOnchain` and `getOrderOnchain` are the right tools and they worked perfectly, but nothing in the `getOpenOrders` docs points at them. A maker that cancels and replaces must use the chain-head reads.

3. **`listLiveBinaryMarkets` filters `intervalSec` as a band.** A 900 second series indexes as 898 or 899 after a roll. Exact matching returns nothing. The docs read as if it were an exact filter.

4. **`getOutcomeBalance` takes one params object.** The positional call compiles against a loose type in one code path and fails silently at runtime. Tightening the signature so the positional form does not type check would have caught our bug at build time.

5. **BUY_NO price is the YES price.** The ABI comment says so and the SDK forwards it verbatim, but `PlaceOrderParams` describes `price` as "YES limit price" without saying that a more aggressive BUY_NO is a lower number. One sentence and an example would remove the ambiguity.

6. **`ImmediateOrCancelNoFill` surfaces as a thrown error from a resolved write.** Fine, but the sibling gotcha is that other reverts resolve with `receipt.status === "reverted"` instead of throwing. A consistent rule, or a helper that throws on any revert, would be easier to build on.

7. **Recycled pools keep dead orders, and `getOwnOpenOrdersOnchain` returns them.** Expiry is lazy on chain, so after a window rolls, the pool still lists the previous window's expired orders under the same owner. Our taker read a 0.480 bid from an hour earlier as the live quote and swept 990 contracts to reach it. `getOrderOnchain` does expose `expireTimestampNs`, so the fix is one filter, but the docs for the ids call say nothing about expired entries. Either filter them in the wrapper or say loudly that the caller must.

8. **No way to approve collateral before simulating.** We simulate every order with `eth_call` before asking a wallet to sign, which is what makes the desk safe. But the pool reverts the call until the collateral allowance exists, and the only approval path is the one inside `placeOrder`, which sends the order right after. `buildPlaceOrder().approval` is always populated and does not check the chain. We ended up holding our own wallet client just to send one `approve`. The writer already has `approveIfNeeded`; exposing it on the trader would remove that.

9. **A series alternates between two pools.** BTC 15m ran on two pool addresses in turn, one per window, so a fresh allowance was needed on each and a per-pool cache had to be keyed by both. The docs say pools are recycled, not that a series uses more than one.

10. **`getFills(pool, { market })` did not narrow to the market for us.** The rows came back from the pool's earlier lives too and we filtered on the row's own `market` field. The rows themselves are excellent, see below.

11. **Windows exit assertion.** Leaving the process while the SDK's websocket is open prints `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` from libuv on Windows. Harmless, alarming, and we did not find a documented `close()` to call first.

## Things that worked well

- `getOrderOnchain` and `getOwnOpenOrdersOnchain` read our own writes in the same block. This is what made cancel and replace reliable.
- `burnSet` with `autoApprove` merged a filled pair back to collateral in one call.
- `getBinaryOrderBook` with `decimals` gave usable human prices without extra plumbing.
- `PostOnlyWouldCross` is a clean signal to re-plan from a fresh book, and `eth_call` on `buildPlaceOrder().order` returns that selector before anything is signed. That preview is the core of the desk's safety.
- `getUserFills` and `getFills` rows carry `kind` (`MINT_A_PAIR`, `DIRECT_YES`, `BURN_A_PAIR`), both sides, both parties and the tx hash. Reconstructing what happened to a quote took one call, once the indexer caught up.
- The React hooks armed a live book and price on the desk with almost no code.

## Asks

- A documented recipe for the mint-a-pair path from the maker's side: rest BUY_YES below mid and BUY_NO above it in YES terms, keep the sum under one, merge the resulting pair. It is the most interesting thing the venue does and it is not spelled out.
- `trader.approveIfNeeded(token, spender)` as a public verb, so an app can approve first and simulate everything after.
- Filter expired orders out of `getOwnOpenOrdersOnchain`, or return the expiry alongside the ids.
- A note in the write docs that a simulation is only as good as the block it ran on. Router based takers on Shannon flip the book every few blocks, so a PostOnly that simulated clean can still cross at inclusion. The app has to re-check the second side right before its own send.
- A `close()` on the client for scripts that want to exit cleanly.
