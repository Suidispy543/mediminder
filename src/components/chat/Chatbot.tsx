// src/components/chat/Chatbot.tsx
import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, Pressable, Text, ScrollView } from "react-native";
import tw from "../../lib/tw";
import { askChatbot } from "../../lib/api";

type Msg = { role: "user" | "assistant"; text: string };

export default function Chatbot() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi! I’m MediChat. Ask me about medicines, schedules, or general health guidance.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function sendMessage() {
    const q = input.trim();
    if (!q || sending) return;

    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setSending(true);

    try {
      const answer = await askChatbot(q);
      const finalText =
        (answer && String(answer).trim()) || "I couldn’t find an answer.";
      setMessages((m) => [...m, { role: "assistant", text: finalText }]);
    } catch (err: any) {
      console.error("[chat] error:", err);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `❌ ${err?.message || "Something went wrong."}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={tw`flex-1 bg-bg`}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={tw`px-4 py-3`}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <View
              key={`${i}-${m.role}`}
              style={tw`${isUser ? "items-end" : "items-start"} my-1`}
            >
              <View
                style={tw`max-w-[85%] rounded-2xl px-4 py-3 ${
                  isUser ? "bg-brand" : "bg-card"
                } border border-border`}
              >
                <Text style={tw`${isUser ? "text-white" : "text-text"} text-base`}>
                  {m.text}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={tw`flex-row items-center px-4 py-3 border-t border-border bg-card`}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything…"
          placeholderTextColor={(tw.color("mutetext") as string) || "#9ca3af"}
          style={tw`flex-1 bg-bg rounded-xl px-3 py-2 text-text`}
          editable={!sending}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <Pressable
          onPress={sendMessage}
          disabled={sending || !input.trim()}
          style={tw`ml-2 rounded-xl px-4 py-2 ${
            sending || !input.trim() ? "bg-brand/50" : "bg-brand"
          }`}
        >
          <Text style={tw`text-white font-semibold`}>
            {sending ? "..." : "Send"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
