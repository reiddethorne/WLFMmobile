# WLFM Mobile

A cross-platform app for WLFM, Lawrence University's student radio station, built with Expo, React Native, and TypeScript.

I built this app to make WLFM easier to discover and listen to. By bringing the live stream, schedule, reminders, and blog posts all into one place, I hope to help current listeners stay connected, introduce new listeners to the station, and help to grow WLFM’s audience.

## Features

- Live365 playback with background audio and native media controls
- Now-playing metadata, album art, recently played tracks, and a sleep timer
- A 14-day schedule loaded from Google Calendar
- Station-time or device-time schedule display
- Favorite shows and local reminder notifications
- WordPress stories rendered in a native article reader
- Light and dark themes with persistent preferences
- iOS, Android, and limited web support

## How it is organized

The app keeps routing, interface state, and external services separate:

- `src/app/` contains Expo Router screens and navigation.
- `src/components/` contains the radio player, schedule, article, and settings UI.
- `src/hooks/` coordinates cancellable screen state and shared player state.
- `src/services/` isolates Live365, Google Calendar, WordPress, playback, and notifications.
- `tests/` covers parsing, request handling, playback state, schedules, reminders, and articles.

External responses are validated and converted into application-owned types instead of being passed directly to the interface. The schedule layer caches fresh results and coordinates overlapping requests, while the player service owns one native playback queue and rejects stale commands. Platform-specific adapters keep native-only audio and notification code out of the web build.

No separate application server is required. The app reads the public station stream and schedule directly and uses a dedicated read-only WordPress account for published stories.

## Technology

- Expo SDK 57 and Expo Router
- React Native 0.86 and React 19
- TypeScript 6
- `@rntp/player` for native audio
- Expo Notifications, SecureStore, and AsyncStorage
- Live365, Google Calendar, and WordPress integrations
- Node's built-in test runner

## Getting started

Use Node.js 22.13 or newer. Native builds also require Xcode for iOS or Android Studio, JDK 17, and the Android SDK for Android.

Install the project and create a local environment file:

```bash
npm ci
cp .env.example .env.local
```

The schedule needs a public Google Calendar ID and a restricted Google Calendar API key. The Blog tab needs a dedicated WordPress username and application password. Fill in the corresponding values in `.env.local`.

All `EXPO_PUBLIC_*` values are bundled with the application and can be extracted. Do not use a private calendar or a WordPress account with write or administrative access. See the [WordPress setup guide](docs/wordpress.md) for the account and credential model.

## Running the app

Native audio requires a development build; Expo Go cannot run the player.

```bash
# iOS
npm run ios

# Android
npm run android
```

After installing a development build, start Metro with:

```bash
npm start
```

`npm run web` can be used to preview the interface, but native playback, authenticated Blog access, and notifications are intentionally unavailable or limited on web.

## Verification

```bash
npm run typecheck
node --test tests/*.test.mjs
```

The current suite contains 154 checks. The latest local run passed 152 and skipped the two optional live-endpoint checks, with no failures. Live checks can be run separately with `npm run check:live365` and `npm run check:calendar` after configuration.

## Current limitations

- Live365 listener responses are public but are not a versioned API contract.
- Playback and notification behavior still needs physical-device acceptance testing on both platforms.
- The checked-in bundle identifiers use `dev.studentradio.wlfm` and should be replaced before distribution.
- Distribution requires confirming that the selected `@rntp/player` license covers the station's use.
- The Blog currently embeds an application password for a dedicated WordPress account configured for read-only access. Because client-side credentials are extractable, a production version should use an unauthenticated public feed or a small backend proxy.

The detailed implementation history and platform notes from the original README are preserved in [docs/codex-output.md](docs/codex-output.md).

## License

This project is available under the terms in [LICENSE](LICENSE).
