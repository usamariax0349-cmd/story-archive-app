import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// The frontend calls this instead of talking to any AI provider directly.
// The real API key stays here, server-side, and is never sent to the browser.
app.post("/api/story", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GEMINI_API_KEY. Set it in your environment variables.",
      });
    }

    const { system, messages } = req.body || {};

    // Translate our app's {role: 'user'|'assistant', content} history into
    // Gemini's {role: 'user'|'model', parts: [{text}]} shape.
    const contents = (Array.isArray(messages) ? messages : []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system || "" }] },
        contents,
        generationConfig: { maxOutputTokens: 700, temperature: 1 },
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const message = (data && data.error && data.error.message) || `Upstream HTTP ${upstream.status}`;
      return res.status(upstream.status).json({ error: message });
    }

    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;
    const text = (parts || [])
      .map((p) => p.text || "")
      .join("\n")
      .trim();

    if (!text) {
      return res.status(502).json({ error: "The model returned an empty response." });
    }

    res.json({ text });
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
