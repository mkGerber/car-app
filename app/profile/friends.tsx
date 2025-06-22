import React, { useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import {
  Text,
  Avatar,
  ActivityIndicator,
  useTheme,
  Appbar,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";

export default function FriendsListScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const paperTheme = useTheme();

  const fetchFriends = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Friends where user is receiver
      const { data: receivedFriends, error: receivedError } = await supabase
        .from("friendships")
        .select(
          `id, status, created_at, profile:sender_id (id, name, username, avatar_url)`
        )
        .eq("receiver_id", user.id)
        .eq("status", "accepted");
      if (receivedError) throw receivedError;
      // Friends where user is sender
      const { data: sentFriends, error: sentError } = await supabase
        .from("friendships")
        .select(
          `id, status, created_at, profile:receiver_id (id, name, username, avatar_url)`
        )
        .eq("sender_id", user.id)
        .eq("status", "accepted");
      if (sentError) throw sentError;
      // Combine and sort
      const allFriends = [
        ...(receivedFriends || []),
        ...(sentFriends || []),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setFriends(allFriends);
    } catch (err) {
      console.error("Error fetching friends:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: paperTheme.colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Friends" />
      </Appbar.Header>
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : friends.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: paperTheme.colors.onSurfaceVariant }}>
            No friends yet. Add some friends to see them here!
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.profile.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.friendRow}
              onPress={() => router.push(`/profile/${item.profile.id}`)}
            >
              <Avatar.Image
                size={48}
                source={{ uri: item.profile.avatar_url }}
                style={{ marginRight: 16 }}
              />
              <View>
                <Text
                  style={{
                    fontWeight: "bold",
                    color: paperTheme.colors.onSurface,
                  }}
                >
                  {item.profile.name}
                </Text>
                <Text
                  style={{
                    color: paperTheme.colors.onSurfaceVariant,
                    fontSize: 13,
                  }}
                >
                  @{item.profile.username}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
});
