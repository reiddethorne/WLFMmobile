import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = await mkdtemp(join(tmpdir(), "wlfm-reminder-tests-"));
after(() => rm(temp, { recursive: true, force: true }));
for (const [source, output] of [
  ["../src/services/showReminders.ts", "showReminders.mjs"],
  ["../src/services/reminderNotifications.ts", "reminderNotifications.mjs"],
  ["../src/hooks/useReminderNavigation.ts", "useReminderNavigation.mjs"],
]) {
  const input = await readFile(new URL(source, import.meta.url), "utf8");
  const compiled = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    .replace('"./showReminders"', '"./showReminders.mjs"')
    .replace('"@/services/showReminders"', '"./showReminders.mjs"')
    .replace('"expo-notifications"', '"./notifications.mjs"')
    .replace('"react-native"', '"./native.mjs"')
    .replace('"expo-router"', '"./router.mjs"')
    .replace('"react"', '"./react.mjs"');
  await writeFile(join(temp, output), compiled);
}
await Promise.all([
  writeFile(join(temp, "notifications.mjs"), `
    export const state = { calls: [], initial: null, responses: new Set(), received: new Set(), granted: true, canAskAgain: true, requests: [] };
    export const IosAuthorizationStatus = { PROVISIONAL: 3 };
    export const AndroidImportance = { HIGH: 4 };
    export const SchedulableTriggerInputTypes = { DATE: "date" };
    export const DEFAULT_ACTION_IDENTIFIER = "default";
    export function setNotificationHandler(handler) { state.handler = handler; }
    export async function setNotificationChannelAsync(...args) { state.calls.push(["channel", ...args]); }
    export async function getPermissionsAsync() { state.calls.push(["permission"]); return { granted: state.granted, canAskAgain: state.canAskAgain, ios: { status: state.iosStatus } }; }
    export async function requestPermissionsAsync() { state.calls.push(["prompt"]); return { granted: state.granted }; }
    export async function scheduleNotificationAsync(request) { state.calls.push(["schedule", request]); return request.identifier; }
    export async function cancelScheduledNotificationAsync(id) { state.calls.push(["cancel", id]); }
    export async function getAllScheduledNotificationsAsync() { return state.requests; }
    export function addNotificationResponseReceivedListener(listener) { state.responses.add(listener); return { remove() { state.responses.delete(listener); } }; }
    export function addNotificationReceivedListener(listener) { state.received.add(listener); return { remove() { state.received.delete(listener); } }; }
    export function getLastNotificationResponse() { return state.initial; }
    export function clearLastNotificationResponse() { state.initial = null; }
  `),
  writeFile(join(temp, "native.mjs"), 'export const Platform = { OS: "android" };'),
  writeFile(join(temp, "router.mjs"), `
    export const pushes = [];
    export const navigation = { key: null };
    export const router = { navigate: (route) => pushes.push(route) };
    export const useRootNavigationState = () => navigation;
  `),
  writeFile(join(temp, "react.mjs"), `
    export const effects = [];
    const ref = { current: null };
    export function useEffect(effect) { effects.push(effect); }
    export function useRef() { return ref; }
  `),
]);
const importTemp = (name) => import(pathToFileURL(join(temp, name)).href);
const { ShowRemindersStore, SHOW_PREFERENCES_KEY, favoriteProgramKey, reminderNotificationId,
  reminderTimestamp, parseScheduleEntryParam } = await importTemp("showReminders.mjs");
const { reminderNotifications } = await importTemp("reminderNotifications.mjs");
const { useReminderNavigation } = await importTemp("useReminderNavigation.mjs");
const { state: native } = await importTemp("notifications.mjs");

const NOW = Date.parse("2026-11-03T18:00:00Z");
const event = (id = "show-1", changes = {}) => ({
  id, title: "Evening Show", start: "2026-11-03T19:00:00Z", end: "2026-11-03T20:00:00Z",
  description: "A radio program", location: null, isAllDay: false, ...changes,
});
const reminder = (show = event(), minutesBefore = 5) => ({
  event: show, minutesBefore, notificationId: reminderNotificationId(show.id),
});

function fixture({ raw = null, supported = true, pending = [] } = {}) {
  let now = NOW;
  let saved = raw;
  let failWrite = false;
  let denied = false;
  let failSchedule = false;
  let failCancel = false;
  let scheduleAttempts = 0;
  let failAtAttempt = Infinity;
  const os = new Map(pending.map((item) => [item.notificationId, item]));
  const calls = [];
  const store = new ShowRemindersStore({
    clock: () => now,
    storage: {
      async getItem(key) { assert.equal(key, SHOW_PREFERENCES_KEY); return saved; },
      async setItem(key, value) { assert.equal(key, SHOW_PREFERENCES_KEY); if (failWrite) throw new Error("Disk unavailable"); saved = value; },
    },
    notifications: {
      supported,
      async requestPermission() { calls.push("permission"); if (denied) throw new Error("Notifications disabled"); },
      async schedule(item) { calls.push("schedule"); scheduleAttempts += 1; if (failSchedule || scheduleAttempts === failAtAttempt) throw new Error("Schedule failed"); os.set(item.notificationId, item); },
      async cancel(id) { calls.push("cancel"); if (failCancel) throw new Error("Cancellation failed"); os.delete(id); },
      async list() { calls.push("list"); return [...os.values()]; },
    },
  });
  return { store, os, calls, saved: () => JSON.parse(saved), setNow: (value) => { now = value; },
    failWrite: (value) => { failWrite = value; }, deny: () => { denied = true; },
    failSchedule: (value) => { failSchedule = value; }, failCancel: (value) => { failCancel = value; },
    failScheduleIn: (attempts) => { failAtAttempt = scheduleAttempts + attempts; } };
}

test("favorites persist across launches and match separate airings by normalized title", async () => {
  const f = fixture();
  await f.store.initialize();
  await f.store.toggleFavorite(" Evening   Show ");
  assert.equal(f.store.getSnapshot().favorites[0].key, favoriteProgramKey(event("another-airing").title));
  const reopened = fixture({ raw: JSON.stringify(f.saved()) });
  await reopened.store.initialize();
  assert.equal(reopened.store.getSnapshot().favorites.length, 1);
  await reopened.store.toggleFavorite("EVENING SHOW");
  assert.deepEqual(reopened.store.getSnapshot().favorites, []);
});

test("hydration and rapid changes are serialized without losing saved favorites", async () => {
  const f = fixture({ raw: JSON.stringify({ favorites: [{ title: "Saved", key: "saved" }], reminders: [], minutesBefore: 10 }) });
  await Promise.all([f.store.initialize(), f.store.toggleFavorite("New"), f.store.toggleFavorite("Third")]);
  assert.equal(f.store.getSnapshot().favorites.length, 3);
  assert.equal(f.saved().minutesBefore, 10);
});

test("unreadable storage is not overwritten and mutations remain disabled", async () => {
  const f = fixture({ raw: "invalid JSON" });
  await assert.rejects(f.store.initialize());
  assert.equal(f.store.getSnapshot().ready, false);
  await assert.rejects(f.store.toggleFavorite("New"), /still loading/);
});

test("enabling reminders schedules every matching title, replaces their lead time, and cancels the whole program", async () => {
  const f = fixture();
  await f.store.initialize();
  await f.store.updateSchedule([
    event(), event("another-airing", { title: " EVENING   SHOW ", start: "2026-11-04T19:00:00Z", end: "2026-11-04T20:00:00Z" }),
    event("different", { title: "Another Show" }),
  ]);
  await Promise.all([f.store.setReminder(event(), 5), f.store.setReminder(event(), 10)]);
  assert.equal(f.os.size, 2);
  assert.equal(f.saved().programReminders.length, 1);
  assert.ok(f.saved().reminders.every((item) => item.minutesBefore === 10));
  assert.equal(reminderTimestamp(f.saved().reminders[0]), Date.parse(event().start) - 600_000);
  await f.store.setMinutesBefore(15);
  assert.equal(f.saved().reminders[0].minutesBefore, 10);
  await f.store.cancelReminder("evening show");
  assert.equal(f.os.size, 0);
  assert.equal(f.saved().reminders.length, 0);
  assert.equal(f.saved().programReminders.length, 0);
});

test("all-day entries and invalid lead times never prompt or schedule", async () => {
  const f = fixture();
  await f.store.initialize();
  for (const [show, minutes] of [
    [event("all-day", { start: "2026-11-03", end: "2026-11-04", isAllDay: true }), 5],
    [event(), 0],
  ]) await assert.rejects(f.store.setReminder(show, minutes));
  assert.ok(!f.calls.includes("permission") && !f.calls.includes("schedule"));
  assert.equal(f.os.size, 0);
});

test("past and too-soon airings are skipped while future timed airings get reminders", async () => {
  const f = fixture();
  await f.store.initialize();
  const shows = [event(),
    event("past", { start: "2026-11-03T17:00:00Z", end: "2026-11-03T17:30:00Z" }),
    event("soon", { start: "2026-11-03T18:05:00Z" }),
    event("all-day", { start: "2026-11-03", end: "2026-11-04", isAllDay: true }),
  ];
  await f.store.updateSchedule(shows);
  await f.store.setReminder(shows[2], 5);
  assert.deepEqual([...f.os.values()].map((item) => item.event.id), ["show-1"]);
  assert.equal(f.saved().programReminders.length, 1);
});

test("successful schedule updates add airings, reschedule changed times, and remove cancelled or renamed ones", async () => {
  const f = fixture();
  await f.store.initialize();
  await f.store.updateSchedule([event(), event("cancelled"), event("renamed")]);
  await f.store.setReminder(event(), 5);
  const moved = event("show-1", { start: "2026-11-03T21:00:00Z", end: "2026-11-03T22:00:00Z" });
  await f.store.updateSchedule([moved, event("new"), event("renamed", { title: "Different Show" })]);
  assert.deepEqual([...f.os.values()].map((item) => item.event.id).sort(), ["new", "show-1"]);
  assert.equal(f.os.get(reminderNotificationId("show-1")).event.start, moved.start);
  assert.equal(f.saved().programReminders.length, 1);
  await f.store.cancelReminder(event().title);
  await f.store.updateSchedule([moved, event("another-new")]);
  assert.equal(f.os.size, 0);
  assert.deepEqual(f.saved().programReminders, []);
});

test("a title stays enabled across an empty schedule and cold launch, then queues new airings without prompting", async () => {
  const f = fixture();
  await f.store.initialize();
  await f.store.setReminder(event(), 10);
  await f.store.updateSchedule([]);
  assert.equal(f.os.size, 0);
  assert.equal(f.saved().programReminders.length, 1);
  const reopened = fixture({ raw: JSON.stringify(f.saved()) });
  await reopened.store.initialize();
  await reopened.store.updateSchedule([event("new-season")]);
  assert.equal(reopened.os.size, 1);
  assert.equal(reopened.saved().reminders[0].minutesBefore, 10);
  assert.ok(!reopened.calls.includes("permission"));
  await reopened.store.setProgramMinutesBefore("EVENING SHOW", 15);
  assert.equal(reopened.saved().reminders[0].minutesBefore, 15);
});

test("legacy per-airing reminders migrate to a persistent title setting using the earliest lead time", async () => {
  const first = reminder(event(), 10);
  const second = reminder(event("second", { start: "2026-11-04T19:00:00Z", end: "2026-11-04T20:00:00Z" }), 5);
  const f = fixture({ raw: JSON.stringify({ favorites: [], reminders: [second, first], minutesBefore: 5 }), pending: [first, second] });
  await f.store.initialize();
  assert.deepEqual(f.saved().programReminders, [{ key: "evening show", title: "Evening Show", minutesBefore: 10 }]);
  assert.ok([...f.os.values()].every((item) => item.minutesBefore === 10));
  await f.store.updateSchedule([event(), second.event, event("third")]);
  assert.equal(f.os.size, 3);
  assert.ok([...f.os.values()].every((item) => item.minutesBefore === 10));
});

test("an explicitly disabled title is never resurrected from an orphaned OS request", async () => {
  const f = fixture({ raw: JSON.stringify({ favorites: [], programReminders: [], reminders: [], minutesBefore: 5 }), pending: [reminder()] });
  await f.store.initialize();
  assert.equal(f.os.size, 0);
  assert.deepEqual(f.store.getSnapshot().programReminders, []);
});

test("a partial multi-airing failure restores every previous lead time and the saved program setting", async () => {
  const f = fixture();
  await f.store.initialize();
  await f.store.updateSchedule([event(), event("second")]);
  await f.store.setReminder(event(), 5);
  f.failScheduleIn(2);
  await assert.rejects(f.store.setProgramMinutesBefore(event().title, 15), /Schedule failed/);
  assert.equal(f.os.size, 2);
  assert.ok([...f.os.values()].every((item) => item.minutesBefore === 5));
  assert.equal(f.saved().programReminders[0].minutesBefore, 5);
  await f.store.setProgramMinutesBefore(event().title, 10);
  assert.ok([...f.os.values()].every((item) => item.minutesBefore === 10));
});

test("permission denial leaves reminder state untouched", async () => {
  const f = fixture();
  await f.store.initialize();
  f.deny();
  await assert.rejects(f.store.setReminder(event(), 5), /disabled/);
  assert.equal(f.os.size, 0);
  assert.equal(f.store.getSnapshot().reminders.length, 0);
});

test("native scheduling and cancellation failures do not report a successful change", async () => {
  const f = fixture();
  await f.store.initialize();
  f.failSchedule(true);
  await assert.rejects(f.store.setReminder(event(), 5), /Schedule failed/);
  assert.equal(f.store.getSnapshot().programReminders.length, 0);
  f.failSchedule(false);
  await f.store.setReminder(event(), 5);
  f.failCancel(true);
  await assert.rejects(f.store.cancelReminder(event().title), /Cancellation failed/);
  assert.equal(f.store.getSnapshot().reminders.length, 1);
  assert.equal(f.store.getSnapshot().programReminders.length, 1);
});

test("the next 50 airings are queued and later ones are added as earlier ones are delivered", async () => {
  const f = fixture();
  await f.store.initialize();
  const events = Array.from({ length: 55 }, (_, index) => event(`airing-${index}`, {
    start: new Date(NOW + (index + 1) * 3_600_000).toISOString(),
    end: new Date(NOW + (index + 2) * 3_600_000).toISOString(),
  }));
  await f.store.updateSchedule(events);
  await f.store.setReminder(events[0], 5);
  assert.equal(f.os.size, 50);
  assert.ok(!f.os.has(reminderNotificationId("airing-50")));
  f.os.delete(reminderNotificationId("airing-0"));
  f.setNow(Date.parse(events[0].start));
  await f.store.initialize();
  assert.equal(f.os.size, 50);
  assert.ok(f.os.has(reminderNotificationId("airing-50")));
  assert.ok(!f.os.has(reminderNotificationId("airing-0")));
});

test("reminder time is rechecked after a slow permissions prompt", async () => {
  let now = NOW;
  let schedules = 0;
  const store = new ShowRemindersStore({
    clock: () => now,
    storage: { getItem: async () => null, setItem: async () => undefined },
    notifications: { supported: true, list: async () => [], cancel: async () => undefined,
      requestPermission: async () => { now = Date.parse(event().start); },
      schedule: async () => { schedules += 1; } },
  });
  await store.initialize();
  await store.setReminder(event(), 5);
  assert.equal(schedules, 0);
  assert.equal(store.getSnapshot().programReminders.length, 1);
});

test("failed storage rolls back a new reminder and restores an existing reminder", async () => {
  const f = fixture();
  await f.store.initialize();
  f.failWrite(true);
  await assert.rejects(f.store.setReminder(event(), 5), /Disk unavailable/);
  assert.equal(f.os.size, 0);
  f.failWrite(false);
  await f.store.setReminder(event(), 5);
  f.failWrite(true);
  await assert.rejects(f.store.setReminder(event(), 15), /Disk unavailable/);
  assert.equal([...f.os.values()][0].minutesBefore, 5);
  assert.equal(f.store.getSnapshot().reminders[0].minutesBefore, 5);
});

test("OS reconciliation recovers pending reminders and drops cancelled or delivered ones", async () => {
  const pending = reminder(event("pending"));
  const delivered = reminder(event("delivered"));
  const f = fixture({ raw: JSON.stringify({ favorites: [], reminders: [delivered], minutesBefore: 5 }), pending: [pending] });
  await f.store.initialize();
  assert.deepEqual(f.store.getSnapshot().reminders, [pending]);
  f.os.clear();
  await f.store.initialize();
  assert.deepEqual(f.saved().reminders, []);
});

test("a failed cancellation save restores every queued airing and the program setting", async () => {
  const f = fixture();
  await f.store.initialize();
  await f.store.setReminder(event(), 5);
  f.failWrite(true);
  await assert.rejects(f.store.cancelReminder(event().title));
  assert.equal(f.os.size, 1);
  assert.equal(f.store.getSnapshot().programReminders.length, 1);
  f.failWrite(false);
  await f.store.cancelReminder(event().title);
  assert.deepEqual(f.saved().reminders, []);
});

test("overdue reminders still queued by the OS remain available to cancel", async () => {
  const pending = reminder();
  const f = fixture({ pending: [pending] });
  f.setNow(Date.parse(pending.event.start) + 60_000);
  await f.store.initialize();
  assert.equal(f.store.getSnapshot().reminders.length, 1);
  await f.store.cancelReminder(pending.event.title);
  assert.equal(f.os.size, 0);
});

test("web supports favorites without invoking native notifications", async () => {
  const f = fixture({ supported: false });
  await f.store.initialize();
  await f.store.toggleFavorite("Favorite");
  await assert.rejects(f.store.setReminder(event(), 5), /iOS and Android/);
  assert.deepEqual(f.calls, []);
});

test("timestamps use absolute instants across DST and notification entries validate defensively", () => {
  const show = event("dst", { start: "2026-11-01T01:05:00-06:00", end: "2026-11-01T02:05:00-06:00" });
  assert.equal(reminderTimestamp(reminder(show, 10)), Date.parse("2026-11-01T06:55:00Z"));
  assert.deepEqual(parseScheduleEntryParam(JSON.stringify(show)), show);
  for (const value of ["broken", "null", "{}", JSON.stringify({ ...show, start: "local time" }),
    JSON.stringify({ ...show, isAllDay: true, start: "2026-02-30", end: "2026-03-02" })]) {
    assert.equal(parseScheduleEntryParam(value), null);
  }
});

test("native adapter creates Android channel before prompting, handles iOS provisional access and denial", async () => {
  native.calls = [];
  native.granted = false;
  native.canAskAgain = true;
  await assert.rejects(reminderNotifications.requestPermission(), /notification settings/);
  assert.deepEqual(native.calls.map(([name]) => name), ["channel", "permission", "prompt"]);
  native.calls = [];
  native.canAskAgain = false;
  await assert.rejects(reminderNotifications.requestPermission());
  assert.deepEqual(native.calls.map(([name]) => name), ["channel", "permission"]);
  const { Platform } = await importTemp("native.mjs");
  Platform.OS = "ios";
  native.iosStatus = 3;
  native.calls = [];
  await reminderNotifications.requestPermission();
  assert.deepEqual(native.calls.map(([name]) => name), ["permission"]);
});

test("native scheduling uses a dated one-off trigger with an offline entry; unrelated requests are ignored", async () => {
  native.calls = [];
  const item = reminder();
  await reminderNotifications.schedule(item);
  const request = native.calls[0][1];
  assert.equal(request.content.body, "Starts in 5 minutes on WLFM. Tap to listen.");
  assert.equal(request.trigger.type, "date");
  assert.equal(request.trigger.date.getTime(), reminderTimestamp(item));
  assert.equal(request.trigger.repeats, undefined);
  assert.deepEqual(request.content.data.reminder.event, event());
  native.requests = [
    { identifier: item.notificationId, content: { data: request.content.data } },
    { identifier: "other", content: { data: request.content.data } },
    { identifier: "other", content: { data: { type: "unrelated" } } },
  ];
  assert.deepEqual(await reminderNotifications.list(), [item]);
  assert.deepEqual(await native.handler.handleNotification(), {
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  });
});

test("foreground delivery refreshes reminders without reacting to unrelated notifications or leaking listeners", () => {
  let refreshes = 0;
  const stop = reminderNotifications.subscribeReceived(() => { refreshes += 1; });
  const listener = [...native.received][0];
  listener({ request: { content: { data: { type: "unrelated" } } } });
  assert.equal(refreshes, 0);
  listener({ request: { content: { data: { type: "show-reminder" } } } });
  assert.equal(refreshes, 1);
  stop();
  assert.equal(native.received.size, 0);
});

test("cold and warm notification taps open the radio player once and clean up", async () => {
  const { navigation, pushes } = await importTemp("router.mjs");
  const { effects } = await importTemp("react.mjs");
  const response = (item, date) => ({ actionIdentifier: "default", notification: {
    date, request: { identifier: item.notificationId, content: { data: { type: "show-reminder", reminder: item } } },
  } });
  const first = response(reminder(), 1);
  native.initial = first;
  useReminderNavigation();
  effects.pop()();
  assert.equal(pushes.length, 0);
  navigation.key = "mounted";
  useReminderNavigation();
  const cleanup = effects.pop()();
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0], { pathname: "/(tabs)" });
  assert.equal(native.initial, null);
  const listener = [...native.responses][0];
  listener(first);
  assert.equal(pushes.length, 1);
  listener(response(reminder(event("second")), 2));
  assert.equal(pushes.length, 2);
  assert.deepEqual(pushes[1], { pathname: "/(tabs)" });
  listener({ ...first, actionIdentifier: "dismiss" });
  listener(response({ ...reminder(), event: { id: "malformed" } }, 3));
  assert.equal(pushes.length, 2);
  cleanup();
  assert.equal(native.responses.size, 0);
});
