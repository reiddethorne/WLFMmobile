import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = await mkdtemp(join(tmpdir(), "wlfm-calendar-tests-"));
after(() => rm(temp, { recursive: true, force: true }));
for (const [source, output] of [
  ["../src/config/calendar.ts", "calendar.mjs"],
  ["../src/services/googleCalendar.ts", "googleCalendar.mjs"],
]) {
  const input = await readFile(new URL(source, import.meta.url), "utf8");
  const compiled = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace('"../config/calendar"', '"./calendar.mjs"');
  await writeFile(join(temp, output), compiled);
}

const {
  CalendarConfigurationError,
  STATION_TIME_ZONE,
  SCHEDULE_WINDOW_DAYS,
} = await import(pathToFileURL(join(temp, "calendar.mjs")).href);
const {
  GoogleCalendarError,
  getSchedule,
  getUpcomingEvents,
  parseCalendarEvent,
} = await import(pathToFileURL(join(temp, "googleCalendar.mjs")).href);
const fixture = JSON.parse(await readFile(new URL("./fixtures/google-calendar-events.json", import.meta.url), "utf8"));
const [timedFixture, recurringFixture] = fixture.items;
const originalFetch = globalThis.fetch;

async function withCalendarEnv(action, values = {}) {
  const originalId = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ID;
  const originalKey = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY;
  if (values.id === null) delete process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ID = values.id ?? "calendar+test@group.calendar.google.com";
  if (values.key === null) delete process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY;
  else process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY = values.key ?? "test-api-key";
  try {
    await action();
  } finally {
    if (originalId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ID = originalId;
    if (originalKey === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY;
    else process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY = originalKey;
  }
}

async function mockFetch(mock, action) {
  globalThis.fetch = mock;
  try {
    await withCalendarEnv(action);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function isCalendarError(code) {
  return (error) => error instanceof GoogleCalendarError && error.code === code;
}

test("observed timed event becomes the app-owned shape", () => {
  assert.deepEqual(parseCalendarEvent(timedFixture), {
    id: "sanitized-one-off-id",
    title: "DRIED FRUIT LIVE",
    description: null,
    location: null,
    start: "2026-09-22T19:00:00-05:00",
    end: "2026-09-22T20:00:00-05:00",
    isAllDay: false,
  });
});

test("missing optional description and location remain null", () => {
  const event = parseCalendarEvent({ ...timedFixture, description: undefined, location: undefined });
  assert.equal(event.description, null);
  assert.equal(event.location, null);
});

test("blank or missing summaries use the deliberate fallback", () => {
  for (const summary of [undefined, null, "   ", 42]) {
    assert.equal(parseCalendarEvent({ ...timedFixture, summary }).title, "Untitled program");
  }
});

test("all-day dates stay date-only and preserve Google's exclusive end", () => {
  const event = parseCalendarEvent({
    id: "all-day",
    status: "confirmed",
    summary: "Station event",
    start: { date: "2026-10-03" },
    end: { date: "2026-10-05" },
  });
  assert.deepEqual(event, {
    id: "all-day",
    title: "Station event",
    description: null,
    location: null,
    start: "2026-10-03",
    end: "2026-10-05",
    isAllDay: true,
  });
});

test("observed recurring instance is parsed without client-side recurrence expansion", () => {
  const event = parseCalendarEvent(recurringFixture);
  assert.equal(event.id, "sanitized-recurring-instance-id");
  assert.equal(event.start, recurringFixture.start.dateTime);
  assert.equal(event.end, recurringFixture.end.dateTime);
});

test("cancelled events are excluded even when deleted instances omit times", () => {
  assert.equal(parseCalendarEvent({ id: "deleted-instance", status: "cancelled" }), null);
});

test("invalid dates and non-positive ranges are rejected", () => {
  for (const event of [
    { ...timedFixture, start: { dateTime: "not-a-date" } },
    { ...timedFixture, start: { dateTime: "2026-02-30T19:00:00-06:00" } },
    { ...timedFixture, end: { dateTime: timedFixture.start.dateTime } },
    { ...timedFixture, start: { date: "2026-02-30" }, end: { date: "2026-03-01" } },
    { ...timedFixture, start: { date: "2026-10-03" }, end: { date: "2026-10-03" } },
  ]) {
    assert.throws(() => parseCalendarEvent(event), isCalendarError("invalid-response"));
  }
});

test("missing or mismatched start and end values are rejected", () => {
  for (const event of [
    { ...timedFixture, start: undefined },
    { ...timedFixture, end: undefined },
    { ...timedFixture, end: {} },
    { ...timedFixture, end: { date: "2026-09-23" } },
  ]) {
    assert.throws(() => parseCalendarEvent(event), isCalendarError("invalid-response"));
  }
});

test("request uses the documented window, expansion, order, timezone, and API-key header", async () => {
  const timeMin = new Date("2026-09-22T12:00:00.000Z");
  const timeMax = new Date("2026-10-06T12:00:00.000Z");
  await mockFetch(async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/calendar/v3/calendars/calendar%2Btest%40group.calendar.google.com/events");
    assert.equal(url.searchParams.get("timeMin"), timeMin.toISOString());
    assert.equal(url.searchParams.get("timeMax"), timeMax.toISOString());
    assert.equal(url.searchParams.get("timeZone"), STATION_TIME_ZONE);
    assert.equal(url.searchParams.get("singleEvents"), "true");
    assert.equal(url.searchParams.get("orderBy"), "startTime");
    assert.equal(url.searchParams.get("showDeleted"), "false");
    assert.equal(url.searchParams.get("maxResults"), "2500");
    assert.equal(url.searchParams.has("key"), false);
    assert.equal(options.headers["x-goog-api-key"], "test-api-key");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(fixture);
  }, async () => {
    const events = await getSchedule({ timeMin, timeMax });
    assert.equal(events.length, 2);
  });
});

test("malformed top-level responses and event collections are rejected", async () => {
  for (const body of [null, [], {}, { items: null }, { items: {} }]) {
    await mockFetch(async () => Response.json(body), async () => {
      await assert.rejects(
        getSchedule({ timeMin: new Date("2026-09-22T00:00:00Z"), timeMax: new Date("2026-09-23T00:00:00Z") }),
        isCalendarError("invalid-response"),
      );
    });
  }
});

test("HTTP, unreadable JSON, and network failures remain distinct", async () => {
  const cases = [
    [async () => new Response("denied", { status: 403 }), "http"],
    [async () => new Response("<html>not json</html>"), "invalid-response"],
    [async () => { throw new TypeError("offline"); }, "network"],
  ];
  for (const [mock, code] of cases) {
    await mockFetch(mock, async () => {
      await assert.rejects(
        getSchedule({ timeMin: new Date("2026-09-22T00:00:00Z"), timeMax: new Date("2026-09-23T00:00:00Z") }),
        isCalendarError(code),
      );
    });
  }
});

test("timeout aborts the full request and remains distinct", async () => {
  await mockFetch((_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), async () => {
    await assert.rejects(
      getSchedule({
        timeMin: new Date("2026-09-22T00:00:00Z"),
        timeMax: new Date("2026-09-23T00:00:00Z"),
        timeoutMs: 5,
      }),
      isCalendarError("timeout"),
    );
  });
});

test("caller cancellation is distinct and already-cancelled requests never fetch", async () => {
  const controller = new AbortController();
  controller.abort();
  await mockFetch(() => assert.fail("fetch must not run"), async () => {
    await assert.rejects(
      getSchedule({
        timeMin: new Date("2026-09-22T00:00:00Z"),
        timeMax: new Date("2026-09-23T00:00:00Z"),
        signal: controller.signal,
      }),
      isCalendarError("aborted"),
    );
  });
});

test("caller cancellation aborts an in-flight request", async () => {
  const controller = new AbortController();
  await mockFetch((_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), async () => {
    const result = getSchedule({
      timeMin: new Date("2026-09-22T00:00:00Z"),
      timeMax: new Date("2026-09-23T00:00:00Z"),
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(result, isCalendarError("aborted"));
  });
});

test("pagination follows every nextPageToken without truncation", async () => {
  const requestedTokens = [];
  await mockFetch(async (input) => {
    const token = new URL(input).searchParams.get("pageToken");
    requestedTokens.push(token);
    if (token === null) return Response.json({ items: [timedFixture], nextPageToken: "page-two" });
    assert.equal(token, "page-two");
    return Response.json({ items: [recurringFixture] });
  }, async () => {
    const events = await getSchedule({
      timeMin: new Date("2026-09-22T00:00:00Z"),
      timeMax: new Date("2026-10-06T00:00:00Z"),
    });
    assert.deepEqual(requestedTokens, [null, "page-two"]);
    assert.deepEqual(events.map(({ id }) => id), ["sanitized-one-off-id", "sanitized-recurring-instance-id"]);
  });
});

test("invalid or repeated page tokens are rejected", async () => {
  for (const secondToken of ["", 42]) {
    await mockFetch(async () => Response.json({ items: [], nextPageToken: secondToken }), async () => {
      await assert.rejects(
        getSchedule({ timeMin: new Date("2026-09-22T00:00:00Z"), timeMax: new Date("2026-09-23T00:00:00Z") }),
        isCalendarError("invalid-response"),
      );
    });
  }

  await mockFetch(async () => Response.json({ items: [], nextPageToken: "same-token" }), async () => {
    await assert.rejects(
      getSchedule({ timeMin: new Date("2026-09-22T00:00:00Z"), timeMax: new Date("2026-09-23T00:00:00Z") }),
      isCalendarError("invalid-response"),
    );
  });
});

test("missing configuration fails before accessing the network", async () => {
  globalThis.fetch = () => assert.fail("fetch must not run");
  try {
    await withCalendarEnv(async () => {
      await assert.rejects(
        getUpcomingEvents(),
        (error) => error instanceof CalendarConfigurationError && error.code === "configuration",
      );
    }, { id: null, key: null });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("upcoming window uses the centralized 14-day default", async () => {
  const now = new Date("2026-09-22T17:00:00.000Z");
  await mockFetch(async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("timeMin"), now.toISOString());
    assert.equal(
      url.searchParams.get("timeMax"),
      new Date(now.getTime() + SCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
    return Response.json({ items: [] });
  }, async () => {
    assert.deepEqual(await getUpcomingEvents({ now }), []);
  });
});

test("API keys never appear in request URLs or errors", async () => {
  const secret = "sensitive-test-api-key";
  globalThis.fetch = async (input) => {
    assert.equal(String(input).includes(secret), false);
    return new Response("denied", { status: 403 });
  };
  try {
    await withCalendarEnv(async () => {
      await assert.rejects(
        getSchedule({ timeMin: new Date("2026-09-22T00:00:00Z"), timeMax: new Date("2026-09-23T00:00:00Z") }),
        (error) => error instanceof GoogleCalendarError && error.code === "http" && !error.message.includes(secret),
      );
    }, { key: secret });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live public calendar endpoint", { skip: process.env.GOOGLE_CALENDAR_LIVE_CHECK !== "1" }, async () => {
  const events = await getUpcomingEvents();
  assert.ok(Array.isArray(events));
  for (const event of events) {
    assert.equal(typeof event.id, "string");
    assert.equal(typeof event.title, "string");
  }
});
