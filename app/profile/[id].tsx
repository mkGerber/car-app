import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
} from "react-native";
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
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";

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
  const { user } = useSelector((state: RootState) => state.auth);
  const [profile, setProfile] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const paperTheme = useTheme();
  const [badges, setBadges] = useState<any[]>([]);
  const [badgeModal, setBadgeModal] = useState<{
    visible: boolean;
    badge: any | null;
  }>({ visible: false, badge: null });

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

        // Fetch following and followers counts
        const { count: followingCount } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", id);
        setFollowingCount(followingCount || 0);

        const { count: followersCount } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("followed_id", id);
        setFollowersCount(followersCount || 0);

        // Check if current user is following this profile
        if (user?.id && user.id !== id) {
          const { data: followData } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("followed_id", id)
            .maybeSingle();
          setIsFollowing(!!followData);
        }
      } catch (err) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProfile();
  }, [id, user]);

  useEffect(() => {
    async function fetchBadges() {
      const { data, error } = await supabase
        .from("user_badges")
        .select("awarded_at, badge:badge_id (name, description, icon_url)")
        .eq("user_id", id);
      if (!error) setBadges(data || []);
    }
    if (id) fetchBadges();
  }, [id]);

  const handleFollowToggle = async () => {
    if (!user || !profile) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("followed_id", profile.id);
        setIsFollowing(false);
        setFollowersCount((prev) => prev - 1);
      } else {
        // Follow
        await supabase.from("follows").insert({
          follower_id: user.id,
          followed_id: profile.id,
        });
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    } finally {
      setFollowLoading(false);
    }
  };

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
          {badges.length > 0 && (
            <View
              style={{ flexDirection: "row", marginTop: 8, marginBottom: 8 }}
            >
              {badges.map((b) => (
                <TouchableOpacity
                  key={b.badge.name}
                  onPress={() =>
                    setBadgeModal({ visible: true, badge: b.badge })
                  }
                  style={{ marginRight: 8 }}
                >
                  <Image
                    source={{ uri: b.badge.icon_url }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: "#d4af37",
                      backgroundColor: "#222",
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {user?.id !== profile.id && (
            <Button
              mode={isFollowing ? "outlined" : "contained"}
              onPress={handleFollowToggle}
              loading={followLoading}
              style={{ marginTop: 16 }}
              textColor={isFollowing ? paperTheme.colors.primary : undefined}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          )}
        </View>
      </ImageBackground>
      <View style={styles.statsContainer}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text variant="headlineSmall">{vehicles.length}</Text>
            <Text variant="bodySmall">Vehicles</Text>
          </View>
          <TouchableOpacity
            style={styles.stat}
            onPress={() =>
              router.push(`/profile/friends?tab=following&userId=${profile.id}`)
            }
          >
            <Text variant="headlineSmall">{followingCount}</Text>
            <Text variant="bodySmall">Following</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stat}
            onPress={() =>
              router.push(`/profile/friends?tab=followers&userId=${profile.id}`)
            }
          >
            <Text variant="headlineSmall">{followersCount}</Text>
            <Text variant="bodySmall">Followers</Text>
          </TouchableOpacity>
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
              <TouchableOpacity
                key={vehicle.id}
                onPress={() => router.push(`/vehicle/${vehicle.id}`)}
                activeOpacity={0.8}
              >
                <Card style={{ marginBottom: 12 }}>
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
              </TouchableOpacity>
            );
          })
        )}
      </View>
      <Modal
        visible={badgeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setBadgeModal({ visible: false, badge: null })}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "#222",
              padding: 24,
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            {badgeModal.badge && (
              <>
                <Image
                  source={{ uri: badgeModal.badge.icon_url }}
                  style={{ width: 64, height: 64, marginBottom: 12 }}
                />
                <Text
                  style={{ color: "#d4af37", fontWeight: "bold", fontSize: 18 }}
                >
                  {badgeModal.badge.name}
                </Text>
                <Text
                  style={{ color: "#fff", marginTop: 8, textAlign: "center" }}
                >
                  {badgeModal.badge.description}
                </Text>
                <Button
                  mode="contained"
                  style={{ marginTop: 16 }}
                  onPress={() => setBadgeModal({ visible: false, badge: null })}
                >
                  Close
                </Button>
              </>
            )}
          </View>
        </View>
      </Modal>
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
