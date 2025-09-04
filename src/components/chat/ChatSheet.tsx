// src/components/chat/ChatSheet.tsx
import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import tw from "../../lib/tw";
import { askChatbot } from "../../lib/api";

type Msg = { role: "user" | "assistant"; text: string };

export default function ChatSheet() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! Ask about meds, schedules, or reports." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const canSend = !sending && input.trim().length > 0;

  async function sendMessage() {
    const q = input.trim();
    if (!q || sending) return;

    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setSending(true);

    try {
      const answer = await askChatbot(q);
      const finalText =
        (answer && String(answer).trim()) || "⚠️ No answer received.";
      setMessages((m) => [...m, { role: "assistant", text: finalText }]);
    } catch (err: any) {
      console.log("[chat] fetch error:", err?.message || String(err));
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry, I couldn’t reach the server." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={tw`flex-1`}>
      <ScrollView
        ref={scrollRef}
        style={tw`flex-1 px-4 pt-2`}
        contentContainerStyle={tw`pb-3`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const bubbleBg = isUser
            ? ((tw.color("brand") as string) || "#2563eb")
            : ((tw.color("card") as string) || "#ffffff");
        const textColor = isUser ? "#ffffff" : "#0f172a";
          return (
            <View key={i} style={tw`${isUser ? "items-end" : "items-start"} my-1`}>
              <View
                style={[
                  tw`max-w-[85%] rounded-2xl px-4 py-3 border border-border`,
                  { backgroundColor: bubbleBg, minHeight: 36, justifyContent: "center" },
                ]}
              >
                <Text style={[tw`text-base`, { color: textColor }]}>{m.text}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={tw`flex-row items-center px-4 py-3 border-t border-border bg-card`}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about meds, schedules, reports…"
          placeholderTextColor={(tw.color("mutetext") as string) || "#9ca3af"}
          style={tw`flex-1 bg-bg rounded-xl px-3 py-2 text-text`}
          editable={!sending}
          returnKeyType="send"
          enablesReturnKeyAutomatically
          onSubmitEditing={sendMessage}
          autoCapitalize="sentences"
          autoCorrect
        />
        <Pressable
          onPress={sendMessage}
          disabled={!canSend}
          style={[
            tw`ml-2 rounded-xl px-5 py-2`,
            { backgroundColor: canSend ? ((tw.color("brand") as string) || "#2563eb") : "#9aa6b2" },
          ]}
        >
          <Text style={tw`text-white font-semibold`}>{sending ? "…" : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
