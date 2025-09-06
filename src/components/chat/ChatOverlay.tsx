// src/components/chat/ChatOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Keyboard,
  TextInput as RNTextInput,
  Text,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { askChatbot } from "../../lib/chatService";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const GREEN = "#10B981";

export default function ChatOverlay() {
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: "welcome", role: "assistant", content: "Hi! Ask about meds, schedules, or reports." },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const listRef = useRef<FlatList<Msg> | null>(null);
  const inputRef = useRef<RNTextInput | null>(null);

  function push(role: Msg["role"], content: string) {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  }

  async function onSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    push("user", q);
    setLoading(true);
    Keyboard.dismiss();

    try {
      const answer = await askChatbot(q);
      push("assistant", answer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      push("assistant", `❌ ${msg}`);
    } finally {
      setLoading(false);
      // scroll and focus after a short delay so UI updates first
      setTimeout(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        inputRef.current?.focus?.();
      }, 80);
    }
  }

  // keep scrolled to newest when messages change
  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  function renderItem({ item }: { item: Msg }) {
    const isUser = item.role === "user";
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={isUser ? styles.textUser : styles.textBot}>{item.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => {
          setOpen(true);
          // focus input after modal opens
          setTimeout(() => inputRef.current?.focus?.(), 220);
        }}
      >
        <MaterialCommunityIcons name="robot-happy-outline" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Full-screen modal */}
      <Modal visible={open} transparent={false} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>MediChat (beta)</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtnHeader}>
                <Text style={styles.closeTextHeader}>Close</Text>
              </TouchableOpacity>
            </View>

            {/* Message list */}
            <FlatList
              ref={listRef}
              data={messages.slice().reverse()} // reverse: newest first for inverted UX
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              inverted
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            />

            {/* Input area pinned to bottom */}
            <View style={styles.inputRow}>
              <RNTextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about meds, schedules, reports…"
                placeholderTextColor="#6B7280"
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={onSend}
                editable={!loading}
                multiline
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnDisabled]}
                onPress={onSend}
                disabled={loading || !input.trim()}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1 },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  closeBtnHeader: { padding: 8 },
  closeTextHeader: { color: "#374151" },

  list: { flex: 1, paddingHorizontal: 12, backgroundColor: "#FFFFFF" },
  listContent: { paddingTop: 12, paddingBottom: 12, flexGrow: 1, justifyContent: "flex-end" },

  row: { marginVertical: 6 },
  rowUser: { alignSelf: "flex-end" },
  rowBot: { alignSelf: "flex-start" },

  bubble: { padding: 12, borderRadius: 14, maxWidth: "82%" },
  bubbleUser: { backgroundColor: GREEN },
  bubbleBot: { backgroundColor: "#F3F4F6" },
  textUser: { color: "#fff", fontSize: 15 },
  textBot: { color: "#111827", fontSize: 15 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#fff",
    color: "#111827",
  },
  sendBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.55 },
  sendBtnText: { color: "#fff", fontWeight: "600" },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 22 },
});
