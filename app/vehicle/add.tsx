import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  Modal,
  BackHandler,
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
  ProgressBar,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { supabase } from "../../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";

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

export default function AddVehicleScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [horsepower, setHorsepower] = useState("");
  const [description, setDescription] = useState("");
  const [modifications, setModifications] = useState<string[]>([]);
  const [newModification, setNewModification] = useState("");
  const [images, setImages] = useState<string[]>([]); // local uris
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");

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

  const handleAddVehicle = async () => {
    setError("");
    if (!name || !make || !model || !year) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!user?.id) {
      setError("You must be logged in to add a vehicle.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      // 1. Insert vehicle without images
      const { data: insertData, error: insertError } = await supabase
        .from("vehicles")
        .insert({
          name,
          make,
          model,
          year: parseInt(year),
          description,
          horsepower: horsepower ? parseInt(horsepower) : null,
          modifications,
          images: [],
          user_id: user.id,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      const vehicleId = insertData.id;

      // 2. Upload images using vehicleId in the path
      let imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const imgUri = images[i];

        // Manipulate image for better performance
        const manipulated = await ImageManipulator.manipulateAsync(
          imgUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Generate unique filename
        const fileName = `${vehicleId}/${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}.jpg`;

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to Uint8Array for React Native compatibility
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Upload using Supabase client storage API with Uint8Array
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("vehicle-images")
          .upload(fileName, byteArray, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setError(`Failed to upload image #${i + 1}: ${uploadError.message}`);
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("vehicle-images")
          .getPublicUrl(fileName);

        imageUrls.push(urlData.publicUrl);
        setUploadProgress(Math.round(((i + 1) / images.length) * 100));
      }

      // 3. Update vehicle with image URLs
      if (imageUrls.length > 0) {
        const { error: updateError } = await supabase
          .from("vehicles")
          .update({ images: JSON.stringify(imageUrls) })
          .eq("id", vehicleId);
        if (updateError) throw updateError;
      }

      setSnackbar("Vehicle added!");
      // Optionally, add a short delay for UI polish
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/(tabs)/garage");
    } catch (e: any) {
      console.error("Error adding vehicle:", e);
      setError(e.message || "Failed to add vehicle.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    if (!uploading) return;
    // Prevent hardware back button while uploading
    const onBackPress = () => true;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [uploading]);

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top || 16 },
      ]}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text
            variant="titleLarge"
            style={{ marginBottom: 16, color: colors.onBackground }}
          >
            Add Vehicle
          </Text>
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            mode="outlined"
            required
          />
          <Text style={styles.label}>Make</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
          >
            {makes.map((m) => (
              <Chip
                key={m}
                selected={make === m}
                onPress={() => setMake(m)}
                style={[
                  styles.chip,
                  make === m && { backgroundColor: colors.primary },
                ]}
                textStyle={{
                  color: make === m ? colors.onPrimary : colors.primary,
                }}
              >
                {m}
              </Chip>
            ))}
          </ScrollView>
          <TextInput
            label="Model"
            value={model}
            onChangeText={setModel}
            style={styles.input}
            mode="outlined"
            required
          />
          <TextInput
            label="Year"
            value={year}
            onChangeText={setYear}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
            required
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
            label="Description"
            value={description}
            onChangeText={setDescription}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>Modifications</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <TextInput
              label="Add Modification"
              value={newModification}
              onChangeText={setNewModification}
              style={{ flex: 1, marginRight: 8 }}
              mode="outlined"
            />
            <Button
              mode="contained"
              onPress={handleAddModification}
              style={{ borderRadius: 8 }}
            >
              Add
            </Button>
          </View>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}
          >
            {modifications.map((mod, idx) => (
              <Chip
                key={idx}
                style={styles.modChip}
                textStyle={{ color: "#d4af37" }}
                onClose={() => handleRemoveModification(idx)}
              >
                {mod}
              </Chip>
            ))}
          </View>
          <Button
            mode="outlined"
            onPress={pickImages}
            style={{ marginVertical: 12 }}
            icon="image"
          >
            {images.length > 0
              ? `Change Images (${images.length})`
              : "Pick Images"}
          </Button>
          {images.length > 0 && (
            <ScrollView horizontal style={{ marginBottom: 12 }}>
              {images.map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: img }}
                  style={styles.imagePreview}
                />
              ))}
            </ScrollView>
          )}
          {error ? <HelperText type="error">{error}</HelperText> : null}
          <Button
            mode="contained"
            onPress={handleAddVehicle}
            loading={uploading}
            disabled={uploading}
            style={{ marginTop: 16 }}
          >
            Add Vehicle
          </Button>
        </Card.Content>
      </Card>
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar("")}
        duration={1500}
      >
        {snackbar}
      </Snackbar>
      {/* Full-screen loading overlay while uploading */}
      <Modal visible={uploading} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color="#d4af37" />
          <Text
            style={{
              color: "#fff",
              marginTop: 16,
              fontSize: 20,
              fontWeight: "bold",
            }}
          >
            Uploading Vehicle Photos...
          </Text>
          {uploadProgress > 0 && (
            <>
              <Text style={{ color: "#fff", marginTop: 8, fontSize: 16 }}>
                {`Uploading photo ${Math.ceil(
                  (uploadProgress / 100) * images.length
                )} of ${images.length}`}
              </Text>
              <ProgressBar
                progress={uploadProgress / 100}
                color="#d4af37"
                style={{
                  width: 200,
                  marginTop: 12,
                  height: 8,
                  borderRadius: 4,
                }}
              />
              <Text style={{ color: "#fff", marginTop: 8 }}>
                {uploadProgress}%
              </Text>
            </>
          )}
          {error ? (
            <Text
              style={{ color: "#ff5252", marginTop: 16, textAlign: "center" }}
            >
              {error}
            </Text>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  input: {
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
    borderColor: "#d4af37",
    borderWidth: 1,
    backgroundColor: "rgba(212, 175, 55, 0.08)",
  },
  label: {
    marginBottom: 4,
    marginLeft: 2,
    color: "#d4af37",
    fontWeight: "bold",
  },
  imagePreview: {
    width: 100,
    height: 80,
    borderRadius: 12,
    marginRight: 8,
  },
  modChip: {
    marginRight: 4,
    marginBottom: 4,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderColor: "#d4af37",
    borderWidth: 1,
  },
});
