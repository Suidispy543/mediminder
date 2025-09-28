// src/lib/chatService.ts
import { generateText } from "./geminiClient";
import Constants from "expo-constants";

/**
 * askChatbot wrapper:
 *  - tries Gemini first via generateText()
 *  - falls back to Hugging Face if Gemini is unavailable / no models / quota / network
 *  - in-memory cache + cooldown
 */

const CACHE_TTL = 1000 * 60 * 30;
const USER_COOLDOWN_MS = 1000 * 5;
const CACHE: Record<string, { text: string; ts: number }> = {};
let lastCallTs = 0;

/* ---------------- HF helper ---------------- */
function getHfToken(): string | null {
  const expoExtra = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra ?? {};
  const fromExtra = (expoExtra as any)?.HF_API_KEY ?? (expoExtra as any)?.REACT_APP_HF_API_KEY;
  const fromEnv = (process.env as any)?.HF_API_KEY ?? (process.env as any)?.REACT_APP_HF_API_KEY;
  const maybe = fromExtra ?? fromEnv ?? null;
  return maybe || null;
}

async function callHuggingFace(prompt: string, modelName = "google/flan-t5-small"): Promise<string> {
  const HF_KEY = getHfToken();
  if (!HF_KEY) throw new Error("Hugging Face API key missing (set HF_API_KEY in app.json extra or environment).");

  const url = `https://api-inference.huggingface.co/models/${modelName}`;
  const body = { inputs: prompt, options: { wait_for_model: true } };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${HF_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HF inference failed: ${res.status} ${text}`);

  try {
    const j = JSON.parse(text);
    if (Array.isArray(j) && j[0]?.generated_text) return j[0].generated_text;
    if (typeof j?.generated_text === "string") return j.generated_text;
    if (Array.isArray(j) && typeof j[0] === "string") return j[0];
    return typeof j === "string" ? j : JSON.stringify(j);
  } catch {
    if (text) return text;
    throw new Error("HF inference returned an empty or unparseable response.");
  }
}

/* ---------------- utilities ---------------- */
function extractErrorMessage(err: unknown): string {
  if (!err) return "";
  try {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message || String(err);
    const anyErr: any = err as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (anyErr.error && typeof anyErr.error.message === "string") return anyErr.error.message;
    if (anyErr.response) {
      const resp = anyErr.response;
      if (resp.data) {
        try { return typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data); } catch {}
      }
      try { return JSON.stringify(resp); } catch {}
    }
    if (typeof anyErr === "object") {
      try { return JSON.stringify(anyErr); } catch { return String(anyErr); }
    }
    return String(anyErr);
  } catch {
    try { return String(err); } catch { return "Unknown error"; }
  }
}

function looksLikeQuotaError(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("quota") || lower.includes("billing") || lower.includes("exceeded") || lower.includes("quota_exceeded");
}

function isMetaOrEmptyResponse(s: string | null | undefined): boolean {
  if (!s) return true;
  const t = String(s).trim().toLowerCase();
  if (t.length === 0) return true;
  if (t === "model") return true;
  if (t.length <= 3) return true;
  return false;
}

/* ---------------- askChatbot ---------------- */
export async function askChatbot(prompt: string): Promise<string> {
  const q = (prompt || "").trim();
  if (!q) return "";

  const now = Date.now();
  if (now - lastCallTs < USER_COOLDOWN_MS) {
    throw new Error("Please wait a few seconds before sending another question.");
  }
  lastCallTs = now;

  const cacheKey = q.toLowerCase();
  if (CACHE[cacheKey] && now - CACHE[cacheKey].ts < CACHE_TTL) return CACHE[cacheKey].text;

  try {
    let geminiResp = await generateText(q, { maxOutputTokens: 300, temperature: 0.2 });

    if (isMetaOrEmptyResponse(geminiResp)) {
      try {
        geminiResp = await generateText(q, { maxOutputTokens: 512, temperature: 0.2 });
      } catch (retryErr) {
        console.warn("[chatService] Gemini retry failed:", extractErrorMessage(retryErr));
      }
    }

    const text = String(geminiResp ?? "").trim();
    if (isMetaOrEmptyResponse(text)) throw new Error("Gemini returned empty or metadata-only response after retry.");

    CACHE[cacheKey] = { text, ts: Date.now() };
    return text;
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.warn("[chatService] Gemini error or empty response:", msg);

    const lower = (msg || "").toLowerCase();

    // If geminiClient reported "No compatible Gemini models..." -> immediate HF fallback
    if (lower.includes("no compatible gemini models") || lower.includes("no compatible gemini models found")) {
      try {
        console.log("[chatService] Using HF fallback due to missing Gemini models.");
        const hfText = await callHuggingFace(q);
        const text = String(hfText ?? "");
        CACHE[cacheKey] = { text, ts: Date.now() };
        return text;
      } catch (hfErr: unknown) {
        const hfMsg = extractErrorMessage(hfErr);
        throw new Error(`Gemini unavailable (no models). HF fallback also failed: ${hfMsg}`);
      }
    }

    // Quota/network/timeouts -> HF fallback
    if (looksLikeQuotaError(lower) || lower.includes("network") || lower.includes("timeout") || lower.includes("unavailable") || lower.includes("service temporarily") || lower.includes("empty or metadata-only")) {
      try {
        console.log("[chatService] Attempting Hugging Face fallback...");
        const hfText = await callHuggingFace(q);
        const text = String(hfText ?? "");
        CACHE[cacheKey] = { text, ts: Date.now() };
        return text;
      } catch (hfErr: unknown) {
        const hfMsg = extractErrorMessage(hfErr);
        throw new Error(`Both Gemini and HF fallback failed. Gemini: ${msg}. HF: ${hfMsg}`);
      }
    }

    // otherwise bubble up Gemini error
    throw new Error(`[chatService] Gemini error: ${msg}`);
  }
}

/* Debug helper */
export function clearChatCache() {
  for (const k of Object.keys(CACHE)) delete CACHE[k];
  lastCallTs = 0;
}
