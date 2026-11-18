# WLFM store metadata — English (United States)

This is working copy. Confirm all `TODO(RELEASE)` items before submission.

## Shared identity

- App name: `WLFM`
- Publisher/legal entity: `TODO(RELEASE): Confirm Lawrence University or other legal publisher name.`
- Copyright: `TODO(RELEASE): Confirm, for example "2026 Lawrence University".`
- Primary category: Music
- Secondary Apple category: Entertainment
- Google Play category: Music & Audio
- Price: Free
- Marketing URL: `https://solwlfm.lawrence.edu/`
- Support URL: `https://solwlfm.lawrence.edu/contact/`
- Support email: `TODO(RELEASE): Add a monitored institutional email address.`
- Privacy-policy URL: `TODO(RELEASE): Add the published HTTPS URL.`

## Apple App Store

### Subtitle

Lawrence Student Radio

### Promotional text

Listen to WLFM live, see what is playing, explore the upcoming schedule, save favorite shows, set local reminders, and read the latest station blog stories.

### Keywords

WLFM,Lawrence University,college radio,student radio,live radio,music,schedule,Appleton

## Google Play

### Short description

Listen to WLFM live and explore shows, schedules, reminders, and station news.

## Full description

WLFM is Lawrence University's student radio station and the only alternative in the valley.

Listen to the live WLFM stream and keep up with the station in one place:

- Continue listening in the background with lock-screen and media controls.
- See current song information, album artwork, and recently played tracks.
- Explore the upcoming two-week show schedule.
- View schedule times in station time or your device's local time.
- Save favorite shows and create optional local reminders for upcoming airings.
- Read recent stories from the WLFM website in a native article reader.
- Choose a light, dark, or system appearance.

An internet connection is required for live audio, schedule updates, current song information, and station stories. Show reminders are scheduled locally on the device and can be disabled at any time.

## Version 1.0 release notes

Welcome to the WLFM mobile app. Listen live, follow current song information, browse the upcoming schedule, save favorite shows, set local reminders, and read recent station stories.

## Store questionnaire working answers

These are preparation notes, not final legal or policy determinations.

- Account required: No.
- User-generated content submitted through the app: No.
- In-app purchases: No.
- Location access: No.
- Contacts, photos, camera, or microphone access: No.
- Notifications: Optional local show reminders and media playback controls.
- Background activity: Live radio playback while the app is backgrounded or the screen is locked.
- Advertising: No. The current Live365 station stream does not contain advertising, and the app does not include an advertising SDK.
- Explicit content: Yes. The live student-radio stream may contain explicit language or mature themes. Answer both stores' content-rating questions conservatively.
- Target audience: A general audience of teen and adult radio listeners. The app is not designed specifically for children.
- iPad support: Yes. Include final-release testing and the required iPad screenshots.
- Content rights: `TODO(RELEASE): Confirm the publisher is authorized to distribute WLFM branding, stream audio, schedule information, artwork, and articles.`

## Preliminary privacy-label notes

Do not copy these notes into a store questionnaire without reviewing the final
production build and each third party's practices.

- The app has no listener account, analytics SDK, advertising SDK, or separate
  WLFM application backend in the current source tree.
- Appearance, schedule-display preference, favorite shows, diagnostics
  preference, and reminder settings are stored on the device.
- Local notification requests and scheduled reminders are handled on the
  device; the app does not request an Expo push token.
- The app makes direct requests to Live365, Google Calendar, the WLFM WordPress
  site, audio and image hosts. Those services can receive routine connection
  information such as an IP address and request metadata.
- External links open in the system browser and are then governed by the
  destination site's practices.

