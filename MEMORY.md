# HOUSE memory (compaction)

Read this before continuing work. Do not reopen idea letters. HOUSE is the product.

## Product

HOUSE lets a wallet quote both sides of a DreamDEX Event Contract with zero inventory. Rest BUY_YES below mid and BUY_NO so the implied Up ask is above mid. Opposite takers mint a complete set. Do not copy ec-maker (that mints a set and sells YES).

One sentence: Event Contracts let two buyers mint a complete set with no seller. HOUSE is the first product that lets a normal wallet be that book.

## Rules from the user

- Comments only on lines that actually need them.
- Never use em-dashes (the long dash character). Use commas, colons, periods, or a hyphen.
- Commits must keep git author as Wildan Nur Rahman / wildannurrahman30@gmail.com. Do not set GIT_AUTHOR_NAME to Cursor or an AI. Do not change git config.
- Do not read .env values. PRIVATE_KEY lives at repo root .env.

## Proven on Shannon (2 Sep 2026)

- Chain 50312. RPC https://dream-rpc.somnia.network and https://api.infra.testnet.somnia.network.
- Indexer https://dev.smk.somnia.host/v1/graphql. CORS allows http://localhost:3000.
- WS wss://api.infra.testnet.somnia.network/ws.
- SDK @somnia-chain/markets-sdk 0.29.0.
- Demo wallet 0x857b7EfE554D39Ac226F556b982e074AB10995a6.
- tUSDC 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E, 6 decimals, wallet had ~9608.
- trader.faucet() mints up to 10000 tUSDC per call.
- STT after faucet ~1.10. SDK write envelope is 10M gas times 60 gwei = 0.6 STT reserved. Unused gas refunds. Actual approve+place+cancel burned ~0.005 STT. 1 STT is enough to develop. Do not lower gas below ~1M (approve OOG under 1M).
- Live write: PostOnly BUY 0.05 on BTC 15m YES, order id 147573952589676494756, tx 0xe3e94725a488550c9a585d546a83f07914adb6ae0eef37e931c07969cad9938b, then cancel success.
- Tick/lot/minQuantity on testnet = 1000 (0.001).

## Venue filter

- Use DreamDEX venue 0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c.
- Ignore venue 0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f (60s Pricefeed test).
- Prefer intervalSec 900 (15m). Also live: 300, 3600, 14400, 86400.
- listLiveBinaryMarkets has asset, intervalSec, marketId, poolAddress, venueId. No outcome symbols.
- Trading symbols come from loadMarkets(), example BTC-0-02SEP26-0700-0ECF/tUSDC#YES and #NO.
- Gate writes on getMarketOnchain(marketId).status === 1. Key UI by marketId. Pools recycle.
- Do not parse question text. Use asset + intervalSec.
- Redeem via listBinaryMarkets({ status: "Finalized" }) + trader.redeem. loadMarkets() hides settled.
- Price feed: SOMNIA_TESTNET_PRICE_FEED, watchPrice("BTC").

## Quoting math

- Prices are Up probabilities in (0,1). Down is 1 minus Up.
- BUY_YES at fair - halfSpread. BUY_NO price in YES terms is fair + halfSpread (pay 1 - that for Down).
- Keep bid + downCost < 1 so we do not mint against ourselves. 2 to 3 ticks of spread.
- PostOnly. Catch PostOnlyWouldCross and requote.
- expireTimestampNs is mandatory nanoseconds, 0 reverts, cap at market expiry.
- Unified createOrder(symbol, "limit", "buy", size, price, { postOnly: true }) works on YES. Raw trader.placeOrder with side BUY_YES / BUY_NO is the explicit path.
- probabilityToPrice / fromHuman for raw units. exchange.priceToPrecision for grid snap. SDK >= 0.28.0 snaps floats on unified verbs.
- Skip windows about to lock. Scale headroom to intervalSec, not a fixed 300s.

## Architecture

```
Next.js on :3000 (reads: indexer + watches)
  one screen: clock, BTC vs open, book, two quotes, inventory, flatten
Node quote process (PRIVATE_KEY)
  PostOnly BUY_YES + BUY_NO, expireTimestampNs, cancel/replace, on-chain status
```

## Files

- `web/`: Next.js desk on :3000
- `quote/src/index.ts`: Node PostOnly loop (loads PRIVATE_KEY from root `.env`, never prints it)
- `web/src/lib/{config,exchange,discover,quoting,house}.ts`: shared venue, math, writes
- `MEMORY.md`: this file

## Browser gotchas found while building

- Import `injected` from `wagmi`, never `wagmi/connectors` (that barrel pulls Coinbase x402 and Next 500s).
- Do not call `loadMarkets()` to arm the desk. Perp factory discovery hangs the UI.
- Arm from `listLiveBinaryMarkets` (indexer). Gate writes on `getMarketOnchain` inside `planQuotes`.
- Opening oracle `numericValue` is 2dp. Divide by 100.
- `intervalSec` filter is a band. Do not exact-match 900.

## Design

Night pit / odds board, not a generic CLOB dashboard.
- ink #16132a, tape #efe6d6, copper Up #c9843a, steel Down #3d6a86, chalk #f3eadc, ember clock #e8a060
- Display: Syne. Data: IBM Plex Mono.
- Signature: two-pan quote beam that tilts with Up vs Down inventory.

## Out of scope

Parlays, streaks, Gemini, copy-trade, MCP, RELAY reactivity, yield claims on testnet.

## Hackathon

Somnia x DreamDEX Event Contracts. Submit by 8 Sep 2026. Working Shannon prototype, GitHub, 2-3 min video, optional SDK feedback. Prize 5000 USDso.
