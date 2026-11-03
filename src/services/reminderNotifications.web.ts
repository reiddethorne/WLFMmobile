import type { ReminderNotifications } from "./showReminders";

export const reminderNotifications: ReminderNotifications = {
  supported: false,
  requestPermission: async () => { throw new Error("Show reminders are available in the iOS and Android app."); },
  schedule: async () => { throw new Error("Show reminders are available in the iOS and Android app."); },
  cancel: async () => undefined,
  list: async () => [],
};
