import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Run the actual TypeScript service with the existing compiler; no test dependency.
const temp = await mkdtemp(join(tmpdir(), "wlfm-live365-tests-"));
after(() => rm(temp, { recursive: true, force: true }));
for (const [source, output] of [
  ["../src/config/station.ts", "station.mjs"],
  ["../src/services/live365.ts", "live365.mjs"],
]) {
  const input = await readFile(new URL(source, import.meta.url), "utf8");
  const compiled = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace('"../config/station"', '"./station.mjs"');
  await writeFile(join(temp, output), compiled);
}
const { parseStationInfo, getStationInfo, getStreamUrl, getNowPlaying, Live365Error } =
  await import(pathToFileURL(join(temp, "live365.mjs")).href);
const fixture = JSON.parse(await readFile(new URL("./fixtures/live365-a98536.json", import.meta.url), "utf8"));
const originalFetch = globalThis.fetch;

async function mockFetch(mock, action) {
  globalThis.fetch = mock;
  try { await action(); } finally { globalThis.fetch = originalFetch; }
}

test("observed WLFM response prefers MP3 even when AAC is listed first", () => {
  const parsed = parseStationInfo({ ...fixture, "listening-urls": [...fixture["listening-urls"]].reverse() });
  assert.equal(parsed.name, "WLFM");
  assert.equal(parsed.preferredStream.url, "https://streaming.live365.com/a98536");
  assert.equal(parsed.preferredStream.mimeType, "audio/mpeg");
  assert.equal(parsed.preferredStream.bitrateKbps, 128);
  assert.equal(parsed.hlsUrl, "https://streaming.live365.com/a98536/playlist.m3u8");
  assert.deepEqual(parsed.nowPlaying, { title: "Corduroy", artist: "Wild Firth", artworkUrl: fixture["current-track"].art });
});

test("malformed optional fields do not fabricate songs or stream URLs", () => {
  const parsed = parseStationInfo({
    "mount-id": "a98536", name: 9, "station-logo": "http://unsafe.example/art.jpg",
    "current-track": { title: 5, artist: " ", art: fixture["current-track"].art },
    "listening-urls": [null, { url: "https://evil.example/a98536", encoding: "mp3" },
      { url: "https://streaming.live365.com/a99999", encoding: "mp3" },
      { url: "https://streaming.live365.com/a98536?session=temporary", encoding: "mp3" }],
  });
  assert.equal(parsed.name, "WLFM");
  assert.equal(parsed.artworkUrl, null);
  assert.equal(parsed.nowPlaying, null);
  assert.equal(parsed.preferredStream, null);
  assert.deepEqual(parsed.streams, []);
});

test("partial metadata and invalid bitrate/artwork remain usable", () => {
  const parsed = parseStationInfo({ ...fixture,
    "current-track": { title: "  Song  ", artist: null, art: "javascript:alert(1)" },
    "listening-urls": [{ url: fixture["stream-url"], encoding: "mp3", bitrate: "128" }],
  });
  assert.deepEqual(parsed.nowPlaying, { title: "Song", artist: null, artworkUrl: null });
  assert.equal(parsed.preferredStream.bitrateKbps, null);
});

test("verified primary URL is a fallback; unsupported entries are ignored", () => {
  const parsed = parseStationInfo({ ...fixture, "listening-urls": null });
  assert.equal(parsed.preferredStream.url, fixture["stream-url"]);
  assert.equal(parsed.preferredStream.bitrateKbps, null);
});

test("AAC remains an alternative when no MP3 URL is available", () => {
  const parsed = parseStationInfo({ ...fixture, "stream-url": null,
    "listening-urls": [fixture["listening-urls"][1]],
  });
  assert.equal(parsed.preferredStream.encoding, "aac");
});

test("wrong identities and malformed top-level responses are rejected", () => {
  for (const input of [null, [], {}, { ...fixture, "mount-id": "a99999" }]) {
    assert.throws(() => parseStationInfo(input), (error) => error instanceof Live365Error && error.code === "invalid-response");
  }
});

test("disabled/offline stations do not report a playable stream or stale song", () => {
  for (const flags of [{ station_enabled: false }, { is_playing: false }]) {
    const parsed = parseStationInfo({ ...fixture, ...flags });
    assert.equal(parsed.preferredStream, null);
    assert.equal(parsed.nowPlaying, null);
  }
});

test("public service functions fetch and parse without playback imports", async () => {
  await mockFetch(async (url, options) => {
    assert.equal(url, "https://api.live365.com/station/a98536");
    assert.equal(options.headers.Accept, "application/json");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(fixture);
  }, async () => {
    assert.equal((await getStationInfo()).id, "a98536");
    assert.equal(await getStreamUrl(), fixture["stream-url"]);
    assert.equal((await getNowPlaying()).title, fixture["current-track"].title);
  });
});

test("HTTP errors, unreadable JSON, and network failures have distinct status", async () => {
  for (const [mock, code] of [
    [async () => new Response("missing", { status: 404 }), "http"],
    [async () => new Response("<html>error</html>"), "invalid-response"],
    [async () => { throw new TypeError("offline"); }, "network"],
  ]) {
    await mockFetch(mock, () => assert.rejects(getStationInfo(), (error) => error instanceof Live365Error && error.code === code));
  }
});

test("no supported stream produces an explicit error", async () => {
  await mockFetch(async () => Response.json({ "mount-id": "a98536" }), async () => {
    await assert.rejects(getStreamUrl(), (error) => error.code === "stream-unavailable");
    assert.equal(await getNowPlaying(), null);
  });
});

test("timeouts abort pending requests and allow a subsequent retry", async () => {
  await mockFetch((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), () => assert.rejects(getStationInfo({ timeoutMs: 5 }), (error) => error.code === "timeout"));
  await mockFetch(async () => Response.json(fixture), async () => {
    assert.equal((await getStationInfo()).name, "WLFM");
  });
});

test("timeout covers JSON body reading, not only response headers", async () => {
  await mockFetch(async (_url, { signal }) => ({ ok: true,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("body aborted")), { once: true });
    }),
  }), () => assert.rejects(getStationInfo({ timeoutMs: 5 }), (error) => error.code === "timeout"));
});

test("already cancelled requests do not access the network", async () => {
  const controller = new AbortController();
  controller.abort();
  await mockFetch(() => { assert.fail("fetch must not run"); }, () =>
    assert.rejects(getStationInfo({ signal: controller.signal }), (error) => error.code === "aborted"));
});

test("caller cancellation remains distinct from a timeout", async () => {
  const controller = new AbortController();
  await mockFetch((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), async () => {
    const result = getStationInfo({ signal: controller.signal });
    controller.abort();
    await assert.rejects(result, (error) => error.code === "aborted");
  });
});

test("live public endpoint and all service functions", { skip: process.env.LIVE365_LIVE_CHECK !== "1" }, async () => {
  const station = await getStationInfo();
  assert.equal(station.id, "a98536");
  assert.equal(station.name, "WLFM");
  const url = await getStreamUrl();
  assert.equal(url, "https://streaming.live365.com/a98536");
  const metadata = await getNowPlaying();
  assert.ok(metadata === null || typeof metadata.title === "string" || typeof metadata.artist === "string");
  console.log(JSON.stringify({ station: station.name, streamUrl: url, nowPlaying: metadata }, null, 2));
});
