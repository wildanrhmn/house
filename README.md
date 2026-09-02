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

Landing: [http://localhost:3000](http://localhost:3000). Desk: [http://localhost:3000/desk](http://localhost:3000/desk). Connect a Shannon wallet, then Quote both sides once per window. Flatten sells leftover outcomes. Redeem settled pulls payouts after resolve.

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

## Stack

- Next.js desk on port 3000 (indexer CORS is allowed for that origin)
- `@somnia-chain/markets-sdk` 0.29.0
- DreamDEX venue only. Prefer BTC 15m. Writes gated on on-chain status Trading.
- PostOnly. `expireTimestampNs` is required. `BUY_NO` prices are in YES terms.

No Solidity. No vault. One-shot wallet quotes, not a MetaMask requote loop.
