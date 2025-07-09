import React, { useEffect, useState } from "react";
import { View, ScrollView, Image, TouchableOpacity } from "react-native";
import {
  Text,
  Appbar,
  ActivityIndicator,
  useTheme,
  Modal,
  Button,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../src/store";
import { supabase } from "../src/services/supabase";
import { router } from "expo-router";

export default function BadgesScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const paperTheme = useTheme();
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [badgeModal, setBadgeModal] = useState<{
    visible: boolean;
    badge: any | null;
  }>({ visible: false, badge: null });

  useEffect(() => {
    async function fetchBadges() {
      setLoading(true);
      const { data: badges, error: badgesError } = await supabase
        .from("badges")
        .select("id, name, description, icon_url");
      let userBadgeIds = new Set<string>();
      if (user?.id) {
        const { data: userBadgesData } = await supabase
          .from("user_badges")
          .select("badge_id")
          .eq("user_id", user.id);
        userBadgeIds = new Set((userBadgesData || []).map((b) => b.badge_id));
      }
      setAllBadges(badges || []);
      setUserBadges(userBadgeIds);
      setLoading(false);
    }
    fetchBadges();
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: paperTheme.colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Badges & Achievements" />
      </Appbar.Header>
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 20,
              marginBottom: 16,
              color: paperTheme.colors.primary,
            }}
          >
            Collect badges by being active in the app!
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "flex-start",
            }}
          >
            {allBadges.map((badge) => {
              const earned = userBadges.has(badge.id);
              return (
                <TouchableOpacity
                  key={badge.id}
                  onPress={() => setBadgeModal({ visible: true, badge })}
                  style={{
                    width: "45%",
                    margin: "2.5%",
                    backgroundColor: paperTheme.colors.surface,
                    borderRadius: 12,
                    alignItems: "center",
                    padding: 16,
                    opacity: earned ? 1 : 0.4,
                    borderWidth: earned ? 2 : 1,
                    borderColor: earned ? "#d4af37" : paperTheme.colors.outline,
                  }}
                >
                  <Image
                    source={{ uri: badge.icon_url }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      marginBottom: 8,
                      backgroundColor: "#222",
                    }}
                  />
                  <Text
                    style={{
                      fontWeight: "bold",
                      color: earned
                        ? paperTheme.colors.primary
                        : paperTheme.colors.onSurface,
                      textAlign: "center",
                    }}
                  >
                    {badge.name}
                  </Text>
                  <Text
                    style={{
                      color: paperTheme.colors.onSurface + "99",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {badge.description}
                  </Text>
                  {!earned && (
                    <Text style={{ color: "#aaa", fontSize: 12, marginTop: 6 }}>
                      Not earned yet
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
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
              width: 280,
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
    </View>
  );
}
