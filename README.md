# Streakline

Let-it-ride parlays for DreamDEX Event Contracts. Pick a run of Up/Down calls
across consecutive windows; each winning leg's full payout rolls into the next.
One stake, compounding odds, on-chain positions in your own wallet.

Built on Somnia Shannon testnet for the Somnia x DreamDEX Event Contracts Hackathon.

## Layout

- `contracts/` — StreakVault + run lifecycle (Foundry)
- `keeper/`    — settlement watcher & roll executor (TypeScript, markets-sdk)
- `web/`       — run builder, live runs, leaderboard (Next.js)
- `shared/`    — venue config, market types, tick/lot math
