import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
  HelperText,
} from "react-native-paper";
import { Link, router } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme as useAppTheme } from "../../src/context/ThemeContext";
import { awardBadge } from "../../src/utils/awardBadges";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const theme = useTheme();
  const { isDarkTheme } = useAppTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("Attempting to sign in...");
      const user = await signIn(email, password);
      console.log("Sign in successful, redirecting to feed...");
      router.replace("/(tabs)/feed");
      if (user?.id) {
        // Add your own logic for streak and join date
        await awardBadge(user.id, "Streak");
        await awardBadge(user.id, "OG Member");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Surface
          style={[
            styles.surface,
            {
              backgroundColor: theme.colors.surface,
              elevation: 4,
            },
          ]}
        >
          <Image
            source={
              theme.dark
                ? require("../../assets/gearly-v6White.png")
                : require("../../assets/gearly-v6Black.png")
            }
            style={{
              width: 120,
              height: 40,
              alignSelf: "center",
              marginBottom: 16,
            }}
            resizeMode="contain"
          />
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            Welcome Back
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.subtitle, { color: theme.colors.onSurface }]}
          >
            Sign in to access your digital garage
          </Text>

          {error ? (
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          ) : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            theme={theme}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
            theme={theme}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            theme={theme}
          >
            Sign In
          </Button>

          <View style={styles.links}>
            <Link href="/(auth)/signup" asChild>
              <Button mode="text">Don't have an account? Sign up</Button>
            </Link>
            <Link href="/(auth)/forgot-password" asChild>
              <Button mode="text">Forgot password?</Button>
            </Link>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  surface: {
    flex: 1,
    margin: 16,
    padding: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 32,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 8,
  },
  links: {
    alignItems: "center",
    gap: 8,
  },
});
