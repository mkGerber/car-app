import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
} from "react-native";
import {
  Text,
  Card,
  Button,
  FAB,
  ActivityIndicator,
  Chip,
  useTheme,
  Avatar,
  Surface,
  IconButton,
} from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../src/store";
import {
  setEvents,
  setLoading,
  setError,
} from "../../src/store/slices/eventsSlice";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import { format } from "date-fns";
import MapView, { Marker, Callout } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

export default function EventsScreen() {
  const dispatch = useDispatch();
  const { events, loading } = useSelector((state: RootState) => state.events);
  const [refreshing, setRefreshing] = useState(false);
  const [mapView, setMapView] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const loadEvents = async () => {
    try {
      dispatch(setLoading(true));
      // Fetch events with creator info
      const { data: eventsData, error } = await supabase
        .from("events")
        .select(`*, created_by:profiles(name, avatar_url)`)
        .order("date", { ascending: true });
      if (error) throw error;
      // Fetch attendee counts for all events
      const { data: attendeeCounts, error: countsError } = await supabase
        .from("event_attendees")
        .select("event_id")
        .in(
          "event_id",
          (eventsData || []).map((event) => event.id)
        );
      if (countsError) throw countsError;
      const attendeeCountMap =
        attendeeCounts?.reduce((acc, curr) => {
          acc[curr.event_id] = (acc[curr.event_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};
      // Combine the data
      const eventsWithCounts = (eventsData || []).map((event) => ({
        ...event,
        attendees_count: attendeeCountMap[event.id] || 0,
      }));
      dispatch(setEvents(eventsWithCounts));
    } catch (error: any) {
      dispatch(setError(error.message));
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "h:mm a");
    } catch {
      return "";
    }
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  // Filter events that have coordinates
  const eventsWithLocation = events.filter(
    (event) => event.latitude && event.longitude
  );

  // Calculate map region based on events
  const getMapRegion = () => {
    if (eventsWithLocation.length === 0) {
      return {
        latitude: 37.0902,
        longitude: -95.7129,
        latitudeDelta: 50,
        longitudeDelta: 50,
      };
    }

    const latitudes = eventsWithLocation.map((e) => e.latitude);
    const longitudes = eventsWithLocation.map((e) => e.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.1) * 1.5,
      longitudeDelta: Math.max(maxLng - minLng, 0.1) * 1.5,
    };
  };

  const renderEvent = ({ item }: { item: any }) => (
    <Card style={styles.eventCard} mode="outlined">
      {item.image_url && (
        <Card.Cover
          source={{
            uri:
              item.image_url ||
              "https://source.unsplash.com/random/800x600/?car-meet",
          }}
          style={styles.eventImage}
        />
      )}
      <Card.Content>
        <View style={styles.eventHeader}>
          <Text
            variant="titleMedium"
            style={[styles.eventTitle, { color: colors.onBackground }]}
          >
            {item.title}
          </Text>
          <Chip
            mode="outlined"
            textStyle={{
              color: isUpcoming(item.date) ? "#4caf50" : colors.onBackground,
            }}
            style={{
              borderColor: isUpcoming(item.date)
                ? "#4caf50"
                : colors.onBackground,
            }}
          >
            {isUpcoming(item.date) ? "Upcoming" : "Past"}
          </Chip>
        </View>
        <View style={styles.eventDetails}>
          <Text
            variant="bodySmall"
            style={[styles.dateTime, { color: colors.onBackground }]}
          >
            📅 {formatDate(item.date)}
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.location, { color: colors.onBackground }]}
          >
            📍 {item.location}
          </Text>
        </View>
        {item.description && (
          <Text
            variant="bodyMedium"
            style={[styles.description, { color: colors.onBackground }]}
          >
            {item.description}
          </Text>
        )}
        <View style={styles.eventStats}>
          <Text variant="bodySmall" style={{ color: colors.onBackground }}>
            👥 {item.attendees_count || 0} attending
          </Text>
          {item.created_by && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Avatar.Image
                source={{ uri: item.created_by.avatar_url }}
                size={20}
                style={{ marginRight: 4 }}
              />
              <Text variant="bodySmall" style={{ color: colors.onBackground }}>
                Hosted by {item.created_by.name}
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
      <Card.Actions>
        <Button
          mode="outlined"
          onPress={() => router.push(`/event/${item.id}`)}
        >
          View Details
        </Button>
      </Card.Actions>
    </Card>
  );

  const renderMapView = () => (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        region={getMapRegion()}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {eventsWithLocation.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude,
              longitude: event.longitude,
            }}
            pinColor={isUpcoming(event.date) ? "#4caf50" : "#ff9800"}
          >
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{event.title}</Text>
                <Text style={styles.calloutLocation}>{event.location}</Text>
                <Text style={styles.calloutDate}>{formatDate(event.date)}</Text>
                <Text style={styles.calloutAttendees}>
                  {event.attendees_count || 0} attending
                </Text>
                <Button
                  mode="contained"
                  onPress={() => router.push(`/event/${event.id}`)}
                  style={styles.calloutButton}
                >
                  View Details
                </Button>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );

  const renderListView = () => (
    <FlatList
      data={events}
      renderItem={renderEvent}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text
              variant="headlineSmall"
              style={{ color: colors.onBackground }}
            >
              No events yet
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.emptyText, { color: colors.onBackground }]}
            >
              Check back later for car meets and events!
            </Text>
          </View>
        ) : (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
          </View>
        )
      }
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with toggle buttons */}
      <Surface style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Events
          </Text>
          <View style={styles.toggleContainer}>
            <Button
              mode={!mapView ? "contained" : "outlined"}
              onPress={() => setMapView(false)}
              style={[styles.toggleButton, !mapView && styles.activeButton]}
              textColor={!mapView ? "#0a0f2c" : colors.onBackground}
            >
              List
            </Button>
            <Button
              mode={mapView ? "contained" : "outlined"}
              onPress={() => setMapView(true)}
              style={[styles.toggleButton, mapView && styles.activeButton]}
              textColor={mapView ? "#0a0f2c" : colors.onBackground}
            >
              Map
            </Button>
          </View>
        </View>
      </Surface>

      {/* Map or List View */}
      {mapView ? renderMapView() : renderListView()}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/create-event")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    elevation: 2,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "bold",
  },
  toggleContainer: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: "#d4af37",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4,
  },
  calloutLocation: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  calloutDate: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  calloutAttendees: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  calloutButton: {
    backgroundColor: "#d4af37",
  },
  list: {
    padding: 16,
  },
  eventCard: {
    marginBottom: 16,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  eventTitle: {
    flex: 1,
    marginRight: 8,
  },
  eventDetails: {
    marginBottom: 12,
  },
  dateTime: {
    color: "#666",
    marginBottom: 4,
  },
  location: {
    color: "#666",
  },
  description: {
    marginBottom: 12,
  },
  eventStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 16,
    color: "#666",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
  eventImage: {
    height: 140,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
});
