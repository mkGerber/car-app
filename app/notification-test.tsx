import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { Button, Card, Title, Paragraph, useTheme } from "react-native-paper";
import { NotificationHelper } from "../src/utils/notificationHelper";

export default function NotificationTestScreen() {
  const theme = useTheme();
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>(
    []
  );

  useEffect(() => {
    loadScheduledNotifications();
  }, []);

  const loadScheduledNotifications = async () => {
    const notifications = await NotificationHelper.getScheduledNotifications();
    setScheduledNotifications(notifications);
  };

  const handleTestImmediate = async () => {
    const result = await NotificationHelper.testNotification();
    if (result) {
      Alert.alert("Success", "Test notification scheduled!");
    } else {
      Alert.alert("Error", "Failed to schedule notification");
    }
  };

  const handleTestDelayed = async () => {
    const result = await NotificationHelper.testMaintenanceReminder();
    if (result) {
      Alert.alert(
        "Success",
        "Maintenance reminder scheduled for 5 seconds from now!"
      );
      loadScheduledNotifications();
    } else {
      Alert.alert("Error", "Failed to schedule notification");
    }
  };

  const handleTestCustomDelay = async (seconds: number) => {
    const result = await NotificationHelper.testDelayedNotification(seconds);
    if (result) {
      Alert.alert(
        "Success",
        `Notification scheduled for ${seconds} seconds from now!`
      );
      loadScheduledNotifications();
    } else {
      Alert.alert("Error", "Failed to schedule notification");
    }
  };

  const handleTestMaintenance = async () => {
    const testDate = new Date();
    testDate.setMinutes(testDate.getMinutes() + 1); // 1 minute from now

    const result = await NotificationHelper.scheduleMaintenanceReminder(
      "Test Vehicle",
      "Oil Change",
      testDate,
      50000
    );

    if (result) {
      Alert.alert(
        "Success",
        "Maintenance reminder scheduled for 1 minute from now!"
      );
      loadScheduledNotifications();
    } else {
      Alert.alert("Error", "Failed to schedule notification");
    }
  };

  const handleCancelAll = async () => {
    await NotificationHelper.cancelAllNotifications();
    Alert.alert("Success", "All notifications cancelled!");
    loadScheduledNotifications();
  };

  const styles = getStyles(theme);

  return (
    <ScrollView style={styles.container}>
      <Title style={styles.title}>Notification Testing</Title>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Test Notifications</Title>
          <Paragraph>Try these different notification types:</Paragraph>

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleTestImmediate}
              style={styles.button}
            >
              Test Immediate Notification
            </Button>

            <Button
              mode="contained"
              onPress={handleTestDelayed}
              style={styles.button}
            >
              Test Delayed (5 seconds)
            </Button>

            <Button
              mode="contained"
              onPress={handleTestMaintenance}
              style={styles.button}
            >
              Test Maintenance Reminder (1 minute)
            </Button>

            <Button
              mode="contained"
              onPress={() => handleTestCustomDelay(10)}
              style={styles.button}
            >
              Test 10 Second Delay
            </Button>

            <Button
              mode="contained"
              onPress={() => handleTestCustomDelay(30)}
              style={styles.button}
            >
              Test 30 Second Delay
            </Button>

            <Button
              mode="contained"
              onPress={() => handleTestCustomDelay(60)}
              style={styles.button}
            >
              Test 1 Minute Delay
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Manage Notifications</Title>
          <Paragraph>
            Current scheduled notifications: {scheduledNotifications.length}
          </Paragraph>

          <Button
            mode="outlined"
            onPress={handleCancelAll}
            style={styles.button}
          >
            Cancel All Notifications
          </Button>
        </Card.Content>
      </Card>

      {scheduledNotifications.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Scheduled Notifications</Title>
            {scheduledNotifications.map((notification, index) => (
              <View key={index} style={styles.notificationItem}>
                <Text style={styles.notificationTitle}>
                  {notification.content.title}
                </Text>
                <Text style={styles.notificationBody}>
                  {notification.content.body}
                </Text>
                <Text style={styles.notificationDate}>
                  Scheduled for:{" "}
                  {new Date(notification.trigger.date).toLocaleString()}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Title>Debug Information</Title>
          <Paragraph>
            Current time: {new Date().toLocaleString()}
            {"\n"}
            Total scheduled: {scheduledNotifications.length}
            {"\n"}
            Platform: {Platform.OS}
            {"\n"}
            {"\n"}
            If delayed notifications aren't working:{"\n"}• Check that the app
            has notification permissions{"\n"}• Make sure the device isn't in
            battery saver mode{"\n"}• Try longer delays (30+ seconds) for
            testing{"\n"}• Check the console for scheduling logs
          </Paragraph>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>How to Test</Title>
          <Paragraph>
            1. Tap "Test Immediate Notification" to see a notification right
            away{"\n"}
            2. Tap "Test Delayed" to schedule a notification for 5 seconds{"\n"}
            3. Tap "Test Maintenance Reminder" to schedule a maintenance
            notification for 1 minute{"\n"}
            4. Try the custom delay buttons for longer delays{"\n"}
            5. Use "Cancel All" to clear all scheduled notifications{"\n"}
            6. Check the scheduled notifications list to see what's pending
            {"\n"}
            7. Monitor the console for debugging information
          </Paragraph>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
      marginVertical: 20,
      color: theme.colors.onSurface,
    },
    card: {
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
    buttonContainer: {
      marginTop: 16,
    },
    button: {
      marginVertical: 8,
    },
    notificationItem: {
      marginVertical: 8,
      padding: 12,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    notificationBody: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    notificationDate: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      fontStyle: "italic",
    },
  });
