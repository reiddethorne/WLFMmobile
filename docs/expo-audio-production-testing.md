# Expo Audio production-player device test

This checklist tests the real Home-screen radio player after its migration to Expo SDK 57 `expo-audio`. The temporary feasibility player and legacy native engine have been removed, so Expo Audio is the app's only production audio engine.

## Prepare the build

The Expo Audio config plugin contains native changes. Build and install a fresh development client rather than using Expo Go or a client from before this migration:

```bash
npm ci
npm run ios
# or
npm run android
```

Start Metro with `npm start`, open the Home tab, and use the main radio **Play** button. Do not use an older installed build or the removed feasibility controls.

`npm ci` applies the pinned Expo Audio 57.0.5 iOS live-stream patch automatically. If its postinstall step fails, do not build or test an unpatched iOS client.

## Test both sources

Open **More → Preferences**, enable diagnostics, and return Home. Leave the transport on HLS for the first run, then select MP3 and press Play again for the second run.

For both HLS and MP3, confirm:

- Audio becomes audible and the app progresses from connecting/buffering to playing.
- Pause and resume work in the app.
- Title, artist, and remote artwork update without interrupting audio.
- Lock-screen or Control Center play/pause works on iOS.
- Media-notification play/pause works on Android.
- Headset and Bluetooth play/pause controls work.
- Disconnecting headphones or Bluetooth does not unexpectedly continue on the speaker.
- A phone call or competing audio interrupts playback safely.
- After disabling the network long enough to exhaust the HLS buffer, the app changes from Playing to Buffering and iOS system controls stop reporting active playback. Restoring the network reloads the stale live source and returns both to Playing without pressing Play or reopening the app; use the visible Retry action after a terminal error.
- While the stream is buffering without a network, press Pause, restore the network, and press Play from both the app and the lock screen. Each Play should reload HLS and resume even when the pause lasted less than 15 seconds.
- After pausing for at least 15 seconds, return to the app and press Play; the live source should reconnect instead of remaining on Connecting.
- On iOS, pause from the lock screen, keep the device locked for at least 15 seconds, and resume from the lock screen; audio should rejoin the live stream without opening the app.
- Returning to the foreground shows the same playing or paused state as the native controls.

## Background endurance gate

On a physical iOS device and a physical Android device:

1. Start the normal Home-screen player.
2. Lock the device and leave the stream playing for 60–90 minutes.
3. Confirm audio remains continuous and system metadata continues to update.
4. On Android, repeat after removing the app from recents and record whether playback continues.

The Android result is a hard gate because Expo issue [#49906](https://github.com/expo/expo/issues/49906) reports playback-service shutdown after roughly 10–15 minutes in some configurations.

Record the device, OS version, selected transport, build mode, elapsed time, and any failure. Do not treat the migration as release-ready if background playback, media controls, interruption handling, metadata, or state reconciliation is unreliable.
