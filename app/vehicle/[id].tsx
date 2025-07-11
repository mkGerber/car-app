import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MaintenanceReminders } from "../../src/components/garage/MaintenanceReminders";

const { width, height } = Dimensions.get("window");

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
  const [photos, setPhotos] = useState<any[]>([]);
  const [buildUpdates, setBuildUpdates] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [fanPhotos, setFanPhotos] = useState<any[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [owner, setOwner] = useState<any>(null);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Define tabs in logical order
  const tabs = [
    "Overview",
    "Specifications",
    "Build Timeline",
    "Maintenance",
    "Wishlist",
    "Fan Photos",
  ];

  // Helper to handle scroll and update zoomIndex
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setZoomIndex(viewableItems[0].index);
    }
  }).current;
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  // Helper function to get proper image URL
  const getImageUrl = (imagePath: string | null | undefined): string => {
    if (!imagePath) return "";
    if (typeof imagePath === "string" && imagePath.startsWith("http"))
      return imagePath;
    if (typeof storage !== "undefined" && storage.getImageUrl) {
      return storage.getImageUrl(imagePath) || "";
    }
    return "";
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
        // Sort by created_at descending (most recent first)
        const sortedFanPhotos = (fanPhotosData || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setFanPhotos(sortedFanPhotos);
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
          const { error: timelineError, data: inserted } = await supabase
            .from("vehicle_timeline")
            .insert(timelineItem)
            .select()
            .single();
          if (!timelineError && inserted) {
            setBuildUpdates((prev) => [inserted, ...prev]);
          } else if (timelineError) {
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
          if (!deleteError) {
            setBuildUpdates((prev) =>
              prev.filter(
                (u) => u.title !== `Completed: ${item.title}${costText}`
              )
            );
          } else {
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
        // Fallback to a safe color if status is undefined or not recognized
        return theme.colors.primary || "#181c3a";
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
          source={{ uri: item.photo_url || "" }}
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
              iconColor={
                item.completed ? theme.colors.primary : theme.colors.outline
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
      <Card.Cover source={{ uri: item.image_url || "" }} />
      <Card.Content>
        <View style={styles.fanPhotoHeader}>
          <Avatar.Image
            size={32}
            source={{ uri: item.spotted_by_profile.avatar_url || "" }}
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

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return (
          <View>
            <Surface style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <View style={{ flex: 1, minWidth: 120, marginBottom: 8 }}>
                  <Text style={styles.specLabel}>Year</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.year || "N/A"}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 120, marginBottom: 8 }}>
                  <Text style={styles.specLabel}>Make</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.make || "N/A"}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 120, marginBottom: 8 }}>
                  <Text style={styles.specLabel}>Model</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.model || "N/A"}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 120, marginBottom: 8 }}>
                  <Text style={styles.specLabel}>Miles</Text>
                  <Text style={styles.specValue}>
                    {currentVehicle?.miles || "N/A"}
                  </Text>
                </View>
              </View>
            </Surface>
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
            {getModifications(currentVehicle).map((mod: any, index: number) => (
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
          <Surface style={styles.section}>
            <FlatList
              data={buildUpdates}
              renderItem={renderBuildUpdate}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No build updates yet.</Text>
              }
            />
          </Surface>
        );
      case 3:
        return (
          <Surface style={styles.section}>
            <MaintenanceReminders
              vehicleId={currentVehicle?.id || ""}
              vehicleMiles={currentVehicle?.miles || 0}
            />
          </Surface>
        );
      case 4:
        return (
          <Surface style={styles.section}>
            <FlatList
              data={wishlistItems}
              renderItem={renderWishlistItem}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No wishlist items yet.</Text>
              }
            />
          </Surface>
        );
      case 5:
        return (
          <Surface style={styles.section}>
            <FlatList
              data={fanPhotos}
              renderItem={renderFanPhoto}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No fan photos yet.</Text>
              }
            />
          </Surface>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    if (zoomVisible && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: zoomIndex,
          animated: false,
        });
      }, 100);
    }
  }, [zoomVisible, zoomIndex]);

  if (loading || !currentVehicle) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Render the main content based on selected tab
  const renderMainContent = () => {
    switch (selectedTab) {
      case 0: // Overview
        return (
          <ScrollView style={styles.contentContainer}>
            {renderTabContent()}
          </ScrollView>
        );
      case 1: // Specifications
        return (
          <ScrollView style={styles.contentContainer}>
            {renderTabContent()}
          </ScrollView>
        );
      case 2: // Build Timeline
        return (
          <FlatList
            style={styles.contentContainer}
            data={buildUpdates}
            renderItem={renderBuildUpdate}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No build updates yet.</Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        );
      case 3: // Maintenance
        return (
          <ScrollView style={styles.contentContainer}>
            <MaintenanceReminders
              vehicleId={currentVehicle?.id || ""}
              vehicleMiles={currentVehicle?.miles || 0}
            />
          </ScrollView>
        );
      case 4: // Wishlist
        return (
          <FlatList
            style={styles.contentContainer}
            data={wishlistItems}
            renderItem={renderWishlistItem}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No wishlist items yet.</Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        );
      case 5: // Fan Photos
        return (
          <FlatList
            style={styles.contentContainer}
            data={fanPhotos}
            renderItem={renderFanPhoto}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No fan photos yet.</Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero Section with Image */}
      {getMainImage(currentVehicle) && (
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: getImageUrl(getMainImage(currentVehicle)) }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <IconButton
            icon="magnify"
            size={28}
            style={styles.zoomButton}
            onPress={() => {
              setZoomIndex(selectedImage);
              setZoomVisible(true);
            }}
            iconColor={theme.colors.primary}
          />
          <View style={styles.heroContent}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroVehicleName} numberOfLines={2}>
                {currentVehicle?.name ||
                  `${currentVehicle?.year || ""} ${
                    currentVehicle?.make || ""
                  } ${currentVehicle?.model || ""}`}
              </Text>
              {owner && (
                <TouchableOpacity
                  onPress={() =>
                    router.push(`/profile/${currentVehicle.user_id}`)
                  }
                  style={styles.heroOwnerInfo}
                >
                  {owner.avatar_url ? (
                    <Avatar.Image
                      size={28}
                      source={{ uri: getImageUrl(owner.avatar_url) }}
                      style={styles.heroOwnerAvatar}
                    />
                  ) : (
                    <Avatar.Text
                      size={28}
                      label={
                        owner.name ? owner.name.charAt(0).toUpperCase() : "U"
                      }
                      style={styles.heroOwnerAvatar}
                    />
                  )}
                  <Text style={styles.heroOwnerName}>{owner.name}</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.heroActions}>
              <IconButton
                icon={isLiked ? "heart" : "heart-outline"}
                onPress={handleLikeToggle}
                iconColor={isLiked ? theme.colors.error : theme.colors.primary}
                style={styles.heroActionButton}
              />
              <IconButton
                icon="share"
                onPress={() => {}}
                iconColor={theme.colors.primary}
                style={styles.heroActionButton}
              />
              {isOwner && (
                <IconButton
                  icon="pencil"
                  onPress={() =>
                    router.push(`/vehicle/edit/${currentVehicle?.id}`)
                  }
                  iconColor={theme.colors.primary}
                  style={styles.heroActionButton}
                />
              )}
            </View>
          </View>
          <Chip
            mode="flat"
            style={styles.heroStatusChip}
            textStyle={{
              color: getStatusColor(currentVehicle?.status),
              fontWeight: "bold",
            }}
          >
            {currentVehicle?.status || currentVehicle?.type || "Unknown"}
          </Chip>
        </View>
      )}

      {/* Thumbnails */}
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

      {/* Top Tab Navigation */}
      <Surface style={styles.topTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topTabsScroll}
        >
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.topTab,
                selectedTab === index && styles.selectedTopTab,
              ]}
              onPress={() => setSelectedTab(index)}
            >
              <Text
                style={[
                  styles.topTabText,
                  selectedTab === index && styles.selectedTopTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Surface>

      {/* Main Content */}
      {renderMainContent()}

      {/* Image Zoom Modal */}
      {zoomVisible && photos.length > 0 && (
        <Modal
          visible={zoomVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setZoomVisible(false)}
        >
          <View style={styles.zoomModalOverlay}>
            <IconButton
              icon="close"
              size={32}
              style={styles.zoomCloseButton}
              onPress={() => setZoomVisible(false)}
              iconColor="white"
            />
            <FlatList
              ref={flatListRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewConfigRef.current}
              renderItem={({ item }) => (
                <View style={styles.zoomImageContainer}>
                  <Image
                    source={{ uri: getImageUrl(item.photo_url) }}
                    style={styles.zoomImage}
                    resizeMode="contain"
                  />
                </View>
              )}
              keyExtractor={(item) => item.id}
            />
            <View style={styles.zoomPagination}>
              {photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.zoomDot,
                    zoomIndex === index && styles.zoomActiveDot,
                  ]}
                />
              ))}
            </View>
          </View>
        </Modal>
      )}
    </View>
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
    topTabsContainer: {
      backgroundColor: theme.colors.surface,
      elevation: 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    topTabsScroll: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    topTab: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 4,
      borderRadius: 20,
      backgroundColor: "transparent",
    },
    selectedTopTab: {
      backgroundColor: theme.colors.primary,
      elevation: 2,
    },
    topTabText: {
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
    },
    selectedTopTabText: {
      color: theme.colors.onPrimary,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    zoomButton: {
      position: "absolute",
      top: 18,
      right: 18,
      zIndex: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      elevation: 3,
    },
    zoomModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.97)",
      justifyContent: "center",
      alignItems: "center",
    },
    zoomCloseButton: {
      position: "absolute",
      top: 50,
      right: 20,
      zIndex: 10,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 20,
    },
    zoomImageContainer: {
      width: width,
      height: height,
    },
    zoomImage: {
      width: "100%",
      height: "100%",
    },
    zoomPagination: {
      position: "absolute",
      bottom: 50,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    zoomDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.5)",
      marginHorizontal: 4,
    },
    zoomActiveDot: {
      backgroundColor: "white",
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
    section: {
      marginBottom: 16,
      padding: 20,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      elevation: 3,
    },
    sectionTitle: {
      marginBottom: 8,
      fontWeight: "bold",
      color: theme.colors.onSurface,
      fontSize: 18,
    },
    specGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    specItem: {
      flex: 1,
      alignItems: "center",
    },
    specLabel: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    specValue: {
      color: theme.colors.primary,
      fontWeight: "bold",
      fontSize: 16,
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
    updateCard: {
      marginBottom: 12,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      elevation: 2,
    },
    updateHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    updateDate: {
      color: theme.colors.onSurface,
      opacity: 0.7,
    },
    updateDescription: {
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    updateCost: {
      color: theme.colors.primary,
      fontWeight: "bold",
    },
    wishlistCard: {
      marginBottom: 12,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      elevation: 2,
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
      color: theme.colors.onSurface,
    },
    wishlistTitleCompleted: {
      textDecorationLine: "line-through",
      color: theme.colors.outline,
    },
    wishlistActions: {
      flexDirection: "row",
    },
    wishlistDescription: {
      marginBottom: 8,
      color: theme.colors.onSurface,
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
      color: theme.colors.onSurface,
      textAlign: "center",
      opacity: 0.7,
    },
    fanPhotoCard: {
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      elevation: 2,
    },
    fanPhotoHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
    },
    fanPhotoUsername: {
      marginLeft: 8,
      fontWeight: "bold",
      color: theme.colors.onSurface,
    },
    fanPhotoDate: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      fontSize: 12,
      color: theme.colors.onSurface,
      opacity: 0.7,
    },
    heroContainer: {
      height: 320,
      width: "100%",
      position: "relative",
      marginBottom: 12,
    },
    heroImage: {
      width: "100%",
      height: "100%",
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.dark
        ? "rgba(24,26,32,0.55)"
        : "rgba(255,255,255,0.45)",
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    heroContent: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      padding: 20,
    },
    heroTextBlock: {
      flex: 1,
      backgroundColor: theme.dark
        ? "rgba(35,38,47,0.85)"
        : "rgba(255,255,255,0.85)",
      borderRadius: 16,
      padding: 12,
      marginRight: 12,
    },
    heroVehicleName: {
      color: theme.colors.onSurface,
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 4,
    },
    heroOwnerInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    heroOwnerAvatar: {
      marginRight: 8,
    },
    heroOwnerName: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      fontSize: 15,
    },
    heroActions: {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 2,
    },
    heroActionButton: {
      backgroundColor: theme.colors.surface,
      marginBottom: 6,
      borderRadius: 50,
      elevation: 3,
    },
    heroStatusChip: {
      position: "absolute",
      top: 24,
      left: 24,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 2,
      elevation: 2,
      alignSelf: "flex-start",
    },
    modChip: {
      margin: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
    modChipText: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
  });
