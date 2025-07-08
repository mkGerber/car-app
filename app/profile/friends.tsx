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
  SegmentedButtons,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router, useLocalSearchParams } from "expo-router";
import FriendRecommendations from "./FriendRecommendations";

export default function FriendsScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { tab, userId } = useLocalSearchParams();
  const [following, setFollowing] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<{ [id: string]: string }>(
    {}
  );
  const [followErrorMsg, setFollowErrorMsg] = useState<string | null>(null);
  const [followSuccessMsg, setFollowSuccessMsg] = useState<string | null>(null);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(
    typeof tab === "string" ? tab : "following"
  );
  const [viewingOtherUser, setViewingOtherUser] = useState(false);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const paperTheme = useTheme();
  const { colors } = paperTheme;

  // Determine if we're viewing another user's profile
  const targetUserId = userId || user?.id;

  // Fetch following and followers
  const fetchFollowData = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      // Fetch users that the target user follows
      const { data: followingData, error: followingError } = await supabase
        .from("follows")
        .select(
          `id, created_at, followed:followed_id (id, name, username, avatar_url)`
        )
        .eq("follower_id", targetUserId)
        .order("created_at", { ascending: false });
      if (followingError) throw followingError;

      // Fetch users that follow the target user
      const { data: followersData, error: followersError } = await supabase
        .from("follows")
        .select(
          `id, created_at, follower:follower_id (id, name, username, avatar_url)`
        )
        .eq("followed_id", targetUserId)
        .order("created_at", { ascending: false });
      if (followersError) throw followersError;

      setFollowing(followingData || []);
      setFollowers(followersData || []);

      // If viewing another user's profile, fetch their profile info
      if (userId && userId !== user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url")
          .eq("id", userId)
          .single();
        setOtherUserProfile(profileData);
        setViewingOtherUser(true);
      } else {
        setViewingOtherUser(false);
        setOtherUserProfile(null);
      }
    } catch (err) {
      console.error("Error fetching follow data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Unfollow user (only for current user's following list)
  const handleUnfollow = async (followId: string) => {
    if (!user || viewingOtherUser) return;
    try {
      await supabase.from("follows").delete().eq("id", followId);
      setFollowing(following.filter((f) => f.id !== followId));
    } catch (err) {
      console.error("Error unfollowing:", err);
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

  // Follow user
  const handleFollow = useCallback(
    async (targetUser: any) => {
      if (!user) return;
      setFollowStatus((prev) => ({ ...prev, [targetUser.id]: "loading" }));
      setFollowErrorMsg(null);
      setFollowSuccessMsg(null);
      try {
        // Check if already following
        const { data: existing, error: checkError } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("followed_id", targetUser.id)
          .maybeSingle();
        if (checkError) throw checkError;
        if (existing) {
          setFollowStatus((prev) => ({
            ...prev,
            [targetUser.id]: "following",
          }));
          setFollowErrorMsg("You are already following this user.");
          return;
        }
        // Follow user
        const { error: followError } = await supabase.from("follows").insert({
          follower_id: user.id,
          followed_id: targetUser.id,
        });
        if (followError) {
          setFollowErrorMsg(followError.message || "Failed to follow user.");
          throw followError;
        }
        setFollowStatus((prev) => ({ ...prev, [targetUser.id]: "following" }));
        setFollowSuccessMsg("Successfully followed user!");
        // Refresh follow data
        fetchFollowData();
      } catch (err: any) {
        setFollowStatus((prev) => ({ ...prev, [targetUser.id]: "error" }));
        if (!followErrorMsg)
          setFollowErrorMsg("Failed to follow user. Please try again.");
      }
    },
    [user, followErrorMsg]
  );

  useEffect(() => {
    fetchFollowData();
  }, [targetUserId]);

  const renderUserItem = (item: any, isFollowing: boolean = false) => {
    const profile = isFollowing ? item.followed : item.follower;
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
          <Text style={{ fontWeight: "bold", color: colors.onSurface }}>
            {profile.name}
          </Text>
          <Text style={{ color: colors.onSurface + "99", fontSize: 13 }}>
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
        {isFollowing && !viewingOtherUser && (
          <IconButton
            icon="account-remove"
            onPress={() => handleUnfollow(item.id)}
          />
        )}
      </View>
    );
  };

  const getTitle = () => {
    if (viewingOtherUser && otherUserProfile) {
      return `${otherUserProfile.name}'s ${activeTab}`;
    }
    return "Friends";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={getTitle()} />
      </Appbar.Header>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar - Only show for current user */}
        {!viewingOtherUser && (
          <>
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

            {/* Search Results */}
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
                      <Text
                        style={{ fontWeight: "bold", color: colors.onSurface }}
                      >
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
                      onPress={() => handleFollow(item)}
                      disabled={followStatus[item.id] === "following"}
                      loading={followStatus[item.id] === "loading"}
                      style={{ marginLeft: 8 }}
                    >
                      {followStatus[item.id] === "following"
                        ? "Following"
                        : "Follow"}
                    </Button>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Collapsible Recommendations */}
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() =>
                  setRecommendationsExpanded(!recommendationsExpanded)
                }
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
                    Recommended Users
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
          </>
        )}

        {/* Following/Followers Tabs */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={[
              {
                value: "following",
                label: `Following (${following.length})`,
              },
              {
                value: "followers",
                label: `Followers (${followers.length})`,
              },
            ]}
            style={{ marginBottom: 16 }}
          />

          {loading ? (
            <ActivityIndicator />
          ) : activeTab === "following" ? (
            following.length === 0 ? (
              <Text
                style={{
                  color: colors.onSurface + "99",
                  textAlign: "center",
                  marginVertical: 16,
                }}
              >
                {viewingOtherUser
                  ? "Not following anyone yet."
                  : "You are not following anyone yet."}
              </Text>
            ) : (
              <View>{following.map((item) => renderUserItem(item, true))}</View>
            )
          ) : followers.length === 0 ? (
            <Text
              style={{
                color: colors.onSurface + "99",
                textAlign: "center",
                marginVertical: 16,
              }}
            >
              {viewingOtherUser
                ? "No followers yet."
                : "You have no followers yet."}
            </Text>
          ) : (
            <View>{followers.map((item) => renderUserItem(item, false))}</View>
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
