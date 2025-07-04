import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import {
  Text,
  Avatar,
  ActivityIndicator,
  FAB,
  useTheme,
  Surface,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GroupChatListScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      // First, get all group IDs where the user is a member
      const { data: userGroups, error: userGroupsError } = await supabase
        .from("group_chat_members")
        .select("group_chat_id")
        .eq("user_id", user?.id);

      if (userGroupsError) throw userGroupsError;

      if (!userGroups || userGroups.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = userGroups.map((g) => g.group_chat_id);

      // Then fetch the full group details for those groups
      const { data, error } = await supabase
        .from("group_chats")
        .select(
          `
          id,
          name,
          description,
          image_url,
          created_by:created_by (
            id,
            name,
            avatar_url
          ),
          member_count:group_chat_members(count)
        `
        )
        .in("id", groupIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform the data to include the member count and fix created_by
      const transformedData = (data || []).map((group: any) => ({
        ...group,
        member_count: Array.isArray(group.member_count)
          ? group.member_count[0]?.count || 0
          : 0,
        created_by: Array.isArray(group.created_by)
          ? group.created_by[0]
          : group.created_by,
      }));

      setGroups(transformedData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchGroups();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.colors.error }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Custom Header */}
      <Surface
        style={[
          styles.header,
          { height: insets.top + 56, backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={[styles.headerContent, { paddingTop: insets.top }]}>
          <Text
            variant="headlineSmall"
            style={[styles.headerTitle, { color: theme.colors.onSurface }]}
          >
            Chats
          </Text>
        </View>
      </Surface>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { marginTop: insets.top + 56 }]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.groupItem,
              {
                backgroundColor: undefined,
              },
            ]}
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <Image
                source={require("../../assets/chat-gradient.png")}
                style={{
                  width: "100%",
                  height: "100%",
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 12,
                  opacity: 0.95,
                }}
                resizeMode="cover"
              />
            </View>
            <Avatar.Image
              source={item.image_url ? { uri: item.image_url } : undefined}
              size={56}
              style={{ marginRight: 16 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                variant="titleMedium"
                style={{ color: "#fff", fontWeight: "bold" }}
              >
                {item.name}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={{ color: "#fff" }}
              >
                {item.description}
              </Text>
              <Text variant="labelSmall" style={{ color: "#fff" }}>
                {item.member_count} members
                {item.created_by?.name
                  ? ` • Created by ${item.created_by.name}`
                  : ""}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No group chats yet.</Text>}
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/chat/create")}
        label="Create Group"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    elevation: 2,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  list: {
    padding: 16,
  },
});
