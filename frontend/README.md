# CURB — Frontend (Next.js)

Curb Intelligence console for **Problem Statement 1 — Parking-Induced Congestion**.
App Router + TypeScript + Tailwind. Three tabs:

- **Map** (`/`) — hotspots on the map + the Priority Dispatch rail, filters by cause/persistence, search.
- **Overview** (`/overview`) — tiles, impact-coverage, hotspots-by-cause, persistence triage.
- **Assistant** (`/assistant`) — natural-language queries answered from the data; AI phrasing optional (server-side).

All data comes from `public/curb_priorities.json` (produced by the analysis repo). Nothing external is used for analysis.

## Prerequisites
- Node.js 18.17+ (you have v22 — good)

## Run it
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build / deploy
```bash
npm run build && npm start      # production build locally
```
Deploy to **Vercel** (easiest for Next.js): push to GitHub → import the repo on vercel.com → it builds automatically. The resulting URL is your submission "Demo Link".

## Environment (optional) — copy `.env.local.example` to `.env.local`
```
GEMINI_API_KEY=            # enables AI phrasing in the Assistant (stays server-side, never sent to the browser)
NEXT_PUBLIC_MAPPLS_KEY=    # switches the basemap to the Mappls (MapmyIndia) sponsor map
```
- **Without keys:** the app fully works — dev basemap + a deterministic Assistant.
- **With `NEXT_PUBLIC_MAPPLS_KEY`:** the sponsor map replaces the dev basemap (markers/UI unchanged — Mappls is Leaflet-based).
- **With `GEMINI_API_KEY`:** the Assistant's answers are phrased by Gemini. The model only rephrases rows already computed from the dataset (no external data, no retrieval) — matching the organizer-approved boundary. The key lives only on the server (in `app/api/assistant/route.ts`).

## Updating the data
Regenerate `curb_priorities.json` from the analysis repo (`python run.py` → prioritizer) and copy it into `public/`.

## Structure
```
app/
  layout.tsx            shared header/nav
  page.tsx              Map route (dynamic-imports MapView, client-only)
  overview/page.tsx
  assistant/page.tsx
  api/assistant/route.ts  server-side phrasing (LLM key never reaches the browser)
  globals.css           dark-console theme
components/  Header · MapView · Overview · Assistant
lib/         data.ts (types + loader) · theme.ts (cause colors, tiers)
public/      curb_priorities.json
```

## Notes
- The Map uses Leaflet imperatively and is dynamically imported with `ssr:false` (Leaflet needs `window`).
- `congestion_impact_index` is a normalised severity × footprint **index** (0–100), not a measured/predicted traffic change.
