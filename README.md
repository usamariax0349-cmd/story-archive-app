# Story Archive

A standalone version of the interactive story app — pick a story, play a
character, and for "Echoes of a Second Life," reincarnate as a monster with
levels, skills, traits, and a world that keeps moving without you.

This version runs outside Claude entirely, using a stack of free-tier AI
providers instead of Claude, since it needs its own way to talk to an AI
once it's not running inside Claude.ai anymore.

## 1. Get free API keys

You can set up to four providers. **At least one is required**; setting
more than one stacks their free daily limits together — the server tries
them in order (OpenRouter → Groq → Cerebras → Gemini) and only moves to
the next if the current one is unavailable or fails.

**OpenRouter** — <https://openrouter.ai/keys>. Free models are capped at
50 requests/day with $0 balance, or 1000/day if you ever add a one-time $10
credit (a balance top-up, not a subscription — you don't have to spend it).

**Groq** — <https://console.groq.com/keys>. No card required. Free tier is
roughly 1,000 requests/day on its strongest model, or up to 14,400/day on
a smaller, less capable one.

**Cerebras** — <https://cloud.cerebras.ai>. No card required. One of the
most generous free tiers available — roughly 14,400 requests/day and
1M tokens/day on capable open models like Llama 3.3 70B.

**Gemini** — <https://aistudio.google.com/apikey>. No card required. Free
tier is roughly 100-1,000 requests/day depending on the model.

## 2. Run it locally (optional, to try before deploying)

```bash
npm install
cp .env.example .env
# paste your key(s) into .env

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

If your repo has grown large (lots of art assets), GitHub's browser upload
can fail with a size error — use GitHub Desktop or the `git` CLI to push
instead, which doesn't have that limit.

## 4. Deploy to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Pick the repo you just pushed
3. Railway will detect Node automatically. It runs `npm install`, then
   `npm run build` (via the `build` script), then `npm start`
4. Go to your service's **Variables** tab and add whichever of
   `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`
   you have. Each provider's `*_MODEL` variable is optional — leave it
   unset and the server automatically picks a strong available model for
   that provider.
5. Once it deploys, Railway gives you a public URL — that's your app

## Notes

- **Saves are per-browser.** Progress is stored in that browser's
  `localStorage`, not on the server — clearing browser data clears saves.
- **Free tier limits.** See the numbers above — stacking providers raises
  your effective daily cap well beyond any single one's limit.
- **Swapping or adding providers.** All the AI-calling logic lives in
  `server/index.js`. To add a fourth provider, follow the same pattern as
  the existing three — the frontend just calls `POST /api/story` with
  `{ system, messages }` and expects `{ text }` back, so nothing else
  needs to change.
