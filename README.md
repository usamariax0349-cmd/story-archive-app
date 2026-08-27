# Story Archive

A standalone version of the interactive story app — pick a story, play a
character, and for "Echoes of a Second Life," reincarnate as a monster with
levels, skills, traits, and a world that keeps moving without you.

This version runs outside Claude entirely. It uses **Google's Gemini API
free tier** (no credit card required) instead of Claude, since it needs its
own way to talk to an AI once it's not running inside Claude.ai anymore.

## 1. Get a free API key

1. Go to <https://aistudio.google.com/apikey>
2. Sign in with a Google account and click "Create API key"
3. Copy the key — you won't be charged anything on the free tier

## 2. Run it locally (optional, to try before deploying)

```bash
npm install
cp .env.example .env
# paste your key into .env as GEMINI_API_KEY=...

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
   - `GEMINI_API_KEY` = the key from step 1
   - (optional) `GEMINI_MODEL` = `gemini-2.5-flash` (or another Gemini model)
5. Once it deploys, Railway gives you a public URL — that's your app

## Notes

- **Saves are per-browser.** Progress is stored in that browser's
  `localStorage`, not on the server — clearing browser data clears saves.
- **Free tier limits.** Gemini's free tier allows a limited number of
  requests per minute/day. Plenty for personal play; if you hit the limit
  you'll see an error and can just wait a bit.
- **Swapping providers.** All the AI-calling logic lives in
  `server/index.js`. To use a different provider (Groq, OpenAI, etc.),
  that's the only file that needs to change — the frontend just calls
  `POST /api/story` with `{ system, messages }` and expects `{ text }` back.
