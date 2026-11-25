# sites

Backups of small static sites and games that were uploaded to Netlify by hand and had no GitHub copy.
One folder per site. Each folder is exactly what was live on Netlify on 2026-11-25.

## Live sites in this repo

| Folder | Live URL (Netlify) |
|---|---|
| `ai-day-trader` | https://ai-day-trader.netlify.app |
| `berry-bunny-game` | https://berry-bunny-game.netlify.app |
| `chimerical-moonbeam-5396a5` | https://chimerical-moonbeam-5396a5.netlify.app |
| `chipper-arithmetic-53bb0d` | https://chipper-arithmetic-53bb0d.netlify.app |
| `chord-practice-dp` | https://chord-practice-dp.netlify.app |
| `contact-lens-substitutions` | https://contact-lens-substitutions.netlify.app |
| `costco-warehouses` | https://costco-warehouses.netlify.app |
| `davidapp` | https://davidapp.netlify.app |
| `garage-drinkbot-baf257` | https://garage-drinkbot-baf257.netlify.app |
| `lens-3d-viewer` | https://lens-3d-viewer.netlify.app |
| `mental-math-trainer-dp` | https://mental-math-trainer-dp.netlify.app |
| `optical-dept-photos` | https://optical-dept-photos.netlify.app |
| `personalmovieap` | https://personalmovieap.netlify.app |
| `pocket-picnic-game` | https://pocket-picnic-game.netlify.app |
| `randomsnakegame` | https://randomsnakegame.netlify.app |
| `skyforge-labyrinth` | https://skyforge-labyrinth.netlify.app |
| `skyforge-valley` | https://skyforge-valley.netlify.app |
| `skyforge-world` | https://skyforge-world.netlify.app |
| `skylight-galleria` | https://skylight-galleria.netlify.app |
| `spectacular-rolypoly-ec92ae` | https://spectacular-rolypoly-ec92ae.netlify.app |
| `strategy-arena-dp` | https://strategy-arena-dp.netlify.app |
| `tetrisforbria` | https://tetrisforbria.netlify.app |
| `wondrous-kheer-8b92d0` | https://wondrous-kheer-8b92d0.netlify.app |

## How they deploy

- None of these deploy from this repo yet. They were uploaded to Netlify by hand.
- Nothing here is live from `main` yet. Moving them to Cloudflare and wiring up `main` comes later.

## Not backed up here

- `netlify.toml` and `_headers` config files. Netlify does not serve them publicly.
- Serverless function source code (`magic-storybook`, `note-helper-dp`, `pocket-picnic-game`, `lens-power-chart`, `berry-bunny-game`, `ai-day-trader` had functions).
- Sites held back for a secrets check or because they are too big. Those are tracked outside this repo for now.
