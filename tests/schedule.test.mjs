import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = await mkdtemp(join(tmpdir(), "wlfm-schedule-tests-"));
after(() => rm(temp, { recursive: true, force: true }));
for (const [source, output] of [
  ["../src/config/calendar.ts", "calendar.mjs"],
  ["../src/services/schedule.ts", "schedule.mjs"],
]) {
  const input = await readFile(new URL(source, import.meta.url), "utf8");
  const compiled = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace('"../config/calendar"', '"./calendar.mjs"');
  await writeFile(join(temp, output), compiled);
}

const {
  buildScheduleSections,
  formatEventTime,
  formatScheduleDate,
  getCurrentEvent,
  getNextEvent,
  getStationDateKey,
} = await import(pathToFileURL(join(temp, "schedule.mjs")).href);

function timed(id, start, end, title = id) {
  return { id, title, description: null, location: null, start, end, isAllDay: false };
}

function allDay(id, start, end, title = id) {
  return { id, title, description: null, location: null, start, end, isAllDay: true };
}

test("timed events group by America/Chicago date instead of device or UTC date", () => {
  const chicagoEvening = timed("evening", "2026-09-23T00:30:00Z", "2026-09-23T01:30:00Z");
  const chicagoMorning = timed("morning", "2026-09-23T05:30:00Z", "2026-09-23T06:30:00Z");
  assert.equal(getStationDateKey(chicagoEvening), "2026-09-22");
  assert.equal(getStationDateKey(chicagoMorning), "2026-09-23");
  assert.deepEqual(buildScheduleSections([chicagoMorning, chicagoEvening]).map(({ date }) => date), [
    "2026-09-22",
    "2026-09-23",
  ]);
});

test("Intl handles the America/Chicago spring daylight-saving boundary", () => {
  const event = timed("spring-forward", "2026-03-08T07:30:00Z", "2026-03-08T08:30:00Z");
  assert.equal(getStationDateKey(event), "2026-03-08");
  assert.deepEqual(formatEventTime(event), {
    display: "1:30 AM – 3:30 AM",
    accessibilityLabel: "1:30 AM CST to 3:30 AM CDT",
  });
});

test("current event uses the exact start-inclusive and end-exclusive boundary", () => {
  const event = timed("show", "2026-09-22T19:00:00-05:00", "2026-09-22T20:00:00-05:00");
  assert.equal(getCurrentEvent([event], new Date("2026-09-23T00:00:00Z"))?.id, "show");
  assert.equal(getCurrentEvent([event], new Date("2026-09-23T00:59:59.999Z"))?.id, "show");
  assert.equal(getCurrentEvent([event], new Date("2026-09-23T01:00:00Z")), null);
});

test("next event is the earliest future timed program and is never fabricated", () => {
  const earlier = timed("earlier", "2026-09-22T19:00:00-05:00", "2026-09-22T20:00:00-05:00");
  const later = timed("later", "2026-09-22T21:00:00-05:00", "2026-09-22T22:00:00-05:00");
  assert.equal(getNextEvent([later, earlier], new Date("2026-09-22T23:00:00Z"))?.id, "earlier");
  assert.equal(getNextEvent([earlier, later], new Date("2026-09-23T03:00:00Z")), null);
});

test("all-day entries keep their calendar date and are not inferred as broadcasts", () => {
  const event = allDay("info", "2026-09-22", "2026-09-24", "Station information");
  assert.equal(getStationDateKey(event), "2026-09-22");
  assert.deepEqual(formatEventTime(event), { display: "All day", accessibilityLabel: "All-day event" });
  assert.equal(getCurrentEvent([event], new Date("2026-09-23T12:00:00Z")), null);
  assert.equal(getNextEvent([event], new Date("2026-09-21T12:00:00Z")), null);
});

test("sections are date ordered with all-day entries before timed programs", () => {
  const show = timed("show", "2026-09-22T19:00:00-05:00", "2026-09-22T20:00:00-05:00");
  const notice = allDay("notice", "2026-09-22", "2026-09-23");
  const sections = buildScheduleSections([show, notice]);
  assert.equal(sections[0].title, "Tuesday, September 22");
  assert.deepEqual(sections[0].data.map(({ id }) => id), ["notice", "show"]);
  assert.equal(formatScheduleDate("2026-12-31"), "Thursday, December 31");
});

test("overlapping broadcasts choose the earliest-starting active event deterministically", () => {
  const first = timed("first", "2026-09-22T19:00:00-05:00", "2026-09-22T21:00:00-05:00");
  const second = timed("second", "2026-09-22T20:00:00-05:00", "2026-09-22T22:00:00-05:00");
  assert.equal(getCurrentEvent([second, first], new Date("2026-09-23T01:30:00Z"))?.id, "first");
});
