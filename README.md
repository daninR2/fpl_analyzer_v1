# FPL Analyzer

A web app for Fantasy Premier League managers that turns live FPL data into point projections, transfer guidance, and league-wide charts.

**Live demo:** [ADD YOUR DEPLOYED URL HERE]

![FPL Analyzer screenshot]
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

Projection priors come from a bundled snapshot of the completed 2025/26 FPL season, keyed by stable player code and club abbreviation. This keeps early-season projections reproducible and avoids depending on fragile third-party requests. Live gameweek data comes from the public FPL API.

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
