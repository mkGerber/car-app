import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text, Avatar, Appbar, useTheme, IconButton } from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../src/services/supabase";
import { useTheme as useAppTheme } from "../../../src/context/ThemeContext";
import { useSelector } from "react-redux";
import { RootState } from "../../../src/store";

export default function ChatMembersScreen() {
  const { id } = useLocalSearchParams();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const { isDarkTheme } = useAppTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const [isGroupOwner, setIsGroupOwner] = useState(false);

  useEffect(() => {
    fetchMembers();
    checkGroupOwner();
  }, [id]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("group_chat_members")
        .select("user_id, role")
        .eq("group_chat_id", id);
      if (error) throw error;
      if (!data || data.length === 0) {
        setMembers([]);
        return;
      }
      // Fetch user info
      const userIds = data.map((m: any) => m.user_id);
      const { data: users, error: userError } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .in("id", userIds);
      if (userError) throw userError;
      // Map members to user info
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));
      setMembers(
        data.map((m: any) => ({
          ...m,
          user: userMap.get(m.user_id) || {
            id: m.user_id,
            name: "Unknown",
            username: "unknown",
            avatar_url: null,
          },
        }))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkGroupOwner = async () => {
    // Fetch group info to check if current user is the owner
    const { data: group } = await supabase
      .from("group_chats")
      .select("created_by")
      .eq("id", id)
      .single();
    setIsGroupOwner(group?.created_by === user?.id);
  };

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert(
      "Remove Member",
      "Are you sure you want to remove this member from the group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase
                .from("group_chat_members")
                .delete()
                .eq("group_chat_id", id)
                .eq("user_id", memberId);
              setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
            } catch (err) {
              Alert.alert("Error", "Failed to remove member.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.error }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header
        style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outline,
        }}
      >
        <Appbar.BackAction
          onPress={() => router.back()}
          color={theme.colors.onBackground}
        />
        <Appbar.Content
          title="Members"
          titleStyle={{ color: theme.colors.onBackground }}
        />
      </Appbar.Header>

      <FlatList
        data={members}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.memberItem, { alignItems: "center" }]}>
            {item.user.avatar_url ? (
              <Avatar.Image
                source={{ uri: item.user.avatar_url }}
                size={48}
                style={{ backgroundColor: theme.colors.surfaceVariant }}
              />
            ) : (
              <Avatar.Icon
                icon="account"
                size={48}
                style={{ backgroundColor: theme.colors.surfaceVariant }}
                color={theme.colors.placeholder}
              />
            )}
            <View style={[styles.memberInfo, { flex: 1 }]}>
              <Text
                style={[
                  styles.memberName,
                  { color: theme.colors.onBackground },
                ]}
              >
                {item.user.name}
              </Text>
              <Text
                style={[
                  styles.memberUsername,
                  { color: theme.colors.placeholder },
                ]}
              >
                @{item.user.username}
              </Text>
              <Text
                style={[styles.memberRole, { color: theme.colors.primary }]}
              >
                {item.role}
              </Text>
            </View>
            {isGroupOwner && item.user_id !== user?.id && (
              <IconButton
                icon="account-remove"
                size={24}
                onPress={() => handleRemoveMember(item.user_id)}
                style={{ marginLeft: 8, alignSelf: "center" }}
                accessibilityLabel="Remove member"
              />
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  memberInfo: {
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  memberUsername: {
    fontSize: 14,
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
});
