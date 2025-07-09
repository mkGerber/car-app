import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  useTheme,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "../src/services/supabase";
import { optimizeForUpload, shouldOptimizeImage, formatFileSize } from "../src/utils/imageOptimizer";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../src/store";
import { createPost } from "../src/store/slices/postsSlice";
import { awardBadge } from "../src/utils/awardBadges";

const { width } = Dimensions.get("window");

export default function CreatePostScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const { vehicles } = useSelector((state: RootState) => state.vehicles);
  const { loading: creatingPost } = useSelector(
    (state: RootState) => state.posts
  );

  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [location, setLocation] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const popularHashtags = [
    "#JDM",
    "#Euro",
    "#Muscle",
    "#Classic",
    "#Drift",
    "#Drag",
    "#ShowCar",
    "#TrackBuild",
    "#DailyDriver",
    "#ProjectCar",
    "#Mods",
    "#Tuning",
    "#CarMeet",
    "#CarLife",
    "#CarCulture",
  ];

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const processedImages = await Promise.all(
        result.assets.map(async (asset) => {
          // Check if optimization is needed
          const needsOptimization = await shouldOptimizeImage(asset.uri, 1); // 1MB threshold
          if (needsOptimization) {
            return await optimizeForUpload(asset.uri);
          }
          return asset.uri;
        })
      );
      setSelectedImages([...selectedImages, ...processedImages]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera permission is required to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Always optimize camera photos for consistent upload sizes
      const optimized = await optimizeForUpload(result.assets[0].uri);
      setSelectedImages([...selectedImages, optimized]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const addHashtag = () => {
    if (hashtagInput.trim() && !hashtags.includes(hashtagInput.trim())) {
      setHashtags([...hashtags, hashtagInput.trim()]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (hashtag: string) => {
    setHashtags(hashtags.filter((h) => h !== hashtag));
  };

  const addPopularHashtag = (hashtag: string) => {
    if (!hashtags.includes(hashtag)) {
      setHashtags([...hashtags, hashtag]);
    }
  };

  const uploadImage = async (
    imageUri: string,
    bucket: string,
    path: string
  ) => {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let j = 0; j < byteCharacters.length; j++) {
      byteNumbers[j] = byteCharacters.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, byteArray, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleCreatePost = async () => {
    if (!content.trim() && selectedImages.length === 0) {
      setError("Please add some content or photos to your post.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Extract hashtags from content
      const contentHashtags = content.match(/#\w+/g) || [];
      const allHashtags = [...new Set([...hashtags, ...contentHashtags])];

      // 1. Create the post first (without images)
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          images: [], // empty for now
          vehicle_id: selectedVehicle,
          hashtags: allHashtags,
          location: location.trim() || undefined,
          is_public: isPublic,
        })
        .select()
        .single();

      if (postError || !post)
        throw postError || new Error("Failed to create post");
      const postId = post.id;

      // 2. Upload images to the post's folder
      const imageUrls = await Promise.all(
        selectedImages.map(async (imageUri, index) => {
          // Already compressed in pickImages/takePhoto
          const fileName = `posts/${postId}/${Date.now()}_${index}.jpg`;
          return await uploadImage(imageUri, "vehicle-images", fileName);
        })
      );

      // 3. Update the post with the image URLs
      const { error: updateError } = await supabase
        .from("posts")
        .update({ images: imageUrls })
        .eq("id", postId);

      if (updateError) throw updateError;

      Alert.alert("Success", "Post created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);

      if (user?.id) {
        await awardBadge(user.id, "First Post");
        // Check for 10+ posts/photos
        const { count } = await supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if ((count || 0) >= 10) {
          await awardBadge(user.id, "Photographer");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to create post");
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Button
            mode="text"
            onPress={() => router.back()}
            textColor={colors.primary}
          >
            Cancel
          </Button>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>
            Create Post
          </Text>
          <Button
            mode="text"
            onPress={handleCreatePost}
            loading={uploading}
            disabled={
              uploading || (!content.trim() && selectedImages.length === 0)
            }
            textColor={colors.primary}
          >
            Share
          </Button>
        </View>

        {/* Image Upload Section */}
        <View style={styles.imageSection}>
          {selectedImages.length === 0 ? (
            <View style={styles.uploadButtons}>
              <Button
                mode="outlined"
                onPress={takePhoto}
                icon="camera"
                style={styles.uploadButton}
              >
                Take Photo
              </Button>
              <Button
                mode="outlined"
                onPress={pickImages}
                icon="image-multiple"
                style={styles.uploadButton}
              >
                Choose Photos
              </Button>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: image }} style={styles.selectedImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {selectedImages.length < 5 && (
                <TouchableOpacity
                  style={styles.addMoreButton}
                  onPress={pickImages}
                >
                  <Text style={styles.addMoreText}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          <TextInput
            label="What's on your mind?"
            value={content}
            onChangeText={setContent}
            style={styles.contentInput}
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder="Share your car story, mods, or thoughts..."
          />
        </View>

        {/* Vehicle Selection */}
        {vehicles.length > 0 && (
          <View style={styles.vehicleSection}>
            <Text style={styles.sectionTitle}>Tag a Vehicle (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {vehicles.map((vehicle) => (
                <Chip
                  key={vehicle.id}
                  selected={selectedVehicle === vehicle.id}
                  onPress={() =>
                    setSelectedVehicle(
                      selectedVehicle === vehicle.id ? null : vehicle.id
                    )
                  }
                  style={styles.vehicleChip}
                >
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Chip>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Hashtags Section */}
        <View style={styles.hashtagsSection}>
          <Text style={styles.sectionTitle}>Hashtags</Text>

          {/* Add hashtag input */}
          <View style={styles.hashtagInput}>
            <TextInput
              label="Add hashtag"
              value={hashtagInput}
              onChangeText={setHashtagInput}
              style={styles.hashtagTextInput}
              mode="outlined"
              placeholder="#JDM"
              onSubmitEditing={addHashtag}
            />
            <Button
              mode="contained"
              onPress={addHashtag}
              disabled={!hashtagInput.trim()}
              style={styles.addHashtagButton}
            >
              Add
            </Button>
          </View>

          {/* Selected hashtags */}
          {hashtags.length > 0 && (
            <View style={styles.selectedHashtags}>
              {hashtags.map((hashtag, index) => (
                <Chip
                  key={index}
                  onClose={() => removeHashtag(hashtag)}
                  style={styles.hashtagChip}
                >
                  {hashtag}
                </Chip>
              ))}
            </View>
          )}

          {/* Popular hashtags */}
          <Text style={styles.popularHashtagsTitle}>Popular Hashtags</Text>
          <View style={styles.popularHashtags}>
            {popularHashtags.map((hashtag) => (
              <Chip
                key={hashtag}
                onPress={() => addPopularHashtag(hashtag)}
                style={styles.popularHashtagChip}
                mode="outlined"
              >
                {hashtag}
              </Chip>
            ))}
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.locationSection}>
          <Text style={styles.sectionTitle}>Location (Optional)</Text>
          <TextInput
            label="Where was this taken?"
            value={location}
            onChangeText={setLocation}
            style={styles.locationInput}
            mode="outlined"
            placeholder="Car meet, track, garage..."
          />
        </View>

        {/* Privacy Section */}
        <View style={styles.privacySection}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.privacyOptions}>
            <Chip
              selected={isPublic}
              onPress={() => setIsPublic(true)}
              style={styles.privacyChip}
            >
              Public
            </Chip>
            <Chip
              selected={!isPublic}
              onPress={() => setIsPublic(false)}
              style={styles.privacyChip}
            >
              Private
            </Chip>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  imageSection: {
    marginBottom: 20,
  },
  uploadButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  uploadButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  imageContainer: {
    position: "relative",
    marginRight: 10,
  },
  selectedImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f44336",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  addMoreButton: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addMoreText: {
    fontSize: 32,
    color: "#666",
  },
  contentSection: {
    marginBottom: 20,
  },
  contentInput: {
    marginBottom: 0,
  },
  vehicleSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#d4af37",
  },
  vehicleChip: {
    marginRight: 8,
  },
  hashtagsSection: {
    marginBottom: 20,
  },
  hashtagInput: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  hashtagTextInput: {
    flex: 1,
    marginRight: 8,
  },
  addHashtagButton: {
    backgroundColor: "#d4af37",
  },
  selectedHashtags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  hashtagChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  popularHashtagsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  popularHashtags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  popularHashtagChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  locationSection: {
    marginBottom: 20,
  },
  locationInput: {
    marginBottom: 0,
  },
  privacySection: {
    marginBottom: 20,
  },
  privacyOptions: {
    flexDirection: "row",
  },
  privacyChip: {
    marginRight: 12,
  },
  errorText: {
    color: "#f44336",
    textAlign: "center",
    marginTop: 16,
  },
});
