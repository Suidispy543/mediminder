// src/lib/geminiService.ts
export async function askGemini(question: string): Promise<string> {
  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCB3mDrc0T302iqZcgnCQxzLXIpj06U6t8";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: question }]}],
      }),
    });

    // If response isn’t JSON (or is an error page), fall back to text
    let data: any;
    try {
      data = await res.json();
    } catch {
      const txt = await res.text();
      return `❌ Gemini error: ${txt?.slice(0, 300) || "unknown"}`;
    }

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        JSON.stringify(data).slice(0, 300);
      return `❌ Gemini API error: ${msg}`;
    }

    // Extract model text
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output_text ??
      "";

    return text || "⚠️ No response from Gemini.";
  } catch (err: any) {
    console.error("[geminiService] error:", err);
    return "❌ Gemini request failed.";
  }
}
