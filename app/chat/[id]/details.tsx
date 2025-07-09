import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import {
  Text,
  Appbar,
  Avatar,
  Button,
  useTheme,
  ActivityIndicator,
  Chip,
  Surface,
  Divider,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "../../../src/store";
import { supabase } from "../../../src/services/supabase";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { IconButton } from "react-native-paper";

interface Member {
  id: string;
  user_id: string;
  role: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
  };
}

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useSelector((state: RootState) => state.auth);
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);

      // Fetch group info
      const { data: groupData, error: groupError } = await supabase
        .from("group_chats")
        .select("id, name, description, image_url, created_by, created_at")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("group_chat_members")
        .select("id, user_id, role")
        .eq("group_chat_id", id);

      if (membersError) throw membersError;

      if (membersData && membersData.length > 0) {
        // Fetch user info for all members
        const userIds = membersData.map((m) => m.user_id);
        const { data: usersData, error: usersError } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url")
          .in("id", userIds);

        if (usersError) throw usersError;

        // Map members to user info
        const userMap = new Map((usersData || []).map((u) => [u.id, u]));
        const formattedMembers = membersData.map((member) => ({
          ...member,
          user: userMap.get(member.user_id) || {
            id: member.user_id,
            name: "Unknown",
            username: "unknown",
            avatar_url: null,
          },
        }));

        setMembers(formattedMembers);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isGroupOwner = group?.created_by === user?.id;
  const userRole = members.find((m) => m.user_id === user?.id)?.role;

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert(
      "Remove Member",
      "Are you sure you want to remove this member from the group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase
                .from("group_chat_members")
                .delete()
                .eq("group_chat_id", id)
                .eq("user_id", memberId);
              setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
            } catch (err) {
              Alert.alert("Error", "Failed to remove member.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.onBackground }}>
          {error || "Group not found"}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Group Details" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        {/* Group Header */}
        <Surface style={styles.groupHeader}>
          {group.image_url ? (
            <Image
              source={{ uri: group.image_url }}
              style={styles.groupImage}
            />
          ) : (
            <View
              style={[
                styles.groupImagePlaceholder,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}

          <View style={styles.groupInfo}>
            <Text
              variant="headlineSmall"
              style={[styles.groupName, { color: theme.colors.onBackground }]}
            >
              {group.name}
            </Text>
            {group.description && (
              <Text
                variant="bodyMedium"
                style={[
                  styles.groupDescription,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {group.description}
              </Text>
            )}
            <Text
              variant="bodySmall"
              style={[
                styles.memberCount,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {members.length} member{members.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </Surface>

        {/* Action Buttons */}
        <Surface style={styles.actionsSection}>
          <Button
            mode="contained"
            icon="calendar-plus"
            onPress={() => router.push(`/create-event?groupChatId=${id}`)}
            style={styles.actionButton}
          >
            Create Event
          </Button>

          <Button
            mode="outlined"
            icon="account-plus"
            onPress={() => router.push(`/chat/${id}/add-members`)}
            style={styles.actionButton}
          >
            Add Members
          </Button>

          {isGroupOwner && (
            <Button
              mode="outlined"
              icon="cog"
              onPress={() => router.push(`/chat/${id}/edit`)}
              style={styles.actionButton}
            >
              Edit Group
            </Button>
          )}
        </Surface>

        {/* Members Preview */}
        <Surface style={styles.membersSection}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              Members
            </Text>
            <TouchableOpacity
              onPress={() => router.push(`/chat/${id}/members`)}
            >
              <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={members.slice(0, 5)} // Show first 5 members
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <Avatar.Image
                  source={
                    item.user.avatar_url
                      ? { uri: item.user.avatar_url }
                      : undefined
                  }
                  size={40}
                  style={{ backgroundColor: theme.colors.surfaceVariant }}
                />
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
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    @{item.user.username}
                  </Text>
                </View>
                <Chip
                  mode="outlined"
                  textStyle={{
                    fontSize: 16,
                    fontWeight: "600",
                    textAlign: "center",
                    textAlignVertical: "center",
                    flex: 1,
                  }}
                  style={[
                    styles.roleChip,
                    {
                      height: 32,
                      width: 130,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: 16,
                    },
                  ]}
                >
                  {item.role}
                </Chip>
              </View>
            )}
            ListFooterComponent={
              members.length > 5 ? (
                <TouchableOpacity
                  style={styles.viewMoreButton}
                  onPress={() => router.push(`/chat/${id}/members`)}
                >
                  <Text
                    style={[
                      styles.viewMoreText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    +{members.length - 5} more members
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </Surface>

        {/* Group Info */}
        <Surface style={styles.infoSection}>
          <Text
            variant="titleMedium"
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Group Information
          </Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="calendar"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.infoText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Created {new Date(group.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="account"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.infoText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Your role: {userRole || "Member"}
            </Text>
          </View>
        </Surface>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  groupHeader: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  groupImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  groupImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  groupDescription: {
    marginBottom: 8,
  },
  memberCount: {
    fontWeight: "500",
  },
  actionsSection: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  actionButton: {
    marginBottom: 8,
  },
  membersSection: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "bold",
  },
  viewAll: {
    fontWeight: "500",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontWeight: "600",
    fontSize: 16,
  },
  memberUsername: {
    fontSize: 14,
  },
  roleChip: {
    alignItems: "center",
    justifyContent: "center",
    width: 130,
    borderRadius: 16,
  },
  viewMoreButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  viewMoreText: {
    fontWeight: "500",
  },
  infoSection: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 16,
  },
});
