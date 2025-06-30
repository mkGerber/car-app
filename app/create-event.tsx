import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  useTheme,
  HelperText,
  Snackbar,
  ActivityIndicator,
  Surface,
  Chip,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../src/store";
import MapView, { Marker } from "react-native-maps";
import { format } from "date-fns";

const eventTypes = [
  "Car Meet",
  "Track Day",
  "Car Show",
  "Cruise",
  "Workshop",
  "Other",
];

export default function CreateEventScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [marker, setMarker] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Location Permission",
        "Location permission is needed to set event locations on the map."
      );
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setSelectedImage(manipulated.uri);
    }
  };

  const uploadImage = async (imageUri: string) => {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array for React Native compatibility
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let j = 0; j < byteCharacters.length; j++) {
      byteNumbers[j] = byteCharacters.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Generate unique filename
    const fileName = `event-images/${user?.id}/${Date.now()}_event.jpg`;

    // Upload using Supabase client storage API
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(fileName, byteArray, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("event-images")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleMapPress = (event: any) => {
    setMarker(event.nativeEvent.coordinate);
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      setMarker({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      Alert.alert("Error", "Could not get current location");
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (date) {
        setSelectedDate(date);
      }
    } else {
      // For iOS, just update the date but keep picker open
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
      if (time) {
        // Keep the same date but update the time
        const newDateTime = new Date(selectedDate);
        newDateTime.setHours(time.getHours());
        newDateTime.setMinutes(time.getMinutes());
        setSelectedDate(newDateTime);
      }
    } else {
      // For iOS, just update the time but keep picker open
      if (time) {
        const newDateTime = new Date(selectedDate);
        newDateTime.setHours(time.getHours());
        newDateTime.setMinutes(time.getMinutes());
        setSelectedDate(newDateTime);
      }
    }
  };

  const handleDateConfirm = () => {
    setShowDatePicker(false);
  };

  const handleTimeConfirm = () => {
    setShowTimePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const handleTimeCancel = () => {
    setShowTimePicker(false);
  };

  const formatDateForDisplay = (date: Date) => {
    return format(date, "MMM dd, yyyy");
  };

  const formatTimeForDisplay = (date: Date) => {
    return format(date, "h:mm a");
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      setError("You must be logged in to create an event.");
      return;
    }

    if (!title || !description || !location || !type) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let imageUrl = "";

      // Upload image if selected
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      // Format date for database
      const formattedDate = format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      // Create event
      const { error: createError } = await supabase.from("events").insert({
        title,
        description,
        date: formattedDate,
        location,
        type,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        image_url: imageUrl,
        created_by: user.id,
        latitude: marker?.latitude || null,
        longitude: marker?.longitude || null,
      });

      if (createError) throw createError;

      setSnackbar("Event created successfully!");
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (e: any) {
      console.error("Error creating event:", e);
      setError(e.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

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
            Create Event
          </Text>

          {/* Event Image */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Event Image</Text>
            <View style={styles.imageContainer}>
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.eventImage}
                />
              ) : (
                <View
                  style={[
                    styles.placeholderImage,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Text style={{ color: colors.onSurfaceVariant }}>
                    No image selected
                  </Text>
                </View>
              )}
              <Button
                mode="outlined"
                onPress={pickImage}
                style={styles.imageButton}
                icon="image"
              >
                {selectedImage ? "Change Image" : "Add Image"}
              </Button>
            </View>
          </View>

          {/* Event Details */}
          <TextInput
            label="Event Title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            mode="outlined"
            required
          />

          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
            required
          />

          {/* Date and Time Selection */}
          <View style={styles.row}>
            <Button
              mode="outlined"
              onPress={() => setShowDatePicker(true)}
              style={[styles.input, styles.halfInput]}
              icon="calendar"
            >
              {formatDateForDisplay(selectedDate)}
            </Button>
            <Button
              mode="outlined"
              onPress={() => setShowTimePicker(true)}
              style={[styles.input, styles.halfInput]}
              icon="clock"
            >
              {formatTimeForDisplay(selectedDate)}
            </Button>
          </View>

          {/* Date Picker */}
          {showDatePicker && (
            <>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
              {Platform.OS === "ios" && (
                <View style={styles.pickerButtons}>
                  <Button
                    mode="outlined"
                    onPress={handleDateCancel}
                    style={styles.pickerButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleDateConfirm}
                    style={styles.pickerButton}
                  >
                    Done
                  </Button>
                </View>
              )}
            </>
          )}

          {/* Time Picker */}
          {showTimePicker && (
            <>
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
              />
              {Platform.OS === "ios" && (
                <View style={styles.pickerButtons}>
                  <Button
                    mode="outlined"
                    onPress={handleTimeCancel}
                    style={styles.pickerButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleTimeConfirm}
                    style={styles.pickerButton}
                  >
                    Done
                  </Button>
                </View>
              )}
            </>
          )}

          <TextInput
            label="Location"
            value={location}
            onChangeText={setLocation}
            style={styles.input}
            mode="outlined"
            required
          />

          {/* Event Type */}
          <Text style={styles.sectionTitle}>Event Type</Text>
          <View style={styles.chipContainer}>
            {eventTypes.map((eventType) => (
              <Chip
                key={eventType}
                selected={type === eventType}
                onPress={() => setType(eventType)}
                style={[
                  styles.chip,
                  type === eventType && { backgroundColor: colors.primary },
                ]}
                textStyle={{
                  color:
                    type === eventType ? colors.onPrimary : colors.onBackground,
                }}
              >
                {eventType}
              </Chip>
            ))}
          </View>

          <TextInput
            label="Maximum Attendees (Optional)"
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          {/* Map Section */}
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <Text style={styles.sectionTitle}>Event Location</Text>
              <Button
                mode="outlined"
                onPress={() => setShowMap(!showMap)}
                style={styles.mapToggleButton}
                icon={showMap ? "map-off" : "map"}
              >
                {showMap ? "Hide Map" : "Show Map"}
              </Button>
            </View>

            {showMap && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: 37.0902,
                    longitude: -95.7129,
                    latitudeDelta: 50,
                    longitudeDelta: 50,
                  }}
                  onPress={handleMapPress}
                >
                  {marker && <Marker coordinate={marker} pinColor="#d4af37" />}
                </MapView>
                <View style={styles.mapButtons}>
                  <Button
                    mode="outlined"
                    onPress={getCurrentLocation}
                    style={styles.mapButton}
                    icon="crosshairs-gps"
                  >
                    My Location
                  </Button>
                  {marker && (
                    <Text style={styles.coordinates}>
                      {marker.latitude.toFixed(5)},{" "}
                      {marker.longitude.toFixed(5)}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={[styles.button, styles.cancelButton]}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              Create Event
            </Button>
          </View>
        </Card.Content>
      </Card>

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
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  imageSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#d4af37",
  },
  imageContainer: {
    alignItems: "center",
  },
  eventImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  placeholderImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  imageButton: {
    borderColor: "#d4af37",
    borderWidth: 1,
  },
  input: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    marginBottom: 8,
  },
  mapSection: {
    marginBottom: 24,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mapToggleButton: {
    borderColor: "#d4af37",
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  mapButtons: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 8,
    padding: 8,
  },
  mapButton: {
    borderColor: "#d4af37",
  },
  coordinates: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  cancelButton: {
    borderColor: "#666",
  },
  pickerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 8,
  },
  pickerButton: {
    flex: 1,
  },
});
