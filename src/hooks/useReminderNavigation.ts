import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";

import { parseShowReminder } from "@/services/showReminders";

export function useReminderNavigation() {
  const navigation = useRootNavigationState();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!navigation?.key) return;
    const open = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const { notification } = response;
      const key = `${notification.request.identifier}:${notification.date}`;
      if (handled.current === key || notification.request.content.data?.type !== "show-reminder") return;
      const reminder = parseShowReminder(notification.request.content.data.reminder);
      if (!reminder || reminder.notificationId !== notification.request.identifier) return;
      handled.current = key;
      router.navigate({ pathname: "/(tabs)/schedule", params: { event: JSON.stringify(reminder.event) } });
      Notifications.clearLastNotificationResponse();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    const initial = Notifications.getLastNotificationResponse();
    if (initial) open(initial);
    return () => subscription.remove();
  }, [navigation?.key]);
}
