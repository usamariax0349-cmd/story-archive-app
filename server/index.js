import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Three free-tier providers stacked as fallbacks, tried in this order.
// Each provider is only skipped if its key isn't set; otherwise its own
// failure (rate limit, bad model, etc.) falls through to the next one.
// All three happen to speak the same OpenAI-style chat completions format,
// so one shared caller works for all of them.

async function callOpenAICompatible(baseURL, apiKey, model, messages, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(baseURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1600,
        temperature: 1,
      }),
    });
  } catch (networkErr) {
    return { ok: false, error: `Network error reaching ${baseURL}: ${networkErr.message}` };
  }
  let data;
  try {
    data = await res.json();
  } catch (_) {
    return { ok: false, status: res.status, error: `Invalid response (HTTP ${res.status})` };
  }
  if (!res.ok) {
    const raw = data && data.error;
    const message = (raw && (raw.message || raw)) || `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: typeof message === "string" ? message : JSON.stringify(message) };
  }
  const text = (data?.choices?.[0]?.message?.content || "").trim();
  const finishReason = data?.choices?.[0]?.finish_reason;
  return { ok: true, text, finishReason };
}

// Shared continuation loop: if a reply gets cut off (finish_reason "length")
// before reaching the <<STATE>> marker, ask the same provider/model to keep
// going from exactly where it left off, up to a few times.
async function generateWithContinuation(baseURL, apiKey, model, initialMessages, extraHeaders) {
  let fullText = "";
  let messages = initialMessages;
  let hops = 0;
  const MAX_HOPS = 3;
  while (true) {
    const result = await callOpenAICompatible(baseURL, apiKey, model, messages, extraHeaders);
    if (!result.ok) return result;
    fullText += result.text;
    if (result.finishReason !== "length" || fullText.includes("<<STATE>>") || hops >= MAX_HOPS) {
      return { ok: true, text: fullText };
    }
    hops += 1;
    messages = [
      ...messages,
      { role: "assistant", content: result.text },
      {
        role: "user",
        content:
          "Continue directly from exactly where you left off, picking up mid-sentence if needed. Do not repeat anything you already wrote. Wrap up soon and remember to end with the <<STATE>> marker and its JSON as instructed.",
      },
    ];
  }
}

// ---- OpenRouter (tier 1) ----
let cachedOpenRouterModel = null;
let cachedOpenRouterModelAt = 0;
const blockedOpenRouterModels = new Set();

async function resolveOpenRouterModel() {
  if (process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL;
  if (
    cachedOpenRouterModel &&
    !blockedOpenRouterModels.has(cachedOpenRouterModel) &&
    Date.now() - cachedOpenRouterModelAt < 10 * 60 * 1000
  ) {
    return cachedOpenRouterModel;
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
  const freeIds = all.filter(isFree).map((m) => m.id).filter((id) => !blockedOpenRouterModels.has(id));
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
  cachedOpenRouterModel = chosen;
  cachedOpenRouterModelAt = Date.now();
  return chosen;
}

async function tryOpenRouter(chatMessages) {
  if (!OPENROUTER_API_KEY) return { ok: false, unavailable: true };
  let model;
  try {
    model = await resolveOpenRouterModel();
  } catch (e) {
    return { ok: false, error: `OpenRouter: ${e.message}` };
  }
  const headers = {
    "HTTP-Referer": "https://story-archive-app-production.up.railway.app",
    "X-Title": "Story Archive",
  };
  let result = await generateWithContinuation(
    "https://openrouter.ai/api/v1/chat/completions",
    OPENROUTER_API_KEY,
    model,
    chatMessages,
    headers
  );
  if (
    !result.ok &&
    !process.env.OPENROUTER_MODEL &&
    /not found|does not exist|no longer available|not a valid model|no endpoints found/i.test(result.error || "")
  ) {
    blockedOpenRouterModels.add(model);
    if (cachedOpenRouterModel === model) cachedOpenRouterModel = null;
    try {
      model = await resolveOpenRouterModel();
      result = await generateWithContinuation(
        "https://openrouter.ai/api/v1/chat/completions",
        OPENROUTER_API_KEY,
        model,
        chatMessages,
        headers
      );
    } catch (_) {
      // fall through with the original result/error
    }
  }
  if (!result.ok) result.error = `OpenRouter: ${result.error}`;
  return result;
}

// ---- Groq (tier 2) ----
let cachedGroqModel = null;
let cachedGroqModelAt = 0;
const blockedGroqModels = new Set();

async function resolveGroqModel() {
  if (process.env.GROQ_MODEL) return process.env.GROQ_MODEL;
  if (cachedGroqModel && !blockedGroqModels.has(cachedGroqModel) && Date.now() - cachedGroqModelAt < 10 * 60 * 1000) {
    return cachedGroqModel;
  }
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Could not list Groq models (HTTP ${res.status})`);
  const data = await res.json();
  const ids = (data.data || []).map((m) => m.id).filter((id) => !blockedGroqModels.has(id));
  const isChatty = (id) => !/whisper|guard|vision|tool-use|tts|embed|orpheus|canopy|playai|speech|moderation/i.test(id);
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
  cachedGroqModel = chosen;
  cachedGroqModelAt = Date.now();
  return chosen;
}

async function tryGroq(chatMessages) {
  if (!GROQ_API_KEY) return { ok: false, unavailable: true };
  let model;
  try {
    model = await resolveGroqModel();
  } catch (e) {
    return { ok: false, error: `Groq: ${e.message}` };
  }
  let result = await generateWithContinuation(
    "https://api.groq.com/openai/v1/chat/completions",
    GROQ_API_KEY,
    model,
    chatMessages,
    {}
  );
  if (
    !result.ok &&
    !process.env.GROQ_MODEL &&
    /does not exist|decommissioned|not found|terms acceptance|requires terms|not supported|no access/i.test(result.error || "")
  ) {
    blockedGroqModels.add(model);
    if (cachedGroqModel === model) cachedGroqModel = null;
    try {
      model = await resolveGroqModel();
      result = await generateWithContinuation(
        "https://api.groq.com/openai/v1/chat/completions",
        GROQ_API_KEY,
        model,
        chatMessages,
        {}
      );
    } catch (_) {
      // fall through with the original result/error
    }
  }
  if (!result.ok) result.error = `Groq: ${result.error}`;
  return result;
}

// ---- Cerebras (tier 3) ----
let cachedCerebrasModel = null;
let cachedCerebrasModelAt = 0;
const blockedCerebrasModels = new Set();

async function resolveCerebrasModel() {
  if (process.env.CEREBRAS_MODEL) return process.env.CEREBRAS_MODEL;
  if (
    cachedCerebrasModel &&
    !blockedCerebrasModels.has(cachedCerebrasModel) &&
    Date.now() - cachedCerebrasModelAt < 10 * 60 * 1000
  ) {
    return cachedCerebrasModel;
  }
  const res = await fetch("https://api.cerebras.ai/v1/models", {
    headers: { Authorization: `Bearer ${CEREBRAS_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Could not list Cerebras models (HTTP ${res.status})`);
  const data = await res.json();
  const ids = (data.data || []).map((m) => m.id).filter((id) => !blockedCerebrasModels.has(id));
  const preferredPatterns = [/llama-3\.3-70b/i, /llama-4-scout/i, /qwen-3-32b/i, /llama3\.1-70b/i, /llama3\.1-8b/i];
  let chosen = null;
  for (const pattern of preferredPatterns) {
    chosen = ids.find((id) => pattern.test(id));
    if (chosen) break;
  }
  if (!chosen) chosen = ids[0];
  if (!chosen) throw new Error("No usable Cerebras chat models were returned for this key.");
  cachedCerebrasModel = chosen;
  cachedCerebrasModelAt = Date.now();
  return chosen;
}

async function tryCerebras(chatMessages) {
  if (!CEREBRAS_API_KEY) return { ok: false, unavailable: true };
  let model;
  try {
    model = await resolveCerebrasModel();
  } catch (e) {
    return { ok: false, error: `Cerebras: ${e.message}` };
  }
  let result = await generateWithContinuation(
    "https://api.cerebras.ai/v1/chat/completions",
    CEREBRAS_API_KEY,
    model,
    chatMessages,
    {}
  );
  if (
    !result.ok &&
    !process.env.CEREBRAS_MODEL &&
    /does not exist|not found|decommissioned|not supported|no access/i.test(result.error || "")
  ) {
    blockedCerebrasModels.add(model);
    if (cachedCerebrasModel === model) cachedCerebrasModel = null;
    try {
      model = await resolveCerebrasModel();
      result = await generateWithContinuation(
        "https://api.cerebras.ai/v1/chat/completions",
        CEREBRAS_API_KEY,
        model,
        chatMessages,
        {}
      );
    } catch (_) {
      // fall through with the original result/error
    }
  }
  if (!result.ok) result.error = `Cerebras: ${result.error}`;
  return result;
}

// ---- Gemini (tier 4) ----
// Gemini's own OpenAI-compatible endpoint. Its catalog is small and stable
// enough that a fixed preference list works fine without a discovery call.
const GEMINI_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

async function tryGemini(chatMessages) {
  if (!GEMINI_API_KEY) return { ok: false, unavailable: true };
  const candidates = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : GEMINI_MODEL_CANDIDATES;
  let lastResult = { ok: false, error: "No Gemini model succeeded." };
  for (const model of candidates) {
    const result = await generateWithContinuation(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      GEMINI_API_KEY,
      model,
      chatMessages,
      {}
    );
    if (result.ok) return result;
    lastResult = result;
  }
  lastResult.error = `Gemini: ${lastResult.error}`;
  return lastResult;
}

// The frontend calls this instead of talking to any AI provider directly.
// Real API keys stay here, server-side, and are never sent to the browser.
app.post("/api/story", async (req, res) => {
  try {
    const { system, messages } = req.body || {};
    const chatMessages = [
      { role: "system", content: system || "" },
      ...(Array.isArray(messages) ? messages : []).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
      })),
    ];

    const tiers = [tryOpenRouter, tryGroq, tryCerebras, tryGemini];
    let anyConfigured = false;
    let lastError =
      "No AI provider is configured. Set OPENROUTER_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, or GEMINI_API_KEY.";

    for (const tier of tiers) {
      const result = await tier(chatMessages);
      if (result.unavailable) continue; // no key set for this provider — skip silently
      anyConfigured = true;
      if (result.ok && result.text && result.text.trim()) {
        return res.json({ text: result.text.trim() });
      }
      lastError = result.error || "That provider returned an empty response.";
    }

    if (!anyConfigured) {
      return res.status(500).json({ error: lastError });
    }
    return res.status(502).json({ error: `All configured AI providers failed. Last error: ${lastError}` });
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
