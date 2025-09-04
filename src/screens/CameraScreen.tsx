import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CameraCapture from "../components/CameraCapture";
import tw from "../lib/tw";

export default function CameraScreen() {
  return (
    <SafeAreaView edges={["top"]} style={tw`flex-1 bg-bg`}>
      <View style={tw`flex-1 items-center justify-center`}>
        <CameraCapture onUploaded={(res) => console.log("[upload] response:", res)} />
      </View>
    </SafeAreaView>
  );
}
