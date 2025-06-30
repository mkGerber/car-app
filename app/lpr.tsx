import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { supabase } from "../src/services/supabase";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../src/store";

const { width } = Dimensions.get("window");

export default function LPRScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [licensePlate, setLicensePlate] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const [noVehicleInviteModalVisible, setNoVehicleInviteModalVisible] =
    useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setSelectedImage(manipulated.uri);
      setError(null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera permission is required to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setSelectedImage(manipulated.uri);
      setError(null);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setResults([]);
    setError(null);
    setShowResults(false);
    setLicensePlate("");
    setShowManualInput(false);
  };

  const searchForVehicles = async (plates: string[]) => {
    const normalizedPlates = plates.map((plate) => plate.toUpperCase().trim());
    console.log("Searching for plates:", normalizedPlates);

    const { data, error } = await supabase
      .from("vehicles")
      .select(
        `
        id,
        make,
        model,
        year,
        license_plate,
        license_state,
        user_id
      `
      )
      .in("license_plate", normalizedPlates)
      .not("license_plate", "is", null);

    if (error) {
      console.error("Error searching for vehicles:", error);
      return [];
    }

    console.log("Found vehicles:", data);

    const vehiclesWithProfiles = await Promise.all(
      (data || []).map(async (vehicle) => {
        let profileData = null;
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .eq("id", vehicle.user_id)
            .single();
          profileData = profile;
        } catch (err) {
          console.warn("Could not fetch profile for vehicle:", vehicle.id, err);
        }

        return {
          ...vehicle,
          profiles: profileData || {
            id: vehicle.user_id,
            name: "Unknown User",
            username: "unknown",
            avatar_url: null,
          },
        };
      })
    );

    return vehiclesWithProfiles;
  };

  const handleManualPlateSubmit = async () => {
    if (!licensePlate.trim()) return;

    setIsProcessing(true);
    setShowManualInput(false);

    try {
      const normalizedPlate = licensePlate.trim().toUpperCase();
      const plates = [normalizedPlate];
      const vehicles = await searchForVehicles(plates);
      setResults(vehicles);
      setShowResults(true);
    } catch (err) {
      setError("Error searching for vehicles. Please try again.");
      console.error("Search error:", err);
    }

    setIsProcessing(false);
  };

  const handleProcessImage = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowManualInput(true);
    } catch (err) {
      setError("Error processing image. Please try again.");
      console.error("Processing error:", err);
    }

    setIsProcessing(false);
  };

  const uploadImage = async (
    imageUri: string,
    bucket: string,
    path: string
  ) => {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let j = 0; j < byteCharacters.length; j++) {
      byteNumbers[j] = byteCharacters.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, byteArray, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSendInvite = async () => {
    if (!selectedVehicle || !user) return;

    setSendingInvite(true);
    try {
      let imageUrl = null;
      if (selectedImage) {
        const fileName = `lpr-invites/${Date.now()}_${user.id}.jpg`;
        imageUrl = await uploadImage(selectedImage, "vehicle-images", fileName);
      }

      const { error: inviteError } = await supabase.from("lpr_invites").insert({
        sender_id: user.id,
        recipient_id: selectedVehicle.user_id,
        vehicle_id: selectedVehicle.id,
        license_plate: selectedVehicle.license_plate,
        license_state: selectedVehicle.license_state,
        image_url: imageUrl,
        message: inviteMessage.trim() || null,
      });

      if (inviteError) {
        setSnackbar(inviteError.message);
      } else {
        setSnackbar("Invite sent successfully!");
        setInviteModalVisible(false);
        setSelectedVehicle(null);
        setInviteMessage("");
      }
    } catch (err: any) {
      setSnackbar("Failed to send invite");
      console.error("Error sending invite:", err);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSendNoVehicleInvite = async () => {
    if (!user || !licensePlate.trim()) return;

    setSendingInvite(true);
    try {
      let imageUrl = null;
      if (selectedImage) {
        const fileName = `lpr-invites/${Date.now()}_${user.id}.jpg`;
        imageUrl = await uploadImage(selectedImage, "vehicle-images", fileName);
      }

      const normalizedPlate = licensePlate.trim().toUpperCase();

      const { error: inviteError } = await supabase.from("lpr_invites").insert({
        sender_id: user.id,
        recipient_id: null,
        vehicle_id: null,
        license_plate: normalizedPlate,
        license_state: null,
        image_url: imageUrl,
        message: inviteMessage.trim() || null,
        status: "pending",
      });

      if (inviteError) {
        setSnackbar(inviteError.message);
      } else {
        setSnackbar(
          "Invite created! It will be available when the vehicle owner joins."
        );
        setNoVehicleInviteModalVisible(false);
        setInviteMessage("");
      }
    } catch (err: any) {
      setSnackbar("Failed to create invite");
      console.error("Error creating invite:", err);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleOpenInviteModal = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setInviteModalVisible(true);
  };

  const handleOpenNoVehicleInviteModal = () => {
    setNoVehicleInviteModalVisible(true);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={[styles.title, { color: colors.primary }]}>
            License Plate Lookup
          </Text>

          <Text style={styles.subtitle}>
            Upload a photo of a license plate and enter the plate number to find
            the vehicle owner and their profile.
          </Text>

          {/* Image Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Upload Photo</Text>

            {!selectedImage ? (
              <View style={styles.uploadButtons}>
                <Button
                  mode="outlined"
                  onPress={takePhoto}
                  icon="camera"
                  style={styles.uploadButton}
                >
                  Take Photo
                </Button>
                <Button
                  mode="outlined"
                  onPress={pickImage}
                  icon="image"
                  style={styles.uploadButton}
                >
                  Choose Photo
                </Button>
              </View>
            ) : (
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.previewImage}
                />
                <Button
                  mode="outlined"
                  onPress={handleClear}
                  icon="close"
                  style={styles.clearButton}
                >
                  Clear
                </Button>
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {selectedImage && (
              <Button
                mode="contained"
                onPress={handleProcessImage}
                loading={isProcessing}
                disabled={isProcessing}
                style={styles.processButton}
                icon="magnify"
              >
                {isProcessing ? "Processing..." : "Continue to Lookup"}
              </Button>
            )}
          </View>

          {/* Results Section */}
          {showResults && (
            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>
                Found Vehicles ({results.length})
              </Text>

              {results.length === 0 ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>
                    No vehicles found with the license plate{" "}
                    <Text style={{ fontWeight: "bold" }}>{licensePlate}</Text>.
                  </Text>
                  <Text style={styles.noResultsSubtext}>
                    The vehicle owner might not be registered yet, but you can
                    still send an invite!
                  </Text>
                  <Button
                    mode="contained"
                    onPress={handleOpenNoVehicleInviteModal}
                    icon="send"
                    style={styles.sendInviteButton}
                  >
                    Send Invite Anyway
                  </Button>
                </View>
              ) : (
                <View style={styles.resultsList}>
                  {results.map((vehicle) => (
                    <View key={vehicle.id} style={styles.vehicleCard}>
                      <View style={styles.vehicleHeader}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {vehicle.profiles?.name?.[0] || "?"}
                          </Text>
                        </View>
                        <View style={styles.vehicleInfo}>
                          <Text
                            style={[
                              styles.vehicleName,
                              { color: colors.primary },
                            ]}
                          >
                            {vehicle.profiles?.name || "Unknown"}
                          </Text>
                          <Text style={styles.vehicleUsername}>
                            @{vehicle.profiles?.username || "unknown"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.vehicleDetails}>
                        <Text style={styles.vehicleModel}>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </Text>
                        {vehicle.user_id === user?.id ? (
                          <Text
                            style={[
                              styles.licensePlate,
                              { color: colors.primary },
                            ]}
                          >
                            {vehicle.license_plate} ({vehicle.license_state})
                          </Text>
                        ) : (
                          <Text style={styles.licensePlateHidden}>
                            License plate hidden for privacy
                          </Text>
                        )}
                      </View>

                      <View style={styles.vehicleActions}>
                        <Button
                          mode="outlined"
                          onPress={() =>
                            router.push(`/profile/${vehicle.user_id}`)
                          }
                          style={styles.actionButton}
                        >
                          View Profile
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => router.push(`/vehicle/${vehicle.id}`)}
                          style={styles.actionButton}
                        >
                          View Vehicle
                        </Button>
                        {vehicle.user_id !== user?.id && (
                          <Button
                            mode="contained"
                            onPress={() => handleOpenInviteModal(vehicle)}
                            style={styles.actionButton}
                          >
                            Send Invite
                          </Button>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {snackbar ? (
          <View style={styles.snackbar}>
            <Text style={styles.snackbarText}>{snackbar}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Manual License Plate Input Modal */}
      <Modal
        visible={showManualInput}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Enter License Plate Manually</Text>
            <Text style={styles.modalSubtitle}>
              Automatic detection couldn't find a license plate. Please enter
              the plate number manually.
            </Text>
            <TextInput
              label="License Plate"
              value={licensePlate}
              onChangeText={setLicensePlate}
              style={styles.modalInput}
              mode="outlined"
              autoCapitalize="characters"
              placeholder="e.g., ABC123"
            />
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowManualInput(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleManualPlateSubmit}
                disabled={!licensePlate.trim()}
                style={styles.modalButton}
              >
                Search
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* LPR Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Send LPR Invite</Text>
            <Text style={styles.modalSubtitle}>
              Send an invite to{" "}
              {selectedVehicle?.profiles?.name || "the vehicle owner"}.
            </Text>
            <TextInput
              label="Message (optional)"
              value={inviteMessage}
              onChangeText={setInviteMessage}
              style={styles.modalInput}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Hey! I spotted your car and wanted to connect..."
            />
            {selectedImage && (
              <View style={styles.modalImagePreview}>
                <Text style={styles.modalImageLabel}>
                  Image that will be included:
                </Text>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.modalImage}
                />
              </View>
            )}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setInviteModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSendInvite}
                loading={sendingInvite}
                disabled={sendingInvite}
                style={styles.modalButton}
              >
                {sendingInvite ? "Sending..." : "Send Invite"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* No Vehicle Invite Modal */}
      <Modal
        visible={noVehicleInviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoVehicleInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Send LPR Invite</Text>
            <Text style={styles.modalSubtitle}>
              Send an invite to the vehicle owner with the license plate{" "}
              <Text style={{ fontWeight: "bold" }}>{licensePlate}</Text>.
            </Text>
            <Text style={styles.modalSubtitle}>
              They'll receive a notification in their LPR inbox and can choose
              to accept or decline.
            </Text>
            <TextInput
              label="Message (optional)"
              value={inviteMessage}
              onChangeText={setInviteMessage}
              style={styles.modalInput}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Hey! I spotted your car and wanted to connect..."
            />
            {selectedImage && (
              <View style={styles.modalImagePreview}>
                <Text style={styles.modalImageLabel}>
                  Image that will be included:
                </Text>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.modalImage}
                />
              </View>
            )}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setNoVehicleInviteModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSendNoVehicleInvite}
                loading={sendingInvite}
                disabled={sendingInvite}
                style={styles.modalButton}
              >
                {sendingInvite ? "Sending..." : "Send Invite"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.7,
    fontSize: 16,
  },
  uploadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#d4af37",
  },
  uploadButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  uploadButton: {
    flex: 1,
    marginHorizontal: 8,
    borderColor: "#d4af37",
  },
  imagePreview: {
    alignItems: "center",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  clearButton: {
    borderColor: "#666",
  },
  processButton: {
    backgroundColor: "#d4af37",
    marginTop: 8,
  },
  errorText: {
    color: "#f44336",
    marginTop: 8,
    textAlign: "center",
  },
  resultsSection: {
    marginTop: 24,
  },
  noResults: {
    alignItems: "center",
    padding: 24,
  },
  noResultsText: {
    textAlign: "center",
    marginBottom: 8,
    fontSize: 16,
  },
  noResultsSubtext: {
    textAlign: "center",
    marginBottom: 16,
    opacity: 0.7,
    fontSize: 14,
  },
  sendInviteButton: {
    backgroundColor: "#4caf50",
  },
  resultsList: {
    gap: 16,
  },
  vehicleCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 16,
  },
  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d4af37",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  vehicleUsername: {
    fontSize: 14,
    opacity: 0.7,
  },
  vehicleDetails: {
    marginBottom: 16,
  },
  vehicleModel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  licensePlate: {
    fontWeight: "bold",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  licensePlateHidden: {
    opacity: 0.7,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  vehicleActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionButton: {
    flex: 1,
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
    borderRadius: 16,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#d4af37",
  },
  modalSubtitle: {
    marginBottom: 16,
    opacity: 0.7,
    fontSize: 14,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  modalImagePreview: {
    marginBottom: 16,
  },
  modalImageLabel: {
    marginBottom: 8,
    fontSize: 14,
  },
  modalImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  snackbar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#323232",
    borderRadius: 8,
    padding: 16,
  },
  snackbarText: {
    color: "white",
    textAlign: "center",
  },
});
