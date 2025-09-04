// src/screens/AddMedication.tsx
import { upsertMedByName, appendDoses, resetAll, seedSample } from "../lib/storage";
import type { Dose, DoseSlot } from "../lib/types";
import * as React from "react";
import { useState, useMemo } from "react";
import {
  View,
  Platform,
  ScrollView,
  Text as RNText,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Card, TextInput, Text } from "react-native-paper";

import tw from "../lib/tw";
import { softShadow } from "../lib/shadows";
import PrimaryButton from "../components/PrimaryButton";

// ✅ notifications (JS module is fine to import in TS)
import { scheduleMany } from "../lib/notifications";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// --- helpers ---
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeKey(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function uniq<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function AddMedication({ navigation }: { navigation?: any }) {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [dates, setDates] = useState<Date[]>([]);
  const [times, setTimes] = useState<Date[]>([]);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [dateDraft, setDateDraft] = useState<Date>(new Date());
  const [timeDraft, setTimeDraft] = useState<Date>(new Date());

  const sortedDates = useMemo(
    () => uniq([...dates].sort((a, b) => a.getTime() - b.getTime()), toYMD),
    [dates]
  );
  const sortedTimes = useMemo(
    () => uniq([...times].sort((a, b) => a.getTime() - b.getTime()), timeKey),
    [times]
  );

  const handleDateChange = (_evt: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowDate(false);
    if (selected) {
      setDateDraft(selected);
      setDates((arr) => [...arr, selected]);
    }
  };
  const handleTimeChange = (_evt: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowTime(false);
    if (selected) {
      setTimeDraft(selected);
      setTimes((arr) => [...arr, selected]);
    }
  };

  const onSave = async () => {
    if (!name.trim() || sortedDates.length === 0 || sortedTimes.length === 0) {
      console.log("[AddMedication] cannot save — missing fields");
      return;
    }
    const med = await upsertMedByName({ name, pattern: "custom" });

    const newDoses: Dose[] = sortedDates.flatMap((d) =>
      sortedTimes.map((t) => {
        const when = new Date(d);
        when.setHours(t.getHours(), t.getMinutes(), 0, 0);
        return {
          doseId: `${med.medId}-${when.toISOString()}`,
          medId: med.medId,
          whenISO: when.toISOString(),
          slot: "custom" as DoseSlot,
          status: "scheduled",
        };
      })
    );

    // 1) save to storage
    await appendDoses(newDoses);

    // 2) ✨ schedule notifications for these doses
    await scheduleMany(newDoses, med.name);

    console.log("[AddMedication] saved & scheduled:", med, newDoses);
    navigation?.goBack?.();
  };

  const onReset = async () => { await resetAll(); console.log("[AddMedication] storage reset"); };
  const onSeed  = async () => { await seedSample(); console.log("[AddMedication] storage seeded"); };

  const canSave = name.trim().length > 0 && sortedDates.length > 0 && sortedTimes.length > 0;

  const textColor = (tw.color("text") as string) || "#111827";
  const chipText  = (tw.color("brandDark") as string) || "#0f172a";
  const chipBg    = (tw.color("brandSoft") as string) || "#e2e8f0";
  const borderCol = (tw.color("border") as string) || "#e5e7eb";

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={tw`flex-1 bg-bg`}
    >
      <SafeAreaView edges={["top"]} style={tw`bg-bg`}>
        <View
          style={[
            tw`px-4 pb-1 flex-row justify-end gap-2`,
            { paddingTop: 4 },
          ]}
        >
          <PrimaryButton mode="outlined" onPressAsync={onReset}>
            Reset
          </PrimaryButton>
          <PrimaryButton mode="outlined" onPressAsync={onSeed}>
            Seed
          </PrimaryButton>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={tw`flex-grow px-4 pt-2 pb-6`}>
        <View style={[tw`rounded-2xl bg-card border border-border overflow-hidden`, softShadow]}>
          <Card mode="elevated" style={tw`bg-card`}>
            <Card.Content>
              <Text variant="titleMedium" style={[tw`mb-2`, { color: textColor }]}>
                Add Medication
              </Text>

              <TextInput
                label="Medication name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                style={tw`mb-3`}
                mode="outlined"
                outlineStyle={{ borderColor: borderCol }}
                theme={{
                  colors: {
                    primary: (tw.color("brand") as string) || "#2563eb",
                    outline: borderCol,
                    onSurface: textColor,
                    onSurfaceVariant: textColor,
                  },
                }}
              />

              {/* Dates */}
              <Text variant="titleSmall" style={{ color: textColor, opacity: 0.8, marginBottom: 4 }}>
                Select dates
              </Text>
              <PrimaryButton mode="outlined" onPress={() => setShowDate(true)}>
                Add Date
              </PrimaryButton>

              {/* Scrollable chip grid (DATES) */}
              <View style={tw`mt-2`}>
                <ScrollView nestedScrollEnabled style={tw`max-h-40`} contentContainerStyle={tw`flex-row flex-wrap`}>
                  {sortedDates.map((d, idx) => (
                    <View
                      key={`${toYMD(d)}-${idx}`}
                      style={[tw`flex-row items-center rounded-full px-3 py-2 mr-2 mb-2`, { backgroundColor: chipBg, borderColor: borderCol, borderWidth: 1 }]}
                    >
                      <RNText style={[tw`mr-2`, { color: chipText }]}>{toYMD(d)}</RNText>
                      <PrimaryButton mode="text" onPress={() => setDates((arr) => arr.filter((_, i) => i !== idx))}>
                        ✕
                      </PrimaryButton>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Times */}
              <Text variant="titleSmall" style={{ color: textColor, opacity: 0.8, marginTop: 16, marginBottom: 4 }}>
                Select times
              </Text>
              <PrimaryButton mode="outlined" onPress={() => setShowTime(true)}>
                Add Time
              </PrimaryButton>

              {/* Scrollable chip grid (TIMES) */}
              <View style={tw`mt-2`}>
                <ScrollView nestedScrollEnabled style={tw`max-h-40`} contentContainerStyle={tw`flex-row flex-wrap`}>
                  {sortedTimes.map((t, idx) => (
                    <View
                      key={`${timeKey(t)}-${idx}`}
                      style={[tw`flex-row items-center rounded-full px-3 py-2 mr-2 mb-2`, { backgroundColor: chipBg, borderColor: borderCol, borderWidth: 1 }]}
                    >
                      <RNText style={[tw`mr-2`, { color: chipText }]}>{timeKey(t)}</RNText>
                      <PrimaryButton mode="text" onPress={() => setTimes((arr) => arr.filter((_, i) => i !== idx))}>
                        ✕
                      </PrimaryButton>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Native pickers */}
              {showDate && (
                <View style={[tw`mt-2 rounded-xl p-2`, { backgroundColor: "#fff", borderColor: borderCol, borderWidth: 1 }]}>
                  <DateTimePicker
                    value={dateDraft}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={handleDateChange}
                    {...(Platform.OS === "ios" ? { themeVariant: "light" as const, textColor } : {})}
                  />
                </View>
              )}

              {showTime && (
                <View style={[tw`mt-2 rounded-xl p-2`, { backgroundColor: "#fff", borderColor: borderCol, borderWidth: 1 }]}>
                  <DateTimePicker
                    value={timeDraft}
                    mode="time"
                    is24Hour
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                    {...(Platform.OS === "ios" ? { themeVariant: "light" as const, textColor } : {})}
                  />
                </View>
              )}

              {/* Actions */}
              <View style={tw`mt-5`}>
                <PrimaryButton onPressAsync={onSave} disabled={!canSave}>
                  Save
                </PrimaryButton>
                <View style={tw`mt-2`} />
                <PrimaryButton mode="outlined" onPress={() => navigation?.goBack?.()}>
                  Cancel
                </PrimaryButton>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
