# markets-sdk 0.29.0 feedback from building HOUSE

Notes from a week on Shannon building a two-sided quoter for Event Contracts. Everything below was hit in practice, with the workaround we shipped.

## Things that cost us time

1. **Gas envelope.** Every signed write reserves 10,000,000 gas at 60 gwei, so the node rejects a transaction with `insufficient balance` unless the wallet holds 0.6 STT, even though the actual burn is a few thousandths. The error message says nothing about gas. A one-line note in the write docs, or a lower default with `gas` as the escape hatch, would save every newcomer an hour.

2. **Fills and open orders lag in the indexer by minutes.** `getUserFills` showed a fill about thirty minutes after it landed, and `getOpenOrders` did not return an order placed seconds earlier. `getOwnOpenOrdersOnchain` and `getOrderOnchain` are the right tools and they worked perfectly, but nothing in the `getOpenOrders` docs points at them. A maker that cancels and replaces must use the chain-head reads.

3. **`listLiveBinaryMarkets` filters `intervalSec` as a band.** A 900 second series indexes as 898 or 899 after a roll. Exact matching returns nothing. The docs read as if it were an exact filter.

4. **`getOutcomeBalance` takes one params object.** The positional call compiles against a loose type in one code path and fails silently at runtime. Tightening the signature so the positional form does not type check would have caught our bug at build time.

5. **BUY_NO price is the YES price.** The ABI comment says so and the SDK forwards it verbatim, but `PlaceOrderParams` describes `price` as "YES limit price" without saying that a more aggressive BUY_NO is a lower number. One sentence and an example would remove the ambiguity.

6. **`ImmediateOrCancelNoFill` surfaces as a thrown error from a resolved write.** Fine, but the sibling gotcha is that other reverts resolve with `receipt.status === "reverted"` instead of throwing. A consistent rule, or a helper that throws on any revert, would be easier to build on.

## Things that worked well

- `getOrderOnchain` and `getOwnOpenOrdersOnchain` read our own writes in the same block. This is what made cancel and replace reliable.
- `burnSet` with `autoApprove` merged a filled pair back to collateral in one call.
- `getBinaryOrderBook` with `decimals` gave usable human prices without extra plumbing.
- `PostOnlyWouldCross` is a clean signal to re-plan from a fresh book.
- The React hooks armed a live book and price on the desk with almost no code.

## Two asks

- A documented recipe for the mint-a-pair path from the maker's side: rest BUY_YES below mid and BUY_NO above it in YES terms, keep the sum under one, merge the resulting pair. It is the most interesting thing the venue does and it is not spelled out.
- A `wouldRest` style preview for PostOnly, so a quoter can know before sending whether the order would cross at chain head.
