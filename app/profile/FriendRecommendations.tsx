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
  const [requestStatus, setRequestStatus] = useState<{ [id: string]: string }>(
    {}
  );
  const [requestError, setRequestError] = useState<{ [id: string]: string }>(
    {}
  );

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        console.log("Fetching recommendations for user:", user.id);

        // compile all friends of user
        const { data: friendships, error: friendsError } = await supabase
          .from("friendships")
          .select("id, sender_id, receiver_id, status")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq("status", "accepted");

        if (friendsError) throw friendsError;

        console.log("Found friendships:", friendships?.length || 0);

        // build a set of friend IDs
        const friendIds = new Set<string>();
        friendships?.forEach((f) => {
          if (f.sender_id === user.id) friendIds.add(f.receiver_id);
          else friendIds.add(f.sender_id);
        });

        console.log("Friend IDs:", Array.from(friendIds));

        // get all friends of your friends (excluding yourself and your friends)
        let mutualMap: Record<string, { count: number; user: any }> = {};

        for (const fid of friendIds) {
          const { data: fof, error: fofError } = await supabase
            .from("friendships")
            .select(
              "sender_id, receiver_id, status, sender:sender_id(id, name, username, avatar_url), receiver:receiver_id(id, name, username, avatar_url)"
            )
            .or(`sender_id.eq.${fid},receiver_id.eq.${fid}`)
            .eq("status", "accepted");

          if (fofError) throw fofError;

          fof?.forEach((f) => {
            const otherId = f.sender_id === fid ? f.receiver_id : f.sender_id;
            if (otherId !== user.id && !friendIds.has(otherId)) {
              // Get user info
              const userInfo = f.sender_id === otherId ? f.sender : f.receiver;
              if (!mutualMap[otherId]) {
                mutualMap[otherId] = { count: 1, user: userInfo };
              } else {
                mutualMap[otherId].count += 1;
              }
            }
          });
        }

        console.log("Mutual friends map:", Object.keys(mutualMap).length);

        // convert to array and sort by mutual count
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
          // exclude current user and their friends
          const excludeIds = [user.id, ...Array.from(friendIds)];
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

        // Check for existing friendships/requests for each user
        if (usersToCheck.length > 0) {
          const ids = usersToCheck.map((u) => u.id);
          const { data: friendships2, error: checkError } = await supabase
            .from("friendships")
            .select("sender_id, receiver_id, status")
            .or(
              `and(sender_id.eq.${user.id},receiver_id.in.(${ids
                .map((id) => `"${id}"`)
                .join(",")})),and(sender_id.in.(${ids
                .map((id) => `"${id}"`)
                .join(",")}),receiver_id.eq.${user.id})`
            )
            .in("status", ["pending", "accepted"]);

          if (checkError) throw checkError;

          // Build a map of userId -> status
          const statusMap: Record<string, "sent" | "accepted"> = {};
          friendships2?.forEach((f) => {
            const otherId =
              f.sender_id === user.id ? f.receiver_id : f.sender_id;
            if (f.status === "pending") statusMap[otherId] = "sent";
            if (f.status === "accepted") statusMap[otherId] = "accepted";
          });

          // Set requestStatus for each user
          setRequestStatus((prev) => {
            const updated = { ...prev };
            usersToCheck.forEach((u) => {
              if (statusMap[u.id] === "sent") updated[u.id] = "sent";
              else if (statusMap[u.id] === "accepted")
                updated[u.id] = "sent"; // treat accepted as sent
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

  const handleSendRequest = async (targetUser: any) => {
    if (!user) return;
    setRequestStatus((prev) => ({ ...prev, [targetUser.id]: "loading" }));
    setRequestError((prev) => ({ ...prev, [targetUser.id]: "" }));

    try {
      // Check if a friendship already exists
      const { data: existingFriendship, error: checkError } = await supabase
        .from("friendships")
        .select("id, status")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${user.id})`
        )
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingFriendship) {
        if (existingFriendship.status === "pending") {
          throw new Error("Friend request already sent");
        } else if (existingFriendship.status === "accepted") {
          throw new Error("Already friends with this user");
        } else if (existingFriendship.status === "rejected") {
          throw new Error("Friend request was previously rejected");
        }
      }

      // Send the friend request
      const { error: sendError } = await supabase.from("friendships").insert({
        sender_id: user.id,
        receiver_id: targetUser.id,
        status: "pending",
      });

      if (sendError) throw sendError;

      setRequestStatus((prev) => ({ ...prev, [targetUser.id]: "sent" }));
    } catch (err: any) {
      setRequestStatus((prev) => ({ ...prev, [targetUser.id]: "error" }));
      setRequestError((prev) => ({ ...prev, [targetUser.id]: err.message }));
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
        style={{ marginRight: 12, backgroundColor: colors.primary + "22" }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "bold", color: colors.onSurface }}>
          {item.name}
        </Text>
        <Text style={{ color: colors.onSurface + "99", fontSize: 13 }}>
          @{item.username}
        </Text>
        {!isRecent && item.mutualCount && (
          <Text style={{ color: colors.onSurface + "99", fontSize: 12 }}>
            {item.mutualCount} mutual friend{item.mutualCount > 1 ? "s" : ""}
          </Text>
        )}
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
          ? "Sent"
          : "Send Request"}
      </Button>
    </View>
  );

  return (
    <View>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text
          style={{
            color: colors.error,
            textAlign: "center",
            marginVertical: 16,
          }}
        >
          Error: {error}
        </Text>
      ) : recommendations.length > 0 ? (
        <View>
          {recommendations.map((item) => renderUserItem(item, false))}
        </View>
      ) : recentUsers.length > 0 ? (
        <View>
          <Text
            style={{
              color: colors.onSurface + "99",
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            Recently joined users
          </Text>
          {recentUsers.map((item) => renderUserItem(item, true))}
        </View>
      ) : (
        <Text
          style={{
            color: colors.onSurface + "99",
            textAlign: "center",
            marginVertical: 16,
          }}
        >
          No recommendations yet!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles are now inline for theme support
});
