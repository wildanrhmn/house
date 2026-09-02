# HOUSE

Event Contracts let two buyers mint a complete set with no seller. HOUSE lets a normal wallet be that book.

Quote both sides of a DreamDEX binary on Somnia Shannon: rest `BUY_YES` below mid and `BUY_NO` so the implied Up ask sits above mid. Opposite takers mint the pair. You keep the spread. No inventory to start.

Shannon prototype for the Somnia x DreamDEX Event Contracts hackathon.

## Run

Root `.env` needs `PRIVATE_KEY` (used only by the Node quoter). Do not commit it.

```bash
npm install
npm run dev
```

UI: [http://localhost:3000](http://localhost:3000). Connect a Shannon wallet, then Quote both sides once per window. Flatten sells leftover outcomes. Redeem settled pulls payouts after resolve.

Node quoter (same key, requotes about every 20s):

```bash
npm run quote
```

## Stack

- Next.js desk on port 3000 (indexer CORS is allowed for that origin)
- `@somnia-chain/markets-sdk` 0.29.0
- DreamDEX venue only. Prefer BTC 15m. Writes gated on on-chain status Trading.
- PostOnly. `expireTimestampNs` is required. `BUY_NO` prices are in YES terms.

No Solidity. No vault. One-shot wallet quotes, not a MetaMask requote loop.
