import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Modal,
} from "react-native";
import {
  Text,
  Surface,
  List,
  Button,
  ActivityIndicator,
  useTheme,
  Switch,
  Chip,
  IconButton,
} from "react-native-paper";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { useFocusEffect } from "expo-router";
import { useTheme as useAppTheme } from "../../src/context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Post } from "../../src/store/slices/postsSlice";

const { width } = Dimensions.get("window");
const GRID_ITEM_SIZE = (width - 48) / 3; // 3 columns with margins

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const paperTheme = useTheme();
  const { isDarkTheme, toggleTheme } = useAppTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const { vehicles } = useSelector((state: RootState) => state.vehicles);
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*, vehicles(*)")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      }
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    if (!user?.id) return;
    try {
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          user:profiles(name, username, avatar_url),
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      setUserPosts(data || []);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchFriends = async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
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
      setLoadingFriends(false);
    }
  };

  // Refresh profile data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
      fetchFriends();
      fetchUserPosts();
    }, [user])
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchProfile(), fetchUserPosts()]).finally(() =>
      setRefreshing(false)
    );
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const renderPostGridItem = ({ item: post }: { item: Post }) => (
    <TouchableOpacity
      style={styles.postGridItem}
      onPress={() => {
        setSelectedPost(post);
        setPostModalVisible(true);
      }}
    >
      {post.images && post.images.length > 0 ? (
        <Image
          source={{ uri: post.images[0] }}
          style={styles.postGridImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.postGridPlaceholder}>
          <Text style={styles.postGridPlaceholderText}>📝</Text>
        </View>
      )}
      {post.images && post.images.length > 1 && (
        <View style={styles.multipleImagesIndicator}>
          <Text style={styles.multipleImagesText}>
            +{post.images.length - 1}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPostDetail = () => {
    if (!selectedPost) return null;

    return (
      <View style={styles.postDetailContainer}>
        {/* Post Header */}
        <View style={styles.postDetailHeader}>
          <View style={styles.postDetailUser}>
            <Image
              source={{ uri: selectedPost.user.avatar_url }}
              style={styles.postDetailAvatar}
            />
            <View style={styles.postDetailUserInfo}>
              <Text style={styles.postDetailUserName}>
                {selectedPost.user.name}
              </Text>
              <Text style={styles.postDetailUsername}>
                @{selectedPost.user.username}
              </Text>
            </View>
          </View>
          <Text style={styles.postDetailTime}>
            {formatTimeAgo(selectedPost.created_at)}
          </Text>
        </View>

        {/* Post Content */}
        {selectedPost.content && (
          <Text style={styles.postDetailContent}>{selectedPost.content}</Text>
        )}

        {/* Post Images */}
        {selectedPost.images && selectedPost.images.length > 0 && (
          <View style={styles.postDetailImages}>
            {selectedPost.images.length === 1 ? (
              <Image
                source={{ uri: selectedPost.images[0] }}
                style={styles.postDetailSingleImage}
                resizeMode="cover"
              />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedPost.images.map((image, index) => (
                  <Image
                    key={index}
                    source={{ uri: image }}
                    style={styles.postDetailMultiImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Vehicle Tag */}
        {selectedPost.vehicle && (
          <View style={styles.postDetailVehicleTag}>
            <Text style={styles.postDetailVehicleText}>
              📍 {selectedPost.vehicle.year} {selectedPost.vehicle.make}{" "}
              {selectedPost.vehicle.model}
            </Text>
          </View>
        )}

        {/* Location */}
        {selectedPost.location && (
          <View style={styles.postDetailLocationTag}>
            <Text style={styles.postDetailLocationText}>
              📍 {selectedPost.location}
            </Text>
          </View>
        )}

        {/* Hashtags */}
        {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
          <View style={styles.postDetailHashtags}>
            {selectedPost.hashtags.map((hashtag, index) => (
              <Text key={index} style={styles.postDetailHashtag}>
                {hashtag}
              </Text>
            ))}
          </View>
        )}

        {/* Post Stats */}
        <View style={styles.postDetailStats}>
          <View style={styles.postDetailStat}>
            <Text style={styles.postDetailStatIcon}>❤️</Text>
            <Text style={styles.postDetailStatText}>
              {selectedPost.likes_count}
            </Text>
          </View>
          <View style={styles.postDetailStat}>
            <Text style={styles.postDetailStatIcon}>💬</Text>
            <Text style={styles.postDetailStatText}>
              {selectedPost.comments_count}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const styles = getStyles(paperTheme);

  if (loading && !profile) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: paperTheme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Surface style={[styles.customHeader, { height: insets.top + 56 }]}>
        <View style={[styles.headerContent, { paddingTop: insets.top }]}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Profile
          </Text>
        </View>
      </Surface>
      <ScrollView
        style={[styles.scrollView, { marginTop: insets.top + 56 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ImageBackground
          source={{ uri: profile?.banner_url }}
          style={styles.header}
          resizeMode="cover"
        >
          <View style={styles.headerOverlay}>
            <Image
              source={{ uri: profile?.avatar_url }}
              style={styles.avatar}
              resizeMode="cover"
            />
            <Text variant="headlineSmall" style={styles.name}>
              {profile?.name || user?.username}
            </Text>
            <Text variant="bodyMedium" style={styles.username}>
              @{profile?.username}
            </Text>
            {profile?.bio && (
              <Text variant="bodyMedium" style={styles.bio}>
                {profile.bio}
              </Text>
            )}
          </View>
        </ImageBackground>

        <View style={styles.statsContainer}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text variant="headlineSmall">
                {profile?.vehicles?.length || 0}
              </Text>
              <Text variant="bodySmall">Vehicles</Text>
            </View>
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push("/profile/friends")}
              activeOpacity={0.7}
            >
              <Text variant="headlineSmall">{friends.length}</Text>
              <Text
                variant="bodySmall"
                style={{ color: paperTheme.colors.primary, fontWeight: "bold" }}
              >
                Friends
              </Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <Text variant="headlineSmall">{userPosts.length}</Text>
              <Text variant="bodySmall">Posts</Text>
            </View>
          </View>
        </View>

        {/* Posts Section */}
        <Surface style={styles.section}>
          <View style={styles.postsHeader}>
            <Text variant="titleMedium" style={styles.postsTitle}>
              My Posts
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/create-post")}
              style={styles.createPostButton}
            >
              <Text style={styles.createPostButtonText}>+ New Post</Text>
            </TouchableOpacity>
          </View>

          {loadingPosts ? (
            <View style={styles.postsLoading}>
              <ActivityIndicator size="small" />
            </View>
          ) : userPosts.length > 0 ? (
            <FlatList
              data={userPosts}
              renderItem={renderPostGridItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.postsGrid}
            />
          ) : (
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>No posts yet</Text>
              <Text style={styles.noPostsSubtext}>
                Share your car stories and experiences!
              </Text>
              <Button
                mode="contained"
                onPress={() => router.push("/create-post")}
                style={styles.createFirstPostButton}
              >
                Create Your First Post
              </Button>
            </View>
          )}
        </Surface>

        <Surface style={styles.section}>
          <List.Section>
            <List.Subheader>Account</List.Subheader>

            <List.Item
              title="Edit Profile"
              left={(props) => <List.Icon {...props} icon="account-edit" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/edit-profile")}
            />

            <List.Item
              title="Change Password"
              left={(props) => <List.Icon {...props} icon="lock" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/(auth)/reset-password")}
            />

            <List.Item
              title="Notifications"
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/notifications")}
            />
          </List.Section>
        </Surface>

        <Surface style={styles.section}>
          <List.Section>
            <List.Subheader>App</List.Subheader>

            <List.Item
              title="Dark Mode"
              left={(props) => <List.Icon {...props} icon="brightness-6" />}
              right={() => (
                <Switch value={isDarkTheme} onValueChange={toggleTheme} />
              )}
            />

            <List.Item
              title="About"
              left={(props) => <List.Icon {...props} icon="information" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/about")}
            />

            <List.Item
              title="Privacy Policy"
              left={(props) => <List.Icon {...props} icon="shield" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/privacy")}
            />

            <List.Item
              title="Terms of Service"
              left={(props) => <List.Icon {...props} icon="file-document" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/terms")}
            />
          </List.Section>
        </Surface>

        <Surface style={styles.section}>
          <List.Section>
            <List.Subheader>Support</List.Subheader>

            <List.Item
              title="Help & FAQ"
              left={(props) => <List.Icon {...props} icon="help-circle" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/help")}
            />

            <List.Item
              title="Contact Us"
              left={(props) => <List.Icon {...props} icon="email" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/contact")}
            />

            <List.Item
              title="Report a Bug"
              left={(props) => <List.Icon {...props} icon="bug" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/report-bug")}
            />
          </List.Section>
        </Surface>

        <Surface style={styles.section}>
          <List.Section>
            <List.Subheader>Content</List.Subheader>

            <List.Item
              title="My Garage"
              left={(props) => <List.Icon {...props} icon="car-multiple" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push("/(tabs)/garage")}
            />
          </List.Section>
        </Surface>

        <View style={styles.signOutContainer}>
          <Button
            mode="outlined"
            onPress={handleSignOut}
            style={styles.signOutButton}
            textColor="#d32f2f"
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>

      {/* Post Detail Modal */}
      <Modal
        visible={postModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPostModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Details</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setPostModalVisible(false)}
              />
            </View>
            <ScrollView style={styles.modalContent}>
              {renderPostDetail()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    header: {
      minHeight: 200,
      justifyContent: "center",
      alignItems: "center",
    },
    headerOverlay: {
      backgroundColor: "rgba(0,0,0,0.5)",
      width: "100%",
      minHeight: 200,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderColor: "#fff",
      borderWidth: 2,
    },
    name: {
      fontWeight: "bold",
      marginBottom: 4,
      color: "#fff",
    },
    username: {
      color: "#ccc",
      marginBottom: 8,
    },
    bio: {
      textAlign: "center",
      color: "#eee",
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    statsContainer: {
      marginTop: -40, // Pulls the stats up over the banner
      paddingHorizontal: 16,
    },
    stats: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    stat: {
      alignItems: "center",
    },
    section: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    postsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    postsTitle: {
      fontWeight: "bold",
    },
    createPostButton: {
      backgroundColor: "#d4af37",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    createPostButtonText: {
      color: "white",
      fontSize: 12,
      fontWeight: "bold",
    },
    postsLoading: {
      padding: 20,
      alignItems: "center",
    },
    postsGrid: {
      padding: 8,
    },
    postGridItem: {
      width: GRID_ITEM_SIZE,
      height: GRID_ITEM_SIZE,
      margin: 2,
      borderRadius: 8,
      overflow: "hidden",
      position: "relative",
    },
    postGridImage: {
      width: "100%",
      height: "100%",
    },
    postGridPlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.colors.outline,
      justifyContent: "center",
      alignItems: "center",
    },
    postGridPlaceholderText: {
      fontSize: 20,
    },
    multipleImagesIndicator: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    multipleImagesText: {
      color: "white",
      fontSize: 8,
      fontWeight: "bold",
    },
    noPostsContainer: {
      padding: 32,
      alignItems: "center",
    },
    noPostsText: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 8,
      color: theme.colors.onSurface,
    },
    noPostsSubtext: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 20,
    },
    createFirstPostButton: {
      backgroundColor: "#d4af37",
    },
    signOutContainer: {
      margin: 16,
      marginBottom: 32,
    },
    signOutButton: {
      borderColor: theme.colors.error,
    },
    customHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      elevation: 2,
      backgroundColor: theme.colors.surface,
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
    scrollView: {
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modal: {
      backgroundColor: "white",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
    },
    modalContent: {
      padding: 16,
    },
    postDetailContainer: {
      paddingBottom: 20,
    },
    postDetailHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    postDetailUser: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    postDetailAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    postDetailUserInfo: {
      flex: 1,
    },
    postDetailUserName: {
      fontSize: 16,
      fontWeight: "bold",
    },
    postDetailUsername: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    postDetailTime: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    postDetailContent: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 16,
    },
    postDetailImages: {
      marginBottom: 16,
    },
    postDetailSingleImage: {
      width: "100%",
      height: 300,
      borderRadius: 12,
    },
    postDetailMultiImage: {
      width: 250,
      height: 250,
      borderRadius: 12,
      marginRight: 8,
    },
    postDetailVehicleTag: {
      backgroundColor: theme.colors.outline,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    postDetailVehicleText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    postDetailLocationTag: {
      backgroundColor: theme.colors.outline,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    postDetailLocationText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    postDetailHashtags: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 16,
    },
    postDetailHashtag: {
      fontSize: 14,
      color: "#1e88e5",
      marginRight: 8,
    },
    postDetailStats: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      paddingTop: 12,
    },
    postDetailStat: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 24,
    },
    postDetailStatIcon: {
      fontSize: 16,
      marginRight: 4,
    },
    postDetailStatText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
  });
