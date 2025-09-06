// src/lib/chatService.ts
/**
 * askChatbot wrapper with:
 * - Try Gemini first (generateText from src/lib/geminiClient.ts).
 * - If Gemini fails with a quota/billing error (or similar), automatically try Hugging Face Inference as fallback.
 * - In-memory caching and cooldown to avoid spamming the APIs (reduces cost and quota usage).
 *
 * Requirements:
 * - Your existing geminiClient.generateText(prompt, opts) must throw Errors with readable messages.
 * - Put your Hugging Face API token in app.json extra as HF_API_KEY for dev/testing or in env as HF_API_KEY.
 *
 * Notes:
 * - Hugging Face free tier is limited. Use a small model (e.g., "google/flan-t5-small") for low-cost fallback.
 * - This fallback is intended for dev/testing and small user volumes only.
 */

import { generateText } from "./geminiClient";
import Constants from "expo-constants";

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache by default
const USER_COOLDOWN_MS = 1000 * 5; // 5 seconds cooldown between requests (global)
const CACHE: Record<string, { text: string; ts: number }> = {};
let lastCallTs = 0;

/** Read HF token from env or expo.extra (dev). */
function getHfToken(): string | null {
  const expoExtra = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra ?? {};
  const fromExtra = (expoExtra as any)?.HF_API_KEY ?? (expoExtra as any)?.REACT_APP_HF_API_KEY;
  const fromEnv = (process.env as any)?.HF_API_KEY ?? (process.env as any)?.REACT_APP_HF_API_KEY;
  const maybe = fromExtra ?? fromEnv ?? null;
  return maybe || null;
}

/** Call Hugging Face Inference API (simple wrapper).
 *  By default this uses google/flan-t5-small — good tradeoff for short text.
 *  You can change modelName to any HF model you prefer.
 */
async function callHuggingFace(prompt: string, modelName = "google/flan-t5-small"): Promise<string> {
  const HF_KEY = getHfToken();
  if (!HF_KEY) throw new Error("Hugging Face API key missing (set HF_API_KEY in app.json extra or environment).");

  const url = `https://api-inference.huggingface.co/models/${modelName}`;
  const body = { inputs: prompt, options: { wait_for_model: true } };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    // include body to help debugging
    throw new Error(`HF inference failed: ${res.status} ${text}`);
  }

  // Many HF models return JSON array with generated_text or simple string — try parse
  try {
    const j = JSON.parse(text);
    // Common structure 1: [{ generated_text: "..." }]
    if (Array.isArray(j) && j[0]?.generated_text) return j[0].generated_text;
    // Common structure 2: { generated_text: "..." }
    if (typeof j?.generated_text === "string") return j.generated_text;
    // Common structure 3: HF chat models may return array of strings
    if (Array.isArray(j) && typeof j[0] === "string") return j[0];
    // fallback: stringify entire response
    return typeof j === "string" ? j : JSON.stringify(j);
  } catch {
    // If it's not JSON, return raw text
    if (text) return text;
    throw new Error("HF inference returned an empty or unparseable response.");
  }
}

/** Decide if an error message looks like a quota/billing error */
function looksLikeQuotaError(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("exceeded") ||
    lower.includes("quota_exceeded") ||
    lower.includes("quota exceeded") ||
    lower.includes("you exceeded")
  );
}

/**
 * askChatbot - primary wrapper used by UI
 * - tries Gemini first
 * - on suspected quota/billing error, automatically tries HF fallback
 */
export async function askChatbot(prompt: string): Promise<string> {
  const q = (prompt || "").trim();
  if (!q) return "";

  const now = Date.now();
  // global cooldown
  if (now - lastCallTs < USER_COOLDOWN_MS) {
    throw new Error("Please wait a few seconds before sending another question.");
  }
  lastCallTs = now;

  const cacheKey = q.toLowerCase();
  if (CACHE[cacheKey] && now - CACHE[cacheKey].ts < CACHE_TTL) {
    return CACHE[cacheKey].text;
  }

  // First: try Gemini
  try {
    // conservative defaults: small tokens, low temperature; callers can call generateText directly if needed
    const geminiResp = await generateText(q, { maxOutputTokens: 64, temperature: 0.2, retries: 1 });
    const text = String(geminiResp ?? "");
    CACHE[cacheKey] = { text, ts: Date.now() };
    return text;
  } catch (err: any) {
    const msg = err?.message ?? String(err ?? "");
    console.warn("[chatService] Gemini error:", msg);

    // If it's clearly a quota/billing error (or we can't reach API), attempt HF fallback
    if (looksLikeQuotaError(msg) || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("timeout")) {
      try {
        console.log("[chatService] Attempting Hugging Face fallback...");
        const hfText = await callHuggingFace(q);
        const text = String(hfText ?? "");
        CACHE[cacheKey] = { text, ts: Date.now() };
        return text;
      } catch (hfErr: any) {
        console.error("[chatService] HF fallback failed:", hfErr?.message ?? hfErr);
        // return more helpful message to UI rather than raw stack
        throw new Error(`Both Gemini and HF fallback failed. Gemini: ${msg}. HF: ${String(hfErr?.message ?? hfErr)}`);
      }
    }

    // If it was some other Gemini error (not quota), bubble it up
    throw new Error(`[chatService] Gemini error: ${msg}`);
  }
}
