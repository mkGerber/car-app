import React, { useEffect, useState } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Text, Avatar, Appbar, useTheme } from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../src/services/supabase";
import { useTheme as useAppTheme } from "../../../src/context/ThemeContext";

export default function ChatMembersScreen() {
  const { id } = useLocalSearchParams();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const { isDarkTheme } = useAppTheme();

  useEffect(() => {
    fetchMembers();
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
          <View style={styles.memberItem}>
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
            <View style={styles.memberInfo}>
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
