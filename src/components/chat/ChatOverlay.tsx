// src/components/chat/ChatOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
import { Audio } from "expo-av";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const GREEN = "#10B981";
const WELCOME_MESSAGE =
  "Hello! I'm Baymax, your personal healthcare companion. How can I patch you up today?";
// Ensure this path points to your audio file
const WELCOME_AUDIO = require("../../../assets/sounds/baymax_welcome.wav");

// special typing message id
const TYPING_ID = "__typing__";

export default function ChatOverlay(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const listRef = useRef<FlatList<Msg> | null>(null);
  const inputRef = useRef<RNTextInput | null>(null);

  // welcome audio and sync refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [welcomeMsgId, setWelcomeMsgId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [wordTimestamps, setWordTimestamps] = useState<number[] | null>(null);
  const wordsRef = useRef<string[]>([]);

  // typing animation (3 dots)
  const dotAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
  const typingLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // push helper
  function push(role: Msg["role"], content: string) {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  }

  // ensure typing message exists when loading
  useEffect(() => {
    if (loading) {
      setMessages((prev) => {
        // if typing already present, don't duplicate
        if (prev.some((m) => m.id === TYPING_ID)) return prev;
        return [...prev, { id: TYPING_ID, role: "assistant", content: "" }];
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== TYPING_ID));
    }
  }, [loading]);

  // typing animation start/stop
  function startTypingAnim() {
    if (typingLoopRef.current) return;
    // staggered scale/opacity loop
    const seq = dotAnims.map((anim, i) =>
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    // create staggered loop
    typingLoopRef.current = Animated.loop(Animated.stagger(140, seq));
    typingLoopRef.current.start();
  }

  function stopTypingAnim() {
    if (typingLoopRef.current) {
      typingLoopRef.current.stop();
      typingLoopRef.current = null;
    }
    dotAnims.forEach((d) => d.setValue(0.3));
  }

  useEffect(() => {
    if (loading) startTypingAnim();
    else stopTypingAnim();
    return () => {
      // nothing here; stop handled above
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // send flow
  async function onSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    push("user", q);
    setLoading(true);
    Keyboard.dismiss();

    // scroll to bottom (newest)
    setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 120);

    try {
      const answer = await askChatbot(q);
      push("assistant", String(answer ?? ""));
    } catch (err: any) {
      push("assistant", `❌ ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
      setTimeout(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        inputRef.current?.focus?.();
      }, 80);
    }
  }

  // auto-scroll when messages change
  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      stopAndUnloadSound().catch(() => {});
      stopTypingAnim();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- welcome audio & progressive text (kept) ---------------- */

  async function stopAndUnloadSound() {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    } catch {
      soundRef.current = null;
    }
  }

  async function startWelcomeOnce() {
    const id = `${Date.now()}-welcome`;
    setWelcomeMsgId(id);
    setMessages((prev) => [...prev, { id, role: "assistant", content: WELCOME_MESSAGE }]);

    const words = WELCOME_MESSAGE.split(/\s+/).filter(Boolean);
    wordsRef.current = words;
    setCurrentWordIndex(-1);
    setWordTimestamps(null);

    try {
      await stopAndUnloadSound();

      const { sound } = await Audio.Sound.createAsync(WELCOME_AUDIO, { shouldPlay: false });
      soundRef.current = sound;

      const statusAny = (await sound.getStatusAsync()) as any;
      let durationMs = statusAny?.durationMillis ?? 0;

      if (!durationMs || durationMs <= 0) {
        await sound.playAsync().catch(() => {});
        const s2 = (await sound.getStatusAsync()) as any;
        durationMs = s2?.durationMillis ?? 0;
      }

      if (durationMs && durationMs > 0) {
        const spacing = Math.max(1, Math.floor(durationMs / Math.max(words.length, 1)));
        const ts = words.map((_, i) => Math.round(i * spacing));
        setWordTimestamps(ts);
      } else {
        setWordTimestamps(null);
      }

      try {
        await sound.setPositionAsync(0).catch(() => {});
      } catch {
        /* ignore */
      }
      await sound.playAsync().catch(() => {});

      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }

      const startTs = Date.now();

      tickRef.current = setInterval(async () => {
        try {
          if (!soundRef.current) return;
          const stAny = (await soundRef.current.getStatusAsync()) as any;
          const pos = stAny?.positionMillis ?? (Date.now() - startTs);

          if (wordTimestamps && wordTimestamps.length === wordsRef.current.length) {
            let idx = 0;
            for (let i = 0; i < wordTimestamps.length; i++) {
              if (pos >= (wordTimestamps[i] || 0)) idx = i;
              else break;
            }
            setCurrentWordIndex(idx);
          } else {
            const duration = stAny?.durationMillis ?? 0;
            if (duration && duration > 0) {
              const spacing = duration / Math.max(wordsRef.current.length, 1);
              const idx = Math.min(wordsRef.current.length - 1, Math.floor(pos / Math.max(1, spacing)));
              setCurrentWordIndex(idx);
            } else {
              const cadence = 150;
              const idx = Math.min(wordsRef.current.length - 1, Math.floor((Date.now() - startTs) / cadence));
              setCurrentWordIndex(idx);
            }
          }

          const didJustFinish = !!stAny?.didJustFinish;
          const duration2 = stAny?.durationMillis ?? 0;
          if (didJustFinish || (duration2 > 0 && pos >= duration2 - 30)) {
            setCurrentWordIndex(wordsRef.current.length - 1);
            setTimeout(() => {
              if (tickRef.current !== null) {
                clearInterval(tickRef.current);
                tickRef.current = null;
              }
              stopAndUnloadSound();
              setWelcomeMsgId(null);
              setCurrentWordIndex(-1);
              setWordTimestamps(null);
            }, 180);
          }
        } catch {
          // ignore errors inside tick
        }
      }, 80);
    } catch (err) {
      console.warn("[Baymax] failed to play welcome sound:", err);
      setCurrentWordIndex(wordsRef.current.length - 1);
      setTimeout(() => {
        setWelcomeMsgId(null);
        setCurrentWordIndex(-1);
      }, 800);
    }
  }

  // open chat: clear previous messages, play welcome once per open
  function openChat() {
    // Clear previous messages and input when reopening
    setMessages([]);
    setInput("");
    setOpen(true);
    setTimeout(() => {
      inputRef.current?.focus?.();
      startWelcomeOnce();
    }, 220);
  }

  async function closeChat() {
    // stop intervals and sound first
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    await stopAndUnloadSound();
    stopTypingAnim();

    // hide modal and clear state so next open is fresh
    setOpen(false);
    setWelcomeMsgId(null);
    setCurrentWordIndex(-1);
    setWordTimestamps(null);

    // <-- automatic clear happens here
    setMessages([]);
    setInput("");
  }

  // renderItem - special-case typing message (TYPING_ID)
  function renderItem({ item }: { item: Msg }) {
    const isUser = item.role === "user";

    // active welcome message (progressive words)
    if (welcomeMsgId && item.id === welcomeMsgId) {
      const words = wordsRef.current;
      return (
        <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
            <Text style={styles.welcomeText}>
              {words.map((w, i) => {
                const shown = i <= currentWordIndex;
                return (
                  <Text key={`${item.id}-w-${i}`} style={shown ? styles.welcomeWordShown : styles.welcomeWordHidden}>
                    {w}
                    {i < words.length - 1 ? " " : ""}
                  </Text>
                );
              })}
            </Text>
          </View>
        </View>
      );
    }

    // typing indicator message
    if (item.id === TYPING_ID) {
      return (
        <View style={[styles.row, styles.rowBot]}>
          <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
            <View style={styles.typingDotsRow}>
              {dotAnims.map((anim, i) => (
                <Animated.View
                  key={`dot-${i}`}
                  style={[
                    styles.typingDot,
                    {
                      transform: [
                        {
                          translateY: anim.interpolate({
                            inputRange: [0.3, 1],
                            outputRange: [0, -6],
                          }),
                        },
                      ],
                      opacity: anim.interpolate({
                        inputRange: [0.3, 1],
                        outputRange: [0.35, 1],
                      }),
                      backgroundColor: GREEN,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }

    // normal message
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
          openChat();
        }}
      >
        <MaterialCommunityIcons name="robot-happy-outline" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} transparent={false} animationType="slide" onRequestClose={closeChat}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Baymax (●—●)</Text>
              <TouchableOpacity onPress={closeChat} style={styles.closeBtnHeader}>
                <Text style={styles.closeTextHeader}>Close</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={listRef}
              data={messages.slice().reverse()}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              inverted
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            />

            {/* Input */}
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

  // typing bubble tweaks
  typingBubble: { minWidth: 56, paddingHorizontal: 12, paddingVertical: 8 },
  typingDotsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    marginHorizontal: 6,
  },

  welcomeText: { fontSize: 15, lineHeight: 20 },
  welcomeWordHidden: { color: "transparent" },
  welcomeWordShown: { color: "#111827" },

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
});
