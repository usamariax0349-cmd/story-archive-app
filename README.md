# Story Archive

A standalone version of the interactive story app — pick a story, play a
character, and for "Echoes of a Second Life," reincarnate as a monster with
levels, skills, traits, and a world that keeps moving without you.

This version runs outside Claude entirely. It uses **OpenRouter's free-tier
models** instead of Claude, since it needs its own way to talk to an AI once
it's not running inside Claude.ai anymore.

## 1. Get a free API key

1. Go to <https://openrouter.ai/keys>
2. Sign in and click "Create Key"
3. Copy the key — it starts with `sk-or-v1-...`

**Free tier limits:** with $0 added to your OpenRouter account, free models
(`:free` suffix) are capped at **50 requests/day, 20/minute**. If you ever
add a one-time $10 credit to your account (a balance top-up, not a
subscription — you don't have to spend it), that cap jumps to **1000 free
requests/day**.

## 2. Run it locally (optional, to try before deploying)

```bash
npm install
cp .env.example .env
# paste your key into .env as OPENROUTER_API_KEY=...

# terminal 1
npm run dev:server

# terminal 2
npm run dev:client
```

Open the URL Vite prints (usually `http://localhost:5173`).

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Story Archive app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 4. Deploy to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Pick the repo you just pushed
3. Railway will detect Node automatically. It runs `npm install`, then
   `npm run build` (via the `build` script), then `npm start`
4. Go to your service's **Variables** tab and add:
   - `OPENROUTER_API_KEY` = the key from step 1
   - `OPENROUTER_MODEL` is optional — leave it unset and the server will
     automatically ask OpenRouter which free models are currently available
     and pick a strong one (preferring larger models like Llama 3.3 70B or
     DeepSeek R1). Only set this if you want to force a specific model.
5. Once it deploys, Railway gives you a public URL — that's your app

## Notes

- **Saves are per-browser.** Progress is stored in that browser's
  `localStorage`, not on the server — clearing browser data clears saves.
- **Free tier limits.** See the rate limits above — 50 free requests/day
  is enough for a solid session but not unlimited daily play.
- **Swapping providers.** All the AI-calling logic lives in
  `server/index.js`. To use a different provider, that's the only file
  that needs to change — the frontend just calls `POST /api/story` with
  `{ system, messages }` and expects `{ text }` back.
