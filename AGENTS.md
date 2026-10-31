<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Prediction priors use the bundled completed 2025/26 FPL snapshot, keyed by stable player code and club abbreviation, so early-season projections remain reproducible and do not depend on fragile third-party requests.

- Keep projection math pure and covered by Vitest under src/lib/fpl; MODEL in config.ts owns tunable settings so changes are reviewable.
- Use additive optional projection fields; preserve existing public API types to avoid breaking older views.
- Fetch official Draft player histories through a six-slot cache-backed server helper; snapshot fallback uses only consecutive cumulative totals.
- Prediction tracking runs only behind managed cron authentication, records before kickoff without overwriting, and never fabricates backtests.
