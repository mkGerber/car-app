import { cache, supabase } from '../services/supabase';

export interface SyncOptions {
  forceRefresh?: boolean;
  maxAge?: number; // in milliseconds
  background?: boolean;
}

export class DataSync {
  private static instance: DataSync;
  private syncQueue: Map<string, Promise<any>> = new Map();
  private lastSync: Map<string, number> = new Map();

  static getInstance(): DataSync {
    if (!DataSync.instance) {
      DataSync.instance = new DataSync();
    }
    return DataSync.instance;
  }

  async syncData<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: SyncOptions = {}
  ): Promise<T> {
    const { forceRefresh = false, maxAge = 5 * 60 * 1000, background = false } = options;
    
    // Check if we have a recent sync
    const lastSyncTime = this.lastSync.get(key) || 0;
    const needsSync = forceRefresh || (Date.now() - lastSyncTime) > maxAge;

    // If we have a pending sync for this key, wait for it
    if (this.syncQueue.has(key)) {
      return this.syncQueue.get(key)!;
    }

    // If we don't need to sync and have cached data, return it
    if (!needsSync) {
      const cached = await cache.get(key);
      if (cached) {
        return cached;
      }
    }

    // Create new sync promise
    const syncPromise = this.performSync(key, fetchFunction);
    this.syncQueue.set(key, syncPromise);

    try {
      const result = await syncPromise;
      this.lastSync.set(key, Date.now());
      return result;
    } finally {
      this.syncQueue.delete(key);
    }
  }

  private async performSync<T>(
    key: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    try {
      const data = await fetchFunction();
      await cache.set(key, data);
      return data;
    } catch (error) {
      console.error(`Sync failed for key ${key}:`, error);
      throw error;
    }
  }

  // Invalidate cache for specific keys
  async invalidateCache(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        await cache.set(key, null); // Set to null to force refresh
        this.lastSync.delete(key);
      })
    );
  }

  // Clear all cache
  async clearAllCache(): Promise<void> {
    await cache.clear();
    this.lastSync.clear();
    this.syncQueue.clear();
  }

  // Get sync status
  getSyncStatus(key: string): { lastSync: number | null; isPending: boolean } {
    return {
      lastSync: this.lastSync.get(key) || null,
      isPending: this.syncQueue.has(key),
    };
  }
}

// Convenience functions
export const dataSync = DataSync.getInstance();

export async function syncPosts(page = 0, limit = 10, options?: SyncOptions) {
  return dataSync.syncData(
    `posts_${page}_${limit}`,
    async () => {
      const { data, error } = await supabase
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
      
      if (error) throw error;
      return data;
    },
    options
  );
}

export async function syncEvents(options?: SyncOptions) {
  return dataSync.syncData(
    'events_all',
    async () => {
      const { data, error } = await supabase
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
      
      if (error) throw error;
      return data;
    },
    options
  );
}

export async function syncVehicles(userId: string, options?: SyncOptions) {
  return dataSync.syncData(
    `vehicles_${userId}`,
    async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          user_id,
          make,
          model,
          year,
          trim,
          color,
          mileage,
          weight,
          description,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    options
  );
} 