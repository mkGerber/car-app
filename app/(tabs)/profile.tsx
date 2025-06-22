import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from "react-native";
import {
  Text,
  Avatar,
  Button,
  List,
  Divider,
  Surface,
  Switch,
  useTheme,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { useAuth } from "../../src/context/AuthContext";
import { router } from "expo-router";
import { supabase } from "../../src/services/supabase";
import { useTheme as useAppTheme } from "../../src/context/ThemeContext";

export default function ProfileScreen() {
  const paperTheme = useTheme();
  const { isDarkTheme, toggleTheme } = useAppTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const { vehicles } = useSelector((state: RootState) => state.vehicles);
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*, vehicles(*)")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      }
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
    try {
      // Friends where user is receiver
      const { data: receivedFriends, error: receivedError } = await supabase
        .from("friendships")
        .select(
          `id, status, created_at, profile:sender_id (id, name, username, avatar_url)`
        )
        .eq("receiver_id", user.id)
        .eq("status", "accepted");
      if (receivedError) throw receivedError;
      // Friends where user is sender
      const { data: sentFriends, error: sentError } = await supabase
        .from("friendships")
        .select(
          `id, status, created_at, profile:receiver_id (id, name, username, avatar_url)`
        )
        .eq("sender_id", user.id)
        .eq("status", "accepted");
      if (sentError) throw sentError;
      // Combine and sort
      const allFriends = [
        ...(receivedFriends || []),
        ...(sentFriends || []),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setFriends(allFriends);
    } catch (err) {
      console.error("Error fetching friends:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchFriends();
  }, [user]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchProfile().finally(() => setRefreshing(false));
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const styles = getStyles(paperTheme);

  if (loading && !profile) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: paperTheme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ImageBackground
        source={{ uri: profile?.banner_url }}
        style={styles.header}
        resizeMode="cover"
      >
        <View style={styles.headerOverlay}>
          <Avatar.Image
            size={80}
            source={{ uri: profile?.avatar_url }}
            style={styles.avatar}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {profile?.name || user?.username}
          </Text>
          <Text variant="bodyMedium" style={styles.username}>
            @{profile?.username}
          </Text>
          {profile?.bio && (
            <Text variant="bodyMedium" style={styles.bio}>
              {profile.bio}
            </Text>
          )}
        </View>
      </ImageBackground>

      <View style={styles.statsContainer}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text variant="headlineSmall">
              {profile?.vehicles?.length || 0}
            </Text>
            <Text variant="bodySmall">Vehicles</Text>
          </View>
          <TouchableOpacity
            style={styles.stat}
            onPress={() => router.push("/profile/friends")}
            activeOpacity={0.7}
          >
            <Text variant="headlineSmall">{friends.length}</Text>
            <Text
              variant="bodySmall"
              style={{ color: paperTheme.colors.primary, fontWeight: "bold" }}
            >
              Friends
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Surface style={styles.section}>
        <List.Section>
          <List.Subheader>Account</List.Subheader>

          <List.Item
            title="Edit Profile"
            left={(props) => <List.Icon {...props} icon="account-edit" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/edit-profile")}
          />

          <List.Item
            title="Change Password"
            left={(props) => <List.Icon {...props} icon="lock" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/(auth)/reset-password")}
          />

          <List.Item
            title="Notifications"
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/notifications")}
          />
        </List.Section>
      </Surface>

      <Surface style={styles.section}>
        <List.Section>
          <List.Subheader>App</List.Subheader>

          <List.Item
            title="Dark Mode"
            left={(props) => <List.Icon {...props} icon="brightness-6" />}
            right={() => (
              <Switch value={isDarkTheme} onValueChange={toggleTheme} />
            )}
          />

          <List.Item
            title="About"
            left={(props) => <List.Icon {...props} icon="information" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/about")}
          />

          <List.Item
            title="Privacy Policy"
            left={(props) => <List.Icon {...props} icon="shield" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/privacy")}
          />

          <List.Item
            title="Terms of Service"
            left={(props) => <List.Icon {...props} icon="file-document" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/terms")}
          />
        </List.Section>
      </Surface>

      <Surface style={styles.section}>
        <List.Section>
          <List.Subheader>Support</List.Subheader>

          <List.Item
            title="Help & FAQ"
            left={(props) => <List.Icon {...props} icon="help-circle" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/help")}
          />

          <List.Item
            title="Contact Us"
            left={(props) => <List.Icon {...props} icon="email" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/contact")}
          />

          <List.Item
            title="Report a Bug"
            left={(props) => <List.Icon {...props} icon="bug" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/report-bug")}
          />
        </List.Section>
      </Surface>

      <Surface style={styles.section}>
        <List.Section>
          <List.Subheader>Content</List.Subheader>

          <List.Item
            title="My Garage"
            left={(props) => <List.Icon {...props} icon="car-multiple" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/(tabs)/garage")}
          />
        </List.Section>
      </Surface>

      <View style={styles.signOutContainer}>
        <Button
          mode="outlined"
          onPress={handleSignOut}
          style={styles.signOutButton}
          textColor="#d32f2f"
        >
          Sign Out
        </Button>
      </View>
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
      marginTop: -40, // Pulls the stats up over the banner
      paddingHorizontal: 16,
    },
    stats: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: theme.colors.surface,
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
    section: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    signOutContainer: {
      margin: 16,
      marginBottom: 32,
    },
    signOutButton: {
      borderColor: theme.colors.error,
    },
  });
