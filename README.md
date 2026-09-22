# WLFM Student Radio — Stage 6

Expo Router foundation for an iOS and Android student radio app. The home screen
contains a simple Play/Pause/Retry control and a development-only Live365
connection check. Live365 discovery, native live playback, background audio,
native Play/Pause controls, synchronized live metadata, and the final player
screen are implemented.

## Verified versions

Verified September 21, 2026: Expo SDK 57 (`~57.0.24`), React Native `0.86.3`,
React `19.2.3`, Expo Router `~57.0.22`, TypeScript `~6.0.3`, Expo Development
Client `~57.0.19`, and Track Player **`@rntp/player` pinned to `5.9.2`**.
Track Player v4 (`react-native-track-player`) is frozen.
V5 requires RN 0.74+ and the New Architecture, which Expo 57 always enables.
This meets documented requirements; native compilation and device behavior still
need verification. The installed v5 license allows free academic use strictly for
instruction or noncommercial research. A publicly operated campus station may
fall outside that exemption, even if nonprofit; confirm eligibility or obtain a
license before deploying. See `node_modules/@rntp/player/license.txt`.
The optional `shaka-player` peer is omitted because web playback is outside scope.

Sources:

- [Expo 57 versioned docs](https://docs.expo.dev/versions/v57.0.0/)
- [Expo 57 release notes](https://expo.dev/changelog/sdk-57)
- [Router installation](https://docs.expo.dev/router/installation/)
- [Track Player installation](https://www.rntp.dev/docs/installation)
- [Track Player changelog](https://www.rntp.dev/changelog)
- [Development Client](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/)
- [EAS profiles](https://docs.expo.dev/build/eas-json/)
- [EAS build infrastructure](https://docs.expo.dev/build-reference/infrastructure/)
- [Live365 public stream formats](https://help.live365.com/en/support/solutions/articles/43000739178-output-encoding-settings)

## Structure

```text
src/
  app/                 # Expo Router routes only
    _layout.tsx
    index.tsx
  components/          # Player controls, NowPlaying, development diagnostics
  config/station.ts    # Central public station configuration
  constants/theme.ts   # Shared colors, spacing, radii, font sizes
  hooks/               # Live365 diagnostics and shared radio player state
  services/live365.ts  # Public networking and defensive parsing; no audio imports
  services/metadata.ts # Stream-first metadata and scoped Live365 fallback polling
  services/player.ts   # Single native player and cancellable playback commands
  services/player.web.ts # Native-only message; no web audio engine dependency
  types/               # Application-owned station, player, and metadata types
tests/                 # Networking, player, and metadata behavior checks
assets/                # Existing starter images; replace branding later
```

Keep the existing supported `src/app` convention; do not add a second root `app`
directory. `@/` resolves to `src/`. The ignored `example/` starter archive is
excluded from TypeScript checking.

Live365 requests belong in a service separate from playback and UI.
The observed public API fields are validated at runtime, as described below.
Only public information belongs in `STATION`;
never bundle private API keys or broadcaster credentials, including through
`EXPO_PUBLIC_*` variables. WLFM's public station mount ID is `a98536`.

## Install and check

Use Node.js 22.13+ (Node 22 LTS recommended).

```bash
npm ci
npm run typecheck
npm run check:dependencies
npx expo-doctor@latest
npm run test:live365
npm run test:player
npm run test:metadata
# Optional integration check against the real public endpoint:
npm run check:live365
```

## Run a development build

Use custom development builds for native audio. Expo Go cannot validate the player.
Current app identifiers are `dev.studentradio.wlfm`; choose institution-owned
identifiers before distribution. Native settings belong in Expo configuration;
generated `ios/` and `android/` folders are ignored.

Local iOS requires full Xcode 26.4+ selected and an installed iOS simulator:

```bash
npm run ios
```

Local Android requires Android Studio, its SDK, JDK 17, and an emulator or
connected debug-enabled device:

```bash
npm run android
```

These commands generate/compile native projects and launch Metro. Once the
client is installed, restart Metro with `npm start`.

EAS alternatives (first use requires login and project association):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
# iOS simulator:
npx eas-cli@latest build --platform ios --profile development-simulator
# Registered iPhone; Apple Developer signing required:
npx eas-cli@latest build --platform ios --profile development
```

Install the development build, run `npm start`, and open the app. EAS iOS uses
Xcode 26.6, the documented SDK 57 image, pinned in `eas.json`. Using Xcode 27
requires additional scene-lifecycle configuration from the Expo release notes;
that toolchain is not configured here. `npm run web` previews the UI only.

## Stage 1 acceptance check

On both native platforms:

1. Launch: station name, slogan, and player card appear.
2. Confirm the play button is disabled and produces no request or sound.
3. Check safe-area spacing, scrolling, large text, and screen-reader labels.
4. Background and reopen: the placeholder remains usable.

iOS background audio is declared with `UIBackgroundModes: ["audio"]`. Track
Player auto-links and supplies Android media-playback foreground-service
permissions in its own manifest; Expo includes network access. No Track Player
config plugin is needed. Rebuild the client whenever native dependencies or
Expo native configuration change.
Expo 57 targets iOS 16.4+ and Android 7+.

Native playback milestones require their device acceptance checks. TypeScript,
bundle exports, and native project generation cannot certify audible playback.

## Stage 2: verified Live365 integration

Verified the actual public listener page, its public JavaScript client, and live
responses on September 17, 2026:

- [WLFM listener page](https://live365.com/station/WLFM-a98536)
- [Public station JSON](https://api.live365.com/station/a98536)
- Preferred stable listening URL: `https://streaming.live365.com/a98536`.
- Alternative AAC: `https://streaming.live365.com/a98536_2`.
- Advertised HLS: `https://streaming.live365.com/a98536/playlist.m3u8`.

The station JSON uses `mount-id`, `name`, `station-logo`, `station_enabled`,
`is_playing`, `listening-urls` (`url`, `encoding`, `bitrate`), `stream-url`,
`stream-hls-url`, and `current-track` (`title`, `artist`, `art`). The fixture in
`tests/fixtures/live365-a98536.json` is a subset of one actual response, with
unneeded fields omitted. App types describe normalized, validated data rather
than casting JSON to a claimed API interface. These are observed listener APIs,
not a documented versioned broadcaster contract; fields can change.

MP3 returned `audio/mpeg`, 128 kbps; AAC returned `audio/aacp`, 64 kbps.
Both streams advertised `icy-metaint: 8192` and yielded actual ICY title/artist
metadata. The HLS URL returned a valid master playlist. Select MP3 for the first
player milestone because the canonical mount works, ICY metadata is available,
and the codec is broadly supported. RNTP 5 supports both standard streams and
HLS; no device latency/robustness comparison has been performed. Keep HLS available
without preferring it or persisting its temporary CDN/session URL.

`getStationInfo()`, `getStreamUrl()`, and `getNowPlaying()` are independently
callable. Each makes a fresh request; consumers needing multiple fields should
use one station snapshot, as the diagnostics hook does. Requests have a 10-second
timeout covering body reading, optional caller cancellation, and typed errors.
Missing metadata returns `null`; missing/unsafe stream URLs are not fabricated.
Explicitly disabled/offline stations report no preferred stream or current song.
No credentials, dependencies, audio requests, or metadata polling were added.

The home screen displays diagnostics only under `__DEV__`. It fetches once when
mounted and on manual Refresh. Unmount/superseded requests are cancelled, and
cancelled results cannot overwrite a newer snapshot. This API snapshot may differ
from what a future listener hears due to buffering or personalized ad insertion;
stream metadata will be evaluated as the primary source in Stage 5.

Stage 2 checks: strict TypeScript and 15 service checks pass, including live calls
to all three service functions. Stage 2 device checks were subsequently confirmed
by the user. No native dependency/config
changed in Stage 2, so an existing Stage 1 development build only needs `npm start`.

On iOS and Android, open the app and confirm API Connected, URL available, and
title/artist (or LIVE/WLFM fallbacks). Turn off network access and press Refresh:
an error should appear, with Play still disabled. Restore connectivity and Refresh:
the connection should recover. Navigate away during a request to verify cleanup.
These describe the Stage 2 checkpoint; Play is now enabled in Stage 3.

## Foundation verification

Passed: strict TypeScript, online Expo dependency checks, all 21 Expo Doctor
checks, and bundle exports for iOS/Android/web. Native projects were generated
in a temporary directory without installing pods; Track Player was detected by
autolinking on both platforms, and generated iOS configuration contains the audio
background mode. Generated native projects were not added to this repository.

Native builds/device checks remain pending: this machine currently selects
Apple Command Line Tools instead of full Xcode, and has JDK 23 rather than the
recommended JDK 17. Use the EAS development profiles or configure those local
toolchains before completing the native acceptance check.


## Stage 3: native live playback

Uses the installed `@rntp/player` 5.9.2 APIs verified against current docs and
source: synchronous setup, media-item, play/pause, retry, state getters/events,
and `setCommands`. Sources: [setup](https://www.rntp.dev/docs/player-setup),
[playback](https://www.rntp.dev/docs/playback), [events](https://www.rntp.dev/docs/events).

No initialization or playback occurs on initial mount. First Play lazily loads
the native library, initializes once in the foreground, discovers the verified
Live365 stream, installs one `isLive` item, and requests playback. Native state
determines the display. Pause cancels discovery or buffering, and a generation
counter prevents superseded attempts from playing. Normal resume reuses the
live item at the live edge. No seek/next/previous controls are available.
No native dependency/configuration changed in this stage.

Failed connections offer explicit Retry. Native error recovery calls `retry()`
then `play()`. A stalled start fails after 30 seconds; retry reloads the stream.
No automatic retries or metadata polling occur. Station fallback metadata is
LIVE/WLFM; stream-driven metadata is disabled until Stage 5. Native Play/Pause
commands are the minimum needed to restrict the media session to radio controls;
Stage 4 reviews/tests background behavior, interruptions, and native controls.

The service owns one player per JS runtime. UI observer subscriptions clean up
through `useSyncExternalStore`; screen unmount does not destroy the player.
Native/app-state listeners are registered once for the service lifetime.
Stage 4 uses native command handling, so a JavaScript playback-session entry
point is not needed for Play/Pause while the app process is suspended.
The web-specific service displays a development-build requirement instead of
installing the optional Shaka web audio engine.

Passed: strict TypeScript, 13 player tests using a native mock, existing Live365
tests, native generation/autolinking on both platforms, and iOS/Android/web
bundle exports. These cannot prove native compilation or audible playback.
Full Xcode is installed at version 26.3, below SDK 57's documented minimum 26.4;
CocoaPods is not on PATH. Use EAS or configure the local toolchain. Native UI
automation access is unavailable.

Exact next command for an existing development build:

```bash
npm start
```

Test on **both iOS and Android**, with a client including `@rntp/player`:

1. Cold launch: no audio and a Play button.
2. Press Play: Connecting/Buffering changes to Playing live and WLFM is audible.
3. Pause: sound stops. Resume: live audio returns.
4. Rapidly press Play/Pause during connection: canceled attempts must not start.
5. Disable connectivity and attempt playback: an error offers Retry. Restore
   connectivity and Retry: audio returns without restarting the app.
6. Leave/reopen the screen: its state matches the actual player.

If native linking is missing, rebuild; refreshing JS is insufficient:

```bash
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development
# For an iOS simulator instead of a physical iPhone:
npx eas-cli@latest build --platform ios --profile development-simulator
```

Install the rebuilt client and run `npm start`. Do not use Expo Go. Stage 3
device acceptance was confirmed by the user before Stage 4 began.

## Stage 4: background audio and native controls

The player requests exclusive music audio focus and uses Track Player's native
Play/Pause handling. Native handling continues to work when React Native's
JavaScript runtime is suspended, and seek/next/previous remain unavailable.
The queued live item supplies `LIVE`, `WLFM`, and a bundled WLFM image to iOS
Now Playing, Android's media notification, Bluetooth, and other media surfaces.

The setup explicitly enables route-loss handling. Disconnecting wired headphones
or a Bluetooth audio route pauses playback instead of moving it to the phone
speaker. The installed iOS player pauses for audio interruptions and resumes only
when the system allows resumption and the stream was playing beforehand. Android
uses Media3 audio focus through exclusive mixing. Returning the app to the
foreground rereads native state, so the button reflects changes made through
lock-screen or notification controls.

Android uses network wake mode for the live stream and continues playback when
the task is removed from recents. The library's Media3 service owns the foreground
media notification. Some Android vendors can still stop long-running playback
under device-specific battery restrictions, which requires device testing.

Verified for Stage 4:

- strict TypeScript;
- 14 player service tests, including one-time initialization, native-state sync,
  Play/Pause-only commands, background policy, and fallback system metadata;
- all 15 Live365 service checks (14 local passes and the opt-in live check skipped);
- iOS and Android release bundle exports, both containing bundled artwork;
- clean Expo prebuild in a temporary directory;
- generated iOS `UIBackgroundModes` containing `audio`;
- successful Android merged-manifest processing containing `WAKE_LOCK`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, and Track Player's
  `mediaPlayback` service.

Relevant current documentation:

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Track Player setup and background playback](https://www.rntp.dev/docs/player-setup)
- [Track Player playback and remote controls](https://www.rntp.dev/docs/playback)

Expo Go cannot run this native player. A client that already contains Track
Player and the iOS audio background mode only needs Metro for these Stage 4
JavaScript changes:

```bash
npm start
```

If the installed client predates either native setting, rebuild it with one of:

```bash
# Android development build
npx eas-cli@latest build --platform android --profile development

# Physical iPhone development build
npx eas-cli@latest build --platform ios --profile development

# iOS Simulator development build
npx eas-cli@latest build --platform ios --profile development-simulator
```

Install the resulting client, run `npm start`, and test on both platforms:

1. Launch and press Play; wait for audible live audio.
2. Lock the device and confirm playback continues with WLFM artwork and only a
   Play/Pause transport control.
3. Pause on the lock screen or Android notification, resume there, then return
   to the app and confirm its button matches the real state.
4. While playing, background the app and remove it from Android recents; confirm
   audio and the notification continue.
5. Disconnect headphones or Bluetooth; confirm playback pauses and does not
   switch to the phone speaker.
6. Start a call or another audio interruption; confirm playback pauses and only
   resumes when the operating system permits it.

A physical iPhone is the meaningful lock-screen/interruption test. Local iOS
builds remain blocked until Xcode 26.4+ and CocoaPods are selected; this machine
previously reported Xcode 26.3. For Android local builds, use the SDK 57 toolchain
and JDK 17. The EAS development profiles avoid those local toolchain limits.
Stage 4 device acceptance was confirmed by the user before Stage 5 began.

## Stage 5: now-playing metadata

Track Player's `autoUpdateMetadataFromStream` is enabled. Native ICY/ID3 metadata
updates the active media item and therefore the lock screen, Android notification,
Bluetooth surfaces, and app UI without replacing or restarting the stream. The
app listens to raw `MetadataReceived` events to establish stream authority and
to `MediaMetadataChanged` for the effective native state. Foreground reconciliation
recovers metadata events missed while JavaScript was suspended.

The public Live365 `current-track` response is a fallback and artwork source. It
is requested immediately after playback becomes audible and then at most every
30 seconds while audio is playing. Polling stops and in-flight requests are
aborted on pause or error. Live365 never overrides a stream title or artist.
Its artwork is used only when normalized title and artist match the current
stream track, preventing delayed directory responses from attaching stale art.

Missing, blank, malformed, or non-HTTPS metadata falls back to the bundled WLFM
image and:

```text
LIVE
Student Radio
```

The temporary home-screen `NowPlaying` component displays title, artist, and
artwork. Failed remote artwork loads return to the bundled image. Stage 6 owns
the final visual design.

Verified for Stage 5:

- strict TypeScript;
- 7 metadata tests covering source priority, matching artwork, malformed data,
  polling scope, cancellation, and foreground recovery;
- 15 player tests covering native event wiring and lock-screen metadata updates;
- 15/15 Live365 checks against the current public WLFM endpoint;
- iOS, Android, and web bundle exports.

Sources: [Track Player events](https://www.rntp.dev/docs/events),
[Track Player playback](https://www.rntp.dev/docs/playback),
[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), and the
[WLFM public station response](https://api.live365.com/station/a98536).

No native package or Expo configuration changed in Stage 5. Use the existing
development build and run:

```bash
npm start
```

Test on both iOS and Android:

1. Before playback, confirm `LIVE` / `Student Radio` and bundled artwork.
2. Press Play and confirm the current stream title and artist appear without an
   audio restart; matching Live365 artwork may follow.
3. Check that the lock screen or Android notification shows the same metadata.
4. Leave the stream playing across a song change. Confirm app and system metadata
   update while audio remains continuous.
5. Pause and wait at least 30 seconds; metadata should remain stable. Resume and
   confirm it refreshes.
6. Background and foreground the app, then confirm its metadata matches the
   native media controls.
7. Disable networking during playback and confirm the last valid metadata or
   station fallback remains usable without crashing.

Stream and directory timing can differ because of buffering or inserted content;
the app intentionally trusts the audio stream in that case. Background JavaScript
may be suspended, but Track Player's native auto-update path still updates stream
title and artist on system media surfaces.

## Stage 6: final UI and engineering review

Stage 5 device acceptance was confirmed before this stage. The final screen uses
the revised design brief: generous spacing, subtle depth, accessible contrast,
and large touch targets. It includes the WLFM logo and name, station slogan,
LIVE badge, large artwork, title, artist, an 88-point Play/Pause/Retry control,
and a status treatment for idle, connecting, buffering, playing, paused, and
unavailable states. The palette is derived from the supplied WLFM artwork. Core
text/background contrast is at least 6.9:1, and white on the primary action is
7.3:1.

The Expo appearance and splash configuration now match the light app surface.
The splash uses the WLFM artwork on `#FFF8F2`. These are native configuration
changes, so existing development clients must be rebuilt. Expo notes that
development builds cannot fully reproduce the standalone splash screen; check
the splash again in a production build.

Final engineering review:

- strict TypeScript is enabled; no `any` or unused imports remain;
- player setup, listeners, and UI stores are singletons per JavaScript runtime;
- superseded playback and Live365 requests are aborted and guarded by generations;
- UI subscriptions and component effects clean up on unmount;
- metadata polling stops on pause/error and stale responses cannot publish;
- native ICY/ID3 remains the title/artist authority; matching API art is optional;
- foreground reconciliation covers native control changes and missed metadata;
- iOS background audio and interruption/route handling remain configured;
- Android manifest merging retains wake lock, foreground media permissions, and
  Track Player's `mediaPlayback` service;
- iOS, Android, and web production bundle exports pass;
- no new runtime dependency was added for the UI.

### Final project tree

```text
WLFMmobile/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── assets/
│   └── images/
│       └── wlfm-square.png
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   ├── components/
│   │   ├── Live365Diagnostics.tsx
│   │   ├── NowPlaying.tsx
│   │   ├── PlayerButton.tsx
│   │   └── RadioPlayer.tsx
│   ├── config/
│   │   └── station.ts
│   ├── constants/
│   │   ├── assets.ts
│   │   └── theme.ts
│   ├── hooks/
│   │   ├── useLive365Diagnostics.ts
│   │   ├── useNowPlaying.ts
│   │   └── useRadioPlayer.ts
│   ├── services/
│   │   ├── live365.ts
│   │   ├── metadata.ts
│   │   ├── player.ts
│   │   └── player.web.ts
│   └── types/
│       ├── live365.ts
│       ├── metadata.ts
│       ├── player.ts
│       └── station.ts
└── tests/
    ├── fixtures/live365-a98536.json
    ├── live365.test.mjs
    ├── metadata.test.mjs
    └── player.test.mjs
```

### Final setup and validation

Use Node.js 22.13+ and install the locked dependencies:

```bash
npm ci
npm run typecheck
npm run test:live365
npm run test:metadata
npm run test:player
npm run check:dependencies
```

Rebuild and install a development client because Stage 6 changed native
appearance and splash configuration:

```bash
# Android
npx eas-cli@latest build --platform android --profile development

# Physical iPhone
npx eas-cli@latest build --platform ios --profile development

# iOS Simulator
npx eas-cli@latest build --platform ios --profile development-simulator
```

Then start Metro:

```bash
npm start
```

Perform the full physical-device acceptance pass: all six visual/player states,
large text and screen reader labels, small-screen scrolling, live audio, a song
change, background/lock playback, native Play/Pause, interruption handling,
headphone/Bluetooth disconnect, offline/retry, and app/native-state agreement.

For a store build after acceptance:

```bash
npx eas-cli@latest build --platform all --profile production
```

Before the first store upload, replace `dev.studentradio.wlfm` with an
institution-owned Android package and iOS bundle identifier; these identifiers
are difficult or impossible to change after release. Confirm that WLFM's use of
`@rntp/player` satisfies its license, verify continued access to the observed
public Live365 listener API, and inspect the splash screen in a release build.
Do not put broadcaster credentials or private keys in the mobile bundle.

`npm audit --omit=dev` currently reports moderate advisories in Expo SDK 57's
transitive `query-string/decode-uri-component` and build-time
`@expo/config-plugins/xcode/uuid` chains. npm's suggested forced fix would
downgrade Router and SplashScreen across SDK boundaries, so it was not applied.
Recheck after Expo publishes compatible patched dependencies; do not use
`npm audit fix --force` on this SDK without reviewing the resulting versions.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo SplashScreen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/),
[Expo development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/),
[Track Player setup](https://www.rntp.dev/docs/player-setup), and
[Track Player events](https://www.rntp.dev/docs/events).
