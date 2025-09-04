import * as React from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import PrimaryButton from "./PrimaryButton";
import tw from "../lib/tw";
import { uploadPhoto } from "../lib/upload";

type Props = {
  onUploaded?: (result: any) => void; // optional callback with server response
};

export default function CameraCapture({ onUploaded }: Props) {
  const onPressAsync = async () => {
    try {
      // ask permission on demand
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        allowsEditing: false,
        exif: false,
      });

      if (result.canceled) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Oops", "No image captured.");
        return;
      }

      // upload
      const response = await uploadPhoto(asset.uri);
      onUploaded?.(response);
      Alert.alert("Uploaded ✅", "Your photo has been uploaded.");
    } catch (e: any) {
      console.warn("[camera] error", e);
      Alert.alert("Upload failed", e?.message ?? "Something went wrong.");
    }
  };

  return (
    <PrimaryButton
      mode="contained"
      icon="camera"
      onPressAsync={onPressAsync}
      // center-ish large button look consistent with your brand
      style={tw`rounded-2xl py-3 px-5`}
    >
      Open Camera
    </PrimaryButton>
  );
}
