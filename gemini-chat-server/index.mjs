import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.GOOGLE_API_KEY; // <-- set this env var
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // or gemini-1.5-pro

if (!API_KEY) {
  console.error("Missing GOOGLE_API_KEY env var.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL });

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/", (_req, res) => res.json({ ok: true }));

// Your contract: POST /chat  { question: string }
app.post("/chat", async (req, res) => {
  try {
    const q = (req.body?.question || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing 'question'." });

    const system =
      "You are MediChat, a helpful medication assistant. Keep answers concise, non-diagnostic, and encourage consulting professionals for medical decisions.";

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${system}\n\nUser: ${q}` }]}],
    });

    const answer = result?.response?.text() || "";
    res.json({ answer });
  } catch (err) {
    console.error("[/chat] error:", err);
    res.status(500).json({ error: "chat_failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini chat proxy listening on http://localhost:${PORT}`);
});
