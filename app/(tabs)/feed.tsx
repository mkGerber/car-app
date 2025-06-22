import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import {
  Text,
  Card,
  Avatar,
  Button,
  FAB,
  ActivityIndicator,
  Chip,
  Surface,
  useTheme,
  IconButton,
} from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { router } from "expo-router";
import { supabase } from "../../src/services/supabase";

const { width } = Dimensions.get("window");

export default function FeedScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [featuredVehicles, setFeaturedVehicles] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const { colors } = useTheme();
  const themedText = { color: colors.onBackground };

  const trendingTopics = [
    "JDM",
    "Euro",
    "Muscle",
    "Classic",
    "Drift",
    "Drag",
    "Show Car",
    "Track Build",
  ];

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch upcoming events
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select(
          `
          *,
          created_by:profiles(name, avatar_url)
        `
        )
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true })
        .limit(2);

      if (eventsError) throw eventsError;

      // Fetch attendee counts for all events
      const { data: attendeeCounts, error: countsError } = await supabase
        .from("event_attendees")
        .select("event_id")
        .in(
          "event_id",
          eventsData.map((event) => event.id)
        );

      if (countsError) throw countsError;

      // Count attendees for each event
      const attendeeCountMap =
        attendeeCounts?.reduce((acc, curr) => {
          acc[curr.event_id] = (acc[curr.event_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

      // Combine the data
      const eventsWithCounts = eventsData.map((event) => ({
        ...event,
        attendees: [
          {
            count: attendeeCountMap[event.id] || 0,
          },
        ],
      }));

      setUpcomingEvents(eventsWithCounts);

      // Fetch recent vehicles with owner profiles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select(
          `
          *,
          user:profiles!user_id(name, avatar_url)
        `
        )
        .order("created_at", { ascending: false })
        .limit(3);

      if (vehiclesError) throw vehiclesError;

      // Transform vehicle data
      const transformedVehicles = vehiclesData.map((vehicle) => {
        // Parse images
        let parsedImages: string[] = [];
        try {
          if (typeof vehicle.images === "string") {
            const outer = JSON.parse(vehicle.images);
            if (
              Array.isArray(outer) &&
              typeof outer[0] === "string" &&
              outer[0].trim().startsWith("[")
            ) {
              parsedImages = JSON.parse(outer[0]);
            } else if (Array.isArray(outer)) {
              parsedImages = outer;
            }
          } else if (Array.isArray(vehicle.images)) {
            parsedImages = vehicle.images;
          }
        } catch (err) {
          console.warn("Image parsing failed:", err);
          parsedImages = [];
        }

        // Get the first image or use a fallback
        const imageSrc =
          Array.isArray(parsedImages) && parsedImages.length > 0
            ? parsedImages[0].replace(/^\["|"\]$/g, "") // Remove [" and "] if present
            : "https://source.unsplash.com/random/800x600/?car";

        return {
          id: vehicle.id,
          name: vehicle.name,
          owner: vehicle.user?.name || "Anonymous",
          image: imageSrc,
          likes: vehicle.likes_count || 0,
          comments: 0, // TODO: Implement comments system
          modifications: vehicle.modifications || [],
        };
      });

      setFeaturedVehicles(transformedVehicles);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const renderVehicleCard = (vehicle: any) => (
    <TouchableOpacity
      key={vehicle.id}
      style={styles.vehicleCard}
      onPress={() => router.push(`/vehicle/${vehicle.id}`)}
    >
      <Card style={styles.card} mode="elevated">
        <Card.Cover
          source={{ uri: vehicle.image }}
          style={styles.vehicleImage}
        />
        <Card.Content style={styles.cardContent}>
          <View>
            <Text
              variant="titleMedium"
              style={styles.vehicleName}
              numberOfLines={1}
            >
              {vehicle.name}
            </Text>
            <Text
              variant="bodySmall"
              style={styles.vehicleOwner}
              numberOfLines={1}
            >
              Owner: {vehicle.owner}
            </Text>
            <View style={styles.modificationsContainer}>
              {vehicle.modifications
                .slice(0, 2)
                .map((mod: string, index: number) => (
                  <Chip
                    key={index}
                    mode="outlined"
                    compact
                    style={styles.modificationChip}
                    textStyle={styles.chipText}
                  >
                    {mod}
                  </Chip>
                ))}
            </View>
          </View>
          <View style={styles.engagementRow}>
            <Button
              icon="heart-outline"
              mode="text"
              compact
              textColor="#666"
              style={styles.engagementButton}
              labelStyle={styles.engagementLabel}
            >
              {vehicle.likes}
            </Button>
            <Button
              icon="comment-outline"
              mode="text"
              compact
              textColor="#666"
              style={styles.engagementButton}
              labelStyle={styles.engagementLabel}
            >
              {vehicle.comments}
            </Button>
            <Button
              icon="share-variant"
              mode="text"
              compact
              textColor="#666"
              style={styles.engagementButton}
            />
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderEventCard = (event: any) => (
    <TouchableOpacity
      key={event.id}
      onPress={() => router.push(`/event/${event.id}`)}
    >
      <Card style={styles.eventCard} mode="elevated">
        <View style={styles.eventCardContent}>
          <Card.Cover
            source={{
              uri:
                event.image_url ||
                "https://source.unsplash.com/random/800x600/?car-meet",
            }}
            style={styles.eventImage}
          />
          <View style={styles.eventDetails}>
            <View style={styles.eventHeader}>
              <Avatar.Image
                source={{ uri: event.created_by?.avatar_url }}
                size={24}
                style={styles.eventCreatorAvatar}
              />
              <Text
                variant="bodySmall"
                style={[styles.eventCreator, themedText]}
                numberOfLines={1}
              >
                {event.created_by?.name || "Unknown Creator"}
              </Text>
            </View>

            <Text
              variant="titleMedium"
              style={[styles.eventTitle, themedText]}
              numberOfLines={2}
            >
              {event.title}
            </Text>

            <View style={styles.eventInfo}>
              <View style={styles.eventInfoRow}>
                <Avatar.Icon
                  icon="calendar"
                  size={24}
                  style={styles.eventInfoIcon}
                />
                <Text
                  variant="bodySmall"
                  style={[styles.eventInfoText, themedText]}
                >
                  {new Date(event.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.eventInfoRow}>
                <Avatar.Icon
                  icon="map-marker"
                  size={24}
                  style={styles.eventInfoIcon}
                />
                <Text
                  variant="bodySmall"
                  style={[styles.eventInfoText, themedText]}
                  numberOfLines={1}
                >
                  {event.location}
                </Text>
              </View>
              <View style={styles.eventInfoRow}>
                <Avatar.Icon
                  icon="account-group"
                  size={24}
                  style={styles.eventInfoIcon}
                />
                <Text
                  variant="bodySmall"
                  style={[styles.eventInfoText, themedText]}
                >
                  {event.attendees?.[0]?.count || 0} attending
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Featured Vehicles Section */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text variant="headlineMedium" style={styles.sectionTitle}>
          Featured Vehicles
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredVehicles.map(renderVehicleCard)}
        </ScrollView>
      </View>

      {/* Upcoming Events Section */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text variant="headlineMedium" style={styles.sectionTitle}>
          Upcoming Events
        </Text>
        {upcomingEvents.length === 0 ? (
          <Surface style={styles.emptyState}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No upcoming events
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              Be the first to create an event!
            </Text>
            <Button
              mode="contained"
              onPress={() => router.push("/(tabs)/events")}
              style={styles.emptyButton}
              buttonColor="#d4af37"
              textColor="#0a0f2c"
            >
              Create Event
            </Button>
          </Surface>
        ) : (
          <View style={styles.eventsContainer}>
            {upcomingEvents.map(renderEventCard)}
          </View>
        )}
      </View>

      {/* Trending Topics Section */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text variant="headlineMedium" style={styles.sectionTitle}>
          Trending Topics
        </Text>
        <View style={styles.topicsContainer}>
          {trendingTopics.map((topic) => (
            <Chip
              key={topic}
              mode="outlined"
              style={styles.topicChip}
              textStyle={styles.topicChipText}
            >
              {topic}
            </Chip>
          ))}
        </View>
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/create-post")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroSection: {
    height: 250,
    justifyContent: "center",
    alignItems: "center",
  },
  heroOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 24,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.9,
  },
  heroButton: {
    borderRadius: 8,
  },
  section: {
    paddingVertical: 24,
    paddingLeft: 16,
  },
  sectionTitle: {
    color: "#d4af37",
    fontWeight: "bold",
    marginBottom: 16,
  },
  vehicleCard: {
    width: width * 0.7,
    marginRight: 16,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
  },
  vehicleImage: {
    height: 160,
  },
  cardContent: {
    padding: 12,
  },
  vehicleName: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  vehicleOwner: {
    color: "#666",
    marginBottom: 8,
  },
  modificationsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  modificationChip: {
    marginRight: 4,
    marginBottom: 4,
    borderColor: "#d4af37",
  },
  chipText: {
    fontSize: 10,
    color: "#d4af37",
  },
  engagementRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
    marginTop: 8,
  },
  engagementButton: {
    marginRight: 8,
  },
  engagementLabel: {
    fontSize: 12,
  },
  eventsContainer: {
    gap: 16,
    paddingRight: 16,
  },
  eventCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  eventCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventImage: {
    width: 120,
    height: "100%",
    borderRadius: 0,
  },
  eventDetails: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  eventCreatorAvatar: {
    marginRight: 8,
  },
  eventCreator: {
    color: "#666",
    flexShrink: 1,
  },
  eventTitle: {
    fontWeight: "bold",
    marginBottom: 12,
  },
  eventInfo: {
    gap: 8,
  },
  eventInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventInfoIcon: {
    backgroundColor: "transparent",
    marginRight: 4,
  },
  eventInfoText: {
    flexShrink: 1,
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
    borderRadius: 12,
  },
  emptyTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  emptyButton: {
    borderRadius: 8,
  },
  topicsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topicChip: {
    borderColor: "#d4af37",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
  },
  topicChipText: {
    color: "#d4af37",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
