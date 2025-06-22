import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import {
  Text,
  Card,
  Button,
  FAB,
  ActivityIndicator,
  Chip,
  useTheme,
  Avatar,
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

export default function EventsScreen() {
  const dispatch = useDispatch();
  const { events, loading } = useSelector((state: RootState) => state.events);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
    // backgroundColor: "#f5f5f5",
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
