export async function askChatbot(question: string): Promise<string> {
  try {
    // Local dev on simulator: http://localhost:8080/chat
    // On real device: http://<YOUR_LAN_IP>:8080/chat
    const API_URL = "http://10.29.4.167:8080/chat"; // <- replace this

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[chatService] API error:", res.status, txt);
      return `Sorry, something went wrong. (HTTP ${res.status})`;
    }

    const data = await res.json();
    return data?.answer || "No answer available.";
  } catch (err) {
    console.error("[chatService] network error:", err);
    return "Network error. Try again later.";
  }
}
