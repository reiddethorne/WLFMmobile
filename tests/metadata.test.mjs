import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function runtime(t) {
  const folder = await mkdtemp(join(tmpdir(), "wlfm-metadata-tests-"));
  const source = await readFile(new URL("../src/services/metadata.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    .replaceAll('"../constants/assets"', '"./assets.mjs"')
    .replaceAll('"./live365"', '"./live365.mjs"');
  await Promise.all([
    writeFile(join(folder, "metadata.mjs"), compiled),
    writeFile(join(folder, "assets.mjs"), `export const STATION_ARTWORK = 42;`),
    writeFile(join(folder, "live365.mjs"), `
      export const controls = {calls:0, result:null, load:null, signal:null};
      export async function getNowPlaying(options) {
        controls.calls++;
        controls.signal=options.signal;
        return controls.load ? controls.load(options) : controls.result;
      }
    `),
  ]);
  const metadata = await import(pathToFileURL(join(folder, "metadata.mjs")).href);
  const live365 = await import(pathToFileURL(join(folder, "live365.mjs")).href);
  const nativeUpdates = [];
  metadata.configureNativeMetadataUpdater((value) => nativeUpdates.push(value));
  t.after(async () => {
    metadata.setMetadataPlaybackActive(false);
    await rm(folder, { recursive: true, force: true });
  });
  return { metadata, live365, nativeUpdates };
}

const apiTrack = {
  title: "Home",
  artist: "OVAN/SHAUN",
  artworkUrl: "https://media.live365.com/home.jpg",
};

test("metadata starts with the documented station fallback", async (t) => {
  const { metadata, live365 } = await runtime(t);
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title: "LIVE", artist: "Student Radio", artworkUrl: null, source: "fallback",
  });
  assert.equal(live365.controls.calls, 0);
});

test("Live365 is polled only during playback and fills metadata before ICY arrives", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = apiTrack;
  metadata.setMetadataPlaybackActive(true);
  await new Promise((done) => setImmediate(done));
  assert.equal(live365.controls.calls, 1);
  assert.deepEqual(metadata.getNowPlayingSnapshot(), { ...apiTrack, source: "live365" });
  assert.deepEqual(nativeUpdates.at(-1), apiTrack);
  metadata.setMetadataPlaybackActive(true);
  assert.equal(live365.controls.calls, 1);
  metadata.setMetadataPlaybackActive(false);
});

test("stream title and artist outrank mismatched directory metadata", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = apiTrack;
  metadata.setMetadataPlaybackActive(true);
  await new Promise((done) => setImmediate(done));
  metadata.receiveStreamMetadata({ title: "Different Song", artist: "Different Artist" });
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title: "Different Song", artist: "Different Artist", artworkUrl: null, source: "stream",
  });
  assert.deepEqual(nativeUpdates.at(-1), { artworkUrl: 42 });
});

test("matching Live365 data supplies artwork without overriding stream text", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  metadata.receiveStreamMetadata({ title: "  HOME ", artist: "OVAN / SHAUN" });
  live365.controls.result = apiTrack;
  metadata.setMetadataPlaybackActive(true);
  await new Promise((done) => setImmediate(done));
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title: "HOME", artist: "OVAN / SHAUN", artworkUrl: apiTrack.artworkUrl, source: "stream",
  });
  assert.deepEqual(nativeUpdates.at(-1), { artworkUrl: apiTrack.artworkUrl });
});

test("effective native metadata recovers stream priority after a suspended raw event", async (t) => {
  const { metadata, live365 } = await runtime(t);
  live365.controls.result = apiTrack;
  metadata.setMetadataPlaybackActive(true);
  await new Promise((done) => setImmediate(done));
  metadata.receiveEffectiveMetadata({ title: "New Native Song", artist: "Native Artist", artworkUrl: 42 });
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title: "New Native Song", artist: "Native Artist", artworkUrl: null, source: "stream",
  });
});

test("invalid metadata and unsafe artwork degrade to the bundled fallback", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = { title: "  ", artist: "", artworkUrl: "http://example.com/art.jpg" };
  metadata.setMetadataPlaybackActive(true);
  await new Promise((done) => setImmediate(done));
  metadata.receiveStreamMetadata({ title: "\n", artist: "  ", artworkUrl: 123 });
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title: "LIVE", artist: "Student Radio", artworkUrl: null, source: "fallback",
  });
  assert.deepEqual(nativeUpdates.at(-1), { title: "LIVE", artist: "Student Radio", artworkUrl: 42 });
});

test("stopping playback aborts a fallback request and rejects its stale result", async (t) => {
  const { metadata, live365 } = await runtime(t);
  let resolve;
  live365.controls.load = () => new Promise((done) => { resolve = done; });
  metadata.setMetadataPlaybackActive(true);
  await new Promise((done) => setImmediate(done));
  metadata.setMetadataPlaybackActive(false);
  assert.equal(live365.controls.signal.aborted, true);
  resolve(apiTrack);
  await new Promise((done) => setImmediate(done));
  assert.equal(metadata.getNowPlayingSnapshot().source, "fallback");
});
