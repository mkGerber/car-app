import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('Supabase config:', { 
  url: supabaseUrl ? 'Set' : 'Not set', 
  key: supabaseAnonKey ? 'Set' : 'Not set' 
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Cache utilities
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const IMAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CacheItem {
  data: any;
  timestamp: number;
}

const cache = {
  async get(key: string): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);
      if (!cached) return null;
      
      const item: CacheItem = JSON.parse(cached);
      if (Date.now() - item.timestamp > CACHE_DURATION) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return item.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(key: string, data: any): Promise<void> {
    try {
      const item: CacheItem = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
};

// Auth helpers
export const auth = {
  signUp: async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password });
  },
  
  signIn: async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  },
  
  signOut: async () => {
    return await supabase.auth.signOut();
  },
  
  getCurrentUser: async () => {
    return await supabase.auth.getUser();
  },
  
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helpers
export const db = {
  // Users
  getProfile: async (userId: string) => {
    return await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
  },
  
  updateProfile: async (userId: string, updates: any) => {
    return await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
  },
  
  // Vehicles
  getVehicles: async (userId: string, useCache = true) => {
    console.log('getVehicles called with userId:', userId, 'useCache:', useCache);
    
    if (!userId) {
      console.log('No userId provided, returning empty result');
      return { data: [], error: null };
    }

    const cacheKey = `vehicles_${userId}`;
    
    // Try cache first
    if (useCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log('Returning cached vehicles data');
        return { data: cached, error: null };
      }
    }

    console.log('Fetching vehicles from database...');
    
    // Test database connection first
    const { count: testCount, error: testError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    console.log('Database connection test:', { testCount, testError });
    
    const result = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log('Database result:', result);

    // Cache the result
    if (result.data && useCache) {
      await cache.set(cacheKey, result.data);
    }

    return result;
  },
  
  getVehicle: async (vehicleId: string) => {
    return await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();
  },
  
  createVehicle: async (vehicleData: any) => {
    return await supabase
      .from('vehicles')
      .insert(vehicleData)
      .select()
      .single();
  },
  
  updateVehicle: async (vehicleId: string, updates: any) => {
    return await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId);
  },
  
  deleteVehicle: async (vehicleId: string) => {
    return await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);
  },
  
  // Posts
  getPosts: async (page = 0, limit = 10, useCache = true) => {
    const cacheKey = `posts_${page}_${limit}`;
    
    // Try cache first
    if (useCache) {
      const cached = await cache.get(cacheKey);
      if (cached) return { data: cached, error: null };
    }

    const result = await supabase
      .from('posts')
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
        user:profiles(id, username, avatar_url),
        vehicle:vehicles(id, make, model, year)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    // Cache the result
    if (result.data && useCache) {
      await cache.set(cacheKey, result.data);
    }

    return result;
  },
  
  createPost: async (postData: any) => {
    return await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();
  },
  
  // Events
  getEvents: async (useCache = true) => {
    const cacheKey = 'events_all';
    
    // Try cache first
    if (useCache) {
      const cached = await cache.get(cacheKey);
      if (cached) return { data: cached, error: null };
    }

    const result = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        date,
        location,
        latitude,
        longitude,
        image_url,
        group_chat_id,
        created_by,
        created_at,
        creator:profiles(id, username, avatar_url)
      `)
      .order('date', { ascending: true });

    // Cache the result
    if (result.data && useCache) {
      await cache.set(cacheKey, result.data);
    }

    return result;
  },
  
  getEvent: async (eventId: string) => {
    return await supabase
      .from('events')
      .select(`
        *,
        creator:users(id, username, avatar_url)
      `)
      .eq('id', eventId)
      .single();
  },
  
  createEvent: async (eventData: any) => {
    return await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();
  },

  // Vehicle Photos
  getVehiclePhotos: async (vehicleId: string) => {
    return await supabase
      .from('vehicle_photos')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
  },

  addVehiclePhoto: async (photoData: any) => {
    return await supabase
      .from('vehicle_photos')
      .insert(photoData)
      .select()
      .single();
  },

  // Build Updates
  getBuildUpdates: async (vehicleId: string) => {
    return await supabase
      .from('build_updates')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('date', { ascending: false });
  },

  addBuildUpdate: async (updateData: any) => {
    return await supabase
      .from('build_updates')
      .insert(updateData)
      .select()
      .single();
  },

  // Group Vehicles
  getGroupVehicles: async (groupId: string) => {
    const result = await supabase
      .from('group_vehicles')
      .select(`
        id,
        group_chat_id,
        user_id,
        vehicle_id,
        added_at,
        is_featured,
        description,
        vehicle:vehicles(*)
      `)
      .eq('group_chat_id', groupId)
      .order('is_featured', { ascending: false })
      .order('added_at', { ascending: false });

    // If we have data, fetch user profiles separately
    if (result.data && result.data.length > 0) {
      const userIds = [...new Set(result.data.map(gv => gv.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      if (!profilesError && profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const vehiclesWithProfiles = result.data.map(gv => ({
          ...gv,
          user: profileMap.get(gv.user_id) || {
            id: gv.user_id,
            name: 'Unknown User',
            username: 'unknown',
            avatar_url: null,
          },
        }));
        return { data: vehiclesWithProfiles, error: null };
      }
    }

    return result;
  },

  addVehicleToGroup: async (groupId: string, vehicleId: string, description?: string) => {
    // First get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const result = await supabase
      .from('group_vehicles')
      .insert({
        group_chat_id: groupId,
        user_id: user.id,
        vehicle_id: vehicleId,
        description: description || null,
      })
      .select(`
        id,
        group_chat_id,
        user_id,
        vehicle_id,
        added_at,
        is_featured,
        description,
        vehicle:vehicles(*)
      `)
      .single();

    // If successful, fetch the user profile
    if (result.data) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .eq('id', result.data.user_id)
        .single();

      if (!profileError && profile) {
        return {
          data: {
            ...result.data,
            user: profile,
          },
          error: null,
        };
      }
    }

    return result;
  },

  removeVehicleFromGroup: async (groupId: string, vehicleId: string) => {
    const result = await supabase
      .from('group_vehicles')
      .delete()
      .eq('group_chat_id', groupId)
      .eq('vehicle_id', vehicleId);

    return result;
  },

  toggleVehicleFeatured: async (groupId: string, vehicleId: string, isFeatured: boolean) => {
    const result = await supabase
      .from('group_vehicles')
      .update({ is_featured: isFeatured })
      .eq('group_chat_id', groupId)
      .eq('vehicle_id', vehicleId);

    return result;
  },
};

// Storage helpers
export const storage = {
  uploadImage: async (file: any, path: string) => {
    return await supabase.storage.from('images').upload(path, file);
  },
  
  getImageUrl: (path: string) => {
    return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
  },
  
  deleteImage: async (path: string) => {
    return await supabase.storage.from('images').remove([path]);
  },

  // Optimized image URL with transformations
  getOptimizedImageUrl: (path: string, width = 800, quality = 80) => {
    const url = supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
    // Add transformation parameters for CDN optimization
    return `${url}?width=${width}&quality=${quality}`;
  },

  // Get thumbnail URL for lists
  getThumbnailUrl: (path: string) => {
    return storage.getOptimizedImageUrl(path, 300, 70);
  },

  // Get medium size for detail views
  getMediumUrl: (path: string) => {
    return storage.getOptimizedImageUrl(path, 800, 80);
  },

  // Get full size for full-screen views
  getFullUrl: (path: string) => {
    return storage.getOptimizedImageUrl(path, 1200, 90);
  },
};

// Export cache for external use
export { cache }; 