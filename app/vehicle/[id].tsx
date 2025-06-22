import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
} from "react-native";
import {
  Text,
  Card,
  Button,
  Chip,
  ActivityIndicator,
  Surface,
  Divider,
  Avatar,
  IconButton,
  useTheme,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../src/store";
import {
  setCurrentVehicle,
  setLoading,
  setError,
} from "../../src/store/slices/vehiclesSlice";
import { db, supabase, storage } from "../../src/services/supabase";
import { format } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function VehicleDetailsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const dispatch = useDispatch();
  const { currentVehicle, loading } = useSelector(
    (state: RootState) => state.vehicles
  );
  const { user } = useSelector((state: RootState) => state.auth);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [buildUpdates, setBuildUpdates] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [fanPhotos, setFanPhotos] = useState([]);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [owner, setOwner] = useState(null);

  // Helper function to get proper image URL
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return null;

    // If it's already a full URL, return as is
    if (imagePath.startsWith("http")) {
      return imagePath;
    }

    // If it's a storage path, convert to public URL
    return storage.getImageUrl(imagePath);
  };

  // Helper function to parse images from the vehicle data
  const getVehicleImages = (vehicle: any) => {
    if (!vehicle?.images) return [];

    try {
      // Parse the JSON string array
      const imageArray = JSON.parse(vehicle.images);
      return Array.isArray(imageArray) ? imageArray : [];
    } catch (error) {
      console.log("Error parsing images:", error);
      return [];
    }
  };

  // Helper function to get the main image (first image in the array)
  const getMainImage = (vehicle: any) => {
    const images = getVehicleImages(vehicle);
    return images.length > 0 ? images[selectedImage] : null;
  };

  // Helper function to parse modifications
  const getModifications = (vehicle: any) => {
    if (!vehicle?.modifications) return [];

    try {
      // If it's already an array, return it
      if (Array.isArray(vehicle.modifications)) {
        return vehicle.modifications;
      }

      // If it's a string, try to parse it as JSON first
      if (typeof vehicle.modifications === "string") {
        // Check if it looks like JSON (starts with [ or {)
        if (
          vehicle.modifications.trim().startsWith("[") ||
          vehicle.modifications.trim().startsWith("{")
        ) {
          try {
            const modArray = JSON.parse(vehicle.modifications);
            return Array.isArray(modArray) ? modArray : [];
          } catch (jsonError) {
            console.log(
              "JSON parsing failed, treating as plain text:",
              jsonError
            );
          }
        }

        // If it's not JSON or JSON parsing failed, treat as plain text
        // Split by commas or newlines if it contains multiple items
        const text = vehicle.modifications.trim();
        if (text.includes(",") || text.includes("\n")) {
          return text
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        } else {
          return [text];
        }
      }

      return [];
    } catch (error) {
      console.log("Error parsing modifications:", error);
      console.log("Modifications value:", vehicle.modifications);
      console.log("Modifications type:", typeof vehicle.modifications);

      // Final fallback: if it's a string, treat it as a single modification
      if (
        typeof vehicle.modifications === "string" &&
        vehicle.modifications.trim()
      ) {
        return [vehicle.modifications.trim()];
      }

      return [];
    }
  };

  const isOwner = user?.id === currentVehicle?.user_id;

  useEffect(() => {
    if (id) {
      loadVehicleDetails(id as string);
    }
  }, [id]);

  const loadVehicleDetails = async (vehicleId: string) => {
    try {
      dispatch(setLoading(true));

      // Load vehicle details
      const { data: vehicle, error: vehicleError } = await db.getVehicle(
        vehicleId
      );
      if (vehicleError) throw vehicleError;

      console.log("Vehicle data:", vehicle);
      console.log("Images field:", vehicle.images);
      console.log("Modifications field:", vehicle.modifications);
      console.log("Modifications type:", typeof vehicle.modifications);
      console.log("Modifications length:", vehicle.modifications?.length);

      dispatch(setCurrentVehicle(vehicle));

      // Set build progress
      setBuildProgress(vehicle.buildProgress || 0);

      // Set likes count
      setLikesCount(vehicle.likes_count || 0);

      // Parse vehicle images and set them as photos
      const vehicleImages = getVehicleImages(vehicle);
      console.log("Parsed vehicle images:", vehicleImages);
      setPhotos(
        vehicleImages.map((url, index) => ({
          id: index.toString(),
          photo_url: url,
          caption: `Photo ${index + 1}`,
        }))
      );

      // Load owner information
      if (vehicle.user_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", vehicle.user_id)
          .single();
        if (profileData) {
          setOwner(profileData);
        }
      }

      // Check if current user has liked this vehicle
      if (user && vehicleId) {
        try {
          const { data: likeData } = await supabase
            .from("vehicle_likes")
            .select("id")
            .eq("vehicle_id", vehicleId)
            .eq("user_id", user.id)
            .maybeSingle();

          setIsLiked(!!likeData);
        } catch (error) {
          console.warn("Could not check user like status:", error);
        }
      }

      // Load build updates
      const { data: updates, error: updatesError } = await supabase
        .from("vehicle_timeline")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("date", { ascending: false });

      if (updatesError) {
        console.error("Error fetching build timeline:", updatesError.message);
      } else {
        setBuildUpdates(updates || []);
      }

      // Load wishlist items
      const { data: wishlist, error: wishlistError } = await supabase
        .from("vehicle_wishlist")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });

      if (wishlistError) {
        console.error("Error fetching wishlist:", wishlistError.message);
      } else {
        setWishlistItems(wishlist || []);
      }

      // Load fan photos from LPR invites
      const { data: fanPhotosData, error: fanPhotosError } = await supabase
        .from("lpr_invites")
        .select(
          `
          id,
          image_url,
          created_at,
          spotted_by_profile:sender_id ( id, name, avatar_url )
        `
        )
        .eq("vehicle_id", vehicleId)
        .eq("status", "accepted");

      if (fanPhotosError) {
        console.error("Error fetching fan photos:", fanPhotosError.message);
      } else {
        setFanPhotos(fanPhotosData || []);
      }
    } catch (error: any) {
      dispatch(setError(error.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleLikeToggle = async () => {
    if (!user || !currentVehicle?.id) return;

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from("vehicle_likes")
          .delete()
          .eq("vehicle_id", currentVehicle.id)
          .eq("user_id", user.id);

        setLikesCount((prev) => prev - 1);
        setIsLiked(false);
      } else {
        // Like
        await supabase.from("vehicle_likes").insert({
          vehicle_id: currentVehicle.id,
          user_id: user.id,
        });

        setLikesCount((prev) => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const saveBuildProgress = async () => {
    if (!currentVehicle?.id) return;

    try {
      await supabase
        .from("vehicles")
        .update({ buildProgress })
        .eq("id", currentVehicle.id);

      // Update the current vehicle in Redux
      dispatch(setCurrentVehicle({ ...currentVehicle, buildProgress }));
    } catch (error) {
      console.error("Error saving build progress:", error);
    }
  };

  const handleToggleWishlistComplete = async (
    itemId: string,
    completed: boolean
  ) => {
    if (!currentVehicle?.id) return;

    // Update the item in Supabase
    const { error } = await supabase
      .from("vehicle_wishlist")
      .update({ completed: !completed })
      .eq("id", itemId);

    if (!error) {
      setWishlistItems(
        wishlistItems.map((item) =>
          item.id === itemId ? { ...item, completed: !completed } : item
        )
      );

      // If marking as complete, add to build timeline
      if (!completed) {
        const item = wishlistItems.find((w) => w.id === itemId);
        if (item) {
          const costText = item.estimated_cost
            ? ` ($${item.estimated_cost})`
            : "";
          const timelineItem = {
            vehicle_id: currentVehicle.id,
            title: `Completed: ${item.title}${costText}`,
            description: item.description || `(from wishlist)`,
            date: new Date().toISOString(),
          };
          const { error: timelineError } = await supabase
            .from("vehicle_timeline")
            .insert(timelineItem);
          if (timelineError) {
            console.error("Error adding to timeline:", timelineError.message);
          }
        }
      } else {
        // If unchecking, remove from build timeline
        const item = wishlistItems.find((w) => w.id === itemId);
        if (item) {
          const costText = item.estimated_cost
            ? ` ($${item.estimated_cost})`
            : "";
          const { error: deleteError } = await supabase
            .from("vehicle_timeline")
            .delete()
            .eq("vehicle_id", currentVehicle.id)
            .eq("title", `Completed: ${item.title}${costText}`);
          if (deleteError) {
            console.error("Error deleting from timeline:", deleteError.message);
          }
        }
      }
    } else {
      console.error("Error updating wishlist item:", error.message);
    }
  };

  const handleDeleteWishlistItem = async (
    itemId: string,
    title: string,
    cost: number
  ) => {
    // Optimistically remove from UI
    const originalItems = [...wishlistItems];
    setWishlistItems(wishlistItems.filter((item) => item.id !== itemId));

    // Delete from Supabase
    const { error } = await supabase
      .from("vehicle_wishlist")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting wishlist item:", error.message);
      // Revert UI change on error
      setWishlistItems(originalItems);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return theme.colors.primary;
      case "In Progress":
        return "#f59e0b"; // Amber 500
      case "Planned":
        return theme.colors.placeholder;
      default:
        return theme.colors.text;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (error) {
      return "Invalid Date";
    }
  };

  const styles = getStyles(theme);

  const renderPhoto = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      onPress={() => setSelectedImage(index)}
      style={styles.thumbnailOuterWrapper}
    >
      <View
        style={[
          styles.photoThumbnailContainer,
          selectedImage === index && styles.selectedPhotoThumbnail,
        ]}
      >
        <Image
          source={{ uri: getImageUrl(item.photo_url) }}
          style={styles.photoThumbnailImage}
          resizeMode="cover"
        />
      </View>
    </TouchableOpacity>
  );

  const renderBuildUpdate = ({ item }: { item: any }) => (
    <Card style={styles.updateCard} mode="outlined">
      <Card.Content>
        <View style={styles.updateHeader}>
          <Text variant="titleMedium">{item.title}</Text>
          <Text variant="bodySmall" style={styles.updateDate}>
            {formatDate(item.date)}
          </Text>
        </View>
        {item.description && (
          <Text variant="bodyMedium" style={styles.updateDescription}>
            {item.description}
          </Text>
        )}
        {item.cost && (
          <Text variant="bodySmall" style={styles.updateCost}>
            Cost: ${item.cost}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderWishlistItem = ({ item }: { item: any }) => (
    <Card style={styles.wishlistCard} mode="outlined">
      <Card.Content>
        <View style={styles.wishlistHeader}>
          <TouchableOpacity
            onPress={() =>
              handleToggleWishlistComplete(item.id, item.completed)
            }
            style={styles.wishlistTitleContainer}
            disabled={!isOwner}
          >
            <IconButton
              icon={
                item.completed
                  ? "check-circle"
                  : "checkbox-blank-circle-outline"
              }
              size={24}
              color={
                item.completed ? theme.colors.primary : theme.colors.placeholder
              }
            />
            <Text
              variant="titleMedium"
              style={[
                styles.wishlistTitle,
                item.completed && styles.wishlistTitleCompleted,
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
          {isOwner && (
            <View style={styles.wishlistActions}>
              <IconButton
                icon="delete"
                size={20}
                onPress={() =>
                  handleDeleteWishlistItem(
                    item.id,
                    item.title,
                    item.estimated_cost
                  )
                }
              />
            </View>
          )}
        </View>
        {item.description && (
          <Text
            variant="bodyMedium"
            style={[
              styles.wishlistDescription,
              item.completed && styles.wishlistTitleCompleted,
            ]}
          >
            {item.description}
          </Text>
        )}
        <View style={styles.wishlistFooter}>
          {item.priority && (
            <Chip
              mode="outlined"
              textStyle={{
                color:
                  item.priority === "high"
                    ? theme.colors.error
                    : item.priority === "medium"
                    ? "#f59e0b"
                    : theme.colors.primary,
              }}
            >
              {item.priority}
            </Chip>
          )}
          {item.estimated_cost && (
            <Text variant="bodySmall" style={styles.wishlistCost}>
              Est. Cost: ${item.estimated_cost}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderFanPhoto = ({ item }: { item: any }) => (
    <Card style={styles.fanPhotoCard}>
      <Card.Cover source={{ uri: getImageUrl(item.image_url) }} />
      <Card.Content>
        <View style={styles.fanPhotoHeader}>
          <Avatar.Image
            size={32}
            source={{ uri: getImageUrl(item.spotted_by_profile.avatar_url) }}
          />
          <Text style={styles.fanPhotoUsername}>
            {item.spotted_by_profile.name}
          </Text>
        </View>
        <Text style={styles.fanPhotoDate}>
          Spotted on: {formatDate(item.created_at)}
        </Text>
      </Card.Content>
    </Card>
  );

  const tabs = [
    "Overview",
    "Specifications",
    "Build Timeline",
    "Fan Photos",
    "Wishlist",
  ];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return (
          <View>
            <Surface style={styles.section}>
              <Text style={styles.sectionTitle}>Performance</Text>
              <View style={styles.specGrid}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Horsepower</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.horsepower || "N/A"} HP
                  </Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Torque</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.torque || "N/A"} lb-ft
                  </Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Weight</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.weight || "N/A"} lbs
                  </Text>
                </View>
              </View>
            </Surface>
          </View>
        );
      case 1:
        return (
          <Surface style={styles.section}>
            <Text style={styles.sectionTitle}>Modifications</Text>
            {getModifications(currentVehicle).map((mod, index) => (
              <Chip
                key={index}
                style={styles.modChip}
                textStyle={styles.modChipText}
              >
                {mod}
              </Chip>
            ))}
          </Surface>
        );
      case 2:
        return (
          <FlatList
            data={buildUpdates}
            renderItem={renderBuildUpdate}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No build updates yet.</Text>
            }
          />
        );
      case 3:
        return (
          <FlatList
            data={fanPhotos}
            renderItem={renderFanPhoto}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No fan photos yet.</Text>
            }
          />
        );
      case 4:
        return (
          <FlatList
            data={wishlistItems}
            renderItem={renderWishlistItem}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No wishlist items yet.</Text>
            }
          />
        );
      default:
        return null;
    }
  };

  if (loading || !currentVehicle) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.vehicleName}>
            {currentVehicle?.name ||
              `${currentVehicle?.year || ""} ${currentVehicle?.make || ""} ${
                currentVehicle?.model || ""
              }`}
          </Text>
          {owner && (
            <TouchableOpacity
              onPress={() => router.push(`/profile/${currentVehicle.user_id}`)}
              style={styles.ownerInfo}
            >
              {owner.avatar_url ? (
                <Avatar.Image
                  size={32}
                  source={{ uri: getImageUrl(owner.avatar_url) }}
                  style={styles.ownerAvatar}
                />
              ) : (
                <Avatar.Text
                  size={32}
                  label={owner.name ? owner.name.charAt(0).toUpperCase() : "U"}
                  style={styles.ownerAvatar}
                />
              )}
              <Text variant="bodyMedium">{owner.name}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Chip
          mode="flat"
          textStyle={{ color: getStatusColor(currentVehicle?.status) }}
          style={[
            styles.statusChip,
            { backgroundColor: `${getStatusColor(currentVehicle?.status)}1A` },
          ]}
        >
          {currentVehicle?.status || currentVehicle?.type || "Unknown"}
        </Chip>
      </Surface>

      {getMainImage(currentVehicle) && (
        <View style={styles.mainImageContainer}>
          <Image
            source={{ uri: getImageUrl(getMainImage(currentVehicle)) }}
            style={styles.mainImage}
            resizeMode="cover"
          />
        </View>
      )}

      {photos.length > 1 && (
        <Surface style={styles.thumbnailsContainer}>
          <FlatList
            data={photos}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailsList}
            renderItem={renderPhoto}
            keyExtractor={(item) => item.id}
          />
        </Surface>
      )}

      <Surface style={styles.actionsSection}>
        <View style={styles.actionButtons}>
          <IconButton
            icon={isLiked ? "heart" : "heart-outline"}
            onPress={handleLikeToggle}
            iconColor={isLiked ? theme.colors.error : theme.colors.placeholder}
          />
          <Text variant="bodySmall">{likesCount}</Text>
          <IconButton
            icon="share"
            onPress={() => {
              /* Handle share */
            }}
          />
          {isOwner && (
            <>
              <Button
                mode="outlined"
                onPress={() =>
                  router.push(`/vehicle/edit/${currentVehicle?.id}`)
                }
                style={styles.actionButton}
              >
                Edit
              </Button>
            </>
          )}
        </View>
      </Surface>

      <Surface style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {[
            "Overview",
            "Specifications",
            "Build Timeline",
            "Fan Photos",
            "Wishlist",
          ].map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === index && styles.selectedTab]}
              onPress={() => setSelectedTab(index)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === index && styles.selectedTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.tabContent}>
          {selectedTab === 0 && (
            <View>
              <Text variant="bodyMedium" style={styles.description}>
                {currentVehicle?.description || "No description available"}
              </Text>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Modifications
              </Text>
              <View style={styles.modificationsContainer}>
                {getModifications(currentVehicle).map((mod, index) => (
                  <Chip key={index} style={styles.modificationChip}>
                    {mod}
                  </Chip>
                ))}
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                License Plate
              </Text>
              <View style={styles.licenseContainer}>
                <Text variant="bodyLarge">
                  {currentVehicle?.license_plate || "Not set"} -{" "}
                  {currentVehicle?.license_state || "N/A"}
                </Text>
              </View>
            </View>
          )}
          {selectedTab === 1 && (
            <View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Make</Text>
                <Text variant="bodyLarge">{currentVehicle?.make || "N/A"}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Model</Text>
                <Text variant="bodyLarge">
                  {currentVehicle?.model || "N/A"}
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Year</Text>
                <Text variant="bodyLarge">{currentVehicle?.year || "N/A"}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Type</Text>
                <Text variant="bodyLarge">{currentVehicle?.type || "N/A"}</Text>
              </View>
              {currentVehicle?.horsepower && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Horsepower</Text>
                  <Text variant="bodyLarge">
                    {currentVehicle.horsepower} HP
                  </Text>
                </View>
              )}
            </View>
          )}
          {selectedTab === 2 && (
            <View>
              {buildUpdates.length > 0 ? (
                <FlatList
                  data={buildUpdates}
                  renderItem={renderBuildUpdate}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptySection}>
                  <Text variant="titleMedium">No Build Updates</Text>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    Track your modifications and progress
                  </Text>
                </View>
              )}
            </View>
          )}
          {selectedTab === 3 && (
            <View>
              {fanPhotos.length > 0 ? (
                <FlatList
                  data={fanPhotos}
                  renderItem={({ item }) => (
                    <Card style={styles.fanPhotoCard} mode="outlined">
                      <Card.Cover
                        source={{ uri: getImageUrl(item.image_url) }}
                      />
                      <Card.Content>
                        <Text variant="bodySmall">
                          Spotted by: {item.spotted_by_profile.name}
                        </Text>
                      </Card.Content>
                    </Card>
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptySection}>
                  <Text variant="titleMedium">No Fan Photos</Text>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    Be the first to share a photo of this vehicle!
                  </Text>
                </View>
              )}
            </View>
          )}
          {selectedTab === 4 && (
            <View>
              {wishlistItems.length > 0 ? (
                <FlatList
                  data={wishlistItems}
                  renderItem={renderWishlistItem}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptySection}>
                  <Text variant="titleMedium">No Wishlist Items</Text>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    Plan your future modifications
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Surface>
    </ScrollView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    header: {
      margin: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    vehicleName: {
      flex: 1,
      marginRight: 8,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    ownerInfo: {
      flexDirection: "row",
      alignItems: "center",
    },
    ownerAvatar: {
      marginRight: 8,
    },
    statusChip: {
      alignSelf: "flex-start",
    },
    mainImageContainer: {
      height: 250,
      marginHorizontal: 16,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceVariant,
    },
    mainImage: {
      width: "100%",
      height: "100%",
    },
    thumbnailsContainer: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      padding: 8,
    },
    thumbnailsList: {
      paddingHorizontal: 4,
    },
    thumbnailOuterWrapper: {
      padding: 4,
    },
    photoThumbnailContainer: {
      width: width * 0.2,
      height: width * 0.2,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceVariant,
    },
    photoThumbnailImage: {
      width: "100%",
      height: "100%",
    },
    selectedPhotoThumbnail: {
      borderWidth: 3,
      borderColor: theme.colors.primary,
    },
    actionsSection: {
      marginHorizontal: 16,
      marginVertical: 16,
      padding: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    actionButtons: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    actionButton: {
      marginHorizontal: 4,
      flex: 1,
    },
    tabsSection: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 2,
      overflow: "hidden",
    },
    tabsContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    tab: {
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    selectedTab: {
      borderBottomWidth: 2,
      borderColor: theme.colors.primary,
    },
    tabText: {
      fontWeight: "bold",
      color: theme.colors.placeholder,
    },
    selectedTabText: {
      color: theme.colors.primary,
    },
    tabContent: {
      padding: 16,
      minHeight: 150,
    },
    description: {
      marginBottom: 16,
      lineHeight: 22,
      color: theme.colors.text,
    },
    sectionTitle: {
      marginBottom: 8,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    modificationsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 16,
    },
    modificationChip: {
      margin: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
    licenseContainer: {
      marginTop: 16,
    },
    specRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: theme.colors.surfaceVariant,
    },
    specLabel: {
      color: theme.colors.placeholder,
    },
    updateCard: {
      marginBottom: 12,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
      borderColor: theme.colors.surfaceVariant,
    },
    updateHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    updateDate: {
      color: theme.colors.placeholder,
    },
    updateDescription: {
      color: theme.colors.text,
      marginBottom: 4,
    },
    updateCost: {
      color: theme.colors.primary,
      fontWeight: "bold",
    },
    wishlistCard: {
      marginBottom: 12,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
      borderColor: theme.colors.surfaceVariant,
    },
    wishlistHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    wishlistTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    wishlistTitle: {
      color: theme.colors.text,
    },
    wishlistTitleCompleted: {
      textDecorationLine: "line-through",
      color: theme.colors.placeholder,
    },
    wishlistActions: {
      flexDirection: "row",
    },
    wishlistDescription: {
      marginBottom: 8,
      color: theme.colors.text,
      marginLeft: 40,
    },
    wishlistFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginLeft: 40,
    },
    wishlistCost: {
      color: theme.colors.primary,
      fontWeight: "bold",
    },
    emptySection: {
      alignItems: "center",
      paddingVertical: 32,
    },
    emptyText: {
      marginTop: 8,
      color: theme.colors.placeholder,
      textAlign: "center",
    },
    fanPhotoCard: {
      marginBottom: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: theme.colors.surfaceVariant,
    },
    fanPhotoHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
    },
    fanPhotoUsername: {
      marginLeft: 8,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    fanPhotoDate: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      fontSize: 12,
      color: theme.colors.placeholder,
    },
  });
