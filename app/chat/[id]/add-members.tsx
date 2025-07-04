import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import {
  Text,
  Avatar,
  Appbar,
  useTheme,
  Searchbar,
  IconButton,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../src/services/supabase";
import { useSelector } from "react-redux";
import { RootState } from "../../../src/store";

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

export default function AddMembersScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useSelector((state: RootState) => state.auth);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [currentMembers, setCurrentMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  // Fetch current members to filter them out
  const fetchCurrentMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("group_chat_members")
        .select("user_id")
        .eq("group_chat_id", id);

      if (error) throw error;

      const memberIds = (data || []).map((m) => m.user_id);
      setCurrentMembers(memberIds);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search users function
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .or(`username.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;

      // Filter out users who are already members
      const filteredResults =
        data?.filter((result) => !currentMembers.includes(result.id)) || [];

      setSearchResults(filteredResults);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add member function
  const handleAddMember = async (selectedUser: User) => {
    if (!id) return;

    setAddingMember(true);
    try {
      // Add user to group
      const { error: memberError } = await supabase
        .from("group_chat_members")
        .insert({
          group_chat_id: id,
          user_id: selectedUser.id,
          role: "member",
        });

      if (memberError) throw memberError;

      // Update current members list
      setCurrentMembers((prev) => [...prev, selectedUser.id]);

      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== selectedUser.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  // Search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentMembers]);

  useEffect(() => {
    fetchCurrentMembers();
  }, [id]);

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: theme.colors.outline }]}
      onPress={() => handleAddMember(item)}
      disabled={addingMember}
    >
      {item.avatar_url ? (
        <Avatar.Image
          source={{ uri: item.avatar_url }}
          size={56}
          style={{ backgroundColor: theme.colors.surfaceVariant }}
        />
      ) : (
        <Avatar.Icon
          icon="account"
          size={56}
          style={{ backgroundColor: theme.colors.surfaceVariant }}
          color={theme.colors.onSurface}
        />
      )}
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.colors.onSurface }]}>
          {item.name}
        </Text>
        <Text style={[styles.userUsername, { color: theme.colors.outline }]}>
          @{item.username}
        </Text>
      </View>
      <IconButton
        icon="plus"
        size={24}
        iconColor={theme.colors.primary}
        disabled={addingMember}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
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
          title="Add Members"
          titleStyle={{ color: theme.colors.onBackground }}
        />
      </Appbar.Header>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search users by name or username..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          iconColor={theme.colors.onSurface}
          inputStyle={{ color: theme.colors.onSurface }}
          placeholderTextColor={theme.colors.outline}
          loading={searchLoading}
        />
      </View>

      <FlatList
        data={searchResults}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        ListEmptyComponent={
          searchQuery ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
                {searchLoading ? "Searching..." : "No users found"}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
                Search for users to add to the group
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    borderRadius: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    fontStyle: "italic",
  },
});
