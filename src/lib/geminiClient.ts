// src/lib/geminiClient.ts
import Constants from "expo-constants";

const API_KEY = (Constants?.manifest?.extra?.EXPO_PUBLIC_GEMINI_API_KEY as string) || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
if (!API_KEY) {
  console.warn("[gemini] No API key found. Set EXPO_PUBLIC_GEMINI_API_KEY in app.json extra (dev only).");
}

const BASE = "https://generativelanguage.googleapis.com/v1beta"; // or v1 if available
const MODEL = "models/gemini-1.5"; // change to the model you tested (gemini-1.5-flash etc.)

export async function generateText(prompt: string) {
  if (!API_KEY) throw new Error("Gemini API key missing");
  const url = `${BASE}/${MODEL}:generateMessage?key=${API_KEY}`;
  const body = {
    // minimal structure for new GL API — adapt to the model you tested
    prompt: {
      messages: [{ content: { text: prompt }, role: "user" }]
    },
    // optional params you may want to tune
    temperature: 0.0,
    maxOutputTokens: 512
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini API error: ${json?.error?.message || JSON.stringify(json)}`);
  }

  // Pull best text out — depends on API shape, adjust if needed:
  // many Gemini responses have candidates or output.paragraphs
  const text =
    json?.candidates?.[0]?.content?.[0]?.text ??
    json?.result?.[0]?.content ??
    json?.output?.[0]?.content?.text ??
    // fallback stringify
    JSON.stringify(json);

  return typeof text === "string" ? text : String(text);
}
