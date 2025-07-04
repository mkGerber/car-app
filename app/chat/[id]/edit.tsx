import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Appbar,
  useTheme,
  Avatar,
  IconButton,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../src/services/supabase";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useSelector } from "react-redux";
import { RootState } from "../../../src/store";
import * as FileSystem from "expo-file-system";

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useSelector((state: RootState) => state.auth);
  const [group, setGroup] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const fetchGroup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("group_chats")
        .select("id, name, description, image_url, created_by")
        .eq("id", id)
        .single();
      if (error) throw error;
      setGroup(data);
      setName(data.name);
      setDescription(data.description || "");
      setImage(data.image_url || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user && group && user.id === group.created_by;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Compress the image
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(manipResult.uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!uri) return null;
    setUploading(true);
    try {
      // Read and compress image as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Convert base64 to Uint8Array
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Generate unique filename
      const ext = uri.split(".").pop();
      const fileName = `${id}/${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}.jpg`;
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("group-images")
        .upload(fileName, byteArray, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("group-images")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err) {
      setError("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setUploading(true);
    let imageUrl = group.image_url;
    if (image && image !== group.image_url && image.startsWith("file")) {
      const uploaded = await uploadImage(image);
      if (uploaded) imageUrl = uploaded;
    }
    try {
      const { error } = await supabase
        .from("group_chats")
        .update({
          name,
          description,
          image_url: imageUrl,
        })
        .eq("id", id)
        .eq("created_by", user.id);
      if (error) throw error;
      router.back();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text>You do not have permission to edit this group.</Text>
      </View>
    );
  }
  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction
          onPress={() => router.back()}
          color={theme.colors.onBackground}
        />
        <Appbar.Content
          title="Edit Group"
          titleStyle={{ color: theme.colors.onBackground }}
        />
      </Appbar.Header>
      <View style={styles.content}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
          {image ? (
            <Avatar.Image
              source={{ uri: image }}
              size={96}
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            />
          ) : (
            <Avatar.Icon
              icon="camera"
              size={96}
              style={{ backgroundColor: theme.colors.surfaceVariant }}
              color={theme.colors.primary}
            />
          )}
          <Text style={{ color: theme.colors.primary, marginTop: 8 }}>
            Change Photo
          </Text>
        </TouchableOpacity>
        <TextInput
          label="Group Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
          mode="outlined"
          multiline
        />
        {error && (
          <Text style={{ color: theme.colors.error, marginTop: 8 }}>
            {error}
          </Text>
        )}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={uploading}
          disabled={uploading || !name.trim()}
          style={{ marginTop: 24 }}
        >
          Save Changes
        </Button>
      </View>
    </View>
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
  content: {
    flex: 1,
    alignItems: "center",
    padding: 24,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  input: {
    width: "100%",
    marginBottom: 16,
  },
});
