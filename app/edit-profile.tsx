import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  useTheme,
  HelperText,
  Snackbar,
  ActivityIndicator,
  Avatar,
  Surface,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { supabase } from "../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../src/store";

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [newBanner, setNewBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("name, username, bio, avatar_url, banner_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setName(data.name || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
        setBannerUrl(data.banner_url || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setNewAvatar(manipulated.uri);
    }
  };

  const pickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setNewBanner(manipulated.uri);
    }
  };

  const uploadImage = async (
    imageUri: string,
    bucket: string,
    path: string
  ) => {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array for React Native compatibility
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let j = 0; j < byteCharacters.length; j++) {
      byteNumbers[j] = byteCharacters.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Upload using Supabase client storage API
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, byteArray, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    setError("");

    try {
      let finalAvatarUrl = avatarUrl;
      let finalBannerUrl = bannerUrl;

      // Delete old avatar if uploading a new one
      if (newAvatar && avatarUrl) {
        try {
          const marker = "/avatars/";
          const idx = avatarUrl.indexOf(marker);
          if (idx !== -1) {
            const filePath = avatarUrl.substring(idx + marker.length);
            await supabase.storage.from("avatars").remove([filePath]);
          }
        } catch (err) {
          // Ignore error, continue
          console.log("Error deleting old avatar:", err);
        }
      }

      // Upload new avatar if selected
      if (newAvatar) {
        const avatarPath = `${user.id}/${Date.now()}.jpg`;
        finalAvatarUrl = await uploadImage(newAvatar, "avatars", avatarPath);
      }

      // Delete old banner if uploading a new one
      if (newBanner && bannerUrl) {
        try {
          const marker = "/banners/";
          const idx = bannerUrl.indexOf(marker);
          if (idx !== -1) {
            const filePath = bannerUrl.substring(idx + marker.length);
            await supabase.storage.from("banners").remove([filePath]);
          }
        } catch (err) {
          // Ignore error, continue
          console.log("Error deleting old banner:", err);
        }
      }

      // Upload new banner if selected
      if (newBanner) {
        const bannerPath = `${user.id}/${Date.now()}.jpg`;
        finalBannerUrl = await uploadImage(newBanner, "banners", bannerPath);
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name,
          username,
          bio,
          avatar_url: finalAvatarUrl,
          banner_url: finalBannerUrl,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setSnackbar("Profile updated successfully!");
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (e: any) {
      console.error("Error updating profile:", e);
      setError(e.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 16, paddingBottom: 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode="interactive"
      >
        <Card style={styles.card}>
          <Card.Content>
            <Text
              variant="titleLarge"
              style={{ marginBottom: 16, color: colors.onBackground }}
            >
              Edit Profile
            </Text>

            {/* Banner Image */}
            <View style={styles.bannerSection}>
              <Text style={styles.sectionTitle}>Banner Image</Text>
              <View style={styles.bannerContainer}>
                <Image
                  source={{
                    uri:
                      newBanner ||
                      bannerUrl ||
                      "https://via.placeholder.com/400x120",
                  }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                <Button
                  mode="outlined"
                  onPress={pickBanner}
                  style={styles.imageButton}
                  icon="image"
                >
                  Change Banner
                </Button>
              </View>
            </View>

            {/* Avatar Image */}
            <View style={styles.avatarSection}>
              <Text style={styles.sectionTitle}>Profile Picture</Text>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarWrapper}>
                  <Image
                    source={{ uri: newAvatar || avatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                </View>
                <Button
                  mode="outlined"
                  onPress={pickAvatar}
                  style={styles.imageButton}
                  icon="account-edit"
                >
                  Change Picture
                </Button>
              </View>
            </View>

            {/* Profile Fields */}
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              mode="outlined"
              required
            />

            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              mode="outlined"
              required
            />

            <TextInput
              label="Bio"
              value={bio}
              onChangeText={setBio}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            {error ? <HelperText type="error">{error}</HelperText> : null}

            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={() => router.back()}
                style={[styles.button, styles.cancelButton]}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.button}
                loading={saving}
                disabled={saving}
              >
                Save Changes
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Snackbar
          visible={!!snackbar}
          onDismiss={() => setSnackbar("")}
          duration={2000}
        >
          {snackbar}
        </Snackbar>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  bannerSection: {
    marginBottom: 24,
  },
  avatarSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#d4af37",
  },
  bannerContainer: {
    alignItems: "center",
  },
  bannerImage: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    alignItems: "center",
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    marginBottom: 12,
    borderColor: "#d4af37",
    borderWidth: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  imageButton: {
    borderColor: "#d4af37",
    borderWidth: 1,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  cancelButton: {
    borderColor: "#666",
  },
});
