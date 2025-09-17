// src/screens/ChatScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { askChatbot } from "../lib/chatService";

type Msg = { id: string; from: "user" | "bot"; text: string };
const GREEN = "#10B981";

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const listRef = useRef<FlatList<Msg> | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    Keyboard.dismiss();

    const userMsg: Msg = { id: `${Date.now()}-u`, from: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const answer = await askChatbot(q);
      const botMsg: Msg = { id: `${Date.now()}-b`, from: "bot", text: String(answer ?? "No answer") };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const botMsg: Msg = { id: `${Date.now()}-err`, from: "bot", text: `❌ ${msg}` };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        inputRef.current?.focus?.();
      }, 80);
    }
  }

  function renderItem({ item }: { item: Msg }) {
    const isUser = item.from === "user";
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={isUser ? styles.textUser : styles.textBot}>{item.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages.slice().reverse()}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          inverted
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="always"
        />

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me something..."
            style={styles.input}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={send}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, loading || !input.trim() ? styles.sendBtnDisabled : null]}
            onPress={send}
            disabled={loading || !input.trim()}
          >
            <Text style={styles.sendBtnText}>{loading ? "..." : "Send"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  flatList: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, flexGrow: 1, justifyContent: "flex-end" },
  msgRow: { marginVertical: 6, marginHorizontal: 6, maxWidth: "80%" },
  msgRowUser: { alignSelf: "flex-end" },
  msgRowBot: { alignSelf: "flex-start" },
  bubble: { borderRadius: 12, padding: 10, maxWidth: "82%" },
  bubbleUser: { backgroundColor: GREEN },
  bubbleBot: { backgroundColor: "#F3F4F6" },
  textUser: { color: "#fff" },
  textBot: { color: "#111827" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", backgroundColor: "#fff" },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  sendBtn: { backgroundColor: GREEN, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: "#fff", fontWeight: "600" },
});
