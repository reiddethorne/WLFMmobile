import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const nativeStub = `
export const PlaybackState = { Idle: 'idle', Ready: 'ready', Buffering: 'buffering', Ended: 'ended', Error: 'error' };
export const PlayerCommand = { PlayPause: 'playPause' };
export const Event = { PlaybackStateChanged: 'state', IsPlayingChanged: 'playing', PlaybackError: 'error', MetadataReceived: 'metadata', MediaMetadataChanged: 'effectiveMetadata' };
export const control = { state: 'idle', playing: false, item: null, calls: [], setupError: false, listeners: new Map() };
export function emit(event, payload) { for (const listener of control.listeners.get(event) ?? []) listener(payload); }
export function audible() { control.state = 'ready'; control.playing = true; emit('state', {state:'ready'}); emit('playing', {playing:true}); }
export default {
  setupPlayer(config) { control.calls.push(['setup', config]); if (control.setupError) throw new Error('Native setup failed'); },
  setCommands(config) { control.calls.push(['commands', config]); },
  addEventListener(event, listener) { const listeners = control.listeners.get(event) ?? new Set(); listeners.add(listener); control.listeners.set(event, listeners); return { remove() {listeners.delete(listener);} }; },
  getPlaybackState() { return control.state; },
  isPlaying() { return control.playing; },
  getActiveMediaItem() { return control.item; },
  getActiveMediaItemIndex() { return control.item ? 0 : null; },
  setMediaItem(item) { control.calls.push(['item', item]); control.item = item; control.state = 'buffering'; emit('state', {state:'buffering'}); },
  play() { control.calls.push(['play']); },
  pause() { control.calls.push(['pause']); control.playing = false; if (control.state !== 'error') control.state = control.item ? 'ready' : 'idle'; emit('playing', {playing:false}); },
  retry() { control.calls.push(['retry']); control.state = 'buffering'; emit('state', {state:'buffering'}); },
  updateMetadata(index, metadata) { control.calls.push(['metadataUpdate', index, metadata]); control.item = {...control.item, ...metadata}; emit('effectiveMetadata', control.item); },
};
`;

async function runtime(t) {
  const folder = await mkdtemp(join(tmpdir(), "wlfm-player-tests-"));
  const source = await readFile(new URL("../src/services/player.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    .replaceAll('"react-native"', '"./appstate.mjs"')
    .replaceAll('"@rntp/player"', '"./native.mjs"')
    .replaceAll('"../config/station"', '"./station.mjs"')
    .replaceAll('"../constants/assets"', '"./assets.mjs"')
    .replaceAll('"./live365"', '"./live365.mjs"')
    .replaceAll('"./metadata"', '"./metadata.mjs"');
  await Promise.all([
    writeFile(join(folder, "player.mjs"), compiled),
    writeFile(join(folder, "native.mjs"), nativeStub),
    writeFile(join(folder, "appstate.mjs"), `export const AppState = {currentState:'active', addEventListener(_event, handler) {this.handler=handler; return {remove(){}};}};`),
    writeFile(join(folder, "station.mjs"), `export const STATION = {id:'a98536', name:'WLFM'};`),
    writeFile(join(folder, "assets.mjs"), `export const STATION_ARTWORK = 42;`),
    writeFile(join(folder, "metadata.mjs"), `
      export const FALLBACK_NOW_PLAYING = {title:'LIVE', artist:'Student Radio'};
      export const controls = {active:[], raw:[], effective:[], resets:0, refreshes:0, updater:null};
      export function configureNativeMetadataUpdater(updater) {controls.updater=updater;}
      export function receiveStreamMetadata(value) {controls.raw.push(value);}
      export function receiveEffectiveMetadata(value) {controls.effective.push(value);}
      export function refreshMetadataFallback() {controls.refreshes++;}
      export function resetNowPlaying() {controls.resets++;}
      export function setMetadataPlaybackActive(value) {controls.active.push(value);}
    `),
    writeFile(join(folder, "live365.mjs"), `
      export const controls = {calls:0, load:null};
      export const station = {name:'WLFM', artworkUrl:null, preferredStream:{url:'https://streaming.live365.com/a98536', mimeType:'audio/mpeg'}};
      export async function getStationInfo(options) {controls.calls++; return controls.load ? controls.load(options) : station;}
    `),
  ]);
  const importFile = (file) => import(pathToFileURL(join(folder, file)).href);
  const player = await importFile("player.mjs");
  const native = await importFile("native.mjs");
  const live365 = await importFile("live365.mjs");
  const metadata = await importFile("metadata.mjs");
  const { AppState } = await importFile("appstate.mjs");
  t.after(async () => {
    player.pauseRadio();
    await rm(folder, { recursive: true, force: true });
  });
  return { player, native, live365, metadata, AppState };
}

test("opening the player does not initialize, fetch, or autoplay", async (t) => {
  const { player, native, live365 } = await runtime(t);
  const unsubscribe = player.subscribeToRadioPlayer(() => {});
  assert.deepEqual(player.getRadioPlayerSnapshot(), {status:"idle", error:null, canPause:false});
  assert.deepEqual(native.control.calls, []);
  assert.equal(live365.controls.calls, 0);
  unsubscribe();
});

test("simultaneous Play calls initialize once and build one live station item", async (t) => {
  const { player, native, live365 } = await runtime(t);
  await Promise.all([player.playRadio(), player.playRadio(), player.playRadio()]);
  assert.equal(native.control.calls.filter(([name]) => name === "setup").length, 1);
  assert.equal(native.control.calls.filter(([name]) => name === "play").length, 1);
  assert.equal(live365.controls.calls, 1);
  assert.equal(native.control.item.isLive, true);
  assert.equal(native.control.item.mediaId, "a98536");
  assert.equal(native.control.item.mimeType, "audio/mpeg");
  assert.equal(native.control.item.title, "LIVE");
  assert.equal(native.control.item.artist, "Student Radio");
  assert.equal(native.control.item.artworkUrl, 42);
  assert.equal(native.control.item.url.headers["Icy-MetaData"], "1");
  const setup = native.control.calls.find(([name]) => name === "setup")[1];
  assert.equal(setup.audioMixing, "exclusive");
  assert.equal(setup.handleAudioBecomingNoisy, true);
  assert.equal(setup.autoUpdateMetadataFromStream, true);
  assert.equal(setup.android.wakeMode, "network");
  assert.equal(setup.android.taskRemovedBehavior, "continue");
  const commands = native.control.calls.find(([name]) => name === "commands")[1];
  assert.deepEqual(commands, {capabilities:["playPause"], handling:"native"});
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
  native.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("pause/resume reuses the live queue and does not initialize or fetch again", async (t) => {
  const { player, native, live365 } = await runtime(t);
  await player.playRadio(); native.audible();
  player.pauseRadio();
  assert.equal(player.getRadioPlayerSnapshot().status, "paused");
  await player.playRadio(); native.audible();
  assert.equal(live365.controls.calls, 1);
  assert.equal(native.control.calls.filter(([name]) => name === "item").length, 1);
  assert.equal(native.control.calls.filter(([name]) => name === "setup").length, 1);
});

test("Pause cancels pending discovery and stale responses cannot start audio", async (t) => {
  const { player, native, live365 } = await runtime(t);
  let resolve;
  let signal;
  live365.controls.load = (options) => {signal = options.signal; return new Promise((done) => {resolve = done;});};
  const attempt = player.playRadio();
  await new Promise((done) => setImmediate(done));
  assert.equal(player.getRadioPlayerSnapshot().canPause, true);
  player.pauseRadio();
  assert.equal(signal.aborted, true);
  resolve(live365.station); await attempt;
  assert.equal(native.control.calls.some(([name]) => name === "play"), false);
  assert.equal(player.getRadioPlayerSnapshot().status, "idle");
});

test("Play/Pause/Play ignores the superseded attempt", async (t) => {
  const { player, native, live365 } = await runtime(t);
  let resolve;
  live365.controls.load = () => new Promise((done) => {resolve = done;});
  const first = player.playRadio();
  await new Promise((done) => setImmediate(done));
  player.pauseRadio();
  live365.controls.load = null;
  await player.playRadio();
  resolve(live365.station); await first;
  assert.equal(native.control.calls.filter(([name]) => name === "play").length, 1);
});

test("native playback errors offer retry, with retry before play", async (t) => {
  const { player, native } = await runtime(t);
  await player.playRadio(); native.audible();
  native.control.state = "error";
  native.emit("error", {message:"Network disconnected"});
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  assert.equal(player.getRadioPlayerSnapshot().error, "Network disconnected");
  const start = native.control.calls.length;
  await player.playRadio();
  const commands = native.control.calls.slice(start).map(([name]) => name);
  assert.deepEqual(commands, ["retry", "play"]);
  assert.equal(player.getRadioPlayerSnapshot().status, "buffering");
});

test("discovery errors can be retried without a second setup", async (t) => {
  const { player, native, live365 } = await runtime(t);
  live365.controls.load = async () => {throw new Error("Offline");};
  await player.playRadio();
  assert.equal(player.getRadioPlayerSnapshot().error, "Offline");
  assert.equal(native.control.calls.some(([name]) => name === "play"), false);
  live365.controls.load = null;
  await player.playRadio(); native.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
  assert.equal(native.control.calls.filter(([name]) => name === "setup").length, 1);
});

test("failed native initialization allows an explicit retry", async (t) => {
  const { player, native } = await runtime(t);
  native.control.setupError = true;
  await player.playRadio();
  assert.equal(player.getRadioPlayerSnapshot().error, "Native setup failed");
  native.control.setupError = false;
  await player.playRadio(); native.audible();
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("setup is rejected outside the foreground", async (t) => {
  const { player, native, AppState } = await runtime(t);
  AppState.currentState = "background";
  await player.playRadio();
  assert.match(player.getRadioPlayerSnapshot().error, /foreground/);
  assert.equal(native.control.calls.some(([name]) => name === "setup"), false);
  AppState.currentState = "active";
  await player.playRadio(); native.audible();
});

test("native pause updates the screen and unsubscribed observers stay removed", async (t) => {
  const { player, native } = await runtime(t);
  let updates = 0;
  const unsubscribe = player.subscribeToRadioPlayer(() => updates++);
  await player.playRadio(); native.audible();
  native.default.pause();
  assert.equal(player.getRadioPlayerSnapshot().status, "paused");
  unsubscribe(); const before = updates;
  native.audible();
  assert.equal(updates, before);
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("metadata events and native updates stay connected to the active live item", async (t) => {
  const { player, native, metadata } = await runtime(t);
  await player.playRadio(); native.audible();
  native.emit("metadata", {title:"Home", artist:"OVAN/SHAUN"});
  native.emit("effectiveMetadata", {title:"Home", artist:"OVAN/SHAUN"});
  assert.deepEqual(metadata.controls.raw, [{title:"Home", artist:"OVAN/SHAUN"}]);
  assert.deepEqual(metadata.controls.effective, [{title:"Home", artist:"OVAN/SHAUN"}]);
  metadata.controls.updater({artworkUrl:"https://media.live365.com/home.jpg"});
  assert.deepEqual(native.control.calls.at(-1), ["metadataUpdate", 0, {artworkUrl:"https://media.live365.com/home.jpg"}]);
  assert.equal(metadata.controls.active.includes(true), true);
  player.pauseRadio();
  assert.equal(metadata.controls.active.at(-1), false);
});

test("foreground reconciliation adopts native state after suspended events", async (t) => {
  const { player, native, AppState } = await runtime(t);
  await player.playRadio(); native.audible();
  // Model a lock-screen pause whose JS event was missed while the runtime slept.
  native.control.playing = false;
  native.control.state = "ready";
  AppState.handler("active");
  assert.equal(player.getRadioPlayerSnapshot().status, "paused");
  native.control.playing = true;
  AppState.handler("active");
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});

test("an ended live stream reports an actionable error", async (t) => {
  const { player, native } = await runtime(t);
  await player.playRadio(); native.audible();
  native.control.playing = false; native.control.state = "ended";
  native.emit("state", {state:"ended"});
  assert.match(player.getRadioPlayerSnapshot().error, /ended/);
});

test("stalled connections time out and cannot start from a late response", async (t) => {
  const { player, native, live365 } = await runtime(t);
  let resolve;
  live365.controls.load = () => new Promise((done) => {resolve = done;});
  t.mock.timers.enable({apis:["setTimeout"]});
  const attempt = player.playRadio();
  await new Promise((done) => setImmediate(done));
  t.mock.timers.tick(30_001);
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  assert.match(player.getRadioPlayerSnapshot().error, /too long/);
  resolve(live365.station); await attempt;
  assert.equal(native.control.calls.some(([name]) => name === "play"), false);
});

test("retry after a buffering timeout creates a fresh connection", async (t) => {
  const { player, native, live365 } = await runtime(t);
  t.mock.timers.enable({apis:["setTimeout"]});
  await player.playRadio();
  t.mock.timers.tick(30_001);
  assert.equal(player.getRadioPlayerSnapshot().status, "error");
  await player.playRadio(); native.audible();
  assert.equal(live365.controls.calls, 2);
  assert.equal(native.control.calls.filter(([name]) => name === "item").length, 2);
  assert.equal(native.control.calls.filter(([name]) => name === "setup").length, 1);
  assert.equal(player.getRadioPlayerSnapshot().status, "playing");
});
