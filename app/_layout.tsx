import { Stack } from "expo-router";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "../src/store";
import { AuthProvider } from "../src/context/AuthContext";
import { AppThemeProvider } from "../src/context/ThemeContext";

export default function RootLayout() {
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
