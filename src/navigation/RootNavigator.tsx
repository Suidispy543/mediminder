// src/navigation/RootNavigator.tsx
import React from "react";
import { TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import CameraUploadScreen from "../screens/CameraUploadScreen";
import PrescriptionReview from "../screens/PrescriptionReview";

import Today from "../screens/Today";
import AddMedication from "../screens/AddMedication";
import History from "../screens/History";

const Tab = createBottomTabNavigator<any>(); // keep loose to avoid extra typing work
const Stack = createNativeStackNavigator<RootStackParamList>(); // <-- typed stack

/**
 * Exported type so screens can import the stack param list
 */
export type RootStackParamList = {
  MainTabs: undefined;
  CameraUpload: undefined;
  PrescriptionReview: { parsed: any; imageUri: string } | undefined;
  // add other stack routes here if needed
};

/**
 * Bottom tabs: Today, Camera, Add, History
 */
function MainTabs({ navigation }: any) {
  return (
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
            <MaterialCommunityIcons
              name="calendar-today"
              color={color}
              size={size}
            />
          ),
        }}
      />

      {/* Middle Camera tab */}
      <Tab.Screen
        name="Camera"
        component={Today} // dummy placeholder (we intercept press)
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="camera" color={color} size={size} />
          ),
          // Use a custom tabBarButton to intercept press and open CameraUpload stack screen
          tabBarButton: (props: any) => {
            // Destructure relevant props to forward styling/children and preserve accessibility
            const { accessibilityState, children, style, onLongPress, ...rest } = props;
            return (
              <TouchableOpacity
                {...rest}
                accessibilityState={accessibilityState}
                style={style}
                activeOpacity={0.8}
                // Use the navigation prop from the MainTabs scope to navigate to the stack screen
                onPress={() => navigation.navigate("CameraUpload")}
                onLongPress={onLongPress ? onLongPress : undefined}
              >
                {children}
              </TouchableOpacity>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            // prevent default switching to dummy tab
            e.preventDefault();
          },
        }}
      />

      <Tab.Screen
        name="Add"
        component={AddMedication}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="plus-circle-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tab.Screen
        name="History"
        component={History}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="history"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root stack: holds MainTabs and new camera flow screens
 */
export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* Your main bottom tabs */}
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />

        {/* New Camera upload screen */}
        <Stack.Screen
          name="CameraUpload"
          component={CameraUploadScreen}
          options={{ title: "Scan Prescription" }}
        />

        {/* New Prescription review screen */}
        <Stack.Screen
          name="PrescriptionReview"
          component={PrescriptionReview}
          options={{ title: "Review & Confirm" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
