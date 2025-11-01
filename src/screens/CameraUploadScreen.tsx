// src/screens/CameraUploadScreen.tsx
import React, { useState } from "react";
import { View, Button, Image, ActivityIndicator, Alert, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

// PRESIGN helpers - make sure this file exists: src/lib/s3Upload.ts
import { getPresign, uploadToS3Presigned, notifyBackend } from "../lib/s3Upload";

type Props = NativeStackScreenProps<RootStackParamList, "CameraUpload">;

export default function CameraUploadScreen({ navigation }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function takePhotoAndUpload() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Camera permission is required to take a picture.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    // Support both old/new Expo shapes
    // @ts-ignore
    if ((result as any).cancelled || (result as any).canceled) return;

    const localUri = (result as any).assets?.[0]?.uri ?? (result as any).uri;
    if (!localUri) {
      Alert.alert("Error", "Could not capture image.");
      return;
    }

    setImageUri(localUri);
    setLoading(true);

    try {
      // resize client-side to keep upload sizes reasonable (<10MB)
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Use presigned upload flow
      const parsed = await presignUploadAndProcess(manipulated.uri);

      setLoading(false);
      navigation.navigate("PrescriptionReview", { parsed, imageUri: manipulated.uri });
    } catch (err: any) {
      setLoading(false);
      console.error("Upload error:", err);
      Alert.alert("Upload error", err?.message ?? String(err));
    }
  }

  /**
   * Presign -> PUT to S3 -> notify backend to run Textract
   * Returns parsed JSON from backend (Textract + Comprehend output)
   */
  async function presignUploadAndProcess(uri: string) {
    // Build filename and content type
    const filename = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const contentType = match ? `image/${match[1]}` : "image/jpeg";

    try {
      // 1) request presigned url from backend
      const presignResp = await getPresign(filename, contentType);
      // presignResp should be { url, key, bucket }
      const presignUrl = presignResp.url ?? presignResp.signedUrl ?? presignResp.putUrl ?? presignResp.presignUrl ?? presignResp.url;
      const key = presignResp.key;

      if (!presignUrl || !key) {
        throw new Error("Presign response missing url or key");
      }

      // 2) upload directly to S3 using presigned URL
      await uploadToS3Presigned(presignUrl, uri, contentType);

      // 3) notify backend to process this S3 object (Textract)
      // You can optionally pass patient info here if available:
      const parsed = await notifyBackend(key /*, patientId?, patientName? */);

      return parsed;
    } catch (err: any) {
      console.error("presignUploadAndProcess failed:", err);
      throw err;
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
      {imageUri && <Image source={{ uri: imageUri }} style={{ width: 300, height: 400, marginBottom: 12, resizeMode: "contain" }} />}
      <Button title="Open Camera & Upload" onPress={takePhotoAndUpload} />
      {loading && (
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Uploading & parsing...</Text>
        </View>
      )}
    </View>
  );
}
