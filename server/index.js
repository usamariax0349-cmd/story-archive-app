import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const FORCED_MODEL = process.env.OPENROUTER_MODEL; // optional manual override

let cachedModel = null;
let cachedModelAt = 0;
const blockedModels = new Set();

// OpenRouter's free-model lineup changes over time, so instead of hardcoding
// one, ask OpenRouter which :free models exist right now and pick a strong one.
async function resolveModel() {
  if (FORCED_MODEL) return FORCED_MODEL;
  if (cachedModel && !blockedModels.has(cachedModel) && Date.now() - cachedModelAt < 10 * 60 * 1000) {
    return cachedModel;
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Could not list OpenRouter models (HTTP ${res.status})`);
  const data = await res.json();
  const all = data.data || [];

  const isFree = (m) => {
    const id = m.id || "";
    if (!id.endsWith(":free")) return false;
    const p = m.pricing || {};
    return Number(p.prompt || 0) === 0 && Number(p.completion || 0) === 0;
  };

  const freeIds = all.filter(isFree).map((m) => m.id).filter((id) => !blockedModels.has(id));

  // Prefer larger, more capable free models first; fall back down the list.
  const preferredPatterns = [
    /llama-3\.3-70b/i,
    /llama-4-maverick/i,
    /deepseek-r1/i,
    /qwen3-235b/i,
    /hermes-3.*405b/i,
    /llama-4-scout/i,
    /gemini.*flash/i,
    /llama-3\.1-70b/i,
    /gemma-3-27b/i,
    /llama-3\.1-8b/i,
  ];

  let chosen = null;
  for (const pattern of preferredPatterns) {
    chosen = freeIds.find((id) => pattern.test(id));
    if (chosen) break;
  }
  if (!chosen) chosen = freeIds[0];
  if (!chosen) throw new Error("No free OpenRouter models are currently available for this key.");

  cachedModel = chosen;
  cachedModelAt = Date.now();
  return chosen;
}

// The frontend calls this instead of talking to any AI provider directly.
// The real API key stays here, server-side, and is never sent to the browser.
app.post("/api/story", async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "Server is missing OPENROUTER_API_KEY. Set it in your environment variables.",
      });
    }

    const { system, messages } = req.body || {};

    const chatMessages = [
      { role: "system", content: system || "" },
      ...(Array.isArray(messages) ? messages : []).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
      })),
    ];

    let model;
    try {
      model = await resolveModel();
    } catch (e) {
      return res.status(500).json({ error: `Could not pick a free OpenRouter model: ${e.message}` });
    }

    const callOpenRouter = (modelId, msgs) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          // Optional but recommended by OpenRouter for attribution/rankings.
          "HTTP-Referer": "https://story-archive-app-production.up.railway.app",
          "X-Title": "Story Archive",
        },
        body: JSON.stringify({
          model: modelId,
          messages: msgs,
          max_tokens: 1600,
          temperature: 1,
        }),
      });

    let upstream = await callOpenRouter(model, chatMessages);
    let data = await upstream.json();

    // If this model got retired, renamed, or is unavailable, blacklist it and
    // try a fresh pick once rather than getting stuck on the same bad model.
    const isModelLevelProblem = /not found|does not exist|no longer available|not a valid model|no endpoints found/i.test(
      (data && data.error && data.error.message) || ""
    );
    if (!upstream.ok && !FORCED_MODEL && isModelLevelProblem) {
      blockedModels.add(model);
      if (cachedModel === model) cachedModel = null;
      try {
        model = await resolveModel();
        upstream = await callOpenRouter(model, chatMessages);
        data = await upstream.json();
      } catch (e) {
        // fall through to normal error handling below
      }
    }

    if (!upstream.ok) {
      const message = (data && data.error && data.error.message) || `Upstream HTTP ${upstream.status}`;
      return res.status(upstream.status).json({ error: message });
    }

    // The model can get cut off before finishing — before it reaches the
    // point where it's supposed to stop and hand control back with choices.
    // If that happens (finish_reason "length" and no <<STATE>> marker yet),
    // automatically ask it to keep going from where it left off, up to a
    // few times, instead of returning a dead-end reply.
    let fullText = (data?.choices?.[0]?.message?.content || "").trim();
    let finishReason = data?.choices?.[0]?.finish_reason;
    let runningMessages = chatMessages;
    let hops = 0;
    const MAX_CONTINUATION_HOPS = 3;

    while (finishReason === "length" && !fullText.includes("<<STATE>>") && hops < MAX_CONTINUATION_HOPS) {
      hops += 1;
      runningMessages = [
        ...runningMessages,
        { role: "assistant", content: fullText },
        {
          role: "user",
          content:
            "Continue directly from exactly where you left off, picking up mid-sentence if needed. Do not repeat anything you already wrote. Wrap up soon and remember to end with the <<STATE>> marker and its JSON as instructed.",
        },
      ];
      let contUpstream;
      let contData;
      try {
        contUpstream = await callOpenRouter(model, runningMessages);
        contData = await contUpstream.json();
      } catch (e) {
        break;
      }
      if (!contUpstream.ok) break;
      const piece = (contData?.choices?.[0]?.message?.content || "").trim();
      if (!piece) break;
      fullText = `${fullText}${piece}`;
      finishReason = contData?.choices?.[0]?.finish_reason;
    }

    if (!fullText) {
      return res.status(502).json({ error: "The model returned an empty response." });
    }

    res.json({ text: fullText });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error." });
  }
});

// Serve the built frontend (created by `npm run build`)
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Story Archive server listening on port ${PORT}`);
});
