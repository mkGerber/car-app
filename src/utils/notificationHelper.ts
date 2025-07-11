import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationHelper {
  static async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    
    return true;
  }

  static async getExpoPushToken() {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const projectId = 'your-expo-project-id'; // You'll need to get this from your Expo dashboard
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      
      console.log('Expo push token:', token.data);
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Test local notification (works immediately)
  static async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    trigger?: Notifications.NotificationTriggerInput
  ) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('No notification permissions');
        return null;
      }

      // If no trigger is provided, show immediately
      const notificationConfig: any = {
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
      };

      if (trigger) {
        notificationConfig.trigger = trigger;
        console.log('Scheduling notification with trigger:', trigger);
      } else {
        // Show immediately
        console.log('Showing notification immediately');
      }

      const notificationId = await Notifications.scheduleNotificationAsync(notificationConfig);

      console.log('Scheduled notification with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  // Schedule maintenance reminder
  static async scheduleMaintenanceReminder(
    vehicleName: string,
    serviceType: string,
    dueDate: Date,
    dueMiles?: number
  ) {
    const title = `Maintenance Due: ${serviceType}`;
    const body = `${vehicleName} needs ${serviceType} service`;
    
    const data = {
      type: 'maintenance_reminder',
      vehicleName,
      serviceType,
      dueDate: dueDate.toISOString(),
      dueMiles,
    };

    // Schedule for the due date
    const trigger = {
      date: dueDate,
    };

    return await this.scheduleLocalNotification(title, body, data, trigger);
  }

  // Schedule reminder for 1 week before due date
  static async scheduleMaintenanceWarning(
    vehicleName: string,
    serviceType: string,
    dueDate: Date,
    dueMiles?: number
  ) {
    const warningDate = new Date(dueDate);
    warningDate.setDate(warningDate.getDate() - 7); // 1 week before

    const title = `Maintenance Coming Up: ${serviceType}`;
    const body = `${vehicleName} will need ${serviceType} service in 1 week`;
    
    const data = {
      type: 'maintenance_warning',
      vehicleName,
      serviceType,
      dueDate: dueDate.toISOString(),
      dueMiles,
    };

    const trigger = {
      date: warningDate,
    };

    return await this.scheduleLocalNotification(title, body, data, trigger);
  }

  // Cancel a specific notification
  static async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Cancel all notifications
  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get all scheduled notifications
  static async getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // Test notification (shows immediately)
  static async testNotification() {
    return await this.scheduleLocalNotification(
      'Test Notification',
      'This is a test notification from your car app!',
      { type: 'test' }
    );
  }

  // Test maintenance reminder (shows in 5 seconds)
  static async testMaintenanceReminder() {
    const testDate = new Date();
    testDate.setSeconds(testDate.getSeconds() + 5); // 5 seconds from now

    console.log('Scheduling test maintenance reminder for:', testDate.toISOString());

    return await this.scheduleLocalNotification(
      'Test Maintenance Reminder',
      'Your test vehicle needs an oil change!',
      { type: 'maintenance_test' },
      { date: testDate }
    );
  }

  // Test delayed notification with custom delay
  static async testDelayedNotification(seconds: number = 10) {
    const testDate = new Date();
    testDate.setSeconds(testDate.getSeconds() + seconds);

    console.log(`Scheduling delayed notification for ${seconds} seconds from now:`, testDate.toISOString());

    return await this.scheduleLocalNotification(
      'Delayed Test Notification',
      `This notification was scheduled ${seconds} seconds ago!`,
      { type: 'delayed_test', delay: seconds },
      { date: testDate }
    );
  }
}

// Listen for notification responses
export const setupNotificationListeners = () => {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response received:', response);
    
    const data = response.notification.request.content.data;
    
    if (data.type === 'maintenance_reminder') {
      // Handle maintenance reminder tap
      console.log('Maintenance reminder tapped:', data);
      // You can navigate to the maintenance screen here
    }
  });

  return subscription;
}; 