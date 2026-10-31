# FPL Analyzer

A web app for Fantasy Premier League managers that turns live FPL data into point projections, transfer guidance, and league-wide charts.

**Live demo:** [Coming Soon!]

[FPL Analyzer screenshot]
<img width="1350" height="679" alt="image" src="https://github.com/user-attachments/assets/e8dd69ef-db0c-461d-87cc-4d881089d3b9" />


## Features

- **League-wide charts** with three views: points per gameweek, record, and total points

<img width="1106" height="434" alt="image" src="https://github.com/user-attachments/assets/6cf69395-1311-4a95-9878-f1ef14640cf1" />
<img width="1107" height="404" alt="image" src="https://github.com/user-attachments/assets/2a846d3e-3e24-485a-ba66-186005a95f9f" />
<img width="1096" height="397" alt="image" src="https://github.com/user-attachments/assets/5fba50f7-6ffc-4cc1-8ee5-0798abf5c4e2" />

- **Point projections** that factor in club strength and 2025/26 season evidence

<img width="1103" height="561" alt="image" src="https://github.com/user-attachments/assets/8f156a98-20ca-4d2a-9ab9-413611930ad9" />

- **Transfer-out guidance** that protects established players from aggressive early-season drop advice and shows a caution marker where relevant

<img width="1147" height="408" alt="image" src="https://github.com/user-attachments/assets/b4eea89a-609d-46fa-b61c-38227c241949" />

- **Responsive UI** checked on desktop and mobile



## Tech Stack

| Area | Tools |
|---|---|
| Language | TypeScript |
| Framework | React 19, TanStack Start, TanStack Router, TanStack Query |
| Styling & UI | Tailwind CSS v4, shadcn/ui (Radix UI), Recharts |
| Backend / Data | Supabase, FPL public REST API |
| Forms & validation | React Hook Form, Zod |
| Tooling | Vite, ESLint, Prettier, Bun |

## How It Works

Projection priors come from a bundled snapshot of the completed 2025/26 FPL season, keyed by stable player code and club abbreviation. This keeps early-season projections reproducible and avoids depending on fragile third-party requests. Live gameweek data comes from the official Draft FPL API. No Reddit or scraping is used.

### Model v2
- Relevant squad players and the top 150 free agents by minutes use six-hour cached player history, fetched with at most six concurrent requests. Missing/incomplete history falls back to consecutive daily cumulative snapshots, then season data. First snapshots and nonconsecutive gaps are never treated as one gameweek.
- Recent six-gameweek evidence decays by `0.85^age`. Playing-time probabilities shrink toward three season games; goals and assists retain positional and completed-2025/26 priors. Prior injury inference and ten-gameweek new-arrival protection remain in place.
- Per-fixture scoring includes penalty-taker floors, exact Poisson goals-conceded expectation (closed form including the tail), clean sheets, saves, yellow/red cards, bonus and defensive contributions. PPG blend is 10%. Return news maps to gameweek deadlines with a staged availability ramp.
- Independent scoring components produce variance and team SD, with a shared-availability adjustment for double gameweeks. Correlated club outcomes are not modeled, so win chances and confidence are approximations, not calibrated guarantees.
- Now value covers three gameweeks; hold value covers up to ten published fixture gameweeks, discounted by `0.92^k`. Exact legal-formation enumeration picks the best XI. Bench value is weighted by positional auto-sub triggers and 0.5; this is an approximation of full FPL automatic substitutions.
- Same-position swaps compare full squad value, not raw player totals, and require positional gain thresholds plus at least 55% modeled confidence. VORP uses the second-best free agent by discounted hold value. Hold verdicts, buy-low/sell-high evidence, contested-target priority and mutually positive trade ideas use the same value layer. Trade suggestions do not guarantee acceptance.
- Forward-only accuracy logs predictions before the first kickoff when a gameweek is first observed current. Daily tracking scores finished gameweeks from official player histories; the `/model` page reports MAE, bias, positional minutes calibration and last-five/PPG baseline errors. Missed kickoff windows are deliberately not backfilled. Daily observation may miss a pre-kickoff window.
- Model constants are documented in `src/lib/fpl/config.ts`; run `bunx vitest run src/lib/fpl/*.test.ts` for unit tests.

### Scheduled tracking
A single managed daily callback at 06:00 UTC captures cumulative snapshots, logs eligible pre-kickoff projections and scores finished gameweeks. Low-frequency managed callbacks may fire within about 30 seconds of the minute. Scheduled HTTP delivery requires a published app; ongoing collection and future accuracy results begin only once delivery is available.

## Getting Started

**Prerequisites:** Node.js 20+ (or Bun) and a Supabase project.

```bash
git clone https://github.com/daninR2/fpl_analyzer_v1.git
cd fpl_analyzer_v1
npm install        # or: bun install
cp .env.example .env
# fill in your Supabase values in .env
npm run dev
```

The app runs at the local URL Vite prints (usually `http://localhost:5173`).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## Project Structure

```
src/
  components/     UI components
  hooks/          Custom React hooks
  integrations/   Supabase client and types
  lib/            Shared utilities
  routes/         File-based routes (TanStack Router)
supabase/         Supabase config and migrations
roadmap.md        Completed and planned work
```

## Roadmap

See [roadmap.md](./roadmap.md).

## About

Built by [Daniyal Naqvi](https://github.com/daninR2), a Computer Science student at Wilfrid Laurier University. The app was developed with AI-assisted tooling ([Lovable](https://lovable.dev)) and is connected to this repository.

Not affiliated with or endorsed by the Premier League or Fantasy Premier League.
