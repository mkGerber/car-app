import { Stack } from "expo-router";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "../src/store";
import { AuthProvider } from "../src/context/AuthContext";
import { AppThemeProvider } from "../src/context/ThemeContext";
import { setupNotificationListeners } from "../src/utils/notificationHelper";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    // Set up notification listeners
    const subscription = setupNotificationListeners();

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <ReduxProvider store={store}>
      <AuthProvider>
        <AppThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppThemeProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}
