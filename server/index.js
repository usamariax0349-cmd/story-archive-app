import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FORCED_MODEL = process.env.GROQ_MODEL; // optional manual override

let cachedModel = null;
let cachedModelAt = 0;
const blockedModels = new Set();

// Groq periodically retires/renames models (and lists non-text models like
// TTS/audio alongside chat models), so instead of hardcoding one, ask Groq
// which models this key can currently use and pick a sensible text-chat one.
async function resolveModel() {
  if (FORCED_MODEL) return FORCED_MODEL;
  if (cachedModel && !blockedModels.has(cachedModel) && Date.now() - cachedModelAt < 10 * 60 * 1000) {
    return cachedModel;
  }

  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Could not list Groq models (HTTP ${res.status})`);
  const data = await res.json();
  const ids = (data.data || []).map((m) => m.id).filter((id) => !blockedModels.has(id));

  // Exclude anything that isn't a general-purpose text chat model: audio/TTS,
  // vision, moderation, tool-use-only, and embedding models all show up in
  // this same list alongside the chat models we actually want.
  const isChatty = (id) =>
    !/whisper|guard|vision|tool-use|tts|embed|orpheus|canopy|playai|speech|moderation/i.test(id);

  // Prefer well-known general chat model families when possible.
  const preferredPatterns = [
    /llama.*70b.*versatile/i,
    /llama.*70b/i,
    /gpt-oss/i,
    /qwen/i,
    /deepseek/i,
    /kimi|moonshot/i,
    /gemma/i,
    /llama.*8b-instant/i,
    /mixtral/i,
  ];
  let chosen = null;
  for (const pattern of preferredPatterns) {
    chosen = ids.find((id) => isChatty(id) && pattern.test(id));
    if (chosen) break;
  }
  if (!chosen) chosen = ids.find(isChatty) || ids[0];
  if (!chosen) throw new Error("No usable Groq chat models were returned for this key.");

  cachedModel = chosen;
  cachedModelAt = Date.now();
  return chosen;
}

// The frontend calls this instead of talking to any AI provider directly.
// The real API key stays here, server-side, and is never sent to the browser.
app.post("/api/story", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GROQ_API_KEY. Set it in your environment variables.",
      });
    }

    const { system, messages } = req.body || {};

    // Groq's API is OpenAI-compatible: one flat messages array, system role included.
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
      return res.status(500).json({ error: `Could not pick a Groq model: ${e.message}` });
    }

    const callGroq = (modelId) =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: chatMessages,
          max_tokens: 1000,
          temperature: 1,
        }),
      });

    let upstream = await callGroq(model);
    let data = await upstream.json();

    // If this model can't actually be used at all (retired, needs terms
    // acceptance, no access, etc.), blacklist it and try a fresh pick once.
    // Don't blacklist for transient issues like rate limits.
    const isModelLevelProblem = /does not exist|decommissioned|not found|terms acceptance|requires terms|not supported|no access/i.test(
      data?.error?.message || ""
    );
    if (!upstream.ok && !FORCED_MODEL && isModelLevelProblem) {
      blockedModels.add(model);
      if (cachedModel === model) cachedModel = null;
      try {
        model = await resolveModel();
        upstream = await callGroq(model);
        data = await upstream.json();
      } catch (e) {
        // fall through to normal error handling below
      }
    }

    if (!upstream.ok) {
      const message = (data && data.error && data.error.message) || `Upstream HTTP ${upstream.status}`;
      return res.status(upstream.status).json({ error: message });
    }

    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";

    if (!text.trim()) {
      return res.status(502).json({ error: "The model returned an empty response." });
    }

    res.json({ text: text.trim() });
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
