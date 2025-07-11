import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import {
  Card,
  Button,
  Chip,
  IconButton,
  Surface,
  Divider,
  ActivityIndicator,
  useTheme,
  SegmentedButtons,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { NotificationHelper } from "../../utils/notificationHelper";

interface MaintenanceReminder {
  id: string;
  vehicle_id: string;
  title: string;
  description?: string;
  reminder_type: "mileage" | "time" | "both";
  interval_miles?: number;
  interval_months?: number;
  last_service_miles?: number;
  last_service_date?: string;
  next_reminder_date?: string;
  next_reminder_miles?: number;
  is_active: boolean;
  priority: "high" | "medium" | "low";
  estimated_cost?: number;
  service_provider?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  reminder_id?: string;
  title: string;
  description?: string;
  service_date: string;
  service_miles?: number;
  cost?: number;
  service_provider?: string;
  notes?: string;
  photos?: string[];
  created_at: string;
}

interface MaintenanceRemindersProps {
  vehicleId: string;
  vehicleMiles?: number;
}

const priorityColors = {
  high: "#f44336",
  medium: "#ff9800",
  low: "#4caf50",
};

const reminderTypeLabels = {
  mileage: "Mileage-based",
  time: "Time-based",
  both: "Mileage & Time",
};

export const MaintenanceReminders: React.FC<MaintenanceRemindersProps> = ({
  vehicleId,
  vehicleMiles = 0,
}) => {
  const theme = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [maintenanceLog, setMaintenanceLog] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [logDialogVisible, setLogDialogVisible] = useState(false);
  const [editingReminder, setEditingReminder] =
    useState<MaintenanceReminder | null>(null);
  const [selectedReminder, setSelectedReminder] =
    useState<MaintenanceReminder | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reminder_type: "mileage" as "mileage" | "time" | "both",
    interval_miles: "",
    interval_months: "",
    priority: "medium" as "high" | "medium" | "low",
    estimated_cost: "",
    service_provider: "",
    notes: "",
  });
  const [logFormData, setLogFormData] = useState({
    title: "",
    description: "",
    service_date: new Date().toISOString().split("T")[0],
    service_miles: "",
    cost: "",
    service_provider: "",
    notes: "",
  });

  useEffect(() => {
    fetchReminders();
    fetchMaintenanceLog();
  }, [vehicleId]);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("maintenance_reminders")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("next_reminder_date", { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  };

  const fetchMaintenanceLog = async () => {
    try {
      const { data, error } = await supabase
        .from("maintenance_log")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("service_date", { ascending: false });

      if (error) throw error;
      setMaintenanceLog(data || []);
    } catch (error) {
      console.error("Error fetching maintenance log:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReminder = () => {
    setEditingReminder(null);
    setFormData({
      title: "",
      description: "",
      reminder_type: "mileage",
      interval_miles: "",
      interval_months: "",
      priority: "medium",
      estimated_cost: "",
      service_provider: "",
      notes: "",
    });
    setDialogVisible(true);
  };

  const handleEditReminder = (reminder: MaintenanceReminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description || "",
      reminder_type: reminder.reminder_type,
      interval_miles: reminder.interval_miles?.toString() || "",
      interval_months: reminder.interval_months?.toString() || "",
      priority: reminder.priority,
      estimated_cost: reminder.estimated_cost?.toString() || "",
      service_provider: reminder.service_provider || "",
      notes: reminder.notes || "",
    });
    setDialogVisible(true);
  };

  const handleSaveReminder = async () => {
    if (!formData.title) return;

    try {
      const reminderData = {
        vehicle_id: vehicleId,
        title: formData.title,
        description: formData.description || null,
        reminder_type: formData.reminder_type,
        interval_miles: formData.interval_miles
          ? parseInt(formData.interval_miles)
          : null,
        interval_months: formData.interval_months
          ? parseInt(formData.interval_months)
          : null,
        priority: formData.priority,
        estimated_cost: formData.estimated_cost
          ? parseFloat(formData.estimated_cost)
          : null,
        service_provider: formData.service_provider || null,
        notes: formData.notes || null,
        is_active: true,
        next_reminder_miles: formData.interval_miles
          ? vehicleMiles + parseInt(formData.interval_miles)
          : null,
        next_reminder_date: formData.interval_months
          ? new Date(
              Date.now() +
                parseInt(formData.interval_months) * 30 * 24 * 60 * 60 * 1000
            ).toISOString()
          : null,
      };

      if (editingReminder) {
        const { error } = await supabase
          .from("maintenance_reminders")
          .update(reminderData)
          .eq("id", editingReminder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maintenance_reminders")
          .insert([reminderData]);
        if (error) throw error;
      }

      setDialogVisible(false);
      fetchReminders();

      // Schedule notification for the reminder
      if (reminderData.next_reminder_date) {
        const dueDate = new Date(reminderData.next_reminder_date);
        const vehicleName =
          currentVehicle?.name ||
          `${currentVehicle?.year} ${currentVehicle?.make} ${currentVehicle?.model}`;

        await NotificationHelper.scheduleMaintenanceReminder(
          vehicleName,
          reminderData.title,
          dueDate,
          reminderData.next_reminder_miles || undefined
        );

        // Also schedule a warning 1 week before
        await NotificationHelper.scheduleMaintenanceWarning(
          vehicleName,
          reminderData.title,
          dueDate,
          reminderData.next_reminder_miles || undefined
        );
      }
    } catch (error) {
      console.error("Error saving reminder:", error);
      Alert.alert("Error", "Failed to save reminder");
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    Alert.alert(
      "Delete Reminder",
      "Are you sure you want to delete this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("maintenance_reminders")
                .delete()
                .eq("id", reminderId);
              if (error) throw error;
              fetchReminders();
            } catch (error) {
              console.error("Error deleting reminder:", error);
              Alert.alert("Error", "Failed to delete reminder");
            }
          },
        },
      ]
    );
  };

  const handleCompleteService = (reminder: MaintenanceReminder) => {
    setSelectedReminder(reminder);
    setLogFormData({
      title: reminder.title,
      description: reminder.description || "",
      service_date: new Date().toISOString().split("T")[0],
      service_miles: vehicleMiles.toString(),
      cost: reminder.estimated_cost?.toString() || "",
      service_provider: reminder.service_provider || "",
      notes: "",
    });
    setLogDialogVisible(true);
  };

  const handleSaveLogEntry = async () => {
    if (!logFormData.title) return;

    try {
      const logData = {
        vehicle_id: vehicleId,
        reminder_id: selectedReminder?.id || null,
        title: logFormData.title,
        description: logFormData.description || null,
        service_date: logFormData.service_date,
        service_miles: logFormData.service_miles
          ? parseInt(logFormData.service_miles)
          : null,
        cost: logFormData.cost ? parseFloat(logFormData.cost) : null,
        service_provider: logFormData.service_provider || null,
        notes: logFormData.notes || null,
      };

      const { error } = await supabase
        .from("maintenance_log")
        .insert([logData]);
      if (error) throw error;

      // Update the reminder with new next reminder date/miles
      if (selectedReminder) {
        const nextReminderData: any = {};

        if (selectedReminder.interval_miles) {
          nextReminderData.next_reminder_miles =
            parseInt(logFormData.service_miles || "0") +
            selectedReminder.interval_miles;
        }

        if (selectedReminder.interval_months) {
          const serviceDate = new Date(logFormData.service_date);
          serviceDate.setMonth(
            serviceDate.getMonth() + selectedReminder.interval_months
          );
          nextReminderData.next_reminder_date = serviceDate.toISOString();
        }

        if (Object.keys(nextReminderData).length > 0) {
          await supabase
            .from("maintenance_reminders")
            .update(nextReminderData)
            .eq("id", selectedReminder.id);
        }
      }

      setLogDialogVisible(false);
      fetchReminders();
      fetchMaintenanceLog();
    } catch (error) {
      console.error("Error saving log entry:", error);
      Alert.alert("Error", "Failed to save service log");
    }
  };

  const getReminderStatus = (reminder: MaintenanceReminder) => {
    const now = new Date();
    const nextDate = reminder.next_reminder_date
      ? new Date(reminder.next_reminder_date)
      : null;
    const milesUntil = reminder.next_reminder_miles
      ? reminder.next_reminder_miles - vehicleMiles
      : null;

    if (nextDate && nextDate <= now) return "overdue";
    if (milesUntil && milesUntil <= 0) return "overdue";
    if (
      nextDate &&
      nextDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    )
      return "due-soon";
    if (milesUntil && milesUntil <= 500) return "due-soon";
    return "upcoming";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "overdue":
        return "#f44336";
      case "due-soon":
        return "#ff9800";
      default:
        return "#4caf50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "overdue":
        return "alert-circle";
      case "due-soon":
        return "clock-alert";
      default:
        return "check-circle";
    }
  };

  const renderReminder = ({ item }: { item: MaintenanceReminder }) => {
    const status = getReminderStatus(item);
    const statusColor = getStatusColor(status);
    const statusIcon = getStatusIcon(status);

    return (
      <Surface
        style={[
          styles.reminderCard,
          { borderLeftColor: statusColor, borderLeftWidth: 4 },
        ]}
      >
        <View style={styles.reminderHeader}>
          <View style={styles.reminderTitleContainer}>
            <MaterialCommunityIcons
              name={statusIcon}
              size={20}
              color={statusColor}
              style={styles.statusIcon}
            />
            <Text style={styles.reminderTitle}>{item.title}</Text>
          </View>
          <View style={styles.reminderActions}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => handleEditReminder(item)}
            />
            <IconButton
              icon="delete"
              size={20}
              onPress={() => handleDeleteReminder(item.id)}
            />
          </View>
        </View>

        {item.description && (
          <Text style={styles.reminderDescription}>{item.description}</Text>
        )}

        <View style={styles.reminderChips}>
          <Chip
            style={[
              styles.chip,
              { backgroundColor: priorityColors[item.priority] + "20" },
            ]}
            textStyle={{ color: priorityColors[item.priority] }}
          >
            {item.priority.toUpperCase()}
          </Chip>
          <Chip style={styles.chip}>
            {reminderTypeLabels[item.reminder_type]}
          </Chip>
        </View>

        <View style={styles.reminderDetails}>
          {item.interval_miles && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="speedometer"
                size={16}
                color="gray"
              />
              <Text style={styles.detailText}>
                Every {item.interval_miles.toLocaleString()} miles
              </Text>
            </View>
          )}
          {item.interval_months && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="calendar" size={16} color="gray" />
              <Text style={styles.detailText}>
                Every {item.interval_months} months
              </Text>
            </View>
          )}
          {item.next_reminder_miles && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker-distance"
                size={16}
                color="gray"
              />
              <Text style={styles.detailText}>
                Due at {item.next_reminder_miles.toLocaleString()} miles
                {vehicleMiles > 0 && (
                  <Text style={{ color: statusColor }}>
                    {" "}
                    ({item.next_reminder_miles - vehicleMiles} miles left)
                  </Text>
                )}
              </Text>
            </View>
          )}
          {item.next_reminder_date && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={16}
                color="gray"
              />
              <Text style={styles.detailText}>
                Due {new Date(item.next_reminder_date).toLocaleDateString()}
              </Text>
            </View>
          )}
          {item.estimated_cost && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="currency-usd"
                size={16}
                color="gray"
              />
              <Text style={styles.detailText}>Est. ${item.estimated_cost}</Text>
            </View>
          )}
        </View>

        <View style={styles.reminderFooter}>
          <Button
            mode="contained"
            onPress={() => handleCompleteService(item)}
            style={styles.completeButton}
          >
            Complete Service
          </Button>
        </View>
      </Surface>
    );
  };

  const renderLogEntry = ({ item }: { item: MaintenanceLog }) => (
    <Surface style={styles.logEntry}>
      <Text style={styles.logTitle}>{item.title}</Text>
      <Text style={styles.logDate}>
        {new Date(item.service_date).toLocaleDateString()}
        {item.service_miles &&
          ` • ${item.service_miles.toLocaleString()} miles`}
        {item.cost && ` • $${item.cost}`}
      </Text>
      {item.description && (
        <Text style={styles.logDescription}>{item.description}</Text>
      )}
      {item.service_provider && (
        <Text style={styles.logProvider}>{item.service_provider}</Text>
      )}
    </Surface>
  );

  if (loading) {
    return <ActivityIndicator style={getStyles(theme).loader} />;
  }

  const activeReminders = reminders.filter((r) => r.is_active);
  const styles = getStyles(theme);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Maintenance Reminders</Text>
          <Text style={styles.headerSubtitle}>
            {activeReminders.length} active reminder
            {activeReminders.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            mode="outlined"
            icon="bell"
            onPress={async () => {
              await NotificationHelper.testMaintenanceReminder();
            }}
            style={styles.testButton}
          >
            Test
          </Button>
          <Button
            mode="contained"
            icon="plus"
            onPress={handleAddReminder}
            style={styles.addButton}
            labelStyle={styles.addButtonLabel}
          >
            Add
          </Button>
        </View>
      </View>

      {/* Active Reminders */}
      {activeReminders.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Reminders</Text>
          <FlatList
            data={activeReminders}
            renderItem={renderReminder}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            style={styles.remindersList}
          />
        </View>
      ) : (
        <Surface style={styles.emptyState}>
          <MaterialCommunityIcons
            name="wrench"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={styles.emptyTitle}>No Active Reminders</Text>
          <Text style={styles.emptyText}>
            Add your first maintenance reminder to keep track of service
            intervals
          </Text>
          <Button
            mode="outlined"
            onPress={handleAddReminder}
            style={styles.emptyButton}
          >
            Add First Reminder
          </Button>
        </Surface>
      )}

      {/* Maintenance History */}
      {maintenanceLog.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service History</Text>
          <FlatList
            data={maintenanceLog.slice(0, 5)} // Show only last 5 entries
            renderItem={renderLogEntry}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            style={styles.logList}
          />
          {maintenanceLog.length > 5 && (
            <Button mode="text" onPress={() => {}} style={styles.viewAllButton}>
              View All ({maintenanceLog.length} entries)
            </Button>
          )}
        </View>
      )}

      {/* Add/Edit Reminder Modal */}
      <Modal
        visible={dialogVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDialogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReminder ? "Edit Reminder" : "Add Reminder"}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setDialogVisible(false)}
              />
            </View>

            <ScrollView
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.input}
                placeholder="Service Title (e.g., Oil Change)"
                value={formData.title}
                onChangeText={(text) =>
                  setFormData({ ...formData, title: text })
                }
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                multiline
                numberOfLines={3}
              />

              {/* Reminder Type Selection */}
              <Text style={styles.formLabel}>Reminder Type</Text>
              <SegmentedButtons
                value={formData.reminder_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, reminder_type: value as any })
                }
                buttons={[
                  { value: "mileage", label: "Miles" },
                  { value: "time", label: "Time" },
                  { value: "both", label: "Both" },
                ]}
                style={styles.segmentedButtons}
              />

              {/* Interval Inputs */}
              <View style={styles.intervalSection}>
                {(formData.reminder_type === "mileage" ||
                  formData.reminder_type === "both") && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Mileage Interval</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 5000"
                      value={formData.interval_miles}
                      onChangeText={(text) =>
                        setFormData({ ...formData, interval_miles: text })
                      }
                      keyboardType="numeric"
                    />
                  </View>
                )}

                {(formData.reminder_type === "time" ||
                  formData.reminder_type === "both") && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Time Interval (months)
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 6"
                      value={formData.interval_months}
                      onChangeText={(text) =>
                        setFormData({ ...formData, interval_months: text })
                      }
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>

              {/* Priority Selection */}
              <Text style={styles.formLabel}>Priority</Text>
              <SegmentedButtons
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value as any })
                }
                buttons={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
                style={styles.segmentedButtons}
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Estimated Cost</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="$0"
                    value={formData.estimated_cost}
                    onChangeText={(text) =>
                      setFormData({ ...formData, estimated_cost: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Service Provider</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional"
                    value={formData.service_provider}
                    onChangeText={(text) =>
                      setFormData({ ...formData, service_provider: text })
                    }
                  />
                </View>
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes (optional)"
                value={formData.notes}
                onChangeText={(text) =>
                  setFormData({ ...formData, notes: text })
                }
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
              <Button
                mode="contained"
                onPress={handleSaveReminder}
                disabled={!formData.title}
              >
                {editingReminder ? "Update" : "Add Reminder"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Service Modal */}
      <Modal
        visible={logDialogVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLogDialogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Service</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setLogDialogVisible(false)}
              />
            </View>

            <ScrollView
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.input}
                placeholder="Service Title"
                value={logFormData.title}
                onChangeText={(text) =>
                  setLogFormData({ ...logFormData, title: text })
                }
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                value={logFormData.description}
                onChangeText={(text) =>
                  setLogFormData({ ...logFormData, description: text })
                }
                multiline
                numberOfLines={3}
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Service Miles</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Current miles"
                    value={logFormData.service_miles}
                    onChangeText={(text) =>
                      setLogFormData({ ...logFormData, service_miles: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Cost</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="$0"
                    value={logFormData.cost}
                    onChangeText={(text) =>
                      setLogFormData({ ...logFormData, cost: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Service Provider"
                value={logFormData.service_provider}
                onChangeText={(text) =>
                  setLogFormData({ ...logFormData, service_provider: text })
                }
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                value={logFormData.notes}
                onChangeText={(text) =>
                  setLogFormData({ ...logFormData, notes: text })
                }
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button onPress={() => setLogDialogVisible(false)}>Cancel</Button>
              <Button
                mode="contained"
                onPress={handleSaveLogEntry}
                disabled={!logFormData.title}
              >
                Complete Service
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
    },
    loader: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    testButton: {
      borderColor: theme.colors.primary,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.onSurface,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
    },
    addButtonLabel: {
      fontSize: 14,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 16,
    },
    emptyState: {
      alignItems: "center",
      padding: 40,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceVariant,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 20,
    },
    emptyButton: {
      borderColor: theme.colors.primary,
    },
    remindersList: {
      marginBottom: 16,
    },
    reminderCard: {
      marginBottom: 16,
      padding: 20,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    reminderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    reminderTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    statusIcon: {
      marginRight: 8,
    },
    reminderTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onSurface,
      flex: 1,
    },
    reminderActions: {
      flexDirection: "row",
    },
    reminderDescription: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 12,
      lineHeight: 20,
    },
    reminderChips: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 8,
    },
    chip: {
      marginRight: 8,
    },
    reminderDetails: {
      gap: 8,
      marginBottom: 16,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    reminderFooter: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      paddingTop: 16,
    },
    completeButton: {
      backgroundColor: theme.colors.primary,
    },
    logList: {
      marginBottom: 16,
    },
    logEntry: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      elevation: 1,
    },
    logTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    logDate: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 8,
    },
    logDescription: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    logProvider: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: "500",
    },
    viewAllButton: {
      marginTop: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      width: "90%",
      maxHeight: "85%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    formContainer: {
      padding: 20,
      maxHeight: 500,
    },
    formLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      fontSize: 16,
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.onSurfaceVariant,
      marginBottom: 6,
    },
    inputGroup: {
      marginBottom: 16,
    },
    textArea: {
      height: 80,
      textAlignVertical: "top",
    },
    row: {
      flexDirection: "row",
      gap: 16,
    },
    halfInput: {
      flex: 1,
    },
    intervalSection: {
      marginBottom: 16,
    },
    segmentedButtons: {
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
  });
