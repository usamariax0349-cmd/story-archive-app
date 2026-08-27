import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

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

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatMessages,
        max_tokens: 700,
        temperature: 1,
      }),
    });

    const data = await upstream.json();

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
