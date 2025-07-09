import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.8,
  format: 'jpeg',
};

export const THUMBNAIL_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 300,
  maxHeight: 300,
  quality: 0.7,
  format: 'jpeg',
};

export const PROFILE_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.8,
  format: 'jpeg',
};

export const FULL_SIZE_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.9,
  format: 'jpeg',
};

export async function optimizeImage(
  imageUri: string,
  options: ImageOptimizationOptions = DEFAULT_OPTIONS
): Promise<string> {
  try {
    const {
      maxWidth = 800,
      maxHeight = 800,
      quality = 0.8,
      format = 'jpeg',
    } = options;

    // Get image info to determine resize dimensions
    const imageInfo = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    // Calculate optimal dimensions while maintaining aspect ratio
    const { width, height } = imageInfo;
    let targetWidth = width;
    let targetHeight = height;

    if (width > maxWidth || height > maxHeight) {
      const aspectRatio = width / height;
      if (width > height) {
        targetWidth = maxWidth;
        targetHeight = maxWidth / aspectRatio;
      } else {
        targetHeight = maxHeight;
        targetWidth = maxHeight * aspectRatio;
      }
    }

    // Perform the optimization
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: targetWidth, height: targetHeight } }],
      {
        compress: quality,
        format: format === 'jpeg' 
          ? ImageManipulator.SaveFormat.JPEG 
          : format === 'png'
          ? ImageManipulator.SaveFormat.PNG
          : ImageManipulator.SaveFormat.WEBP,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('Image optimization failed:', error);
    return imageUri; // Return original if optimization fails
  }
}

export async function createThumbnail(imageUri: string): Promise<string> {
  return optimizeImage(imageUri, THUMBNAIL_OPTIONS);
}

export async function optimizeForUpload(imageUri: string): Promise<string> {
  return optimizeImage(imageUri, DEFAULT_OPTIONS);
}

export async function optimizeForProfile(imageUri: string): Promise<string> {
  return optimizeImage(imageUri, PROFILE_OPTIONS);
}

export async function getImageFileSize(imageUri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    return fileInfo.size || 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function shouldOptimizeImage(imageUri: string, maxSizeMB = 2): Promise<boolean> {
  const fileSize = await getImageFileSize(imageUri);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize > maxSizeBytes;
} 