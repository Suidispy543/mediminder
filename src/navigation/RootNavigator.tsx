import React from "react";
import { Alert, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import Today from "../screens/Today";
import AddMedication from "../screens/AddMedication";
import History from "../screens/History"; // ⬅️ add this import

const Tab = createBottomTabNavigator();

export default function RootNavigator() {
  const handleCameraPress = React.useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      console.log("[camera] captured:", asset.uri);
      // upload if you want…
    } catch (e: any) {
      Alert.alert("Camera Error", e?.message ?? "Failed to open camera");
    }
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
        }}
      >
        <Tab.Screen
          name="Today"
          component={Today}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-today" color={color} size={size} />
            ),
          }}
        />

        {/* Middle Camera tab that opens camera directly */}
        <Tab.Screen
          name="Camera"
          component={Today} // dummy, won't show because we override button
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="camera" color={color} size={size} />
            ),
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                activeOpacity={0.8}
                onPress={handleCameraPress}
                onLongPress={props.onLongPress}
              />
            ),
          }}
          listeners={{
            tabPress: (e) => e.preventDefault(),
          }}
        />

        <Tab.Screen
          name="Add"
          component={AddMedication}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="plus-circle-outline" color={color} size={size} />
            ),
          }}
        />

        {/* ⬇️ NEW: History tab */}
        <Tab.Screen
          name="History"
          component={History}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
