# sites

Small static sites and games, one folder per site. Each folder is exactly what was live on 2026-11-25.

## Live sites

| Folder | Live on Cloudflare | Old Netlify URL |
|---|---|---|
| `ai-day-trader` | https://ai-day-trader.davidpayne2365.workers.dev | https://ai-day-trader.netlify.app |
| `berry-bunny-game` | https://berry-bunny-game.davidpayne2365.workers.dev | https://berry-bunny-game.netlify.app |
| `chimerical-moonbeam-5396a5` | https://chimerical-moonbeam-5396a5.davidpayne2365.workers.dev | https://chimerical-moonbeam-5396a5.netlify.app |
| `chipper-arithmetic-53bb0d` | https://chipper-arithmetic-53bb0d.davidpayne2365.workers.dev | https://chipper-arithmetic-53bb0d.netlify.app |
| `chord-practice-dp` | https://chord-practice-dp.davidpayne2365.workers.dev | https://chord-practice-dp.netlify.app |
| `contact-lens-substitutions` | https://contact-lens-substitutions.davidpayne2365.workers.dev | https://contact-lens-substitutions.netlify.app |
| `costco-warehouses` | https://costco-warehouses.davidpayne2365.workers.dev | https://costco-warehouses.netlify.app |
| `davidapp` | https://davidapp.davidpayne2365.workers.dev | https://davidapp.netlify.app |
| `garage-drinkbot-baf257` | https://garage-drinkbot-baf257.davidpayne2365.workers.dev | https://garage-drinkbot-baf257.netlify.app |
| `lens-3d-viewer` | https://lens-3d-viewer.davidpayne2365.workers.dev | https://lens-3d-viewer.netlify.app |
| `mental-math-trainer-dp` | https://mental-math-trainer-dp.davidpayne2365.workers.dev | https://mental-math-trainer-dp.netlify.app |
| `optical-dept-photos` | https://optical-dept-photos.davidpayne2365.workers.dev | https://optical-dept-photos.netlify.app |
| `personalmovieap` | https://personalmovieap.davidpayne2365.workers.dev | https://personalmovieap.netlify.app |
| `pocket-picnic-game` | https://pocket-picnic-game.davidpayne2365.workers.dev | https://pocket-picnic-game.netlify.app |
| `randomsnakegame` | https://randomsnakegame.davidpayne2365.workers.dev | https://randomsnakegame.netlify.app |
| `skyforge-labyrinth` | https://skyforge-labyrinth.davidpayne2365.workers.dev | https://skyforge-labyrinth.netlify.app |
| `skyforge-valley` | https://skyforge-valley.davidpayne2365.workers.dev | https://skyforge-valley.netlify.app |
| `skyforge-world` | https://skyforge-world.davidpayne2365.workers.dev | https://skyforge-world.netlify.app |
| `skylight-galleria` | https://skylight-galleria.davidpayne2365.workers.dev | https://skylight-galleria.netlify.app |
| `spectacular-rolypoly-ec92ae` | https://spectacular-rolypoly-ec92ae.davidpayne2365.workers.dev | https://spectacular-rolypoly-ec92ae.netlify.app |
| `strategy-arena-dp` | https://strategy-arena-dp.davidpayne2365.workers.dev | https://strategy-arena-dp.netlify.app |
| `tetrisforbria` | https://tetrisforbria.davidpayne2365.workers.dev | https://tetrisforbria.netlify.app |
| `wondrous-kheer-8b92d0` | https://wondrous-kheer-8b92d0.davidpayne2365.workers.dev | https://wondrous-kheer-8b92d0.netlify.app |

## Older projects (copied in from their own repos, not deployed)

Each folder was its own small GitHub repo. The old repos still exist and can be archived on GitHub.

| Folder | Was repo |
|---|---|
| `tetris` | `tetris` |
| `galaga` | `galaga` |
| `wages` | `wages` |
| `sleepapp` | `sleepapp` |
| `siblingsday` | `SiblingsDay` |
| `industrybar` | `IndustryBar` |
| `ncle` | `NCLE` |
| `ncle2` | `NCLE2` |
| `costco` | `costco` |
| `breakout` | `breakout` (the Netlify site `retro-breakout` still deploys from the old `breakout` repo) |

`faxapp` stays its own repo because it is a Next.js app with a backend.

## How they deploy

- Live host: Cloudflare Workers (account `davidpayne2365`). Each folder is uploaded as its own Worker named after the folder.
- `main` holds the source of truth, but pushing to `main` does **not** deploy automatically yet. Sites were uploaded by hand.
- The old Netlify copies still run until you decide to remove them.

## Not in this repo

- `netlify.toml` and `_headers` config files (Netlify does not serve them publicly).
- Serverless function source code (`pocket-picnic-game`, `berry-bunny-game`, `ai-day-trader` had functions).
- Sites that contain API keys live in the private repo `sites-private`.
- `skyforge-line` (367 MB) lives in its own private repo `skyforge-line`.
