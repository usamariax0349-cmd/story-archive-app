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

// Groq periodically retires/renames models, so instead of hardcoding one,
// ask Groq which models this key can currently use and pick a sensible one.
async function resolveModel() {
  if (FORCED_MODEL) return FORCED_MODEL;
  if (cachedModel && Date.now() - cachedModelAt < 10 * 60 * 1000) return cachedModel;

  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Could not list Groq models (HTTP ${res.status})`);
  const data = await res.json();
  const ids = (data.data || []).map((m) => m.id);

  // Skip anything that isn't a general text chat model.
  const isChatty = (id) =>
    !/whisper|guard|vision|tool-use|tts|embed/i.test(id);

  const preferredPatterns = [/70b.*versatile/i, /70b/i, /8b-instant/i, /instant/i];
  let chosen = null;
  for (const pattern of preferredPatterns) {
    chosen = ids.find((id) => isChatty(id) && pattern.test(id));
    if (chosen) break;
  }
  if (!chosen) chosen = ids.find(isChatty) || ids[0];
  if (!chosen) throw new Error("No usable Groq models were returned for this key.");

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
          max_tokens: 700,
          temperature: 1,
        }),
      });

    let upstream = await callGroq(model);
    let data = await upstream.json();

    // If the cached/forced model just got retired mid-session, refresh once and retry.
    if (!upstream.ok && /does not exist|decommissioned|not found/i.test(data?.error?.message || "")) {
      cachedModel = null;
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
