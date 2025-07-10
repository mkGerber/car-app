import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  useTheme,
  ActivityIndicator,
  Avatar,
  Chip,
  Card,
  IconButton,
  TextInput,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { db } from "../../services/supabase";
import { storage } from "../../services/supabase";

interface GroupVehicle {
  id: string;
  group_chat_id: string;
  user_id: string;
  vehicle_id: string;
  added_at: string;
  is_featured: boolean;
  description?: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    trim?: string;
    images?: string[];
    description?: string;
  };
  user: {
    name: string;
    username: string;
    avatar_url?: string;
  };
}

interface GroupGarageProps {
  groupId: string;
  isGroupOwner: boolean;
}

export default function GroupGarage({
  groupId,
  isGroupOwner,
}: GroupGarageProps) {
  const { user } = useSelector((state: RootState) => state.auth);
  const { vehicles } = useSelector((state: RootState) => state.vehicles);
  const [groupVehicles, setGroupVehicles] = useState<GroupVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [description, setDescription] = useState("");
  const [addingVehicle, setAddingVehicle] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    fetchGroupVehicles();
  }, [groupId]);

  const fetchGroupVehicles = async () => {
    try {
      setLoading(true);
      const { data, error } = await db.getGroupVehicles(groupId);
      if (error) throw error;
      setGroupVehicles(data || []);
    } catch (error) {
      console.error("Error fetching group vehicles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!selectedVehicle) {
      Alert.alert("Error", "Please select a vehicle");
      return;
    }

    try {
      setAddingVehicle(true);
      const { error } = await db.addVehicleToGroup(
        groupId,
        selectedVehicle,
        description
      );
      if (error) throw error;

      setAddModalVisible(false);
      setSelectedVehicle("");
      setDescription("");
      fetchGroupVehicles();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setAddingVehicle(false);
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    Alert.alert(
      "Remove Vehicle",
      "Are you sure you want to remove this vehicle from the group garage?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await db.removeVehicleFromGroup(
                groupId,
                vehicleId
              );
              if (error) throw error;
              fetchGroupVehicles();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const handleToggleFeatured = async (
    vehicleId: string,
    isFeatured: boolean
  ) => {
    try {
      const { error } = await db.toggleVehicleFeatured(
        groupId,
        vehicleId,
        !isFeatured
      );
      if (error) throw error;
      fetchGroupVehicles();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const getMainImage = (vehicle: any) => {
    if (!vehicle?.images) return null;
    try {
      const imageArray = JSON.parse(vehicle.images);
      return Array.isArray(imageArray) && imageArray.length > 0
        ? imageArray[0]
        : null;
    } catch (error) {
      return null;
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) {
      return imagePath;
    }
    return storage.getImageUrl(imagePath);
  };

  const renderVehicle = ({ item }: { item: GroupVehicle }) => (
    <View style={styles.vehicleCardContainer}>
      <Card style={styles.vehicleCard}>
        {getMainImage(item.vehicle) && (
          <Card.Cover
            source={{
              uri: getImageUrl(getMainImage(item.vehicle)) || undefined,
            }}
            style={styles.vehicleImage}
          />
        )}
        <Card.Content style={styles.vehicleContent}>
          <View style={styles.vehicleHeader}>
            <View style={styles.vehicleInfo}>
              <Text
                style={[styles.vehicleTitle, { color: "#fff" }]}
                numberOfLines={1}
              >
                {item.vehicle.year} {item.vehicle.make} {item.vehicle.model}
              </Text>
            </View>
          </View>
          <View style={styles.ownerInfo}>
            <Avatar.Image
              source={
                item.user.avatar_url ? { uri: item.user.avatar_url } : undefined
              }
              size={20}
              style={{ backgroundColor: "#444" }}
            />
            <Text
              style={[styles.ownerName, { color: "#fff" }]}
              numberOfLines={1}
            >
              {item.user.name || `@${item.user.username}`}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  const availableVehicles = vehicles.filter(
    (vehicle) => !groupVehicles.some((gv) => gv.vehicle_id === vehicle.id)
  );

  if (loading) {
    return (
      <Surface style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading group garage...</Text>
      </Surface>
    );
  }

  return (
    <Surface style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Group Garage
        </Text>
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => setAddModalVisible(true)}
          disabled={availableVehicles.length === 0}
        >
          Add Vehicle
        </Button>
      </View>

      {groupVehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="garage-variant"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No vehicles in the group garage yet
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Be the first to add your ride!
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupVehicles}
          renderItem={renderVehicle}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.vehicleList}
          numColumns={2}
          columnWrapperStyle={styles.vehicleRow}
        />
      )}

      {/* Add Vehicle Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text variant="headlineSmall">Add Vehicle to Group</Text>
            <IconButton
              icon="close"
              onPress={() => setAddModalVisible(false)}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              Select a vehicle from your garage to add to this group:
            </Text>

            {availableVehicles.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={[
                  styles.vehicleOption,
                  selectedVehicle === vehicle.id && styles.selectedVehicle,
                ]}
                onPress={() => setSelectedVehicle(vehicle.id)}
              >
                <View style={styles.vehicleOptionContent}>
                  {getMainImage(vehicle) && (
                    <Card.Cover
                      source={{
                        uri: getImageUrl(getMainImage(vehicle)) || undefined,
                      }}
                      style={styles.vehicleOptionImage}
                    />
                  )}
                  <View style={styles.vehicleOptionInfo}>
                    <Text variant="titleMedium">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Text>
                    {vehicle.trim && (
                      <Text variant="bodySmall">{vehicle.trim}</Text>
                    )}
                  </View>
                </View>
                {selectedVehicle === vehicle.id && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color={theme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}

            {availableVehicles.length === 0 && (
              <View style={styles.noVehicles}>
                <Text variant="bodyMedium">No vehicles available to add</Text>
                <Text variant="bodySmall">
                  Add vehicles to your personal garage first
                </Text>
              </View>
            )}

            {selectedVehicle && (
              <View style={styles.descriptionSection}>
                <Text variant="bodyMedium" style={styles.descriptionLabel}>
                  Description (optional):
                </Text>
                <TextInput
                  mode="outlined"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Tell the group about your ride..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setAddModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddVehicle}
              loading={addingVehicle}
              disabled={!selectedVehicle || addingVehicle}
              style={styles.modalButton}
            >
              Add Vehicle
            </Button>
          </View>
        </View>
      </Modal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "bold",
  },
  loadingContainer: {
    margin: 16,
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
  },
  emptySubtext: {
    marginTop: 4,
    textAlign: "center",
    opacity: 0.7,
  },
  vehicleList: {
    paddingBottom: 16,
  },
  vehicleRow: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  vehicleCardContainer: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  vehicleCard: {
    backgroundColor: "#23232a",
    borderRadius: 12,
    overflow: "hidden",
    flex: 1,
  },
  vehicleImage: {
    height: 120,
  },
  vehicleContent: {
    flex: 1,
    padding: 8,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleTitle: {
    fontWeight: "bold",
    fontSize: 14,
  },
  vehicleTrim: {
    marginTop: 2,
    fontSize: 12,
  },
  vehicleActions: {
    flexDirection: "row",
  },
  ownerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  ownerName: {
    marginLeft: 6,
    fontSize: 12,
    color: "#fff",
  },
  featuredChip: {
    marginLeft: 6,
  },
  vehicleDescription: {
    marginTop: 6,
    fontStyle: "italic",
    fontSize: 11,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSubtitle: {
    marginBottom: 16,
  },
  vehicleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedVehicle: {
    borderColor: "#2196F3",
    backgroundColor: "#E3F2FD",
  },
  vehicleOptionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleOptionImage: {
    width: 60,
    height: 40,
    marginRight: 12,
  },
  vehicleOptionInfo: {
    flex: 1,
  },
  noVehicles: {
    alignItems: "center",
    padding: 32,
  },
  descriptionSection: {
    marginTop: 16,
  },
  descriptionLabel: {
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});
