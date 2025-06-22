import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  Card,
  Avatar,
  ActivityIndicator,
  Button,
  useTheme,
  IconButton,
  Snackbar,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../src/services/supabase";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const user = useSelector((state: RootState) => state.auth.user);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const maxAvatars = 5;

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select(`*, created_by:profiles(name, avatar_url)`)
        .eq("id", id)
        .single();
      if (!error && data) {
        setEvent(data);
        // Fetch attendees (with profile info)
        const { data: attendeeData } = await supabase
          .from("event_attendees")
          .select("user_id, profiles:profiles(name, avatar_url)")
          .eq("event_id", id);
        setAttendees(attendeeData || []);
        if (user) {
          setIsAttending(
            (attendeeData || []).some((a: any) => a.user_id === user.id)
          );
        }
      }
      setLoading(false);
    };
    if (id) fetchEvent();
  }, [id, user]);

  const handleRSVP = async () => {
    if (!user) {
      setSnackbar("You must be logged in to RSVP.");
      return;
    }
    setLoading(true);
    if (isAttending) {
      // Un-RSVP
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", id)
        .eq("user_id", user.id);
      if (!error) {
        setIsAttending(false);
        setAttendees((prev) => prev.filter((a: any) => a.user_id !== user.id));
        setSnackbar("You have un-RSVPed.");
      } else {
        setSnackbar("Failed to un-RSVP.");
      }
    } else {
      // RSVP
      const { error } = await supabase
        .from("event_attendees")
        .insert({ event_id: id, user_id: user.id });
      if (!error) {
        setIsAttending(true);
        setAttendees((prev) => [
          ...prev,
          {
            user_id: user.id,
            profiles: {
              name: user.full_name || user.username || user.email,
              avatar_url: user.avatar_url,
            },
          },
        ]);
        setSnackbar("You have RSVPed!");
      } else {
        setSnackbar("Failed to RSVP.");
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={{ color: colors.onBackground }}>
          Event not found.
        </Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Button onPress={() => router.back()} style={styles.backButton}>
        Back
      </Button>
      <Card style={styles.card}>
        <Card.Cover
          source={{
            uri:
              event.image_url ||
              "https://source.unsplash.com/random/800x600/?car-meet",
          }}
        />
        <Card.Content>
          <View style={styles.header}>
            <Avatar.Image
              source={{ uri: event.created_by?.avatar_url }}
              size={40}
              style={styles.avatar}
            />
            <Text
              variant="bodyMedium"
              style={[styles.creator, { color: colors.onBackground }]}
            >
              {event.created_by?.name || "Unknown Creator"}
            </Text>
          </View>
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.onBackground }]}
          >
            {event.title}
          </Text>
          <View style={styles.infoRow}>
            <IconButton icon="calendar" size={20} style={styles.infoIcon} />
            <Text
              variant="bodyMedium"
              style={[styles.info, { color: colors.onBackground }]}
            >
              {new Date(event.date).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <IconButton icon="map-marker" size={20} style={styles.infoIcon} />
            <Text
              variant="bodyMedium"
              style={[styles.info, { color: colors.onBackground }]}
            >
              {event.location}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <IconButton
              icon="account-group"
              size={20}
              style={styles.infoIcon}
            />
            <Text
              variant="bodyMedium"
              style={[styles.info, { color: colors.onBackground }]}
            >
              {attendees.length} attending
            </Text>
            <View style={styles.avatarsRow}>
              {attendees.slice(0, maxAvatars).map((a: any, idx: number) => (
                <Avatar.Image
                  key={a.user_id}
                  source={{ uri: a.profiles?.avatar_url }}
                  size={28}
                  style={styles.attendeeAvatar}
                />
              ))}
              {attendees.length > maxAvatars && (
                <Avatar.Text
                  size={28}
                  label={`+${attendees.length - maxAvatars}`}
                  style={styles.attendeeAvatar}
                />
              )}
            </View>
          </View>
          {event.description && (
            <View style={styles.section}>
              <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: colors.onBackground }]}
              >
                Description
              </Text>
              <Text
                variant="bodyMedium"
                style={[styles.description, { color: colors.onBackground }]}
              >
                {event.description}
              </Text>
            </View>
          )}
          <Button
            mode={isAttending ? "outlined" : "contained"}
            onPress={handleRSVP}
            style={styles.rsvpButton}
            buttonColor={isAttending ? undefined : colors.primary}
            textColor={isAttending ? colors.primary : colors.onPrimary}
          >
            {isAttending ? "Cancel RSVP" : "RSVP to this Event"}
          </Button>
        </Card.Content>
      </Card>
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar("")}
        duration={2000}
      >
        {snackbar}
      </Snackbar>
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
  card: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  avatar: {
    marginRight: 8,
  },
  creator: {
    fontWeight: "bold",
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  info: {
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  infoIcon: {
    marginRight: 0,
    backgroundColor: "transparent",
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  attendeeAvatar: {
    marginRight: -8,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#eee",
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  description: {
    marginTop: 4,
  },
  backButton: {
    margin: 16,
    alignSelf: "flex-start",
  },
  rsvpButton: {
    marginTop: 16,
    borderRadius: 8,
  },
});
