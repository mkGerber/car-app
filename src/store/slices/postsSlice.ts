import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Post {
  id: string;
  user_id: string;
  vehicle_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
  };
  media?: Array<{
    id: string;
    media_url: string;
    media_type: 'image' | 'video';
  }>;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

interface PostsState {
  posts: Post[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

const initialState: PostsState = {
  posts: [],
  loading: false,
  error: null,
  hasMore: true,
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setPosts: (state, action: PayloadAction<Post[]>) => {
      state.posts = action.payload;
      state.loading = false;
      state.error = null;
    },
    addPosts: (state, action: PayloadAction<Post[]>) => {
      state.posts.push(...action.payload);
      state.hasMore = action.payload.length > 0;
    },
    addPost: (state, action: PayloadAction<Post>) => {
      state.posts.unshift(action.payload);
    },
    updatePost: (state, action: PayloadAction<Post>) => {
      const index = state.posts.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.posts[index] = action.payload;
      }
    },
    deletePost: (state, action: PayloadAction<string>) => {
      state.posts = state.posts.filter(p => p.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    setHasMore: (state, action: PayloadAction<boolean>) => {
      state.hasMore = action.payload;
    },
  },
});

export const {
  setPosts,
  addPosts,
  addPost,
  updatePost,
  deletePost,
  setLoading,
  setError,
  setHasMore,
} = postsSlice.actions;

export default postsSlice.reducer; 