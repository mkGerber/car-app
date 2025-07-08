import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  Avatar,
  ActivityIndicator,
  Button,
  useTheme,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";

export default function FriendRecommendations() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { colors } = useTheme();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<{ [id: string]: string }>(
    {}
  );
  const [followError, setFollowError] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        console.log("Fetching recommendations for user:", user.id);

        // Get users that the current user follows
        const { data: following, error: followingError } = await supabase
          .from("follows")
          .select("followed_id")
          .eq("follower_id", user.id);

        if (followingError) throw followingError;

        console.log("Found following:", following?.length || 0);

        // Build a set of following IDs
        const followingIds = new Set<string>();
        following?.forEach((f) => {
          followingIds.add(f.followed_id);
        });

        console.log("Following IDs:", Array.from(followingIds));

        // Get users that your following users follow (excluding yourself and your following)
        let mutualMap: Record<string, { count: number; user: any }> = {};

        for (const fid of followingIds) {
          const { data: fof, error: fofError } = await supabase
            .from("follows")
            .select(
              "followed_id, followed:followed_id(id, name, username, avatar_url)"
            )
            .eq("follower_id", fid);

          if (fofError) throw fofError;

          fof?.forEach((f) => {
            const otherId = f.followed_id;
            if (otherId !== user.id && !followingIds.has(otherId)) {
              // Get user info
              const userInfo = f.followed;
              if (!mutualMap[otherId]) {
                mutualMap[otherId] = { count: 1, user: userInfo };
              } else {
                mutualMap[otherId].count += 1;
              }
            }
          });
        }

        console.log("Mutual follows map:", Object.keys(mutualMap).length);

        // Convert to array and sort by mutual count
        const recs = Object.entries(mutualMap)
          .map(([id, { count, user }]) => ({
            id,
            name: user.name,
            username: user.username,
            avatar_url: user.avatar_url,
            mutualCount: count,
          }))
          .sort((a, b) => b.mutualCount - a.mutualCount)
          .slice(0, 10); // top 10

        console.log("Recommendations found:", recs.length);
        setRecommendations(recs);

        let usersToCheck: any[] = [];
        if (recs.length === 0) {
          console.log("No recommendations, fetching recent users");
          // Exclude current user and their following
          const excludeIds = [user.id, ...Array.from(followingIds)];
          console.log("Excluding IDs:", excludeIds);

          const { data: recent, error: recentError } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .not("id", "in", `(${excludeIds.join(",")})`)
            .order("created_at", { ascending: false })
            .limit(10);

          if (recentError) {
            console.error("Error fetching recent users:", recentError);
            throw recentError;
          }

          console.log("Recent users found:", recent?.length || 0);
          setRecentUsers(recent || []);
          usersToCheck = recent || [];
        } else {
          setRecentUsers([]);
          usersToCheck = recs;
        }

        // Check for existing follows for each user
        if (usersToCheck.length > 0) {
          const ids = usersToCheck.map((u) => u.id);
          const { data: follows, error: checkError } = await supabase
            .from("follows")
            .select("followed_id")
            .eq("follower_id", user.id)
            .in("followed_id", ids);

          if (checkError) throw checkError;

          // Build a map of userId -> status
          const statusMap: Record<string, "following"> = {};
          follows?.forEach((f) => {
            statusMap[f.followed_id] = "following";
          });

          // Set followStatus for each user
          setFollowStatus((prev) => {
            const updated = { ...prev };
            usersToCheck.forEach((u) => {
              if (statusMap[u.id] === "following") updated[u.id] = "following";
              else updated[u.id] = "idle";
            });
            return updated;
          });
        }
      } catch (err: any) {
        console.error("Error in fetchRecommendations:", err);
        setError(err.message);
        setRecommendations([]);
        setRecentUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [user]);

  const handleFollow = async (targetUser: any) => {
    if (!user) return;
    setFollowStatus((prev) => ({ ...prev, [targetUser.id]: "loading" }));
    setFollowError((prev) => ({ ...prev, [targetUser.id]: "" }));

    try {
      // Check if already following
      const { data: existingFollow, error: checkError } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("followed_id", targetUser.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingFollow) {
        throw new Error("Already following this user");
      }

      // Follow user
      const { error: followError } = await supabase.from("follows").insert({
        follower_id: user.id,
        followed_id: targetUser.id,
      });

      if (followError) throw followError;

      setFollowStatus((prev) => ({
        ...prev,
        [targetUser.id]: "following",
      }));
    } catch (err: any) {
      console.error("Error following user:", err);
      setFollowStatus((prev) => ({ ...prev, [targetUser.id]: "error" }));
      setFollowError((prev) => ({
        ...prev,
        [targetUser.id]: err.message || "Failed to follow user",
      }));
    }
  };

  const renderUserItem = (item: any, isRecent: boolean = false) => (
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
        <Text style={{ color: colors.onSurface + "99", fontSize: 13 }}>
          @{item.username}
        </Text>
        {!isRecent && item.mutualCount > 0 && (
          <Text style={{ color: colors.primary, fontSize: 12 }}>
            {item.mutualCount} mutual follow{item.mutualCount !== 1 ? "s" : ""}
          </Text>
        )}
      </View>
      <Button
        mode="contained"
        onPress={() => handleFollow(item)}
        disabled={followStatus[item.id] === "following"}
        loading={followStatus[item.id] === "loading"}
        style={{ marginLeft: 8 }}
      >
        {followStatus[item.id] === "following" ? "Following" : "Follow"}
      </Button>
    </View>
  );

  if (loading) {
    return (
      <View style={{ padding: 16 }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.error }}>Error: {error}</Text>
      </View>
    );
  }

  const displayUsers =
    recommendations.length > 0 ? recommendations : recentUsers;
  const isRecent = recommendations.length === 0;

  if (displayUsers.length === 0) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.onSurface + "99", textAlign: "center" }}>
          No recommendations available.
        </Text>
      </View>
    );
  }

  return (
    <View>{displayUsers.map((item) => renderUserItem(item, isRecent))}</View>
  );
}

const styles = StyleSheet.create({
  // Styles are now inline for theme support
});
