import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Modal,
  Image,
  ScrollView,
} from "react-native";
import {
  Text,
  Card,
  Button,
  FAB,
  ActivityIndicator,
  Chip,
  useTheme,
  TextInput,
} from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../src/store";
import {
  setVehicles,
  setLoading,
  setError,
} from "../../src/store/slices/vehiclesSlice";
import { db, storage } from "../../src/services/supabase";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GarageScreen() {
  const dispatch = useDispatch();
  const { vehicles, loading } = useSelector(
    (state: RootState) => state.vehicles
  );
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [lprInboxVisible, setLprInboxVisible] = useState(false);
  const [lprInvites, setLprInvites] = useState<any[]>([]);
  const [lprLoading, setLprLoading] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any>(null);
  const [inviteDetailVisible, setInviteDetailVisible] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return null;

    if (imagePath.startsWith("http")) {
      return imagePath;
    }

    return storage.getImageUrl(imagePath);
  };

  const getMainImage = (vehicle: any) => {
    if (!vehicle?.images) return null;

    try {
      const imageArray = JSON.parse(vehicle.images);
      return Array.isArray(imageArray) && imageArray.length > 0
        ? imageArray[0]
        : null;
    } catch (error) {
      console.log("Error parsing images:", error);
      return null;
    }
  };

  const loadVehicles = async () => {
    try {
      dispatch(setLoading(true));
      const { data, error } = await db.getVehicles(user?.id || "");

      if (error) throw error;

      dispatch(setVehicles(data || []));
    } catch (error: any) {
      dispatch(setError(error.message));
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadVehicles();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVehicles();
    setRefreshing(false);
  };

  const fetchLPRInvites = async () => {
    if (!user) return;

    setLprLoading(true);
    try {
      // Get invites where user is recipient
      const { data: receivedInvites, error: receivedError } = await supabase
        .from("lpr_invites")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });

      if (receivedError) {
        console.error("Error fetching received invites:", receivedError);
        return;
      }

      // Get user's vehicles to check for license plate matches
      const { data: userVehicles } = await supabase
        .from("vehicles")
        .select("id, license_plate, license_state, make, model, year")
        .eq("user_id", user.id);

      // Get invites that match user's license plates (where recipient_id is null)
      const { data: plateMatchInvites, error: plateMatchError } = await supabase
        .from("lpr_invites")
        .select("*")
        .is("recipient_id", null)
        .in(
          "license_plate",
          userVehicles?.map((v) => v.license_plate).filter(Boolean) || []
        )
        .order("created_at", { ascending: false });

      if (plateMatchError) {
        console.warn("Error fetching plate match invites:", plateMatchError);
      }

      // Combine all invites
      const allInvites = [
        ...(receivedInvites || []),
        ...(plateMatchInvites || []),
      ];

      // Get sender profiles and vehicle details
      const invitesWithDetails = await Promise.all(
        allInvites.map(async (invite) => {
          let senderProfile = null;
          let vehicleDetails = null;

          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("name, username, avatar_url")
              .eq("id", invite.sender_id)
              .single();
            senderProfile = profileData;
          } catch (err) {
            console.warn("Could not fetch sender profile:", err);
          }

          try {
            if (invite.vehicle_id) {
              const { data: vehicleData } = await supabase
                .from("vehicles")
                .select("make, model, year")
                .eq("id", invite.vehicle_id)
                .single();
              vehicleDetails = vehicleData;
            } else if (invite.license_plate) {
              const { data: vehicleData } = await supabase
                .from("vehicles")
                .select("make, model, year")
                .eq("license_plate", invite.license_plate)
                .eq("user_id", user.id)
                .single();
              vehicleDetails = vehicleData;
            }
          } catch (err) {
            console.warn("Could not fetch vehicle details:", err);
          }

          return {
            ...invite,
            sender_profile: senderProfile,
            vehicle: vehicleDetails,
          };
        })
      );

      setLprInvites(invitesWithDetails);
    } catch (error) {
      console.error("Error fetching LPR invites:", error);
    } finally {
      setLprLoading(false);
    }
  };

  const handleAcceptInvite = async (invite: any) => {
    setProcessingInvite(true);
    try {
      const { error } = await supabase
        .from("lpr_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      if (error) {
        console.error("Error accepting invite:", error);
      } else {
        // Refresh invites
        await fetchLPRInvites();
        setInviteDetailVisible(false);
        setSelectedInvite(null);
      }
    } catch (error) {
      console.error("Error accepting invite:", error);
    } finally {
      setProcessingInvite(false);
    }
  };

  const handleDeclineInvite = async (invite: any) => {
    setProcessingInvite(true);
    try {
      const { error } = await supabase
        .from("lpr_invites")
        .update({ status: "declined" })
        .eq("id", invite.id);

      if (error) {
        console.error("Error declining invite:", error);
      } else {
        // Refresh invites
        await fetchLPRInvites();
        setInviteDetailVisible(false);
        setSelectedInvite(null);
      }
    } catch (error) {
      console.error("Error declining invite:", error);
    } finally {
      setProcessingInvite(false);
    }
  };

  const openLPRInbox = () => {
    setLprInboxVisible(true);
    fetchLPRInvites();
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "accepted":
        return "Accepted";
      case "declined":
        return "Declined";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "daily":
        return "#4caf50";
      case "project":
        return "#ff9800";
      case "show":
        return "#9c27b0";
      case "track":
        return "#f44336";
      default:
        return "#666";
    }
  };

  const renderVehicle = ({ item }: { item: any }) => (
    <Card
      style={styles.vehicleCard}
      mode="outlined"
      onPress={() => router.push(`/vehicle/${item.id}`)}
    >
      {getMainImage(item) && (
        <Card.Cover
          source={{ uri: getImageUrl(getMainImage(item)) || undefined }}
        />
      )}

      <Card.Content>
        <View style={styles.vehicleHeader}>
          <Text variant="titleMedium">
            {item.year} {item.make} {item.model}
          </Text>
        </View>

        {item.trim && (
          <Text variant="bodySmall" style={styles.trim}>
            {item.trim}
          </Text>
        )}

        {item.description && (
          <Text variant="bodyMedium" style={styles.description}>
            {item.description}
          </Text>
        )}
      </Card.Content>
      {/* Removed Card.Actions with buttons */}
    </Card>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        position: "relative",
      }}
    >
      {/* Custom Header */}
      <View
        style={[
          styles.header,
          { height: insets.top + 56, backgroundColor: colors.surface },
        ]}
      >
        <View style={[styles.headerContent, { paddingTop: insets.top }]}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Garage
          </Text>
          <Button
            mode="outlined"
            onPress={openLPRInbox}
            icon="inbox"
            style={styles.inboxButton}
          >
            Fan Photos Inbox
          </Button>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          data={vehicles}
          renderItem={renderVehicle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text variant="headlineSmall">No vehicles yet</Text>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Add your first car to get started!
                </Text>
                <Button
                  mode="contained"
                  onPress={() => router.push("/vehicle/add")}
                  style={styles.addButton}
                >
                  Add Vehicle
                </Button>
              </View>
            ) : (
              <View style={styles.loader}>
                <ActivityIndicator size="large" />
              </View>
            )
          }
        />
      </View>
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/vehicle/add")}
      />

      {/* LPR Inbox Modal */}
      <Modal
        visible={lprInboxVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLprInboxVisible(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: colors.backdrop || "rgba(0,0,0,0.7)" },
          ]}
        >
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.outline || "#333" },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Fan Photos Inbox
              </Text>
              <Button
                mode="text"
                onPress={() => setLprInboxVisible(false)}
                icon="close"
                textColor={colors.primary}
              >
                Close
              </Button>
            </View>

            {lprLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  Loading invites...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.invitesList}>
                {lprInvites.length === 0 ? (
                  <View style={styles.emptyInbox}>
                    <Text
                      style={[
                        styles.emptyInboxText,
                        { color: colors.onSurface },
                      ]}
                    >
                      No LPR invites yet
                    </Text>
                    <Text
                      style={[
                        styles.emptyInboxSubtext,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      When someone spots your car and sends an LPR invite, it
                      will appear here.
                    </Text>
                  </View>
                ) : (
                  lprInvites.map((invite) => (
                    <View
                      key={invite.id}
                      style={[
                        styles.inviteCard,
                        {
                          backgroundColor:
                            colors.elevation?.level1 || colors.surface,
                        },
                      ]}
                    >
                      <View style={styles.inviteHeader}>
                        <View
                          style={[
                            styles.avatar,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarText,
                              { color: colors.onPrimary },
                            ]}
                          >
                            {invite.sender_profile?.name?.[0] || "?"}
                          </Text>
                        </View>
                        <View style={styles.inviteInfo}>
                          <Text
                            style={[
                              styles.inviteSender,
                              { color: colors.onSurface },
                            ]}
                          >
                            {invite.sender_profile?.name || "Unknown User"}
                          </Text>
                          <Text
                            style={[
                              styles.invitePlate,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {invite.license_plate}
                          </Text>
                          <Text
                            style={[
                              styles.inviteDate,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {new Date(invite.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={styles.inviteStatus}>
                          <Text
                            style={[
                              styles.statusText,
                              {
                                color:
                                  invite.status === "pending"
                                    ? "#ff9800"
                                    : invite.status === "accepted"
                                    ? "#4caf50"
                                    : colors.error || "#f44336",
                              },
                            ]}
                          >
                            {getStatusText(invite.status)}
                          </Text>
                        </View>
                      </View>

                      {invite.vehicle && (
                        <Text
                          style={[
                            styles.vehicleInfo,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          {invite.vehicle.year} {invite.vehicle.make}{" "}
                          {invite.vehicle.model}
                        </Text>
                      )}

                      {invite.message && (
                        <Text
                          style={[
                            styles.inviteMessage,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          "{invite.message}"
                        </Text>
                      )}

                      {invite.image_url && (
                        <Image
                          source={{ uri: invite.image_url }}
                          style={styles.inviteImage}
                        />
                      )}

                      {invite.status === "pending" && (
                        <View style={styles.inviteActions}>
                          <Button
                            mode="outlined"
                            onPress={() => handleDeclineInvite(invite)}
                            loading={processingInvite}
                            disabled={processingInvite}
                            style={[styles.actionButton, styles.declineButton]}
                            textColor={colors.error}
                          >
                            Decline
                          </Button>
                          <Button
                            mode="contained"
                            onPress={() => handleAcceptInvite(invite)}
                            loading={processingInvite}
                            disabled={processingInvite}
                            style={[styles.actionButton, styles.acceptButton]}
                          >
                            Accept
                          </Button>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Invite Detail Modal */}
      <Modal
        visible={inviteDetailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {selectedInvite && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>LPR Invite Details</Text>
                  <Button
                    mode="text"
                    onPress={() => setInviteDetailVisible(false)}
                    icon="close"
                  >
                    Close
                  </Button>
                </View>

                <ScrollView style={styles.inviteDetailContent}>
                  <View style={styles.inviteDetailHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {selectedInvite.sender_profile?.name?.[0] || "?"}
                      </Text>
                    </View>
                    <View style={styles.inviteDetailInfo}>
                      <Text style={styles.inviteDetailSender}>
                        {selectedInvite.sender_profile?.name || "Unknown User"}
                      </Text>
                      <Text style={styles.inviteDetailUsername}>
                        @{selectedInvite.sender_profile?.username || "unknown"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.inviteDetailPlate}>
                    License Plate: {selectedInvite.license_plate}
                    {selectedInvite.license_state &&
                      ` (${selectedInvite.license_state})`}
                  </Text>

                  {selectedInvite.vehicle && (
                    <Text style={styles.inviteDetailVehicle}>
                      Vehicle: {selectedInvite.vehicle.year}{" "}
                      {selectedInvite.vehicle.make}{" "}
                      {selectedInvite.vehicle.model}
                    </Text>
                  )}

                  {selectedInvite.message && (
                    <View style={styles.inviteDetailMessage}>
                      <Text style={styles.messageLabel}>Message:</Text>
                      <Text style={styles.messageText}>
                        "{selectedInvite.message}"
                      </Text>
                    </View>
                  )}

                  {selectedInvite.image_url && (
                    <View style={styles.inviteDetailImage}>
                      <Text style={styles.imageLabel}>Photo:</Text>
                      <Image
                        source={{ uri: selectedInvite.image_url }}
                        style={styles.detailImage}
                      />
                    </View>
                  )}

                  <Text style={styles.inviteDetailDate}>
                    Sent: {new Date(selectedInvite.created_at).toLocaleString()}
                  </Text>
                </ScrollView>

                <View style={styles.inviteDetailActions}>
                  <Button
                    mode="outlined"
                    onPress={() => handleDeclineInvite(selectedInvite)}
                    loading={processingInvite}
                    disabled={processingInvite}
                    style={[styles.actionButton, styles.declineButton]}
                    textColor="#f44336"
                  >
                    Decline
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => handleAcceptInvite(selectedInvite)}
                    loading={processingInvite}
                    disabled={processingInvite}
                    style={[styles.actionButton, styles.acceptButton]}
                  >
                    Accept
                  </Button>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  vehicleCard: {
    marginBottom: 16,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trim: {
    color: "#666",
    marginBottom: 8,
  },
  description: {
    marginTop: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    textAlign: "center",
    marginVertical: 16,
    color: "#666",
  },
  addButton: {
    marginTop: 16,
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
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  inboxButton: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
  },
  invitesList: {
    maxHeight: "80%",
  },
  inviteCard: {
    marginBottom: 10,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d4af37",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  inviteInfo: {
    flex: 1,
  },
  inviteSender: {
    fontSize: 14,
    fontWeight: "bold",
  },
  invitePlate: {
    fontSize: 12,
    color: "#666",
  },
  inviteDate: {
    fontSize: 12,
    color: "#666",
  },
  inviteStatus: {
    width: 80,
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  vehicleInfo: {
    fontSize: 12,
    color: "#666",
  },
  inviteMessage: {
    fontSize: 12,
    color: "#666",
  },
  inviteImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  inviteActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  actionButton: {
    marginHorizontal: 6,
    minWidth: 90,
  },
  emptyInbox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyInboxText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  emptyInboxSubtext: {
    fontSize: 12,
    color: "#666",
  },
  inviteDetailContent: {
    flex: 1,
  },
  inviteDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  inviteDetailInfo: {
    flex: 1,
  },
  inviteDetailSender: {
    fontSize: 14,
    fontWeight: "bold",
  },
  inviteDetailUsername: {
    fontSize: 12,
    color: "#666",
  },
  inviteDetailPlate: {
    fontSize: 12,
    fontWeight: "bold",
  },
  inviteDetailVehicle: {
    fontSize: 12,
    color: "#666",
  },
  inviteDetailMessage: {
    marginBottom: 10,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  messageText: {
    fontSize: 12,
    color: "#666",
  },
  inviteDetailImage: {
    marginBottom: 10,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  detailImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  inviteDetailDate: {
    fontSize: 12,
    color: "#666",
  },
  inviteDetailActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  declineButton: {
    marginLeft: 10,
  },
  acceptButton: {
    marginLeft: 10,
  },
});
