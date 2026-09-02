# HOUSE

Event Contracts let two buyers mint a complete set with no seller. HOUSE lets a normal wallet be that book.

Quote both sides of a DreamDEX binary on Somnia Shannon: rest `BUY_YES` below mid and `BUY_NO` so the implied Up ask sits above mid. Opposite takers mint the pair. You keep the spread. No inventory to start.

Shannon prototype for the Somnia x DreamDEX Event Contracts hackathon.

## Run

Root `.env` needs `PRIVATE_KEY` for the Node quoter and `TAKER_KEY` for the demo taker. Both wallets need STT for gas: the SDK reserves a 0.6 STT envelope per write. Do not commit the file.

```bash
npm install
npm run dev
```

Landing: [http://localhost:3000](http://localhost:3000). Desk: [http://localhost:3000/desk](http://localhost:3000/desk). Connect a Shannon wallet, then Quote both sides once per window. Both orders are simulated against the pool before anything is signed, so a quote that would cross is re-planned instead of sent, and the wallet asks at most three times: one batch cancel of resting quotes, then one signature per side. The desk shows the bet as a question, an UP card and a DOWN card with what you pay against what the crowd pays, and the sum: what a pair costs you, that a pair always pays 1.00, and what you keep. Cash out (Flatten) hands pairs back for 1.00 each and sells any unmatched leftover. Collect payouts (Redeem) pulls winnings from windows that already settled. `/desk?watch=0x...` follows any wallet read-only, which is how to watch the Node quoter work.

Node quoter (PRIVATE_KEY, requotes about every 20s). It sits one tick inside a wider market and never thinner than two ticks; `HOUSE_HALF_SPREAD` caps the half spread and `HOUSE_SIZE` sets contracts per side:

```bash
npm run quote
```

Demo taker (TAKER_KEY). Lifts the resting Up ask with a BUY_YES and hits the bid with a BUY_NO, both immediate or cancel, so each cross mints a complete set into the maker. `--dry` prints the plan without writing, `--faucet` mints test collateral first:

```bash
npm run take -- --dry
npm run take -- --faucet
npm run take
```

The loop: quote both sides, let the taker cross both, watch Sets held rise on the desk, then Flatten. Flatten cancels, merges every balanced YES and NO pair back to collateral, and sells any leftover. The merge is where the spread is realized.

One command runs the whole loop from Node with both keys, rounds until the maker holds a complete set, then flattens:

```bash
npm run demo
```

## Proof on Shannon, 2 Sep 2026

`npm run demo` on BTC 15m market `0x...11199`. HOUSE rested BUY_YES at 0.036 and BUY_NO at an implied Up ask of 0.055, 5 contracts a side. The taker lifted the ask in `0x76f7625ce7fa6c1264fbbe752d1d2a6a5a064cc871706eb56028fa63c2bb77a2` and hit the bid in `0xcb589ed80a98999a8a82e51f102475df97d8e5731f71df8d1e8d51f87e1888db`. Each cross had no seller, so the pool minted the pair. HOUSE held 5 complete sets, merged them back to collateral in `0xed699ecef467211225f8c333588ac16aef09424809b080bd62665b018c97c4a1`, and its collateral rose by 0.095 tUSDC, five times the 0.019 spread.

Earlier the same day a third-party bot lifted a resting HOUSE quote on its own, `0x14295dd86137d448411d864635743a59796df5f284e595879f70109268941af0`, which the indexer records as MINT_A_PAIR with HOUSE as maker.

## Stack

- Next.js desk on port 3000 (indexer CORS is allowed for that origin)
- `@somnia-chain/markets-sdk` 0.29.0
- DreamDEX venue only. Prefer BTC 15m. Writes gated on on-chain status Trading.
- PostOnly. `expireTimestampNs` is required. `BUY_NO` prices are in YES terms.

No Solidity. No vault. One-shot wallet quotes, not a MetaMask requote loop.
