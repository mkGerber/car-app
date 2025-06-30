import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
} from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
  useTheme,
  TextInput,
  Avatar,
  FAB,
  Surface,
  IconButton,
} from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchPosts,
  toggleLike,
  fetchComments,
  addComment,
  Post,
  Comment,
} from "../../src/store/slices/postsSlice";

const { width } = Dimensions.get("window");

export default function FeedScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { posts, comments, loading, error } = useSelector(
    (state: RootState) => state.posts
  );
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchPosts(user.id));
    }
  }, [dispatch, user]);

  const onRefresh = async () => {
    if (user?.id) {
      dispatch(fetchPosts(user.id));
    }
  };

  const handleLike = async (post: Post) => {
    if (!user?.id) return;
    dispatch(toggleLike({ postId: post.id, userId: user.id }));
  };

  const handleComment = async () => {
    if (!user?.id || !selectedPost || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await dispatch(
        addComment({
          postId: selectedPost.id,
          content: commentText.trim(),
        })
      ).unwrap();
      setCommentText("");
    } catch (error: any) {
      console.error("Error adding comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const openComments = (post: Post) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    dispatch(fetchComments(post.id));
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

  // Sample posts for demonstration
  const samplePosts: Post[] = [
    {
      id: "1",
      user_id: "sample-user-1",
      content:
        "Just finished installing my new exhaust system! The sound is absolutely incredible. Can't wait to take it to the next car meet! 🚗💨",
      images: ["https://source.unsplash.com/random/800x600/?car-exhaust"],
      hashtags: ["#JDM", "#Mods", "#Exhaust", "#CarLife"],
      location: "My Garage",
      is_public: true,
      likes_count: 24,
      comments_count: 8,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      user: {
        name: "Alex Chen",
        username: "alexchen",
        avatar_url: "https://source.unsplash.com/random/100x100/?portrait",
      },
      vehicle: {
        year: 2020,
        make: "Honda",
        model: "Civic Type R",
      },
      is_liked: false,
    },
    {
      id: "2",
      user_id: "sample-user-2",
      content:
        "Beautiful sunset drive with the crew tonight. Nothing beats cruising with friends! 🌅",
      images: [
        "https://source.unsplash.com/random/800x600/?sunset-car",
        "https://source.unsplash.com/random/800x600/?car-group",
      ],
      hashtags: ["#Sunset", "#Cruise", "#CarMeet", "#Friends"],
      location: "Coastal Highway",
      is_public: true,
      likes_count: 156,
      comments_count: 23,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      user: {
        name: "Sarah Johnson",
        username: "sarahj",
        avatar_url: "https://source.unsplash.com/random/100x100/?woman",
      },
      vehicle: {
        year: 2018,
        make: "BMW",
        model: "M3",
      },
      is_liked: true,
    },
    {
      id: "3",
      user_id: "sample-user-3",
      content:
        "Track day was amazing! Set a new personal best lap time. The new suspension setup is working perfectly. 🏁",
      images: ["https://source.unsplash.com/random/800x600/?race-track"],
      hashtags: ["#TrackDay", "#PersonalBest", "#Suspension", "#Racing"],
      location: "Local Race Track",
      is_public: true,
      likes_count: 89,
      comments_count: 15,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      user: {
        name: "Mike Rodriguez",
        username: "mikerod",
        avatar_url: "https://source.unsplash.com/random/100x100/?man",
      },
      vehicle: {
        year: 2015,
        make: "Nissan",
        model: "370Z",
      },
      is_liked: false,
    },
  ];

  // Use sample posts if no real posts are loaded yet
  const displayPosts = posts.length > 0 ? posts : samplePosts;

  const renderPost = ({ item: post }: { item: Post }) => (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.postUser}
          onPress={() => router.push(`/profile/${post.user_id}`)}
        >
          <Avatar.Image
            source={{ uri: post.user.avatar_url }}
            size={40}
            style={styles.userAvatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{post.user.name}</Text>
            <Text style={styles.userUsername}>@{post.user.username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
      </View>

      {/* Post Content */}
      {post.content && <Text style={styles.postContent}>{post.content}</Text>}

      {/* Post Images */}
      {post.images && post.images.length > 0 && (
        <View style={styles.postImages}>
          {post.images.length === 1 ? (
            <Image
              source={{ uri: post.images[0] }}
              style={styles.singleImage}
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {post.images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.multiImage}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Vehicle Tag */}
      {post.vehicle && (
        <View style={styles.vehicleTag}>
          <Text style={styles.vehicleText}>
            📍 {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}
          </Text>
        </View>
      )}

      {/* Location */}
      {post.location && (
        <View style={styles.locationTag}>
          <Text style={styles.locationText}>📍 {post.location}</Text>
        </View>
      )}

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <View style={styles.hashtagsContainer}>
          {post.hashtags.map((hashtag, index) => (
            <Text key={index} style={styles.hashtag}>
              {hashtag}
            </Text>
          ))}
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(post)}
        >
          <Text
            style={[
              styles.actionIcon,
              { color: post.is_liked ? "#e91e63" : "#666" },
            ]}
          >
            {post.is_liked ? "❤️" : "🤍"}
          </Text>
          <Text style={styles.actionText}>{post.likes_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openComments(post)}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Custom Header */}
      <Surface style={[styles.header, { height: insets.top + 56 }]}>
        <View style={[styles.headerContent, { paddingTop: insets.top }]}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Feed
          </Text>
          <TouchableOpacity
            onPress={() => {
              console.log("Search button pressed, navigating to /discover");
              router.push("/discover");
            }}
            style={styles.searchButtonContainer}
          >
            <IconButton icon="magnify" size={24} style={styles.searchButton} />
          </TouchableOpacity>
        </View>
      </Surface>

      {/* Posts List */}
      <FlatList
        data={displayPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 72 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>
                Be the first to share your car story!
              </Text>
              <Button
                mode="contained"
                onPress={() => router.push("/create-post")}
                style={styles.createPostButton}
              >
                Create Post
              </Button>
            </View>
          ) : (
            <View style={styles.loader}>
              <ActivityIndicator size="large" />
            </View>
          )
        }
      />

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <Button
                mode="text"
                onPress={() => setCommentModalVisible(false)}
                textColor={theme.colors.primary}
              >
                Close
              </Button>
            </View>

            <ScrollView style={styles.commentsList}>
              {selectedPost &&
                comments[selectedPost.id]?.map((comment: Comment) => (
                  <View key={comment.id} style={styles.comment}>
                    <Avatar.Image
                      source={{ uri: comment.user.avatar_url }}
                      size={32}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <Text style={styles.commentUser}>
                        {comment.user.name}
                      </Text>
                      <Text style={styles.commentText}>{comment.content}</Text>
                      <Text style={styles.commentTime}>
                        {formatTimeAgo(comment.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
            </ScrollView>

            <View style={styles.commentInput}>
              <TextInput
                label="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                style={styles.commentTextInput}
                mode="outlined"
                multiline
              />
              <Button
                mode="contained"
                onPress={handleComment}
                loading={submittingComment}
                disabled={submittingComment || !commentText.trim()}
                style={styles.commentButton}
              >
                Post
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB for creating posts */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push("/create-post")}
        color={theme.colors.onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    elevation: 2,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    zIndex: 1,
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
  searchButtonContainer: {
    marginLeft: 8,
  },
  searchButton: {
    margin: 0,
  },
  list: {
    padding: 16,
  },
  postCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  postUser: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  userUsername: {
    fontSize: 14,
    color: "#666",
  },
  postTime: {
    fontSize: 12,
    color: "#999",
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  postImages: {
    marginBottom: 12,
  },
  singleImage: {
    width: "100%",
    height: 300,
    borderRadius: 8,
  },
  multiImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginRight: 8,
  },
  vehicleTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  vehicleText: {
    fontSize: 14,
    color: "#666",
  },
  locationTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: "#666",
  },
  hashtagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  hashtag: {
    fontSize: 14,
    color: "#1e88e5",
    marginRight: 8,
  },
  postActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 4,
  },
  actionText: {
    fontSize: 14,
    color: "#666",
  },
  empty: {
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  createPostButton: {
    backgroundColor: "#d4af37",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
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
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  commentsList: {
    maxHeight: 400,
    padding: 16,
  },
  comment: {
    flexDirection: "row",
    marginBottom: 16,
  },
  commentAvatar: {
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: "#999",
  },
  commentInput: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  commentTextInput: {
    flex: 1,
    marginRight: 8,
  },
  commentButton: {
    backgroundColor: "#d4af37",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
