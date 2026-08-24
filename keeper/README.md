# Streakline Keeper

Watches every run on the StreakVault and does the two things a contract cannot
do for itself: pick the next live window for a leg, and call settlement when a
window resolves.

## Trust model

The keeper is deliberately powerless. Everything economic is enforced by the
vault on-chain:

| Decision | Who controls it |
|---|---|
| Stake, legs, directions, series, price caps | User, at `createRun`, immutable |
| Venue and collateral of every traded market | Vault (`WrongVenue` check) |
| Worst execution price per leg | Vault (`PriceCapExceeded` check) |
| Order of legs, full-proceeds rolling | Vault state machine |
| Withdrawals | Run owner only (`cancelRun` between legs, `claim` after) |

The keeper chooses *which window* binds a leg and *when* to settle — timing,
not custody. A malicious keeper could at worst stall a run; it cannot redirect
funds, exceed a price cap, trade a different venue, or skip a leg.

## Loop

Every `POLL_MS` (default 5s), for each run:

- **Open** → parse the leg's declared series tag (`ETH:60`), find a live window
  for that asset/interval with enough runway, read the book, and submit
  `executeLeg` with an IOC price cap and a lot-snapped quantity.
- **PositionHeld** → once the window's market is resolved or voided on-chain,
  call `settleLeg` (which redeems via `BinarySettlement.finalizeAndRedeem` and
  either advances the run or ends it).

Every write is simulated first (`simulateContract`) — the SDK's raw sends do
not throw on revert, and a keeper must never spray failing transactions.

## Venue sharp edges handled here

- Pools enforce a book grid, discovered per-pool at runtime via
  `getOrderBookParameters()`: price snaps **up** to the tick (still a cap),
  quantity snaps **down** to the lot, `minQuantity` respected.
- A series' `intervalSec` drifts (a 900s series has shipped 898s windows) —
  intervals are bucket-matched, not compared exactly.
- Windows lock near expiry: legs are only bound with runway of at least
  `max(20s, 25% of the interval)`.

## Run

```bash
cp .env.example .env   # PRIVATE_KEY (keeper key), VAULT_ADDRESS
npm install
npm start
```
