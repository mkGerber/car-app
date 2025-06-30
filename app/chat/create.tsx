import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  useTheme,
  Appbar,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";

export default function CreateGroupChatScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const handleCreate = async () => {
    if (!user?.id || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Create the group chat
      const { data: group, error: groupError } = await supabase
        .from("group_chats")
        .insert({
          name: name.trim(),
          description: description.trim(),
          created_by: user.id,
        })
        .select()
        .single();
      if (groupError) throw groupError;
      // Add the creator as an admin member
      const { error: memberError } = await supabase
        .from("group_chat_members")
        .insert({
          group_chat_id: group.id,
          user_id: user.id,
          role: "admin",
        });
      if (memberError) throw memberError;
      router.replace(`/chat/${group.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Create Group" />
      </Appbar.Header>
      <View style={styles.container}>
        <TextInput
          label="Group Name"
          value={name}
          onChangeText={setName}
          style={{ marginBottom: 16 }}
          mode="outlined"
        />
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          style={{ marginBottom: 16 }}
          mode="outlined"
          multiline
          numberOfLines={3}
        />
        {error && (
          <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
            {error}
          </Text>
        )}
        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={!name.trim() || loading}
        >
          Create Group
        </Button>
        {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
});
