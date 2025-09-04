import React, { useState } from "react";
import { View, TextInput, Button, Text, ScrollView } from "react-native";
import { askChatbot } from "../lib/chatService";

export default function ChatScreen() {
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [input, setInput] = useState("");

  async function send() {
    if (!input.trim()) return;

    // add user msgs
    setMessages((m) => [...m, { from: "user", text: input }]);

    // call backend
    const answer = await askChatbot(input);

    // add bot msg
    setMessages((m) => [...m, { from: "bot", text: answer }]);

    setInput("");
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <ScrollView style={{ flex: 1 }}>
        {messages.map((m, idx) => (
          <Text key={idx} style={{ marginVertical: 4, color: m.from === "user" ? "blue" : "green" }}>
            {m.from === "user" ? "You: " : "Bot: "}
            {m.text}
          </Text>
        ))}
      </ScrollView>

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Ask me something..."
        style={{ borderWidth: 1, padding: 8, marginVertical: 8 }}
      />
      <Button title="Send" onPress={send} />
    </View>
  );
}
