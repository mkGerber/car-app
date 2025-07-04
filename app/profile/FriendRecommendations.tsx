import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Avatar, ActivityIndicator, Button } from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";

export default function FriendRecommendations() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState<{ [id: string]: string }>(
    {}
  );

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // compile all friends of user
        const { data: friendships, error: friendsError } = await supabase
          .from("friendships")
          .select("id, sender_id, receiver_id, status")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq("status", "accepted");
        if (friendsError) throw friendsError;
        // build a set of friend IDs
        const friendIds = new Set<string>();
        friendships?.forEach((f) => {
          if (f.sender_id === user.id) friendIds.add(f.receiver_id);
          else friendIds.add(f.sender_id);
        });
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
              const userInfo = f.sender_id === otherId ? f.sender : f.receiver;
              if (!mutualMap[otherId]) {
                mutualMap[otherId] = { count: 1, user: userInfo };
              } else {
                mutualMap[otherId].count += 1;
              }
            }
          });
        }
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
        setRecommendations(recs);
        let usersToCheck: any[] = [];
        if (recs.length === 0) {
          // exclude current user and their friends
          const excludeIds = [user.id, ...Array.from(friendIds)];
          const excludeIdsSql =
            excludeIds.length > 0
              ? `(${excludeIds.map((id) => `'${id}'`).join(",")})`
              : "('')";
          const { data: recent, error: recentError } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .not("id", "in", excludeIdsSql)
            .order("created_at", { ascending: false })
            .limit(10);
          if (recentError) throw recentError;
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
              `and(sender_id.eq.${user.id},receiver_id.in.(${ids.join(
                ","
              )}),and(sender_id.in.(${ids.join(",")}),receiver_id.eq.${
                user.id
              })`
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
              else if (statusMap[u.id] === "accepted") updated[u.id] = "sent";
              else updated[u.id] = "idle";
            });
            return updated;
          });
        }
      } catch (err: any) {
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
        setRequestStatus((prev) => ({
          ...prev,
          [targetUser.id]: existingFriendship.status,
        }));
        return;
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
    }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
        Recommended Friends
      </Text>
      {loading ? (
        <ActivityIndicator />
      ) : recommendations.length > 0 ? (
        <View style={styles.searchResults}>
          {recommendations.map((item) => (
            <View key={item.id} style={styles.friendRow}>
              <Avatar.Image
                size={40}
                source={{ uri: item.avatar_url }}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
                <Text style={{ color: "#888", fontSize: 13 }}>
                  @{item.username}
                </Text>
                {item.mutualCount && (
                  <Text style={{ color: "#888", fontSize: 12 }}>
                    {item.mutualCount} mutual friends
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
                  ? "Requested"
                  : "Add"}
              </Button>
            </View>
          ))}
        </View>
      ) : recentUsers.length > 0 ? (
        <View style={styles.searchResults}>
          {recentUsers.map((item) => (
            <View key={item.id} style={styles.friendRow}>
              <Avatar.Image
                size={40}
                source={{ uri: item.avatar_url }}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
                <Text style={{ color: "#888", fontSize: 13 }}>
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
  searchResults: {
    marginBottom: 8,
  },
});
