import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  Text,
  Avatar,
  ActivityIndicator,
  useTheme,
  Appbar,
  Button,
  IconButton,
  TextInput as PaperTextInput,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import FriendRecommendations from "./FriendRecommendations";

export default function FriendsScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<{ [id: string]: string }>(
    {}
  );
  const [requestErrorMsg, setRequestErrorMsg] = useState<string | null>(null);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState<string | null>(
    null
  );
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);
  const paperTheme = useTheme();
  const { colors } = paperTheme;

  // Fetch friends
  const fetchFriends = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: receivedFriends, error: receivedError } = await supabase
        .from("friendships")
        .select(
          `id, status, created_at, profile:sender_id (id, name, username, avatar_url)`
        )
        .eq("receiver_id", user.id)
        .eq("status", "accepted");
      if (receivedError) throw receivedError;
      const { data: sentFriends, error: sentError } = await supabase
        .from("friendships")
        .select(
          `id, status, created_at, profile:receiver_id (id, name, username, avatar_url)`
        )
        .eq("sender_id", user.id)
        .eq("status", "accepted");
      if (sentError) throw sentError;
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

  // Remove friend
  const handleRemoveFriend = async (friendshipId: string) => {
    try {
      await supabase.from("friendships").delete().eq("id", friendshipId);
      setFriends(friends.filter((f) => f.id !== friendshipId));
    } catch (err) {
      // Optionally show error
    }
  };

  // Search users
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    let active = true;
    setSearchLoading(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url")
          .or(`username.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
          .limit(5);
        if (error) throw error;
        const filtered = data?.filter((u) => u.id !== user?.id) || [];
        if (active) setSearchResults(filtered);
      } catch (err: any) {
        if (active) setSearchError(err.message);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, user]);

  // Send friend request
  const handleSendRequest = useCallback(
    async (targetUser: any) => {
      if (!user) return;
      setRequestStatus((prev) => ({ ...prev, [targetUser.id]: "loading" }));
      setRequestErrorMsg(null);
      setRequestSuccessMsg(null);
      try {
        // Check if friendship exists
        const { data: existing, error: checkError } = await supabase
          .from("friendships")
          .select("id, status")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${user.id})`
          )
          .maybeSingle();
        if (checkError) throw checkError;
        if (existing) {
          setRequestStatus((prev) => ({
            ...prev,
            [targetUser.id]: existing.status,
          }));
          setRequestErrorMsg(
            "You already have a pending or accepted friendship with this user."
          );
          return;
        }
        // Send request
        const { error: sendError } = await supabase.from("friendships").insert({
          sender_id: user.id,
          receiver_id: targetUser.id,
          status: "pending",
        });
        if (sendError) {
          setRequestErrorMsg(
            sendError.message || "Failed to send friend request."
          );
          throw sendError;
        }
        setRequestStatus((prev) => ({ ...prev, [targetUser.id]: "sent" }));
        setRequestSuccessMsg("Friend request sent!");
      } catch (err: any) {
        setRequestStatus((prev) => ({ ...prev, [targetUser.id]: "error" }));
        if (!requestErrorMsg)
          setRequestErrorMsg(
            "Failed to send friend request. Please try again."
          );
      }
    },
    [user, requestErrorMsg]
  );

  useEffect(() => {
    fetchFriends();
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Friends" />
      </Appbar.Header>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar - Outside of FlatList */}
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <PaperTextInput
            placeholder="Search users by name or username"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ backgroundColor: colors.surface }}
            mode="outlined"
            placeholderTextColor={colors.onSurface + "99"}
            underlineColor={colors.primary}
            selectionColor={colors.primary}
            autoCorrect={false}
            autoCapitalize="none"
            theme={{
              colors: {
                text: colors.onSurface,
                placeholder: colors.onSurface + "99",
              },
            }}
          />
        </View>

        {/* Search Results - Outside of FlatList */}
        {searchLoading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ActivityIndicator />
          </View>
        ) : searchQuery.trim() && searchResults.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text
              style={{
                color: colors.primary,
                fontWeight: "bold",
                fontSize: 16,
                marginBottom: 8,
              }}
            >
              Search Results
            </Text>
            {searchResults.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                  shadowColor: colors.onSurface,
                  shadowOpacity: 0.07,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  borderWidth: 1,
                  borderColor: colors.outline,
                }}
              >
                <Avatar.Image
                  size={40}
                  source={{ uri: item.avatar_url }}
                  style={{
                    marginRight: 12,
                    backgroundColor: colors.primary + "22",
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold", color: colors.onSurface }}>
                    {item.name}
                  </Text>
                  <Text
                    style={{ color: colors.onSurface + "99", fontSize: 13 }}
                  >
                    @{item.username}
                  </Text>
                </View>
                <Button
                  mode="contained"
                  onPress={() => handleSendRequest(item)}
                  disabled={
                    requestStatus[item.id] === "sent" ||
                    requestStatus[item.id] === "accepted"
                  }
                  loading={requestStatus[item.id] === "loading"}
                  style={{ marginLeft: 8 }}
                >
                  {requestStatus[item.id] === "sent" ||
                  requestStatus[item.id] === "accepted"
                    ? "Requested"
                    : "Add"}
                </Button>
              </View>
            ))}
          </View>
        ) : null}

        {/* Collapsible Recommendations - Above Friends List */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setRecommendationsExpanded(!recommendationsExpanded)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.outline,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  fontWeight: "bold",
                  fontSize: 18,
                  color: colors.primary,
                  letterSpacing: 0.5,
                }}
              >
                Recommended Friends
              </Text>
              <View
                style={{
                  marginLeft: 8,
                  backgroundColor: colors.primary + "22",
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.primary,
                    fontWeight: "bold",
                  }}
                >
                  NEW
                </Text>
              </View>
            </View>
            <IconButton
              icon={recommendationsExpanded ? "chevron-up" : "chevron-down"}
              size={24}
              iconColor={colors.primary}
            />
          </TouchableOpacity>

          {recommendationsExpanded && (
            <View style={{ marginTop: 12 }}>
              <FriendRecommendations />
            </View>
          )}
        </View>

        {/* Friends List - Render as regular Views instead of FlatList */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 18,
              marginBottom: 8,
              color: colors.primary,
              letterSpacing: 0.5,
            }}
          >
            Your Friends
          </Text>

          {loading ? (
            <ActivityIndicator />
          ) : friends.length === 0 ? (
            <Text
              style={{
                color: colors.onSurface + "99",
                textAlign: "center",
                marginVertical: 16,
              }}
            >
              You have no friends yet.
            </Text>
          ) : (
            <View>
              {friends.map((item) => {
                const profile = item.profile;
                return (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 12,
                      shadowColor: colors.onSurface,
                      shadowOpacity: 0.07,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      borderWidth: 1,
                      borderColor: colors.outline,
                    }}
                  >
                    <Avatar.Image
                      size={40}
                      source={{ uri: profile.avatar_url }}
                      style={{
                        marginRight: 12,
                        backgroundColor: colors.primary + "22",
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontWeight: "bold", color: colors.onSurface }}
                      >
                        {profile.name}
                      </Text>
                      <Text
                        style={{ color: colors.onSurface + "99", fontSize: 13 }}
                      >
                        @{profile.username}
                      </Text>
                    </View>
                    <Button
                      mode="outlined"
                      onPress={() => router.push(`/profile/${profile.id}`)}
                      style={{ marginRight: 8 }}
                    >
                      View
                    </Button>
                    <IconButton
                      icon="account-remove"
                      onPress={() => handleRemoveFriend(item.id)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
