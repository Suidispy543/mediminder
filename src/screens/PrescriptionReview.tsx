// src/screens/PrescriptionReview.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  Alert,
  ListRenderItemInfo,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BACKEND_URL } from "../config";

type Parsed = {
  patientName?: string | null;
  medications?: any[];
  rawText?: string;
  s3ObjectKey?: string | null;
};

type Med = { id: string; name: string; dose?: string };

type Props = NativeStackScreenProps<any, any>;

export default function PrescriptionReview({ route, navigation }: Props) {
  const { parsed, imageUri } = route.params as { parsed: Parsed; imageUri: string };
  const [patientName, setPatientName] = useState(parsed?.patientName || "");
  const [meds, setMeds] = useState<Med[]>(
    (parsed?.medications || []).map((m: any) => ({
      id: Math.random().toString(36).slice(2, 9),
      name: m.name || (typeof m === "string" ? m : ""),
      dose: (m.attributes && m.attributes.find((a: any) => a.type === "DOSAGE")?.text) || "",
    }))
  );

  function updateMedName(id: string, newName: string) {
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, name: newName } : m)));
  }
  function removeMed(id: string) {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }
  function addBlankMed() {
    setMeds((prev) => [{ id: Math.random().toString(36).slice(2, 9), name: "", dose: "" }, ...prev]);
  }

  // inside PrescriptionReview.tsx (replace existing saveToDashboard)
const [saving, setSaving] = useState(false);

async function saveToDashboard() {
  setSaving(true);
  const payload = {
    patientName,
    medications: meds.map((m) => ({ name: m.name, dose: m.dose })),
    rawText: parsed?.rawText || "",
    s3ObjectKey: parsed?.s3ObjectKey || null,
  };

  try {
    console.log("[Save] sending payload:", payload);
    const resp = await fetch(`${BACKEND_URL}/confirm-prescription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text().catch(() => null);
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e){ json = { message: text }; }

    console.log("[Save] resp status:", resp.status, "body:", json);

    if (!resp.ok) {
      const msg = (json && json.message) || `Server returned ${resp.status}`;
      throw new Error(msg);
    }

    Alert.alert("Saved", "Prescription saved to dashboard.");
    navigation.popToTop();
  } catch (err: any) {
    console.error("[Save] error:", err);
    Alert.alert("Save failed", err?.message || "Unknown error — check server logs or network.");
  } finally {
    setSaving(false);
  }
}


  const renderMed = ({ item }: ListRenderItemInfo<Med>) => (
    <View style={{ marginBottom: 8, borderWidth: 1, borderColor: "#eee", padding: 8, borderRadius: 6 }}>
      <TextInput
        value={item.name}
        onChangeText={(t) => updateMedName(item.id, t)}
        placeholder="Medicine name & dose"
        style={{ borderBottomWidth: 1, borderColor: "#ddd", padding: 6, marginBottom: 6 }}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#666" }}>{item.dose}</Text>
        <TouchableOpacity onPress={() => removeMed(item.id)}>
          <Text style={{ color: "red" }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // List header contains image, extracted text, patient name, add button
  const ListHeaderComponent = useMemo(() => {
    return (
      <View>
        {imageUri && <Image source={{ uri: imageUri }} style={{ width: "100%", height: 400, marginBottom: 12, resizeMode: "contain" }} />}
        <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Extracted Text</Text>
        <Text style={{ marginBottom: 12 }}>{parsed?.rawText || "(none)"}</Text>

        <Text style={{ fontWeight: "bold" }}>Patient Name</Text>
        <TextInput
          value={patientName}
          onChangeText={setPatientName}
          placeholder="Patient name"
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 8, marginBottom: 12 }}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontWeight: "bold" }}>Medicines</Text>
          <TouchableOpacity onPress={addBlankMed}>
            <Text style={{ color: "#007bff" }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [imageUri, parsed?.rawText, patientName]);

  return (
    <FlatList
      data={meds}
      keyExtractor={(item) => item.id}
      renderItem={renderMed}
      ListHeaderComponent={ListHeaderComponent}
      // optional: if you want a footer with the Save button
      ListFooterComponent={
        <View style={{ padding: 16 }}>
          <Button
            title={saving ? "Saving..." : "Save to Dashboard"}
            onPress={saveToDashboard}
            disabled={saving}
          />

        </View>
      }
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    />
  );
}
