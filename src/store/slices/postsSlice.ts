import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { supabase } from "../../services/supabase";

export interface Post {
  id: string;
  user_id: string;
  vehicle_id?: string;
  content: string;
  images: string[];
  hashtags: string[];
  location?: string;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user: {
    name: string;
    username: string;
    avatar_url?: string;
  };
  vehicle?: {
    year: number;
    make: string;
    model: string;
  };
  is_liked?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    name: string;
    username: string;
    avatar_url?: string;
  };
}

interface PostsState {
  posts: Post[];
  comments: Record<string, Comment[]>;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

const initialState: PostsState = {
  posts: [],
  comments: {},
  loading: false,
  error: null,
  refreshing: false,
};

// Async thunks
export const fetchPosts = createAsyncThunk(
  "posts/fetchPosts",
  async (userId?: string) => {
    // Use optimized data fetching with caching
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select(`
        id,
        user_id,
        content,
        images,
        hashtags,
        location,
        is_public,
        likes_count,
        comments_count,
        created_at,
        user:profiles(name, username, avatar_url),
        vehicle:vehicles(year, make, model)
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (postsError) throw postsError;

    // Check which posts the current user has liked
    if (userId && postsData) {
      const { data: likedPosts } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", postsData.map(p => p.id));

      const likedPostIds = new Set(likedPosts?.map(lp => lp.post_id) || []);

      const postsWithLikes = postsData.map(post => ({
        ...post,
        is_liked: likedPostIds.has(post.id)
      }));

      return postsWithLikes;
    }

    return postsData || [];
  }
);

export const createPost = createAsyncThunk(
  "posts/createPost",
  async (postData: {
    content: string;
    images: string[];
    vehicle_id?: string;
    hashtags: string[];
    location?: string;
    is_public: boolean;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get the profile ID for the authenticated user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const { data, error } = await supabase.from("posts").insert({
      user_id: profile.id,
      ...postData,
    }).select(`
      *,
      user:profiles(name, username, avatar_url),
      vehicle:vehicles(year, make, model)
    `).single();

    if (error) throw error;
    return data;
  }
);

export const toggleLike = createAsyncThunk(
  "posts/toggleLike",
  async ({ postId, userId }: { postId: string; userId: string }) => {
    // Check if already liked
    const { data: existingLike } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      
      return { postId, action: "unlike" as const };
    } else {
      // Like
      await supabase
        .from("post_likes")
        .insert({
          post_id: postId,
          user_id: userId
        });
      
      return { postId, action: "like" as const };
    }
  }
);

export const fetchComments = createAsyncThunk(
  "posts/fetchComments",
  async (postId: string) => {
    const { data, error } = await supabase
      .from("post_comments")
      .select(`
        *,
        user:profiles(name, username, avatar_url)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return { postId, comments: data || [] };
  }
);

export const addComment = createAsyncThunk(
  "posts/addComment",
  async ({ postId, content }: { postId: string; content: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get the profile ID for the authenticated user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: profile.id,
        content: content.trim()
      })
      .select(`
        *,
        user:profiles(name, username, avatar_url)
      `)
      .single();

    if (error) throw error;
    return { postId, comment: data };
  }
);

const postsSlice = createSlice({
  name: "posts",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setRefreshing: (state, action: PayloadAction<boolean>) => {
      state.refreshing = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch posts
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch posts";
      });

    // Create post
    builder
      .addCase(createPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.loading = false;
        state.posts.unshift(action.payload);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to create post";
      });

    // Toggle like
    builder
      .addCase(toggleLike.fulfilled, (state, action) => {
        const { postId, action: likeAction } = action.payload;
        const post = state.posts.find(p => p.id === postId);
        if (post) {
          if (likeAction === "like") {
            post.is_liked = true;
            post.likes_count += 1;
          } else {
            post.is_liked = false;
            post.likes_count -= 1;
          }
        }
      });

    // Fetch comments
    builder
      .addCase(fetchComments.fulfilled, (state, action) => {
        const { postId, comments } = action.payload;
        state.comments[postId] = comments;
      });

    // Add comment
    builder
      .addCase(addComment.fulfilled, (state, action) => {
        const { postId, comment } = action.payload;
        if (!state.comments[postId]) {
          state.comments[postId] = [];
        }
        state.comments[postId].push(comment);
        
        // Update post comment count
        const post = state.posts.find(p => p.id === postId);
        if (post) {
          post.comments_count += 1;
        }
      });
  },
});

export const { clearError, setRefreshing } = postsSlice.actions;
export default postsSlice.reducer; 