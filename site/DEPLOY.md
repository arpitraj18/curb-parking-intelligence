# CURB — Deploy guide (live site + working GenAI assistant)

The site is plain static HTML/CSS/JS plus **one serverless function** (`api/assistant.js`)
that powers the live AI. Everything works the moment it's hosted; the assistant upgrades
from offline phrasing to live Gemini phrasing as soon as you add an API key.

---

## What works where

| | Open `index.html` locally | Hosted (Vercel/Netlify) |
|---|---|---|
| All pages, map, charts, tables | ✅ real data | ✅ real data |
| Filters, search, map selection | ✅ | ✅ |
| Assistant (offline phrasing) | ✅ | ✅ |
| Assistant (live Gemini) | ❌ (no server) | ✅ once `GEMINI_API_KEY` is set |

The assistant always falls back to the offline, data-grounded phrasing if the key is
missing or the model call fails — it never shows an error to the judges.

---

## Deploy on Vercel (recommended, ~3 minutes)

**Option A — CLI**
1. Install once: `npm i -g vercel`
2. From this folder: `vercel` (accept defaults; framework = "Other").
3. Add the key: `vercel env add GEMINI_API_KEY` → paste your key → choose *Production*.
4. Ship it: `vercel --prod`.

**Option B — Dashboard**
1. Push this folder to a GitHub repo, then "New Project" on vercel.com and import it.
2. Framework preset: **Other**. Build command: *(leave empty)*. Output dir: *(leave empty)*.
3. Project → **Settings → Environment Variables** → add `GEMINI_API_KEY` = your key.
4. **Deploy** (or redeploy so the new env var takes effect).

Vercel serves the static files from the root and turns `api/assistant.js` into the
`/api/assistant` endpoint automatically. No config file needed.

### Get the API key
Google AI Studio → https://aistudio.google.com/app/apikey → "Create API key".
The model used (`gemini-2.5-flash`) is on the free tier — fine for a demo.

---

## Deploy on Netlify (alternative)
Netlify serves functions at a different path, so two small steps:
1. Move `api/assistant.js` → `netlify/functions/assistant.js` (keep `_hotspots.json` beside it).
2. Add a `netlify.toml` with a redirect so the front-end's `api/assistant` call still works:
   ```toml
   [build]
     publish = "."
     functions = "netlify/functions"
   [[redirects]]
     from = "/api/assistant"
     to = "/.netlify/functions/assistant"
     status = 200
   ```
3. Set `GEMINI_API_KEY` under Site settings → Environment variables.

---

## How the assistant stays compliant
The function sends the model **only** the pre-computed hotspot rows (from the provided
dataset) and instructs it to answer using nothing else — no outside data, no browsing.
It's a phrasing/reasoning layer over your data, which matches the organizer's written
approval. Keep a screenshot of that approval in `docs/` in your submission repo.

## Test the endpoint directly
After deploy: `https://YOUR-SITE/api/assistant` — POST `{"question":"top delivery hotspots"}`,
or open `https://YOUR-SITE/api/assistant?q=worst%205%20spots` in a browser.
A healthy response has `"source":"gemini"`.
