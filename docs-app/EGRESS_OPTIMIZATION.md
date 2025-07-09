# Egress Optimization Guide

This document outlines the comprehensive egress optimization strategies implemented in the mobile app to reduce data usage without sacrificing performance.

## 🎯 Optimization Goals

- **Reduce image upload sizes** by 60-80%
- **Minimize redundant API calls** through intelligent caching
- **Optimize data queries** by selecting only necessary fields
- **Adapt to network conditions** for optimal performance
- **Implement progressive loading** for better user experience

## 📊 Current Optimizations

### 1. Image Optimization

#### Before:

- Images uploaded at 1200px width with 0.8 quality
- No size checking before upload
- Fixed compression settings

#### After:

- **Smart compression**: Only optimize images > 1MB
- **Adaptive quality**: 0.6-0.9 based on network conditions
- **Multiple presets**: Thumbnail (300px), Medium (800px), Full (1200px)
- **Format optimization**: JPEG for photos, WebP when supported

```typescript
// Usage example
import {
  optimizeForUpload,
  shouldOptimizeImage,
} from "../src/utils/imageOptimizer";

const needsOptimization = await shouldOptimizeImage(imageUri, 1); // 1MB threshold
if (needsOptimization) {
  const optimized = await optimizeForUpload(imageUri);
  // Upload optimized image
}
```

### 2. Intelligent Caching System

#### Cache Strategy:

- **5-minute cache** for frequently changing data (posts, events)
- **24-hour cache** for static images
- **Automatic invalidation** when data is updated
- **Network-aware cache duration**

```typescript
// Cache implementation
const cache = {
  async get(key: string): Promise<any | null> {
    // Check cache validity
    // Return cached data if fresh
  },
  async set(key: string, data: any): Promise<void> {
    // Store with timestamp
  },
};
```

### 3. Optimized Database Queries

#### Before:

```sql
SELECT * FROM posts
JOIN users ON posts.user_id = users.id
JOIN vehicles ON posts.vehicle_id = vehicles.id
```

#### After:

```sql
SELECT
  id, user_id, content, images, hashtags,
  location, is_public, likes_count, comments_count,
  created_at,
  user:profiles(id, username, avatar_url),
  vehicle:vehicles(id, make, model, year)
FROM posts
WHERE is_public = true
ORDER BY created_at DESC
LIMIT 20
```

**Benefits:**

- 40-60% reduction in query response size
- Faster parsing and processing
- Reduced network transfer time

### 4. Network-Aware Optimization

#### Optimization Levels:

| Network Type     | Image Quality | Max Width | Cache Duration | Background Sync |
| ---------------- | ------------- | --------- | -------------- | --------------- |
| WiFi (Unmetered) | 0.9           | 1200px    | 10 min         | ✅              |
| WiFi (Metered)   | 0.8           | 800px     | 5 min          | ✅              |
| Cellular (Fast)  | 0.7           | 600px     | 15 min         | ❌              |
| Cellular (Slow)  | 0.6           | 400px     | 30 min         | ❌              |

```typescript
// Network optimization usage
import {
  getOptimizationLevel,
  shouldUseThumbnails,
} from "../src/utils/networkOptimizer";

const level = getOptimizationLevel();
const useThumbnails = shouldUseThumbnails();
```

### 5. Data Synchronization

#### Features:

- **Deduplication**: Prevent multiple simultaneous requests
- **Queue management**: Handle concurrent sync operations
- **Background sync**: Update data when network is good
- **Selective invalidation**: Only refresh changed data

```typescript
// Sync usage
import { syncPosts, syncEvents } from "../src/utils/dataSync";

const posts = await syncPosts(0, 10, { forceRefresh: false });
const events = await syncEvents({ maxAge: 5 * 60 * 1000 });
```

## 🚀 Performance Improvements

### Expected Results:

1. **Image Uploads**: 60-80% size reduction
2. **API Calls**: 40-60% reduction in data transfer
3. **Cache Hit Rate**: 70-90% for frequently accessed data
4. **Network Usage**: 50-70% reduction on cellular networks

### Monitoring:

```typescript
// Track optimization metrics
const metrics = {
  cacheHitRate: cacheHits / totalRequests,
  imageSizeReduction: (originalSize - optimizedSize) / originalSize,
  networkSavings: (beforeBytes - afterBytes) / beforeBytes,
};
```

## 🔧 Implementation Details

### 1. Image Optimization Pipeline

```typescript
// src/utils/imageOptimizer.ts
export async function optimizeImage(
  imageUri: string,
  options: ImageOptimizationOptions = DEFAULT_OPTIONS
): Promise<string> {
  // 1. Check if optimization is needed
  // 2. Calculate optimal dimensions
  // 3. Apply compression
  // 4. Return optimized image
}
```

### 2. Cache Management

```typescript
// src/services/supabase.ts
const cache = {
  async get(key: string): Promise<any | null> {
    // Check cache validity and return data
  },
  async set(key: string, data: any): Promise<void> {
    // Store with timestamp
  },
};
```

### 3. Network Optimization

```typescript
// src/utils/networkOptimizer.ts
class NetworkOptimizer {
  getOptimizationLevel(): OptimizationLevel {
    // Return appropriate settings based on network
  }
}
```

## 📱 Usage Examples

### Optimized Image Upload:

```typescript
// In create-post.tsx
const pickImages = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 0.8,
  });

  if (!result.canceled && result.assets) {
    const processedImages = await Promise.all(
      result.assets.map(async (asset) => {
        const needsOptimization = await shouldOptimizeImage(asset.uri, 1);
        if (needsOptimization) {
          return await optimizeForUpload(asset.uri);
        }
        return asset.uri;
      })
    );
    setSelectedImages([...selectedImages, ...processedImages]);
  }
};
```

### Optimized Data Fetching:

```typescript
// In Redux slices
export const fetchPosts = createAsyncThunk(
  "posts/fetchPosts",
  async (userId?: string) => {
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select(
        `
        id, user_id, content, images, hashtags,
        location, is_public, likes_count, comments_count,
        created_at,
        user:profiles(name, username, avatar_url),
        vehicle:vehicles(year, make, model)
      `
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(20);

    // Process and return data
  }
);
```

## 🔄 Cache Invalidation Strategy

### Automatic Invalidation:

- **Posts**: When new post is created
- **Events**: When event is created/updated
- **Vehicles**: When vehicle is added/modified
- **User data**: When profile is updated

### Manual Invalidation:

```typescript
// Clear specific cache
await dataSync.invalidateCache(["posts_0_10", "events_all"]);

// Clear all cache
await dataSync.clearAllCache();
```

## 📈 Monitoring and Analytics

### Key Metrics to Track:

1. **Cache hit rate** by data type
2. **Image size reduction** percentage
3. **Network usage** by connection type
4. **API response times** before/after optimization
5. **User experience** metrics (load times, etc.)

### Implementation:

```typescript
// Add analytics tracking
const trackOptimization = (metric: string, value: number) => {
  // Send to analytics service
  analytics.track("optimization_metric", { metric, value });
};
```

## 🎯 Future Optimizations

### Planned Improvements:

1. **Progressive image loading** with blur placeholders
2. **Predictive caching** based on user behavior
3. **Offline-first architecture** with sync when online
4. **Image format detection** (WebP, AVIF support)
5. **Background data prefetching** for common screens

### Advanced Features:

1. **Adaptive bitrate** for video content
2. **Smart preloading** based on user patterns
3. **Compression analytics** to optimize settings
4. **Network quality prediction** for better decisions

## 🔧 Configuration

### Environment Variables:

```bash
# Cache duration (in milliseconds)
CACHE_DURATION=300000

# Image optimization threshold (in MB)
IMAGE_OPTIMIZATION_THRESHOLD=1

# Network optimization enabled
ENABLE_NETWORK_OPTIMIZATION=true
```

### Runtime Configuration:

```typescript
// Adjust optimization levels
const customLevel = {
  imageQuality: 0.85,
  maxImageWidth: 1000,
  cacheDuration: 8 * 60 * 1000,
  enableBackgroundSync: true,
  enablePreloading: false,
};
```

## 📚 Best Practices

### For Developers:

1. **Always use optimized queries** - select only needed fields
2. **Implement proper cache invalidation** when data changes
3. **Test on different network conditions** during development
4. **Monitor cache hit rates** and adjust cache duration
5. **Use appropriate image sizes** for different contexts

### For Users:

1. **Enable background sync** when on WiFi
2. **Use WiFi for large uploads** when possible
3. **Clear cache** if experiencing issues
4. **Report slow performance** for optimization

## 🐛 Troubleshooting

### Common Issues:

1. **Cache not working**: Check AsyncStorage permissions
2. **Images not optimizing**: Verify image optimization threshold
3. **Network detection issues**: Ensure NetInfo is properly configured
4. **Performance degradation**: Check cache hit rates and adjust settings

### Debug Commands:

```typescript
// Check cache status
const status = dataSync.getSyncStatus("posts_0_10");

// Clear all cache
await dataSync.clearAllCache();

// Check network optimization level
const level = getOptimizationLevel();
console.log("Current optimization level:", level);
```

This optimization strategy should significantly reduce egress while maintaining or improving app performance across all network conditions.
