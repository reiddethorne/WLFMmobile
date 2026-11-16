import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function runtime(t, { assetDownloadFails = false } = {}) {
  const folder = await mkdtemp(join(tmpdir(), "wlfm-metadata-tests-"));
  const source = await readFile(new URL("../src/services/metadata.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    .replaceAll('"expo-asset"', '"./expo-asset.mjs"')
    .replaceAll('"../config/station"', '"./station.mjs"')
    .replaceAll('"../constants/assets"', '"./assets.mjs"')
    .replaceAll('"../utils/metadataText"', '"./metadataText.mjs"')
    .replaceAll('"./live365"', '"./live365.mjs"');
  const textSource = await readFile(new URL("../src/utils/metadataText.ts", import.meta.url), "utf8");
  const compiledText = ts.transpileModule(textSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  await Promise.all([
    writeFile(join(folder, "metadata.mjs"), compiled),
    writeFile(join(folder, "metadataText.mjs"), compiledText),
    writeFile(join(folder, "station.mjs"), `export const STATION = {name:"WLFM", slogan:"The only alternative in the valley."};`),
    writeFile(join(folder, "assets.mjs"), `export const STATION_ARTWORK = 42;`),
    writeFile(join(folder, "expo-asset.mjs"), `
      export const control = {calls:[], downloadFails:false};
      const asset = {
        uri:"asset://wlfm-square.png", localUri:null,
        async downloadAsync() {
          control.calls.push(["download"]);
          if (control.downloadFails) throw new Error("Asset cache unavailable");
          return {...this, localUri:"file:///bundled/wlfm-square.png"};
        },
      };
      export const Asset = {
        fromModule(moduleId) {control.calls.push(["fromModule", moduleId]); return asset;},
      };
    `),
    writeFile(join(folder, "live365.mjs"), `
      export const controls = {calls:0, result:null, recent:[], load:null, signals:[]};
      export async function getStationInfo(options) {
        controls.calls++;
        controls.signals.push(options.signal);
        return controls.load ? controls.load(options) : {
          nowPlaying: controls.result,
          recentlyPlayed: controls.recent,
        };
      }
    `),
  ]);
  const importFile = (file) => import(pathToFileURL(join(folder, file)).href);
  const metadata = await importFile("metadata.mjs");
  const live365 = await importFile("live365.mjs");
  const asset = await importFile("expo-asset.mjs");
  asset.control.downloadFails = assetDownloadFails;
  const nativeUpdates = [];
  await metadata.configureNativeMetadataUpdater((value) => nativeUpdates.push(value));
  t.after(async () => {
    metadata.setMetadataPlaybackActive(false);
    await rm(folder, { recursive: true, force: true });
  });
  return { metadata, live365, asset, nativeUpdates };
}

const apiTrack = {
  title: "Home",
  artist: "OVAN/SHAUN",
  artworkUrl: "https://media.live365.com/home.jpg",
};

const stationResult = (nowPlaying, recentlyPlayed = []) => ({ nowPlaying, recentlyPlayed });
const settle = () => new Promise((done) => setImmediate(done));

test("metadata starts idle with the bundled artwork resolved through Expo Asset", async (t) => {
  const { metadata, live365, asset, nativeUpdates } = await runtime(t);
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title:"WLFM", artist:"The only alternative in the valley.", artworkUrl:null, source:"fallback",
  });
  assert.equal(live365.controls.calls, 0);
  assert.deepEqual(asset.control.calls, [["fromModule", 42], ["download"]]);
  assert.deepEqual(nativeUpdates, [{
    title:"WLFM", artist:"The only alternative in the valley.",
    artworkUrl:"file:///bundled/wlfm-square.png",
  }]);
});

test("Live365 current-track polling starts only during playback", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = apiTrack;
  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.equal(live365.controls.calls, 1);
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {...apiTrack, source:"live365"});
  assert.deepEqual(nativeUpdates.at(-1), apiTrack);
  metadata.setMetadataPlaybackActive(true);
  assert.equal(live365.controls.calls, 1);
  metadata.setMetadataPlaybackActive(false);
});

test("Live365 text is sanitized and HTML entities are decoded", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = {
    title:"  Don&amp;#39;t `Stop’  ",
    artist:"D´Angelo &amp; Friends\n",
    artworkUrl:"https://media.live365.com/clean.jpg",
  };
  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title:"Don't 'Stop'", artist:"D'Angelo & Friends",
    artworkUrl:"https://media.live365.com/clean.jpg", source:"live365",
  });
  assert.deepEqual(nativeUpdates.at(-1), {
    title:"Don't 'Stop'", artist:"D'Angelo & Friends",
    artworkUrl:"https://media.live365.com/clean.jpg",
  });
});

test("only HTTPS artwork reaches application and lock-screen metadata", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = {
    title:"Unsafe Cover", artist:"Artist", artworkUrl:"http://example.com/art.jpg",
  };
  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title:"Unsafe Cover", artist:"Artist", artworkUrl:null, source:"live365",
  });
  assert.deepEqual(nativeUpdates.at(-1), {
    title:"Unsafe Cover", artist:"Artist", artworkUrl:"file:///bundled/wlfm-square.png",
  });

  live365.controls.load = async () => stationResult({
    title:"Credential Cover", artist:"Artist", artworkUrl:"https://user:pass@example.com/art.jpg",
  });
  metadata.refreshMetadataFallback();
  await settle();
  assert.equal(metadata.getNowPlayingSnapshot().artworkUrl, null);
  assert.equal(nativeUpdates.at(-1).artworkUrl, "file:///bundled/wlfm-square.png");
});

test("missing metadata uses the bundled URI without fabricating a file path", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t, {assetDownloadFails:true});
  live365.controls.result = {title:"  ", artist:"", artworkUrl:null};
  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {
    title:"WLFM", artist:"The only alternative in the valley.", artworkUrl:null, source:"fallback",
  });
  assert.deepEqual(nativeUpdates.at(-1), {
    title:"WLFM", artist:"The only alternative in the valley.",
    artworkUrl:"asset://wlfm-square.png",
  });
});

test("Recently Played polls independently without changing now-playing metadata", async (t) => {
  const { metadata, live365 } = await runtime(t);
  const recent = [{
    title:"Camino Del Sol", artist:"Antena",
    artworkUrl:"https://media.live365.com/camino.jpg",
    startedAt:"2026-10-08T15:54:49.290Z",
  }];
  live365.controls.result = apiTrack;
  live365.controls.recent = recent;
  let updates = 0;
  const unsubscribe = metadata.subscribeToRecentlyPlayed(() => { updates += 1; });
  await settle();
  assert.equal(live365.controls.calls, 1);
  assert.deepEqual(metadata.getRecentlyPlayedSnapshot(), {tracks:recent, status:"ready"});
  assert.equal(metadata.getNowPlayingSnapshot().source, "fallback");
  assert.equal(updates, 1);

  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.equal(live365.controls.calls, 2);
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {...apiTrack, source:"live365"});
  metadata.setMetadataPlaybackActive(false);
  unsubscribe();
});

test("Recently Played retains its last valid tracks across an error", async (t) => {
  const { metadata, live365 } = await runtime(t);
  const recent = [{title:"Home", artist:"OVAN/SHAUN", artworkUrl:null, startedAt:null}];
  live365.controls.recent = recent;
  const unsubscribe = metadata.subscribeToRecentlyPlayed(() => {});
  await settle();
  unsubscribe();

  live365.controls.load = async () => { throw new Error("Offline"); };
  const unsubscribeAgain = metadata.subscribeToRecentlyPlayed(() => {});
  await settle();
  assert.deepEqual(metadata.getRecentlyPlayedSnapshot(), {tracks:recent, status:"error"});
  unsubscribeAgain();
});

test("the poller repeats while owned and stops after its final owner leaves", async (t) => {
  const { metadata, live365 } = await runtime(t);
  t.mock.timers.enable({apis:["setTimeout"]});
  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.equal(live365.controls.calls, 1);
  t.mock.timers.tick(30_001);
  await settle();
  assert.equal(live365.controls.calls, 2);
  metadata.setMetadataPlaybackActive(false);
  t.mock.timers.tick(30_001);
  await settle();
  assert.equal(live365.controls.calls, 2);
});

test("stopping playback aborts an in-flight metadata request", async (t) => {
  const { metadata, live365 } = await runtime(t);
  live365.controls.load = () => new Promise(() => {});
  metadata.setMetadataPlaybackActive(true);
  await settle();
  metadata.setMetadataPlaybackActive(false);
  assert.equal(live365.controls.signals[0].aborted, true);
});

test("a stale response cannot overwrite a newer polling cycle", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  let resolveFirst;
  live365.controls.load = () => new Promise((resolve) => { resolveFirst = resolve; });
  metadata.setMetadataPlaybackActive(true);
  await settle();
  metadata.setMetadataPlaybackActive(false);

  const newer = {title:"New Track", artist:"New Artist", artworkUrl:"https://media.live365.com/new.jpg"};
  live365.controls.load = async () => stationResult(newer);
  metadata.setMetadataPlaybackActive(true);
  await settle();
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {...newer, source:"live365"});

  resolveFirst(stationResult(apiTrack));
  await settle();
  assert.deepEqual(metadata.getNowPlayingSnapshot(), {...newer, source:"live365"});
  assert.deepEqual(nativeUpdates.at(-1), newer);
});

test("accepted metadata changes update native controls without duplicate writes", async (t) => {
  const { metadata, live365, nativeUpdates } = await runtime(t);
  live365.controls.result = apiTrack;
  metadata.setMetadataPlaybackActive(true);
  await settle();
  const afterFirstPoll = nativeUpdates.length;
  metadata.refreshMetadataFallback();
  await settle();
  assert.equal(nativeUpdates.length, afterFirstPoll);

  const next = {...apiTrack, title:"Next Song"};
  live365.controls.result = next;
  metadata.refreshMetadataFallback();
  await settle();
  assert.deepEqual(nativeUpdates.at(-1), next);
  assert.equal(nativeUpdates.length, afterFirstPoll + 1);
});
