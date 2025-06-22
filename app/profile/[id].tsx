import React, { useEffect, useState } from "react";
import { View, ScrollView, ImageBackground, StyleSheet } from "react-native";
import {
  Text,
  Avatar,
  ActivityIndicator,
  Appbar,
  useTheme,
  Card,
  Button,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../src/services/supabase";

// Helper to robustly parse vehicle images (matches web logic)
function parseVehicleImages(imagesField: any): string[] {
  let parsedImages: string[] = [];
  try {
    if (typeof imagesField === "string") {
      const outer = JSON.parse(imagesField);
      if (
        Array.isArray(outer) &&
        typeof outer[0] === "string" &&
        outer[0].trim().startsWith("[")
      ) {
        parsedImages = JSON.parse(outer[0]);
      } else if (Array.isArray(outer)) {
        parsedImages = outer;
      }
    } else if (Array.isArray(imagesField)) {
      parsedImages = imagesField;
    }
  } catch (err) {
    parsedImages = [];
  }
  return parsedImages;
}

export default function OtherProfileScreen() {
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const paperTheme = useTheme();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);
        // Fetch vehicles
        const { data: vehiclesData } = await supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false });
        setVehicles(vehiclesData || []);
      } catch (err) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: paperTheme.colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: paperTheme.colors.background,
        }}
      >
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Profile" />
        </Appbar.Header>
        <Text
          style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: 32 }}
        >
          User not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: paperTheme.colors.background }}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={profile.name || "Profile"} />
      </Appbar.Header>
      <ImageBackground
        source={{ uri: profile.banner_url }}
        style={styles.header}
        resizeMode="cover"
      >
        <View style={styles.headerOverlay}>
          <Avatar.Image
            size={80}
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {profile.name}
          </Text>
          <Text variant="bodyMedium" style={styles.username}>
            @{profile.username}
          </Text>
          {profile.bio && (
            <Text variant="bodyMedium" style={styles.bio}>
              {profile.bio}
            </Text>
          )}
        </View>
      </ImageBackground>
      <View style={styles.statsContainer}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text variant="headlineSmall">{vehicles.length}</Text>
            <Text variant="bodySmall">Vehicles</Text>
          </View>
        </View>
      </View>
      <View style={{ marginHorizontal: 16, marginTop: 16 }}>
        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
          Vehicles
        </Text>
        {vehicles.length === 0 ? (
          <Text style={{ color: paperTheme.colors.onSurfaceVariant }}>
            No vehicles found.
          </Text>
        ) : (
          vehicles.map((vehicle) => {
            const images = parseVehicleImages(vehicle.images);
            const imageUrl =
              images.find(
                (url) => typeof url === "string" && url.startsWith("http")
              ) || null;
            return (
              <Card key={vehicle.id} style={{ marginBottom: 12 }}>
                <Card.Title
                  title={vehicle.name}
                  subtitle={`${vehicle.make} ${vehicle.model} (${vehicle.year})`}
                  left={(props) => <Avatar.Icon {...props} icon="car" />}
                />
                {imageUrl && <Card.Cover source={{ uri: imageUrl }} />}
                <Card.Content>
                  <Text variant="bodyMedium">{vehicle.description}</Text>
                </Card.Content>
              </Card>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  headerOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    width: "100%",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  avatar: {
    marginBottom: 16,
    borderColor: "#fff",
    borderWidth: 2,
  },
  name: {
    fontWeight: "bold",
    marginBottom: 4,
    color: "#fff",
  },
  username: {
    color: "#ccc",
    marginBottom: 8,
  },
  bio: {
    textAlign: "center",
    color: "#eee",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  statsContainer: {
    marginTop: -40,
    paddingHorizontal: 16,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff1",
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stat: {
    alignItems: "center",
  },
});
