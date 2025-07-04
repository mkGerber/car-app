import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
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
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [requestErrorMsg, setRequestErrorMsg] = useState<string | null>(null);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState<string | null>(
    null
  );
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const paperTheme = useTheme();

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
  const handleSendRequest = async (targetUser: any) => {
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
        setRequestErrorMsg("Failed to send friend request. Please try again.");
    }
  };

  // Recommendations (friends of friends or recent users)
  const fetchRecommendations = async () => {
    if (!user) return;
    setRecsLoading(true);
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
        if (recentError) {
          setRecommendations([]);
          setRecentUsers([]);
          throw recentError;
        }
        setRecentUsers(recent || []);
        usersToCheck = recent || [];
      } else {
        setRecentUsers([]);
        usersToCheck = recs;
      }

      // --- Check for existing friendships/requests ---
      if (usersToCheck.length > 0) {
        const ids = usersToCheck.map((u) => u.id);
        const { data: friendships2, error: checkError } = await supabase
          .from("friendships")
          .select("sender_id, receiver_id, status")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.in.(${ids.join(
              ","
            )}),and(sender_id.in.(${ids.join(",")}),receiver_id.eq.${user.id})`
          )
          .in("status", ["pending", "accepted"]);
        if (checkError) throw checkError;
        // Build a map of userId -> status
        const statusMap: Record<string, "sent" | "accepted"> = {};
        friendships2?.forEach((f) => {
          const otherId = f.sender_id === user.id ? f.receiver_id : f.sender_id;
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
      // --- END ---
    } catch (err: any) {
      setRecommendations([]);
      setRecentUsers([]);
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchRecommendations();
  }, [user]);

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Friends" />
      </Appbar.Header>
      <View style={styles.container}>
        <FriendRecommendations />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  searchResults: {
    marginBottom: 8,
  },
});
