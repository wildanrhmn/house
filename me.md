# Event Contracts Hackathon — Idea Brief

Written 2 Sep 2026. Submissions close **8 Sep**. We have about six days. That constraint is part of the strategy: one sharp verb, a working testnet prototype, a 2–3 minute demo that a judge understands in the first 20 seconds.

This is not a list of “AI trading dashboard” prompts. It is a map of the primitive, what is already crowded, and which ideas still have room.

---

## 1. What Event Contracts actually are

DreamDEX Event Contracts are **binary Up/Down markets on BTC and ETH**, over **15-minute and 1-hour windows**, settled in **USDso**. They are not Polymarket AMMs and not Kalshi sportsbooks. They are a **fully on-chain CLOB**.

If the settlement price finishes **at or above** the window’s opening price, Up pays **1 USDso** per contract. Below, Down pays 1. Losers pay 0. Max loss is the stake. No leverage, no liquidations, **zero maker/taker/settlement fees**.

You cannot create new events. The whole venue, today, is four rolling instruments:

| Asset | Window |
| --- | --- |
| BTC | 15m |
| BTC | 1h |
| ETH | 15m |
| ETH | 1h |

All innovation is **experience and composition** around those four. That is why parlays, AI agents, and “pretty terminals” all collide.

### The mechanics almost every clone ignores

These are the actual Lego bricks. A winning product should be *about* one of them, not a skin over “pick Up or Down.”

**Price is a probability.** Up is quoted in `(0, 1)`. Down is always `1 − Up`. One book, two sides.

**Mint-a-pair (the unique fill path).** Two opposite-side *buyers* can cross with **no seller**. The pool mints a fresh `1 Up + 1 Down` from their combined collateral. You can quote both sides with **zero inventory**. This is not how a normal CLOB works, and it is documented as one of four crossing paths.

**Complete sets.** `1 USDso ⇄ 1 Up + 1 Down` via `mintSet` / merge (burn). If `Up + Down ≠ 1` on the book, there is conversion arb.

**You can exit while the window is open.** Sell back at the live price. This is a tradable contract, not a locked bet — unless *we* lock it (which is what the parlay crowd did).

**Windows die and respawn.** The next window is already trading while the last one settles. Pools are **recycled**. Key state by `marketId` (or `pool + nonce`), never by pool address alone.

**Indexer lags. Chain does not.** Gate every write on on-chain status `Trading` (status `1`). `loadMarkets()` hides settled markets; winnings live on `listBinaryMarkets({ status: "Finalized" })`.

**Orders always expire.** `expireTimestampNs` is mandatory. `0` reverts. Use it as a dead-man’s switch.

**Unfilled remainder rests.** IOC if you mean to take. Resting is a product choice, not an accident.

**Voids refund 0.5 both sides.** If the multi-source oracle cannot agree in time, there is no winner.

**HTTP API is spot-only.** Event Contracts live in `@somnia-chain/markets-sdk` (≥ 0.28.0). Binary writes go through `placeBinaryOrder`, not spot `placeOrder`.

**Yield-based CLOB.** No trading fees. Makers are paid stablecoin yield for quoting near the mid / top of book. DreamDEX wants depth. A product that *creates* two-sided quotes is aligned with the sponsor.

**Somnia reactivity.** Contracts can subscribe to on-chain events and run a handler in the **same block**, with no keeper. This is how 15-minute settlement fires. Almost nobody in the hackathon is building a *product* on it.

**Operators / session keys.** Another key can place/cancel for you without withdrawing funds. On binary pools the selectors are not the spot ones, and `cancelOrderFor` is stricter than people assume (Rampart turned that into a whole project).

**Builder fees.** A frontend can charge a per-fill fee if the user approves the builder. That is the only native business model the protocol gives you.

### Stack we actually have to use

- Chain: Somnia Shannon testnet `50312` (mainnet `5031`)
- SDK: `@somnia-chain/markets-sdk` + `viem` (React hooks exist)
- Bot kit: [somnia-chain/dreamdex-bot-kit](https://github.com/somnia-chain/dreamdex-bot-kit) — includes **already-written** EC strategies: `ec-starter`, `ec-maker`, `ec-passive`, `ec-laddering-bot`, `ec-oracle-follow`, `ec-settlement`
- Starter: [ec-dreamdex-hackathon-template](https://github.com/IronicDeGawd/ec-dreamdex-hackathon-template) — mint → trade → redeem loop, explicitly “not a product”
- Docs: [docs.dreamdex.io/developers/event-contracts](https://docs.dreamdex.io/developers/event-contracts)
- App to not clone: [app.dreamdex.io/event-contracts](https://app.dreamdex.io/event-contracts)
- Oracle / settlement receipt: published per market, median of multiple sources
- Native extras in the same SDK: live BTC/ETH index (`watchPrice`), SomniaLend, reactivity, session txs

SDK floors that will waste a day if ignored: `< 0.23` cannot even `loadMarkets`; `< 0.28` float prices miss the tick grid on 18-decimal venues.

---

## 2. What is already done (do not rebuild)

DoraHacks currently shows few public BUIDLs, but GitHub is already noisy. These are the clusters. Building inside one of them is how you lose **Innovation (20%)** on sight.

### Crowded: parlays / streaks / let-it-ride vaults

This was our previous idea. It is the most copied mechanic in the field: lock a stake, roll winning payout into the next window, keeper or vault settles. It is a casino skin on four instruments. Skip it.

### Crowded: kitchen-sink “AI + terminal + swarms”

**DreamPulse** already claimed the entire buffet: pro CLOB terminal, Gemini copilot, no-code strategy studio, backtester, multi-agent swarms, copy-trading, settlement sweeper, BatchApprove, session keys. Even if half of it is vapor, judges will *see* that shape ten times.

### Crowded: AI oracle + copy-trading

**PredicTrader AI** — prices the binary from the underlying, flags stale quotes, 1-click copy the best wallets.

### Crowded: analytics / risk MCP

**LevelField** — structural information-asymmetry scoring, MCP server, on-chain ScoreRegistry. Serious, narrow, already submitted.

### Crowded: protocol-as-security-research

**Rampart** — a contract-owned resting order with **no cancel path**, so the pool itself refuses the funder. That is a finding, not a consumer app. It also burned the “firm quote / operator asymmetry” novelty.

### Crowded: “run a bot from the official kit”

The sponsor already shipped `ec-maker`, `ec-oracle-follow`, `ec-settlement`. A CLI that quotes both sides, or follows the on-chain EMA, is **homework**, not a product.

### Crowded: prettier DreamDEX

Two-tap Up/Down, live odds, portfolio. The official app exists. The starter template even lists this as the default idea.

### Still open

Anything that:

1. Is a **new verb** on the four instruments (quote both sides as a human, spread them, hedge spot with them, duel on them, spectate them as a match).
2. Makes a **unique Event Contract mechanic** the hero (mint-a-pair, complete-set conversion, pool recycling, void 0.5, reactivity).
3. Creates **volume or depth** DreamDEX does not already have, with a path to builder fees.
4. Can be demoed in one take, built in six days, and is not an LLM wrapper.

---

## 3. How judges will actually score us

| Criterion | Weight | What they mean in practice |
| --- | --- | --- |
| Technical implementation | 25% | Real SDK: `loadMarkets`, on-chain status gate, `watchOrderBook` / live hooks, `createOrder` with IOC vs rest, `mintSet`, redeem of **Finalized** markets, tick/lot snapping. Bonus: Solidity + reactivity. Penalty: REST API as if Event Contracts were spot. |
| Innovation | 20% | “Did they use the primitive, or wrap the app?” Mint-a-pair, spreads, reactivity, spot-hedge beat parlays and chatbots. |
| UX | 20% | One job. Empty/error/locked-window states. Not 14 tabs. |
| Ecosystem impact | 20% | New users **or** more fills **or** tighter books. Builder-fee path = “this can live after Sunday.” |
| Demo | 15% | Problem → mechanic → live tx → “what’s next.” 2–3 minutes. |

They asked for production-ready, not a proof of concept. Six days still means: **one loop that is real on Shannon**, not a slide that promises a platform.

---

## 4. The ideas

Each idea is a verb. Each says why it is not already taken, how it uses the SDK, what the demo is, and the risk.

---

### IDEA A — HOUSE (recommended)

**Verb: be the book, with zero inventory.**

A consumer app for the mint-a-pair mechanic. Deposit USDso. The app rests **both** an Up bid and a Down bid around the mid. When a taker buys Up from you and another taker buys Down from you, the pool **mints the pair**. You never needed Up or Down tokens. You keep the spread. You sit near the mid, so you are in line for yield-based maker rewards. Optional: when `Up_ask + Down_ask < 1`, mint a complete set and sell both (conversion arb). When `Up_bid + Down_bid > 1`, buy both and merge.

This is not `ec-maker` with a coat of paint. The kit is a Node process for people who already think in ticks. HOUSE is “I have 50 USDso and I want to be the house for this 15-minute window,” with a UI that shows:

- both quotes on the book
- inventory of Up and Down (should hover near zero if the two-sided machine is working)
- captured spread this window
- what happens if only one side fills (inventory risk, with a one-click flatten)
- auto-cancel + requote as the mid moves, with `expireTimestampNs` as a crash switch
- auto-skip when the window is about to lock

**Why it is novel.** The unique fill path is the product. Almost every other team is a *taker* of the book. DreamDEX’s actual bottleneck is empty books and wide spreads (DreamPulse even named this and then buried it under six other pillars). A product that *adds two-sided depth* scores ecosystem impact without being a clone.

**Why it is buildable in six days.** SDK already: `watchOrderBook`, `createOrder` (resting limits), `cancelOrder`, `mintSet`, live React hooks. One Next.js surface. One quoting engine. No custom vault, no parlay accounting, no LLM.

**Demo (90 seconds).** Empty-ish book → user deposits → two orders appear on both sides → we take against ourselves from a second wallet (or wait for a natural cross) → inventory stays ~0, USDso goes up by the spread → window locks, leftover cancelled, next window armed.

**Judging fit.** Technical 25% (real maker loop, gotchas handled). Innovation 20% (mint-a-pair as UX). Impact 20% (liquidity). UX 20% if we obsess over the flatten/risk panel.

**Risks.** Adverse selection: a fast taker hits the stale side when BTC jumps. Mitigate with tight `expireTimestampNs`, oracle-follow skew (`watchPrice` vs book), and a hard inventory cap. Do not pretend this is risk-free; **show** the inventory and the flatten button. That honesty is the UX.

**Name options:** HOUSE, MID, PAIR, TWO.

**This is the pick** unless you would rather swing at reactivity (Idea D) or a live-sports consumer hit (Idea B).

---

### IDEA B — THE WINDOW

**Verb: watch a 15-minute match, then tap a side.**

Treat each window as a sporting event, not an order book. Live BTC (or ETH) vs the window’s open. A game clock. A “score” that is just distance-from-open. A public **tape** of fills (“someone just lifted 200 Up at 0.71”). One primary action: take the ask on Up or Down. Streamer overlay (OBS-friendly widget) so a Somnia/crypto streamer can host the candle.

Not copy-trading. Not a parlay. The social object is the *window*, the way a football match is the object.

**Why it is novel.** DreamDEX’s own press even says they shipped an institutional CLOB and then a product whose only inputs are an asset, a clock, and a direction — and then they still present it as a trading screen. The consumer product is a **broadcast**. Myriad proved “embed the contract in the feed”; we embed it in the *clock*.

**Why judges might love it.** UX 20% and Impact 20% (new users who will never look at an order book). Builder fees on every tap. Demo is cinematic.

**Why it might lose.** Innovation looks weaker if the recording is “prettier DreamDEX.” We only win this if the **match metaphor is total**: no depth ladder on the home screen, no “limit/IOC” jargon, tape + clock + one stake field. Pro controls go behind a door.

**Build in six days.** Live price + live book via SDK watches, IOC takes, redeem of last window, a public fill feed, a `/overlay` route for OBS. Optional: Farcaster/Telegram “this candle” card.

**Pairing.** This can be the *front* of HOUSE (takers see a match; a “Be the House” tab quotes both sides). That combo is the strongest full product if we can keep the UI from becoming DreamPulse.

---

### IDEA C — SPREAD

**Verb: trade *when* and *which*, not just up or down.**

Parlays say “all of these must win.” A spread says something parlays cannot:

- **Calendar:** long BTC-1h Up, short BTC-15m Up — “it rips this hour, not this candle.”
- **Cross-asset:** long BTC-15m Up, short ETH-15m Up — “BTC leads ETH this window.”
- **Vol strip:** buy a small amount of *both* sides when the book is one-sided and cheap convexity exists (careful: this is just paying 1 USDso per pair plus friction; only interesting around mis-priced completes).

Atomic if we can; otherwise two IOC legs with a max slippage and an abort if leg 1 fills and leg 2 does not (then flatten).

**Why it is novel.** The parlay field is a graveyard. Spreads are how actual derivatives traders use two binaries. Four instruments suddenly become a *surface*.

**Risks.** Harder to explain in a demo. Leg risk. UX can feel like a terminal. Only pick this if you want originality-max among traders and you can design one screen: two clocks, one net thesis sentence, one size.

---

### IDEA D — RELAY (moonshot / highest innovation)

**Verb: the chain itself rolls or hedges you. No keeper.**

Subscribe a Solidity handler to BinaryPool fills and/or market resolution via the **Somnia reactivity precompile**. Examples:

- Window N resolves Up → handler places the user’s pre-signed bias on window N+1 **in the same block**.
- Your 15m Up fills → handler hedges on the live 1h book.
- Your quote is taken → handler requotes, on-chain.

This is the thing Somnia keeps advertising (agents, reactivity, no off-chain polling) and that Event Contract teams are mostly not shipping. Mirra did a reactive copy-trade cascade, but on a toy DEX, not BinaryPool. DreamPulse’s “autonomous” path is an off-chain Node process + session keys — the ordinary way.

**Why it is novel.** It uses the chain’s only unique superpower. Technical score ceiling is the highest in this document.

**Why it is dangerous in six days.** Reactivity subscriptions, gas paid by the subscriber, recursive-handler footguns, binary vs spot operator selectors, and “pool addresses recycle” all exist to ruin a Thursday. If we pick this, the **only** v1 is: *on Finalized, place one IOC on the successor market, with a hard cap.* Nothing else.

**Demo.** Show a settlement tx, then the synthetic reactive tx in the same block placing the next order. Explorer links. That clip wins Presentation if it works.

**Recommendation.** Ship HOUSE. If HOUSE is working by day 4, add a RELAY “auto-roll this bias” as a single Solidity module. Do not start here unless you specifically want to gamble the week on infrastructure.

---

### IDEA E — HEDGEKIT

**Verb: Event Contracts as cheap insurance on DreamDEX spot.**

Same venue, two products. User holds WETH or WBTC on the spot book (or just in wallet). They buy a small pack of **Down** event contracts for the next 15m/1h as a defined-risk crash ticket. One portfolio: spot PnL + binary PnL. “Protect this position until 16:00.”

**Why it is novel.** DreamDEX’s story is “spot, event contracts, later perps, one exchange.” Nobody is building the **combined** UX. A LinkedIn thread on the launch even asked how they think about MM and risk across those surfaces. Ecosystem impact is obvious: volume on both.

**Risks.** Spot REST + binary SDK in one app is two integrations. Insurance framing must not lie (a 15m Down does not hedge an overnight bag). Six-day scope: **one asset, one window, one “cover % of notional” slider**, live `watchPrice`, IOC buy of Down, a single PnL strip.

---

### IDEA F — CONVERSION

**Verb: never predict. Only trade 1 = Up + Down.**

A public conversion bot + dashboard. When the book allows risk-free (or near-risk-free) mint-and-sell or buy-and-merge, do it. Show the inequality live. This *tightens* every window it touches.

**Why it is novel as a *story*.** “The house that does not have a view.” Educational. Generates fills.

**Why it is weak alone.** Looks like a bot from the kit. Weak UX score unless it is a panel inside HOUSE. Treat as a **module**, not the submission.

---

### IDEA G — DUEL

**Verb: challenge a wallet to the same window.**

Two players, same market, opposite sides or same side with a side-pot. Each still trades real Event Contracts (self-custodial). An extra contract or even a simple escrow holds a duel stake paid to whoever’s Event Contract PnL is higher at resolve. Public challenge links.

**Why it is novel.** Social without copy-trading. PvP, not parlay. Very demoable (“I fade you on this candle”).

**Risks.** Extra contract + invite UX. If the duel escrow is sloppy, it becomes the product instead of Event Contracts. Keep the Event Contract trade as the main tx; the duel can even be off-chain score with on-chain fills as proof for a hackathon v1 (less pure, faster).

---

### IDEA H — TAPE

**Verb: a Bloomberg tape for binaries.**

Every fill is on-chain. A chronological social feed: size, side, implied probability, distance-to-open, one-tap fade. Wallet profiles with *realized* window PnL (from Finalized redemptions, not from indexer lag).

**Why it is novel.** Social prediction without a leaderboard-of-claimed-AI-agents. The feed *is* the order flow.

**Why it is weak alone.** Can look like analytics. Pair with THE WINDOW or DUEL.

---

### IDEA I — LEND-AND-QUOTE

**Verb: idle USDso earns; posted USDso quotes.**

SDK already wraps SomniaLend. Supply collateral, borrow working capital, quote Event Contracts. Too much risk surface for six days (liquidation of the *lend* position vs binary inventory). Mention only as a post-hackathon HOUSE extension.

---

### IDEA J — VERDICT

**Verb: make settlement a show.**

Live view of the oracle pipeline (sources, median, Up vs Down) as the window locks, then one-click redeem, then one-click next window. LevelField already owns “risk of the question.” We would own **the moment of truth**.

**Weak as a solo product** (the oracle explorer already exists). Strong as the closing scene of THE WINDOW or HOUSE.

---

## 5. Ideas that feel clever and are still traps

| Trap | Why it dies |
| --- | --- |
| Let-it-ride / streak / parlay vault | Already the default clone. Keeper + accounting hell. |
| Generic LLM agent that “decides Up or Down” | Unfalsifiable, crowded, demo-unreliable. |
| No-code strategy studio | DreamPulse’s second pillar. |
| Copy-trading leaders | PredicTrader, DreamPulse, Mirra-shaped. |
| MCP server for agents | LevelField. |
| New event types (sports, elections) | Venue cannot list them. |
| Firm / non-cancellable quotes | Rampart. |
| Settlement sweeper as the whole app | DreamPulse pillar 6; also a script. |
| Wrapping `ec-oracle-follow` | Sponsor sample. |
| “Platform with 6 pillars” | Judges smell overclaim. One verb. |

---

## 6. Recommendation

**Build HOUSE. Optionally skin the taker side as THE WINDOW.**

One sentence for the README and the video:

> Event Contracts let two buyers mint a complete set with no seller. HOUSE is the first product that lets a normal wallet *be that book* — quote both sides with no inventory, capture the spread, and keep the next window tight.

That sentence uses a primitive the docs themselves call out, solves DreamDEX’s empty-book problem, does not share a skeleton with parlays or AI terminals, and is shippable on Shannon this week.

### Six-day plan if we go HOUSE

1. **Day 1** — SDK exchange on Shannon, discover the four live markets, gate on on-chain status, render one window: clock, open price, live index, book.
2. **Day 2** — Resting two-sided quotes, cancel/replace, mandatory expiry, IOC flatten.
3. **Day 3** — Inventory + PnL panel, complete-set mint/merge when the inequality appears, skip-if-too-close-to-lock.
4. **Day 4** — Next-window arming (off-chain is fine), redeem Finalized, empty/locked/void states.
5. **Day 5** — Polish the one screen, second-wallet fill in the demo, SDK feedback notes (they asked for this).
6. **Day 6** — Record 2–3 min demo, deck optional, submit.

Do **not** start a vault. Do **not** add Gemini. Do **not** add copy-trade. If there is spare time: OBS overlay (WINDOW) or a one-function reactive requote (RELAY).

**Locked HOUSE v1 (from the live Shannon spike, 2 Sep 2026):** quote with `BUY_YES` + `BUY_NO` PostOnly (zero inventory, mint-a-pair). Do **not** copy `ec-maker` (that path mints a set and sells YES, which needs inventory). Filter `venueId = 0x6797…a28c` and prefer `intervalSec = 900`. Ignore the other live venue (`0x1a1e…`, 60s “Pricefeed test”). Discover typed fields via `listLiveBinaryMarkets`, but trade through `loadMarkets()` symbols like `BTC-0-02SEP26-0700-0ECF/tUSDC#YES`. Pin `@somnia-chain/markets-sdk@0.29.0`. Keep ≥ **2 STT** on the demo wallet — see §9.

### If you hate market-making

Pick **THE WINDOW** (consumer, adoption) or **SPREAD** (trader originality) or **HEDGEKIT** (ecosystem: spot + binary). Do not pick RELAY unless you want the whole week to be Solidity.

---

## 7. Sources (read these, not Twitter)

- [Event Contracts (dev)](https://docs.dreamdex.io/developers/event-contracts)
- [Gotchas](https://docs.dreamdex.io/developers/event-contracts/gotchas.md)
- [User-facing Event Contracts](https://docs.dreamdex.io/trading/event-contracts.md)
- [Settlement & voids](https://docs.dreamdex.io/trading/event-contracts/settlement-and-voids.md)
- [Operators & session keys](https://docs.dreamdex.io/trading/readme-1/operators.md)
- [Builder fees](https://docs.dreamdex.io/developers/http-api/builder-fees.md) — HTTP is spot; the *idea* of builder codes still matters for a frontend
- [markets-sdk on npm](https://www.npmjs.com/package/@somnia-chain/markets-sdk) — binary vs spot, watches, mint/redeem, reactivity pointer
- [dreamdex-bot-kit](https://github.com/somnia-chain/dreamdex-bot-kit) — especially `strategies/ec-*`
- [Hackathon starter](https://github.com/IronicDeGawd/ec-dreamdex-hackathon-template)
- [DoraHacks listing](https://dorahacks.io/hackathon/event-contracts/detail)
- Already in the water: [Rampart](https://github.com/edycutjong/rampart), [LevelField](https://github.com/Aji-Q/levelfield), [DreamPulse](https://github.com/zaikaman/DreamPulse), [PredicTrader AI](https://github.com/binasalama12/predictrader-ai)

---

## 8. Decision

**HOUSE is the product.** Do not reopen A–J unless HOUSE is blocked by something in §9 that we cannot fix with STT.

---

## 9. Feasibility lock — live Shannon spike (2 Sep 2026)

Goal: no mid-week surprise. I installed `@somnia-chain/markets-sdk@0.29.0`, talked to Shannon, and sent a real write. Probes live in `spike/` (gitignored). Key never printed. Demo wallet: `0x857b7EfE554D39Ac226F556b982e074AB10995a6`.

### Green — already proven

| Check | Result |
| --- | --- |
| RPC | `https://dream-rpc.somnia.network` and `https://api.infra.testnet.somnia.network` both return chainId **50312** |
| Indexer | `https://dev.smk.somnia.host/v1/graphql` healthy |
| Browser CORS | Indexer returns `Access-Control-Allow-Origin: http://localhost:3000` — Next.js on 3000 can read from the client |
| Collateral | **9608 tUSDC** (6 decimals) at `0x70a86D…d8E`. Faucet exists: `trader.faucet()` caps at 10,000 per call |
| SDK surface | `createOrder`, `cancelOrder`, `mintSet`, `burnSet`, `fetchOrderBook`, `watchOrderBook`, `trader.placeOrder` / `redeem` / `faucet` all present |
| Live markets | **14** binaries, **14** on-chain `status === 1` (Trading) |
| DreamDEX venue | **10** rows on `0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c` including BTC/ETH × 5m / 15m / 1h / 4h / 1d |
| BTC 15m book | Live two-sided book (e.g. bid 0.46 / ask 0.49) — we will not be quoting into a void |
| Tick/lot | testnet `tickSize = lotSize = minQuantity = 1000` (0.001 probability, 0.001 contracts) |
| Zero-inventory path | Official recipes: *“a resting Buy Up at p plus a Buy Down at 1−p is already a two-sided quote with zero inventory”* — this is HOUSE |
| Browser wallets | SDK accepts `walletClient` (wagmi/injected). Local `privateKey` path is what the demo bot will use |

### The only current write blocker: STT envelope

A `createOrder` got as far as `tUSDC.approve(pool, maxUint256)` and the node rejected it:

`realtime_sendRawTransaction` → **`insufficient balance`**

Not tUSDC (we have plenty). **Gas.** The SDK never estimates: every signed write uses a **fixed 10,000,000 gas × 60 gwei = 0.6 STT envelope**. Unused gas is refunded, but the mempool will not admit the tx unless the wallet holds the full envelope. Wallet STT is **0.1006**. Base fee on Shannon is **6 gwei**. Minimum envelope at base fee is still `10M × 6 gwei = 0.06 STT` per tx. Approve + place + cancel is three envelopes. **Do not lower gas below ~1M** — the SDK notes that even `approve` runs out of gas under a 1M limit on Somnia.

**Unblock:** put **≥ 2 STT** (better **5**) on `0x857b7EfE554D39Ac226F556b982e074AB10995a6`.

Faucets: [testnet.somnia.network](https://testnet.somnia.network/), [Google Cloud Shannon](https://cloud.google.com/application/web3/faucet/somnia/shannon), [Stakely](https://stakely.io/faucet/somnia-testnet-stt). Telegram faucet topic is also listed by the starter.

After that, the same `createOrder(..., { postOnly: true })` + `cancelOrder` is the two-minute proof that writes are done. Allowance is **per pool** (`maxUint256`, once per recycled pool address). Then quoting is just PostOnly place/cancel.

### Traps we will design around (not blockers)

1. **Two venues.** `0x1a1e…` is 60-second “Pricefeed test” windows. Filter it. Use DreamDEX `0x6797…`. If a bot-kit `VENUE_ID` constant goes stale, read `venueId` off a live row.
2. **`listLiveBinaryMarkets` has no outcome symbols.** It has `asset`, `intervalSec`, `marketId`, `poolAddress`. Trading symbols come from `loadMarkets()` (`…/tUSDC#YES` / `#NO`).
3. **Do not parse `question`.** Use `asset` + `intervalSec`.
4. **Self-quote spread.** Rest `BUY_YES` below mid and `BUY_NO` so implied Up ask is above mid (prices sum **&lt; 1**). Complementary prices that sum to 1 can hit the mint path against yourself; the venue also blocks self-match, but a 2–3 tick spread is the product.
5. **`PostOnlyWouldCross` throws.** Catch it and requote. It is not a crash.
6. **Indexer lags.** Gate on `getMarketOnchain(marketId).status === 1`. Skip windows with little time left (scale to `intervalSec`, not a fixed 300s — that would kill 5m markets).
7. **Pools recycle.** Key UI state by `marketId`. Re-approve a pool only if allowance is 0.
8. **`loadMarkets()` hides Finalized.** Redeem via `listBinaryMarkets({ status: "Finalized" })` + `trader.redeem`.
9. **Do not requote from the browser every few seconds.** Popup hell, and binary `cancelOrderFor` is hostile to session-key operators (Rampart). v1: Node quoting with the demo key, **or** the user signs two PostOnly orders once per window. Not an HFT loop in MetaMask.
10. **React hooks** need the `react` peer (Next.js has it). Spike failed the import only because the probe had no React — not a product issue.
11. **Yield-based CLOB** is a mainnet maker-incentive story. Do not demo “you earned yield” on testnet. Demo spread + inventory ≈ 0.
12. **Browser wallet gas.** Injected wallets may estimate ~21k/100k and revert on Somnia. If we add Connect Wallet, pass a high `gas` (SDK default 10M) on writes.

### Architecture that stays smooth

```
Next.js (reads: indexer + watches, CORS OK on :3000)
    └── one screen: clock, BTC vs open, book, two quotes, inventory, flatten

Node quoting process (demo PRIVATE_KEY)
    └── PostOnly BUY_YES + BUY_NO, expireTimestampNs, cancel/replace, on-chain status gate
```

No Solidity. No vault. No LLM. No operator/session-key MM. Optional later: user `walletClient` for a one-shot two-sided quote.

### What I will not start until STT is topped up

The first quoting loop. Reads, UI, and market discovery can start immediately. The first on-chain quote waits for ≥ 2 STT so approve + place + cancel all fit in the SDK envelope.
