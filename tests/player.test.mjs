import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const audioStub = `
const initialStatus = {
  id: 1, isLoaded: true, playbackState: 'readyToPlay', playing: false,
  currentTime: 0, duration: 0, playbackRate: 1, shouldCorrectPitch: false,
  pitchCorrectionQuality: 'medium', muted: false, loop: false, didJustFinish: false,
  isBuffering: false, isAudioSamplingSupported: false, timeControlStatus: 'paused',
  reasonForWaitingToPlay: null,
};
export const control = {
  calls: [], createCount: 0, listener: null, modeError: false,
  currentStatus: {...initialStatus}, source: null,
};
const player = {
  get currentStatus() { return control.currentStatus; },
  addListener(event, listener) {
    control.calls.push(['listener', event]); control.listener = listener;
    return {remove() { if (control.listener === listener) control.listener = null; }};
  },
  replace(source) {
    control.calls.push(['replace', source]); control.source = source;
    control.currentStatus = {...initialStatus, isBuffering: true, timeControlStatus: 'waiting'};
  },
  play() { control.calls.push(['play']); },
  pause() {
    control.calls.push(['pause']);
    control.currentStatus = {...control.currentStatus, playing: false, isBuffering: false, timeControlStatus: 'paused'};
    control.listener?.(control.currentStatus);
  },
  setActiveForLockScreen(active, metadata, options) {
    control.calls.push(['lockScreen', active, metadata, options]);
  },
  updateLockScreenMetadata(metadata) { control.calls.push(['metadata', metadata]); },
  clearLockScreenControls() { control.calls.push(['clearLockScreen']); },
};
export function emit(patch) {
  control.currentStatus = {...control.currentStatus, ...patch};
  control.listener?.(control.currentStatus);
}
export function audible() {
  emit({playing:true, isBuffering:false, timeControlStatus:'playing', error:undefined});
}
export function createAudioPlayer(source, options) {
  control.createCount++; control.calls.push(['create', source, options]); return player;
}
export async function setAudioModeAsync(mode) {
  control.calls.push(['mode', mode]);
  if (control.modeError) throw new Error('Native setup failed');
}
export async function requestNotificationPermissionsAsync() {
  control.calls.push(['notificationPermission']); return {granted:true, status:'granted', canAskAgain:true, expires:'never'};
}
`;

async function runtime(t, platform = "android") {
  const folder = await mkdtemp(join(tmpdir(), "wlfm-player-tests-"));
  const source = await readFile(new URL("../src/services/player.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    .replaceAll('"expo-audio"', '"./audio.mjs"')
    .replaceAll('"react-native"', '"./appstate.mjs"')
    .replaceAll('"../config/station"', '"./station.mjs"')
    .replaceAll('"./live365"', '"./live365.mjs"')
    .replaceAll('"./metadata"', '"./metadata.mjs"');
  await Promise.all([
    writeFile(join(folder, "player.mjs"), compiled),
    writeFile(join(folder, "audio.mjs"), audioStub),
    writeFile(join(folder, "appstate.mjs"), `
      export const Platform = {OS:${JSON.stringify(platform)}};
      export const AppState = {
        currentState:'active', listenerRegistrations:0, handler:null,
        addEventListener(_event, handler) {this.listenerRegistrations++; this.handler=handler; return {remove(){}};},
      };
    `),
    writeFile(join(folder, "station.mjs"), `export const STATION = {id:'a98536', name:'WLFM'};`),
    writeFile(join(folder, "metadata.mjs"), `
      export const FALLBACK_NOW_PLAYING = {title:'WLFM', artist:'The only alternative in the valley.'};
      export const nowPlayingSnapshot = {title:'API Song', artist:'API Artist', artworkUrl:'https://media.live365.com/api.jpg'};
      export const controls = {active:[], resets:0, refreshes:0, updater:null};
      export function configureNativeMetadataUpdater(updater) {controls.updater=updater;}
      export function getNowPlayingSnapshot() {return nowPlayingSnapshot;}
      export function refreshMetadataFallback() {controls.refreshes++;}
      export function resetNowPlaying() {controls.resets++;}
      export function setMetadataPlaybackActive(value) {controls.active.push(value);}
    `),
    writeFile(join(folder, "live365.mjs"), `
      export const controls = {calls:0, load:null};
      export const station = {
        name:'WLFM', artworkUrl:null,
        hlsUrl:'https://streaming.live365.com/a98536/playlist.m3u8',
        preferredStream:{url:'https://streaming.live365.com/a98536', mimeType:'audio/mpeg'},
      };
      export async function getStationInfo(options) {controls.calls++; return controls.load ? controls.load(options) : station;}
    `),
  ]);
  const importFile = (file) => import(pathToFileURL(join(folder, file)).href);
  const player = await importFile("player.mjs");
  const audio = await importFile("audio.mjs");
  const live365 = await importFile("live365.mjs");
  const metadata = await importFile("metadata.mjs");
  const { AppState } = await importFile("appstate.mjs");
  t.after(async () => {
    player.pauseRadio();
    await rm(folder, { recursive: true, force: true });
  });
  return { player, audio, live365, metadata, AppState };
}

const callsNamed = (audio, name) => audio.control.calls.filter(([call]) => call === name);

test("opening the player does not initialize, fetch, or autoplay", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  const unsubscribe = player.subscribeToRadioPlayer(() => {});
  assert.deepEqual(player.getRadioPlayerSnapshot(), {status:"idle", error:null, errorKind:null, canPause:false});
  assert.equal(audio.control.createCount, 0);
  assert.deepEqual(audio.control.calls, []);
  assert.equal(live365.controls.calls, 0);
  unsubscribe();
});

test("simultaneous Play calls create one persistent player and prefer HLS", async (t) => {
  const { player, audio, live365, metadata, AppState } = await runtime(t);
  await Promise.all([player.playRadio(), player.playRadio(), player.playRadio()]);
  assert.equal(audio.control.createCount, 1);
  assert.equal(AppState.listenerRegistrations, 1);
  assert.equal(callsNamed(audio, "play").length, 1);
  assert.equal(live365.controls.calls, 1);
  const source = callsNamed(audio, "replace")[0][1];
  assert.equal(source.uri, "https://streaming.live365.com/a98536/playlist.m3u8");
  assert.equal(source.headers["User-Agent"], "WLFM/1.0 (Expo Audio; android)");
  assert.equal(source.headers["Icy-MetaData"], undefined);
  assert.deepEqual(callsNamed(audio, "mode")[0][1], {
    playsInSilentMode:true, shouldPlayInBackground:true, interruptionMode:"doNotMix",
  });
  assert.equal(callsNamed(audio, "notificationPermission").length, 1);
  assert.deepEqual(callsNamed(audio, "create")[0].slice(1), [null, {
    keepAudioSessionActive:true, updateInterval:250,
  }]);
  const lockScreen = callsNamed(audio, "lockScreen")[0];
  assert.equal(lockScreen[1], true);
  assert.deepEqual(lockScreen[2], {
    title:"API Song", artist:"API Artist", albumTitle:"WLFM",
    artworkUrl:"https://media.live365.com/api.jpg",
  });
  assert.deepEqual(lockScreen[3], {
    isLiveStream:true, showSeekBackward:false, showSeekForward:false,
  });
  assert.equal(metadata.controls.active.at(-1), true);
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
  audio.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("iOS does not request Android notification permission", async (t) => {
  const { player, audio } = await runtime(t, "ios");
  await player.playRadio();
  assert.equal(callsNamed(audio, "notificationPermission").length, 0);
});

test("uses direct MP3 with ICY headers when HLS is unavailable", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  live365.controls.load = async () => ({...live365.station, hlsUrl:null});
  await player.playRadio();
  const source = callsNamed(audio, "replace")[0][1];
  assert.equal(source.uri, "https://streaming.live365.com/a98536");
  assert.equal(source.headers["Icy-MetaData"], "1");
  assert.equal(source.headers["User-Agent"], "WLFM/1.0 (Expo Audio; android)");
});

test("a native HLS error falls back once to direct MP3", async (t) => {
  const { player, audio } = await runtime(t);
  await player.playRadio();
  audio.emit({error:"HLS failed", playing:false, isBuffering:false});
  assert.equal(callsNamed(audio, "replace").length, 2);
  assert.equal(callsNamed(audio, "replace")[1][1].uri, "https://streaming.live365.com/a98536");
  assert.equal(callsNamed(audio, "replace")[1][1].headers["Icy-MetaData"], "1");
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
  audio.emit({error:"MP3 failed", playing:false, isBuffering:false});
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  assert.equal(callsNamed(audio, "replace").length, 2);
});

test("no playable direct stream reports station unavailable", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  live365.controls.load = async () => ({...live365.station, preferredStream:null});
  await player.playRadio();
  assert.equal(player.getRadioPlayerSnapshot().errorKind, "station-unavailable");
  assert.match(player.getRadioPlayerSnapshot().error, /currently unavailable/);
  assert.equal(callsNamed(audio, "replace").length, 0);
});

test("a pause within the HLS live window preserves controls and reuses the source", async (t) => {
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  const { player, audio, live365 } = await runtime(t);
  await player.playRadio(); audio.audible();
  player.pauseRadio();
  now += 14_999;
  assert.equal(player.getRadioPlayerSnapshot().status, "paused");
  assert.equal(callsNamed(audio, "clearLockScreen").length, 0);
  await player.playRadio(); audio.audible();
  assert.equal(live365.controls.calls, 1);
  assert.equal(callsNamed(audio, "replace").length, 1);
  assert.equal(audio.control.createCount, 1);
});

test("resume after a stale pause refreshes the source on the persistent player", async (t) => {
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  const { player, audio, live365 } = await runtime(t);
  await player.playRadio(); audio.audible();
  player.pauseRadio();
  now += 15_001;

  await player.playRadio();

  assert.equal(live365.controls.calls, 1);
  assert.equal(callsNamed(audio, "replace").length, 2);
  assert.equal(callsNamed(audio, "replace")[1][1].uri, "https://streaming.live365.com/a98536/playlist.m3u8");
  assert.equal(audio.control.createCount, 1);
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
});

test("external Play refreshes a stale paused source", async (t) => {
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  const { player, audio, live365 } = await runtime(t);
  await player.playRadio(); audio.audible();
  player.pauseRadio();
  now += 15_001;

  audio.emit({playing:false, isBuffering:true, timeControlStatus:"waiting"});

  assert.equal(live365.controls.calls, 1);
  assert.equal(callsNamed(audio, "replace").length, 2);
  assert.equal(audio.control.createCount, 1);
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
});

test("native buffering transitions, pause, and external resume are reflected in app state", async (t) => {
  const { player, audio } = await runtime(t);
  await player.playRadio();
  audio.emit({playing:false, isBuffering:true, timeControlStatus:"waiting"});
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
  audio.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
  audio.emit({playing:false, isBuffering:true, timeControlStatus:"waiting"});
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
  audio.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
  audio.emit({playing:false, isBuffering:false, timeControlStatus:"paused"});
  assert.equal(player.getRadioPlayerSnapshot().status, "paused");
  audio.emit({playing:true, isBuffering:false, timeControlStatus:"playing"});
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("Pause cancels discovery and a stale response cannot start playback", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  let resolve;
  let signal;
  live365.controls.load = (options) => {signal=options.signal; return new Promise((done) => {resolve=done;});};
  const attempt = player.playRadio();
  await new Promise((done) => setImmediate(done));
  player.pauseRadio();
  assert.equal(signal.aborted, true);
  resolve(live365.station);
  await attempt;
  assert.equal(callsNamed(audio, "replace").length, 0);
  assert.equal(callsNamed(audio, "play").length, 0);
  assert.equal(player.getRadioPlayerSnapshot().status, "idle");
});

test("Play/Pause/Play rejects the superseded response", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  let resolve;
  live365.controls.load = () => new Promise((done) => {resolve=done;});
  const first = player.playRadio();
  await new Promise((done) => setImmediate(done));
  player.pauseRadio();
  live365.controls.load = null;
  await player.playRadio();
  resolve(live365.station);
  await first;
  assert.equal(callsNamed(audio, "replace").length, 1);
  assert.equal(callsNamed(audio, "play").length, 1);
});

test("terminal playback errors support an explicit fresh retry", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  live365.controls.load = async () => ({...live365.station, hlsUrl:null});
  await player.playRadio(); audio.audible();
  audio.emit({error:"Network disconnected", playing:false});
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  assert.match(player.getRadioPlayerSnapshot().error, /Couldn't reconnect/);
  await player.playRadio();
  assert.equal(live365.controls.calls, 2);
  assert.equal(callsNamed(audio, "replace").length, 2);
  assert.equal(audio.control.createCount, 1);
});

test("discovery and initialization failures allow explicit retry", async (t) => {
  const first = await runtime(t);
  first.live365.controls.load = async () => {throw new Error("Offline");};
  await first.player.playRadio();
  assert.match(first.player.getRadioPlayerSnapshot().error, /Couldn't reconnect/);
  first.live365.controls.load = null;
  await first.player.playRadio(); first.audio.audible();
  assert.equal(first.player.getRadioPlayerSnapshot().status, "playing");
  assert.equal(first.audio.control.createCount, 1);

  const second = await runtime(t);
  second.audio.control.modeError = true;
  await second.player.playRadio();
  assert.equal(second.player.getRadioPlayerSnapshot().errorKind, "configuration");
  assert.equal(second.player.getRadioPlayerSnapshot().error, "Native setup failed");
  second.audio.control.modeError = false;
  await second.player.playRadio(); second.audio.audible();
  assert.equal(second.player.getRadioPlayerSnapshot().status, "playing");
  assert.equal(second.audio.control.createCount, 1);
});

test("setup is rejected outside the foreground", async (t) => {
  const { player, audio, AppState } = await runtime(t);
  AppState.currentState = "background";
  await player.playRadio();
  assert.match(player.getRadioPlayerSnapshot().error, /foreground/);
  assert.equal(audio.control.createCount, 0);
  AppState.currentState = "active";
  await player.playRadio(); audio.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("foreground reconciliation adopts native state after suspended events", async (t) => {
  const { player, audio, metadata, AppState } = await runtime(t);
  await player.playRadio(); audio.audible();
  audio.control.currentStatus = {...audio.control.currentStatus, playing:false, isBuffering:false, timeControlStatus:"paused"};
  AppState.handler("active");
  assert.equal(player.getRadioPlayerSnapshot().status, "paused");
  audio.control.currentStatus = {...audio.control.currentStatus, playing:true, timeControlStatus:"playing"};
  AppState.handler("active");
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
  assert.equal(metadata.controls.refreshes, 2);
});

test("metadata updates system controls without replacing the audio source", async (t) => {
  const { player, audio, metadata } = await runtime(t);
  await player.playRadio(); audio.audible();
  const replacements = callsNamed(audio, "replace").length;
  metadata.controls.updater({
    title:"Next Song", artist:"Next Artist", artworkUrl:"https://media.live365.com/next.jpg",
  });
  assert.deepEqual(callsNamed(audio, "metadata").at(-1)[1], {
    title:"Next Song", artist:"Next Artist", albumTitle:"WLFM",
    artworkUrl:"https://media.live365.com/next.jpg",
  });
  assert.equal(callsNamed(audio, "replace").length, replacements);
});

test("changing the diagnostic transport requires a fresh source", async (t) => {
  const { player, audio, live365, metadata } = await runtime(t);
  await player.playRadio(); audio.audible();
  player.setRadioTransport("mp3");
  assert.equal(player.getRadioTransportSnapshot(), "mp3");
  assert.equal(callsNamed(audio, "clearLockScreen").length, 1);
  await player.playRadio();
  assert.equal(live365.controls.calls, 2);
  assert.equal(callsNamed(audio, "replace").length, 2);
  assert.equal(callsNamed(audio, "replace")[1][1].uri, "https://streaming.live365.com/a98536");
  assert.ok(metadata.controls.resets >= 2);
});

test("stalled discovery times out and rejects a late response", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  let resolve;
  live365.controls.load = () => new Promise((done) => {resolve=done;});
  t.mock.timers.enable({apis:["setTimeout"]});
  const attempt = player.playRadio();
  await new Promise((done) => setImmediate(done));
  t.mock.timers.tick(30_001);
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  assert.match(player.getRadioPlayerSnapshot().error, /too long/);
  resolve(live365.station);
  await attempt;
  assert.equal(callsNamed(audio, "replace").length, 0);
});

test("retry after a buffering timeout creates a fresh source on the same player", async (t) => {
  const { player, audio, live365 } = await runtime(t);
  t.mock.timers.enable({apis:["setTimeout"]});
  await player.playRadio();
  t.mock.timers.tick(30_001);
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  await player.playRadio(); audio.audible();
  assert.equal(live365.controls.calls, 2);
  assert.equal(callsNamed(audio, "replace").length, 2);
  assert.equal(audio.control.createCount, 1);
});
