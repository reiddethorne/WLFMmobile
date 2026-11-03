import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { parseShowReminder, reminderTimestamp, type ReminderNotifications } from "./showReminders";

const CHANNEL_ID = "show-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function allowed(settings: Notifications.NotificationPermissionsStatus): boolean {
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export const reminderNotifications: ReminderNotifications = {
  supported: true,
  async requestPermission() {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Show reminders",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }
    let settings = await Notifications.getPermissionsAsync();
    if (!allowed(settings) && settings.canAskAgain) {
      settings = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
    }
    if (!allowed(settings)) throw new Error("Notifications are disabled. Enable them in notification settings under Preferences, then try again.");
  },
  async schedule(reminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.notificationId,
      content: {
        title: reminder.event.title,
        body: `Starts in ${reminder.minutesBefore} ${reminder.minutesBefore === 1 ? "minute" : "minutes"} on WLFM. Tap to view the program.`,
        sound: "default",
        data: { type: "show-reminder", reminder },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderTimestamp(reminder)),
        channelId: CHANNEL_ID,
      },
    });
  },
  cancel: Notifications.cancelScheduledNotificationAsync,
  subscribeReceived(listener) {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === "show-reminder") listener();
    });
    return () => subscription.remove();
  },
  async list() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.flatMap((request) => {
      if (request.content.data?.type !== "show-reminder") return [];
      const reminder = parseShowReminder(request.content.data.reminder);
      return reminder && reminder.notificationId === request.identifier ? [reminder] : [];
    });
  },
};
