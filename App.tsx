import ChatOverlay from "./src/components/chat/ChatOverlay";
import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider, MD3LightTheme, type MD3Theme } from "react-native-paper";

import RootNavigator from "./src/navigation/RootNavigator";
import tw from "./src/lib/tw";
import { initNotifications } from "./src/lib/notifications";

const c = (token: string, fallback: string) => (tw.color(token) as string) || fallback;

const theme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:    c("brand",  "#2563eb"),
    background: c("bg",     "#f8fafc"),
    surface:    c("card",   "#ffffff"),
    onSurface:  c("text",   "#0f172a"),
    outline:    c("border", "#e5e7eb"),
  },
};

export default function App() {
  // Keep refs so we can unsubscribe on unmount
  const receivedSubRef = React.useRef<Notifications.Subscription | null>(null);
  const responseSubRef = React.useRef<Notifications.Subscription | null>(null);

  React.useEffect(() => {
    // Initialize notifications (permissions + Android channels)
    initNotifications();

    // Foreground listener (fires even when app is open)
    receivedSubRef.current = Notifications.addNotificationReceivedListener((n) => {
      console.log("[Notif] received (foreground):", n.request.content);
    });

    // Tap listener (fires when user taps a notification)
    responseSubRef.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const doseId = resp.notification.request.content.data?.doseId as string | undefined;
      console.log("[Notif] tapped:", { doseId, content: resp.notification.request.content });
    });

    // Cleanup listeners on unmount / hot reload
    return () => {
      if (receivedSubRef.current) {
        Notifications.removeNotificationSubscription(receivedSubRef.current);
        receivedSubRef.current = null;
      }
      if (responseSubRef.current) {
        Notifications.removeNotificationSubscription(responseSubRef.current);
        responseSubRef.current = null;
      }
    };
  }, []);

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
        {/* Floating chatbot button & modal (appears on every screen) */}
        <ChatOverlay />
      </SafeAreaProvider>
    </PaperProvider>
  );
}
