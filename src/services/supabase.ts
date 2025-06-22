import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
  getVehicles: async (userId: string) => {
    return await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
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
  getPosts: async (page = 0, limit = 10) => {
    return await supabase
      .from('posts')
      .select(`
        *,
        user:users(id, username, avatar_url),
        vehicle:vehicles(id, make, model, year),
        post_media(id, media_url, media_type)
      `)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
  },
  
  createPost: async (postData: any) => {
    return await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();
  },
  
  // Events
  getEvents: async () => {
    return await supabase
      .from('events')
      .select(`
        *,
        creator:users(id, username, avatar_url)
      `)
      .order('start_date', { ascending: true });
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
}; 