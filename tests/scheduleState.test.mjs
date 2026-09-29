import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = await mkdtemp(join(tmpdir(), "wlfm-schedule-state-tests-"));
after(() => rm(temp, { recursive: true, force: true }));

const source = await readFile(new URL("../src/services/scheduleState.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replace('"../config/calendar"', '"./calendar.mjs"')
  .replace('"./googleCalendar"', '"./googleCalendar.mjs"');

await Promise.all([
  writeFile(join(temp, "scheduleState.mjs"), compiled),
  writeFile(join(temp, "calendar.mjs"), `
    export class CalendarConfigurationError extends Error {
      constructor(message) { super(message); this.name = "CalendarConfigurationError"; this.code = "configuration"; }
    }
  `),
  writeFile(join(temp, "googleCalendar.mjs"), `
    export class GoogleCalendarError extends Error {
      constructor(code, message, status = null) { super(message); this.name = "GoogleCalendarError"; this.code = code; this.status = status; }
    }
    export async function getUpcomingEvents() { return []; }
  `),
]);

const {
  ScheduleStore,
  SCHEDULE_FRESHNESS_MS,
} = await import(pathToFileURL(join(temp, "scheduleState.mjs")).href);
const { CalendarConfigurationError } = await import(pathToFileURL(join(temp, "calendar.mjs")).href);
const { GoogleCalendarError } = await import(pathToFileURL(join(temp, "googleCalendar.mjs")).href);

const event = (id) => ({
  id,
  title: id,
  description: null,
  location: null,
  start: "2026-09-22T19:00:00-05:00",
  end: "2026-09-22T20:00:00-05:00",
  isAllDay: false,
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const turn = () => new Promise((resolve) => setImmediate(resolve));

test("focus loads once, stays quiet while fresh, and reloads at five minutes", async () => {
  let now = 1_000;
  let calls = 0;
  const store = new ScheduleStore({
    clock: () => now,
    loadEvents: async () => { calls += 1; return [event(`event-${calls}`)]; },
  });

  await store.refreshIfStale();
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().events[0].id, "event-1");

  now += SCHEDULE_FRESHNESS_MS - 1;
  await store.refreshIfStale();
  assert.equal(calls, 1);

  now += 1;
  await store.refreshIfStale();
  assert.equal(calls, 2);
  assert.equal(store.getSnapshot().events[0].id, "event-2");
});

test("overlapping focus, pull-to-refresh, and Retry requests share one request", async () => {
  const pending = deferred();
  let calls = 0;
  const store = new ScheduleStore({
    loadEvents: ({ signal }) => {
      calls += 1;
      assert.equal(signal.aborted, false);
      return pending.promise;
    },
  });

  const requests = [store.refreshIfStale(), store.refresh(), store.retry(), store.retry()];
  await turn();
  assert.equal(calls, 1);
  pending.resolve([event("only")]);
  await Promise.all(requests);
  assert.equal(store.getSnapshot().events[0].id, "only");
});

test("cleanup aborts active work and does not publish after cancellation", async () => {
  const pending = deferred();
  let requestSignal;
  const store = new ScheduleStore({
    loadEvents: ({ signal }) => {
      requestSignal = signal;
      return pending.promise;
    },
  });

  const request = store.refreshIfStale();
  await turn();
  store.cancel();
  assert.equal(requestSignal.aborted, true);
  pending.resolve([event("late")]);
  await request;
  assert.deepEqual(store.getSnapshot().events, []);
  assert.equal(store.getSnapshot().status, "loading");
});

test("a cancelled stale response cannot overwrite a newer successful response", async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const store = new ScheduleStore({
    loadEvents: () => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    },
  });

  const staleRequest = store.refreshIfStale();
  await turn();
  store.cancel();
  const currentRequest = store.refresh();
  await turn();
  second.resolve([event("current")]);
  await currentRequest;
  first.resolve([event("stale")]);
  await staleRequest;
  assert.equal(store.getSnapshot().events[0].id, "current");
});

test("refresh failure retains the previous schedule and exposes a safe warning", async () => {
  let calls = 0;
  const store = new ScheduleStore({
    loadEvents: async () => {
      calls += 1;
      if (calls === 1) return [event("cached")];
      throw new GoogleCalendarError("network", "socket details");
    },
  });

  await store.refreshIfStale();
  await store.refresh();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.events[0].id, "cached");
  assert.equal(snapshot.error.kind, "offline");
  assert.equal(snapshot.isRefreshing, false);
});

test("an empty successful schedule remains a cached result during refresh failure", async () => {
  const pending = deferred();
  let calls = 0;
  const store = new ScheduleStore({
    loadEvents: () => {
      calls += 1;
      if (calls === 1) return Promise.resolve([]);
      return pending.promise;
    },
  });

  await store.refreshIfStale();
  assert.equal(store.getSnapshot().status, "ready");
  const refresh = store.refresh();
  assert.equal(store.getSnapshot().isRefreshing, true);
  pending.reject(new GoogleCalendarError("network", "offline"));
  await refresh;
  assert.equal(store.getSnapshot().status, "ready");
  assert.deepEqual(store.getSnapshot().events, []);
  assert.equal(store.getSnapshot().error.kind, "offline");
});

test("clean-launch network failure has no fabricated or cached schedule", async () => {
  const store = new ScheduleStore({
    loadEvents: async () => { throw new GoogleCalendarError("network", "offline"); },
  });
  await store.refreshIfStale();
  assert.equal(store.getSnapshot().status, "error");
  assert.deepEqual(store.getSnapshot().events, []);
  assert.equal(store.getSnapshot().error.kind, "offline");
});

test("missing configuration maps to setup guidance without exposing details", async () => {
  const secret = "sensitive-test-api-key";
  const store = new ScheduleStore({
    loadEvents: async () => { throw new CalendarConfigurationError(`missing ${secret}`); },
  });
  await store.refreshIfStale();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.error.kind, "configuration");
  assert.equal(JSON.stringify(snapshot).includes(secret), false);
});

test("HTTP failures never copy API-key-bearing technical messages into UI state", async () => {
  const secret = "sensitive-test-api-key";
  const store = new ScheduleStore({
    loadEvents: async () => { throw new GoogleCalendarError("http", `request with ${secret} failed`, 403); },
  });
  await store.refreshIfStale();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.error.kind, "unavailable");
  assert.equal(JSON.stringify(snapshot).includes(secret), false);
});

test("moving the wall clock backwards invalidates the cache", async () => {
  let now = 20_000;
  let calls = 0;
  const store = new ScheduleStore({
    clock: () => now,
    loadEvents: async () => { calls += 1; return [event(String(calls))]; },
  });
  await store.refreshIfStale();
  now = 10_000;
  await store.refreshIfStale();
  assert.equal(calls, 2);
});
