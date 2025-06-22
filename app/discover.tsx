import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import {
  Text,
  Searchbar,
  Card,
  Avatar,
  ActivityIndicator,
  Chip,
  useTheme,
} from "react-native-paper";
import { supabase } from "../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const makes = [
  "Acura",
  "Alfa Romeo",
  "Audi",
  "BMW",
  "Chevrolet",
  "Dodge",
  "Ferrari",
  "Ford",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];
const types = [
  "Sedan",
  "Coupe",
  "SUV",
  "Truck",
  "Convertible",
  "Wagon",
  "Van",
  "Other",
];

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [filteredVehicles, setFilteredVehicles] = useState<any[]>([]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    handleFilter();
  }, [searchQuery, selectedMake, selectedType, vehicles]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`*, user:profiles!user_id(name, avatar_url)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const transformed = (data || []).map((vehicle) => {
        // Parse images
        let parsedImages: string[] = [];
        try {
          if (typeof vehicle.images === "string") {
            const outer = JSON.parse(vehicle.images);
            if (
              Array.isArray(outer) &&
              typeof outer[0] === "string" &&
              outer[0].trim().startsWith("[")
            ) {
              parsedImages = JSON.parse(outer[0]);
            } else if (Array.isArray(outer)) {
              parsedImages = outer;
            }
          } else if (Array.isArray(vehicle.images)) {
            parsedImages = vehicle.images;
          }
        } catch (err) {
          parsedImages = [];
        }
        const imageSrc =
          Array.isArray(parsedImages) && parsedImages.length > 0
            ? parsedImages[0].replace(/^\["|"\]$/g, "")
            : "https://source.unsplash.com/random/800x600/?car";
        return {
          ...vehicle,
          image: imageSrc,
          owner: vehicle.user?.name || "Anonymous",
          avatar: vehicle.user?.avatar_url,
        };
      });
      setVehicles(transformed);
    } catch (e) {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    let filtered = vehicles;
    if (searchQuery) {
      filtered = filtered.filter(
        (v) =>
          v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (v.modifications || []).some((mod: string) =>
            mod.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }
    if (selectedMake) {
      filtered = filtered.filter((v) => v.make === selectedMake);
    }
    if (selectedType) {
      filtered = filtered.filter((v) => v.type === selectedType);
    }
    setFilteredVehicles(filtered);
  };

  const renderVehicle = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => router.push(`/vehicle/${item.id}`)}>
      <Card style={styles.vehicleCard}>
        <Card.Cover source={{ uri: item.image }} style={styles.vehicleImage} />
        <Card.Content>
          <View style={styles.vehicleHeader}>
            <Avatar.Image
              source={{ uri: item.avatar }}
              size={32}
              style={styles.avatar}
            />
            <Text style={[styles.owner, { color: colors.onBackground }]}>
              {item.owner}
            </Text>
          </View>
          <Text style={[styles.vehicleName, { color: "#d4af37" }]}>
            {item.name}
          </Text>
          <Text style={[styles.vehicleInfo, { color: colors.onBackground }]}>
            {item.year} {item.make} {item.model}
          </Text>
          <View style={styles.modificationsRow}>
            {(item.modifications || [])
              .slice(0, 3)
              .map((mod: string, idx: number) => (
                <Chip
                  key={idx}
                  style={styles.modChip}
                  textStyle={{ color: "#d4af37" }}
                >
                  {mod}
                </Chip>
              ))}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top || 16 },
      ]}
    >
      <Searchbar
        placeholder="Search builds..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />
      <View style={styles.filterRow}>
        <FlatList
          data={makes}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              selected={selectedMake === item}
              onPress={() => setSelectedMake(selectedMake === item ? "" : item)}
              style={styles.filterChip}
              textStyle={{ color: selectedMake === item ? "#fff" : "#d4af37" }}
            >
              {item}
            </Chip>
          )}
        />
      </View>
      <View style={styles.filterRow}>
        <FlatList
          data={types}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              selected={selectedType === item}
              onPress={() => setSelectedType(selectedType === item ? "" : item)}
              style={styles.filterChip}
              textStyle={{ color: selectedType === item ? "#fff" : "#d4af37" }}
            >
              {item}
            </Chip>
          )}
        />
      </View>
      <FlatList
        data={filteredVehicles}
        renderItem={renderVehicle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text
            style={{
              color: colors.onBackground,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No builds found.
          </Text>
        }
      />
    </View>
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
  searchbar: {
    margin: 12,
    borderRadius: 12,
  },
  filterRow: {
    flexDirection: "row",
    marginHorizontal: 8,
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderColor: "#d4af37",
    borderWidth: 1,
  },
  list: {
    padding: 8,
  },
  vehicleCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  vehicleImage: {
    height: 160,
  },
  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  avatar: {
    marginRight: 8,
  },
  owner: {
    fontWeight: "bold",
    fontSize: 14,
  },
  vehicleName: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 2,
  },
  vehicleInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  modificationsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  modChip: {
    marginRight: 4,
    marginBottom: 4,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderColor: "#d4af37",
    borderWidth: 1,
  },
});
