// src/lib/api.ts
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn(
    "[Gemini] EXPO_PUBLIC_GEMINI_API_KEY is missing. Set it in app.json > extra or app.config.*"
  );
}

const MODEL = "gemini-1.5-flash"; // works with generateContent

export async function chatGemini(question: string): Promise<string> {
  if (!question?.trim()) return "Please ask a question.";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }], role: "user" }],
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          ],
          generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 512 },
        }),
      }
    );

    // Try JSON first; fall back to text for easier debugging
    let data: any;
    try {
      data = await res.json();
    } catch {
      const txt = await res.text();
      throw new Error(`Gemini returned non-JSON: ${txt.slice(0, 300)}`);
    }

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        JSON.stringify(data).slice(0, 300);
      throw new Error(msg);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output ??
      "";
    return (text && String(text).trim()) || "I couldn’t find an answer.";
  } catch (err: any) {
    return `❌ Gemini API error: ${err?.message || String(err)}`;
  }
}

// Optional alias used by some screens
export async function askChatbot(q: string) {
  return chatGemini(q);
}
