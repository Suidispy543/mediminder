/**
 * Gemini client (cheaper default model + conservative defaults).
 *
 * - Default model: models/gemini-1.5-flash-8b (lower cost)
 * - Uses generateContent with contents/parts shape.
 * - Default generationConfig: temperature 0.2, maxOutputTokens 120
 * - Keeps debug logging; quiets Typescript 'extra' with any casts.
 *
 * Security: Do NOT ship API keys in a public release. Use a backend proxy in production.
 */

import Constants from "expo-constants";

const DEFAULT_BASES = [
  "https://generativelanguage.googleapis.com/v1beta",
  "https://generativelanguage.googleapis.com/v1",
];

// read expo extra with any-cast (quiet TypeScript)
const expoExtra = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra ?? {};
let API_KEY: string | undefined =
  (expoExtra as any)?.EXPO_PUBLIC_GEMINI_API_KEY ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("[Gemini] EXPO_PUBLIC_GEMINI_API_KEY not found in expo config/env. Set it for dev testing.");
} else {
  console.log("Gemini API key loaded? YES (len=" + String(API_KEY.length) + ")");
}

// default to cheaper model to reduce cost
let MODEL: string =
  (expoExtra as any)?.EXPO_GEMINI_MODEL ?? process.env.EXPO_GEMINI_MODEL ?? "models/gemini-2.0-flash";

export function setModel(name: string) {
  MODEL = name;
}
export function setApiKey(key: string) {
  API_KEY = key;
  console.log("Gemini API key set at runtime (len=" + String(API_KEY?.length ?? 0) + ")");
}

async function safeParseResponse(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

/**
 * Build request body for generateContent using the "contents/parts" shape.
 * Defaults: temperature 0.2, maxOutputTokens 120 (can be overridden via opts).
 */
function buildGenerateContentBody(prompt: string, opts?: any) {
  const contents = [
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ];

  const generationConfig: any = {
    temperature: typeof opts?.temperature === "number" ? opts.temperature : 0.2,
    maxOutputTokens: typeof opts?.maxOutputTokens === "number" ? opts.maxOutputTokens : 120,
  };

  // allow user-provided overrides via opts.generationConfig
  if (opts?.generationConfig && typeof opts.generationConfig === "object") {
    Object.assign(generationConfig, opts.generationConfig);
  }

  const body: any = { contents };
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  // allow passing other top-level keys (e.g., safetySettings) via extraBody
  if (opts?.extraBody && typeof opts.extraBody === "object") {
    Object.assign(body, opts.extraBody);
  }

  return body;
}

/**
 * generateText(prompt, opts)
 * - prompt: string
 * - opts: { model?: string, temperature?: number, maxOutputTokens?: number, generationConfig?: object, extraBody?: object, retries?: number }
 */
export async function generateText(prompt: string, opts?: any): Promise<string> {
  const modelToUse: string = (opts?.model as string) ?? MODEL;
  const retries: number = typeof opts?.retries === "number" ? opts.retries : 0;

  if (!API_KEY) {
    throw new Error("Gemini API key missing. Set EXPO_PUBLIC_GEMINI_API_KEY in app.json extra or env.");
  }

  const body = buildGenerateContentBody(prompt, opts);

  let lastErr: Error | null = null;

  for (const base of DEFAULT_BASES) {
    const url = `${base}/${modelToUse}:generateContent?key=${API_KEY}`;

    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const attemptMsg = attempt > 0 ? ` (retry ${attempt})` : "";
        try {
          console.debug(`[geminiClient] POST ${url}${attemptMsg} body:`, JSON.stringify(body).slice(0, 2000));
        } catch {
          /* ignore stringify issues */
        }

        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch (networkErr) {
          lastErr = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
          console.warn(`[geminiClient] network error calling ${url}:`, lastErr.message ?? lastErr);
          break; // try next base
        }

        const parsed = await safeParseResponse(res);
        const status = (res as any).status ?? res.status;
        console.debug(`[geminiClient] response status=${status} text=${String(parsed.text).slice(0, 2000)}`);

        if (!res.ok) {
          const serverMsg = parsed.json?.error?.message ?? parsed.text ?? `HTTP ${status}`;
          lastErr = new Error(`[Gemini API] ${serverMsg}`);
          if (status >= 500 && attempt < retries) {
            const backoff = 300 * (attempt + 1);
            console.warn(`[geminiClient] server error, retrying after ${backoff}ms:`, serverMsg);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw lastErr;
        }

        // parse probable response shapes for generateContent
        const json = parsed.json;

        // outputs -> array -> content -> [{ text }]
        if (Array.isArray(json?.outputs)) {
          for (const out of json.outputs) {
            if (Array.isArray(out?.content)) {
              for (const piece of out.content) {
                if (typeof piece?.text === "string") return piece.text;
              }
            }
            if (typeof out?.text === "string") return out.text;
            if (Array.isArray(out?.candidates)) {
              for (const cand of out.candidates) {
                if (typeof cand?.content === "string") return cand.content;
                if (Array.isArray(cand?.content)) {
                  for (const p of cand.content) if (typeof p?.text === "string") return p.text;
                }
                if (typeof cand?.text === "string") return cand.text;
              }
            }
          }
        }

        // top-level candidates
        if (Array.isArray(json?.candidates)) {
          const c = json.candidates[0];
          if (typeof c?.content === "string") return c.content;
          if (Array.isArray(c?.content)) {
            for (const p of c.content) if (typeof p?.text === "string") return p.text;
          }
        }

        // fallback: find first string anywhere in the JSON
        const flattenFindString = (obj: any): string | null => {
          if (typeof obj === "string") return obj;
          if (!obj || typeof obj !== "object") return null;
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === "string") return v;
            const nested = flattenFindString(v);
            if (nested) return nested;
          }
          return null;
        };

        const found = flattenFindString(json ?? parsed.text);
        if (found) return found;

        if (parsed.text) return parsed.text;

        throw new Error(`[Gemini API] Unrecognized response shape: ${JSON.stringify(json ?? parsed.text).slice(0, 2000)}`);
      } // end attempt loop
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[geminiClient] base ${base} failed:`, lastErr.message ?? lastErr);
      // try next base
    }
  } // end base loop

  throw lastErr ?? new Error("Unknown Gemini client error");
}
