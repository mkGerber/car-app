import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export interface NetworkInfo {
  isConnected: boolean;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
  isEthernet: boolean;
  isUnknown: boolean;
  isExpensive: boolean;
  isMetered: boolean;
}

export interface OptimizationLevel {
  imageQuality: number;
  maxImageWidth: number;
  cacheDuration: number;
  enableBackgroundSync: boolean;
  enablePreloading: boolean;
}

export const OPTIMIZATION_LEVELS = {
  HIGH: {
    imageQuality: 0.9,
    maxImageWidth: 1200,
    cacheDuration: 10 * 60 * 1000, // 10 minutes
    enableBackgroundSync: true,
    enablePreloading: true,
  },
  MEDIUM: {
    imageQuality: 0.8,
    maxImageWidth: 800,
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    enableBackgroundSync: true,
    enablePreloading: false,
  },
  LOW: {
    imageQuality: 0.7,
    maxImageWidth: 600,
    cacheDuration: 15 * 60 * 1000, // 15 minutes
    enableBackgroundSync: false,
    enablePreloading: false,
  },
  MINIMAL: {
    imageQuality: 0.6,
    maxImageWidth: 400,
    cacheDuration: 30 * 60 * 1000, // 30 minutes
    enableBackgroundSync: false,
    enablePreloading: false,
  },
};

class NetworkOptimizer {
  private static instance: NetworkOptimizer;
  private currentNetworkInfo: NetworkInfo | null = null;
  private listeners: ((info: NetworkInfo) => void)[] = [];

  static getInstance(): NetworkOptimizer {
    if (!NetworkOptimizer.instance) {
      NetworkOptimizer.instance = new NetworkOptimizer();
    }
    return NetworkOptimizer.instance;
  }

  async initialize(): Promise<void> {
    // Get initial network state
    const state = await NetInfo.fetch();
    this.updateNetworkInfo(state);

    // Listen for network changes
    NetInfo.addEventListener((state) => {
      this.updateNetworkInfo(state);
    });
  }

  private updateNetworkInfo(state: any): void {
    this.currentNetworkInfo = {
      isConnected: state.isConnected || false,
      type: state.type || 'unknown',
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
      isEthernet: state.type === 'ethernet',
      isUnknown: state.type === 'unknown',
      isExpensive: state.details?.isConnectionExpensive || false,
      isMetered: state.details?.isMetered || false,
    };

    // Notify listeners
    this.listeners.forEach(listener => listener(this.currentNetworkInfo!));
  }

  getCurrentNetworkInfo(): NetworkInfo | null {
    return this.currentNetworkInfo;
  }

  getOptimizationLevel(): OptimizationLevel {
    if (!this.currentNetworkInfo) {
      return OPTIMIZATION_LEVELS.MEDIUM;
    }

    const { isConnected, isWifi, isCellular, isExpensive, isMetered } = this.currentNetworkInfo;

    if (!isConnected) {
      return OPTIMIZATION_LEVELS.MINIMAL;
    }

    if (isWifi && !isMetered) {
      return OPTIMIZATION_LEVELS.HIGH;
    }

    if (isWifi && isMetered) {
      return OPTIMIZATION_LEVELS.MEDIUM;
    }

    if (isCellular && !isExpensive) {
      return OPTIMIZATION_LEVELS.LOW;
    }

    if (isCellular && isExpensive) {
      return OPTIMIZATION_LEVELS.MINIMAL;
    }

    return OPTIMIZATION_LEVELS.MEDIUM;
  }

  shouldOptimizeImages(): boolean {
    const level = this.getOptimizationLevel();
    return level.imageQuality < 0.9;
  }

  shouldUseThumbnails(): boolean {
    const level = this.getOptimizationLevel();
    return level.maxImageWidth <= 600;
  }

  shouldPreloadData(): boolean {
    const level = this.getOptimizationLevel();
    return level.enablePreloading;
  }

  shouldBackgroundSync(): boolean {
    const level = this.getOptimizationLevel();
    return level.enableBackgroundSync;
  }

  getCacheDuration(): number {
    const level = this.getOptimizationLevel();
    return level.cacheDuration;
  }

  addNetworkListener(listener: (info: NetworkInfo) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async isConnectionFast(): Promise<boolean> {
    if (!this.currentNetworkInfo?.isConnected) {
      return false;
    }

    // Simple speed test
    const startTime = Date.now();
    try {
      const response = await fetch('https://httpbin.org/delay/1', {
        method: 'HEAD',
        timeout: 5000,
      });
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Consider fast if response time is under 2 seconds
      return duration < 2000;
    } catch (error) {
      return false;
    }
  }

  getRecommendedImageSettings() {
    const level = this.getOptimizationLevel();
    return {
      quality: level.imageQuality,
      maxWidth: level.maxImageWidth,
      maxHeight: level.maxImageWidth,
      format: 'jpeg' as const,
    };
  }
}

export const networkOptimizer = NetworkOptimizer.getInstance();

// Convenience functions
export function getOptimizationLevel(): OptimizationLevel {
  return networkOptimizer.getOptimizationLevel();
}

export function shouldOptimizeImages(): boolean {
  return networkOptimizer.shouldOptimizeImages();
}

export function shouldUseThumbnails(): boolean {
  return networkOptimizer.shouldUseThumbnails();
}

export function getRecommendedImageSettings() {
  return networkOptimizer.getRecommendedImageSettings();
} 