import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  Modal,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  useTheme,
  HelperText,
  Snackbar,
  Chip,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { supabase } from "../../../src/services/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../../../src/store";

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

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [horsepower, setHorsepower] = useState("");
  const [miles, setMiles] = useState("");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [modifications, setModifications] = useState<string[]>([]);
  const [newModification, setNewModification] = useState("");
  const [images, setImages] = useState<string[]>([]); // local uris or URLs
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVehicle = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError("Failed to load vehicle");
        setLoading(false);
        return;
      }
      setName(data.name || "");
      setMake(data.make || "");
      setModel(data.model || "");
      setYear(data.year ? String(data.year) : "");
      setHorsepower(data.horsepower ? String(data.horsepower) : "");
      setMiles(data.miles ? String(data.miles) : "");
      setWeight(data.weight ? String(data.weight) : "");
      setDescription(data.description || "");
      setModifications(
        Array.isArray(data.modifications)
          ? data.modifications
          : data.modifications
          ? JSON.parse(data.modifications)
          : []
      );
      setImages(data.images ? JSON.parse(data.images) : []);
      setLoading(false);
    };
    if (id) fetchVehicle();
  }, [id]);

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImages(result.assets.map((a) => a.uri));
    }
  };

  const handleAddModification = () => {
    if (newModification.trim()) {
      setModifications([...modifications, newModification.trim()]);
      setNewModification("");
    }
  };

  const handleRemoveModification = (index: number) => {
    setModifications(modifications.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError("");
    if (!name || !make || !model || !year) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!user?.id) {
      setError("You must be logged in to edit a vehicle.");
      return;
    }
    setUploading(true);
    try {
      // Upload new images if any (skip URLs)
      let imageUrls: string[] = images.filter((img) => img.startsWith("http"));
      for (let i = 0; i < images.length; i++) {
        const imgUri = images[i];
        if (imgUri.startsWith("http")) continue;
        // Manipulate image for better performance
        const manipulated = await ImageManipulator.manipulateAsync(
          imgUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        // Generate unique filename
        const fileName = `${id}/${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}.jpg`;
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Convert base64 to Uint8Array
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        // Upload
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("vehicle-images")
          .upload(fileName, byteArray, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) {
          setError(`Failed to upload image #${i + 1}: ${uploadError.message}`);
          throw uploadError;
        }
        // Get public URL
        const { data: urlData } = supabase.storage
          .from("vehicle-images")
          .getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }
      // Update vehicle
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({
          name,
          make,
          model,
          year: parseInt(year),
          horsepower: horsepower ? parseInt(horsepower) : null,
          miles: miles ? parseInt(miles) : null,
          weight: weight ? parseInt(weight) : null,
          description,
          modifications,
          images: JSON.stringify(imageUrls),
        })
        .eq("id", id);
      if (updateError) throw updateError;
      setSnackbar("Vehicle updated!");
      setTimeout(() => router.back(), 1000);
    } catch (err: any) {
      setError(err.message || "Failed to update vehicle");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      <Text
        variant="headlineMedium"
        style={{
          marginBottom: 16,
          color: colors.onSurface,
          textAlign: "center",
        }}
      >
        Edit Vehicle
      </Text>
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        mode="outlined"
      />
      <TextInput
        label="Make"
        value={make}
        onChangeText={setMake}
        style={styles.input}
        mode="outlined"
      />
      <TextInput
        label="Model"
        value={model}
        onChangeText={setModel}
        style={styles.input}
        mode="outlined"
      />
      <TextInput
        label="Year"
        value={year}
        onChangeText={setYear}
        style={styles.input}
        mode="outlined"
        keyboardType="numeric"
      />
      <TextInput
        label="Horsepower"
        value={horsepower}
        onChangeText={setHorsepower}
        style={styles.input}
        mode="outlined"
        keyboardType="numeric"
      />
      <TextInput
        label="Miles"
        value={miles}
        onChangeText={setMiles}
        style={styles.input}
        mode="outlined"
        keyboardType="numeric"
      />
      <TextInput
        label="Weight (lbs)"
        value={weight}
        onChangeText={setWeight}
        style={styles.input}
        mode="outlined"
        keyboardType="numeric"
      />
      <TextInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        mode="outlined"
        multiline
      />
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <TextInput
          label="Add Modification"
          value={newModification}
          onChangeText={setNewModification}
          style={{ flex: 1, marginRight: 8 }}
          mode="outlined"
        />
        <Button mode="contained" onPress={handleAddModification}>
          Add
        </Button>
      </View>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 16 }}
      >
        {modifications.map((mod, idx) => (
          <Chip
            key={idx}
            style={{ margin: 4 }}
            onClose={() => handleRemoveModification(idx)}
          >
            {mod}
          </Chip>
        ))}
      </View>
      <Button mode="outlined" onPress={pickImages} style={{ marginBottom: 12 }}>
        {images.length > 0 ? `Change Images (${images.length})` : "Pick Images"}
      </Button>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
      >
        {images.map((img, idx) => (
          <Image
            key={idx}
            source={{ uri: img }}
            style={{ width: 100, height: 100, borderRadius: 8, marginRight: 8 }}
          />
        ))}
      </ScrollView>
      {error ? (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      ) : null}
      <Button
        mode="contained"
        onPress={handleSave}
        loading={uploading}
        disabled={uploading}
        style={{ marginTop: 8 }}
      >
        Save Changes
      </Button>
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
  input: {
    marginBottom: 12,
  },
});
