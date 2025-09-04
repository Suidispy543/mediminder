// src/components/chat/ChatOverlay.tsx
import * as React from "react";
import { View, Modal, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { Portal, FAB, Card, Text, TextInput, ActivityIndicator } from "react-native-paper";
import tw from "../../lib/tw";
import PrimaryButton from "../PrimaryButton";
import { chatGemini } from "../../lib/api"; // <- named import exactly like this


type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function ChatOverlay() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: "hello",
      role: "assistant",
      content: "Hi! Ask me about medicines, schedules, or health reports. I’ll do my best to help.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  function push(role: Msg["role"], content: string) {
    setMessages((m) => [...m, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  }

  async function onSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    push("user", text);
    setLoading(true);
    try {
      const answer = await chatGemini(text);
      push("assistant", answer);
    } catch (e: any) {
      push("assistant", `❌ ${e?.message ?? "Something went wrong."}`);
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: Msg }) => (
    <View style={[tw`mb-3`, item.role === "user" ? tw`items-end` : tw`items-start`]}>
      <Card style={[tw`max-w-11/12`, item.role === "user" ? tw`bg-brand` : tw`bg-card`]}>
        <Card.Content>
          <Text style={item.role === "user" ? tw`text-white` : tw`text-text`}>{item.content}</Text>
        </Card.Content>
      </Card>
    </View>
  );

  return (
    <Portal>
      {/* Floating circular chat button */}
      <View pointerEvents="box-none" style={[tw`absolute`, { right: 16, bottom: 28 }]}>
        <FAB icon="robot-happy-outline" style={tw`rounded-full bg-brand`} color="#fff" onPress={() => setOpen(true)} />
      </View>

      {/* Modal */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={tw`flex-1`}>
          <View style={tw`flex-1 bg-black/40`}>
            <View style={[tw`absolute left-0 right-0 bottom-0`, { maxHeight: "85%" }]}>
              <Card style={tw`rounded-t-3xl bg-card border border-border`}>
                <Card.Title title="MediChat (beta)" subtitle="AI assistant for medication support" />
                <Card.Content>
                  <FlatList
                    data={messages}
                    keyExtractor={(m) => m.id}
                    renderItem={renderItem}
                    contentContainerStyle={tw`pt-2 pb-3`}
                  />
                  <View style={tw`h-px bg-border my-3`} />
                  <View style={tw`flex-row items-center gap-2`}>
                    <TextInput
                      mode="outlined"
                      style={[tw`flex-1`, { minHeight: 46 }]}
                      placeholder="Ask about meds, schedules, reports…"
                      value={input}
                      onChangeText={setInput}
                    />
                    <PrimaryButton mode="contained" onPress={onSend} disabled={loading || !input.trim()}>
                      {loading ? <ActivityIndicator color="#fff" /> : "Send"}
                    </PrimaryButton>
                  </View>
                  <View style={tw`mt-2`} />
                  <PrimaryButton mode="outlined" onPress={() => setOpen(false)}>
                    Close
                  </PrimaryButton>
                </Card.Content>
              </Card>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}
