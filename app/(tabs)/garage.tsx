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
} from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../src/store";
import {
  setVehicles,
  setLoading,
  setError,
} from "../../src/store/slices/vehiclesSlice";
import { db, storage } from "../../src/services/supabase";
import { router } from "expo-router";

export default function GarageScreen() {
  const dispatch = useDispatch();
  const { vehicles, loading } = useSelector(
    (state: RootState) => state.vehicles
  );
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

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
    <Card style={styles.vehicleCard} mode="outlined">
      {getMainImage(item) && (
        <Card.Cover source={{ uri: getImageUrl(getMainImage(item)) }} />
      )}

      <Card.Content>
        <View style={styles.vehicleHeader}>
          <Text variant="titleMedium">
            {item.year} {item.make} {item.model}
          </Text>
          <Chip
            mode="outlined"
            textStyle={{ color: getStatusColor(item.status) }}
            style={{ borderColor: getStatusColor(item.status) }}
          >
            {item.status}
          </Chip>
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

      <Card.Actions>
        <Button
          mode="outlined"
          onPress={() => router.push(`/vehicle/${item.id}`)}
        >
          View Details
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.push(`/edit-vehicle/${item.id}`)}
        >
          Edit
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/vehicle/add")}
      />
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
});
