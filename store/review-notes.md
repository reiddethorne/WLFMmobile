# Store review notes

Replace all `TODO(RELEASE)` markers before submission. Keep these notes aligned
with the exact production build submitted for review.

## Apple App Review notes

WLFM is Lawrence University's student radio station. The app provides direct
access to its live radio stream, public program schedule, optional local show
reminders, and recently published station stories.

No account, login, subscription, purchase, or reviewer credential is required.
An internet connection is required for live content.

To test the primary feature:

1. Open the Home tab.
2. Tap the main Play button.
3. Background the app or lock the device to verify continued audio and system
   media controls.
4. Return to the app and use Pause to stop playback.

The app requests notification permission only after the reviewer chooses to
enable a reminder for a scheduled show. Reminders are scheduled locally. The
app does not register for remote promotional push notifications.

Background audio is a core feature because the app is a live radio player.
Current track metadata and artwork can vary with the live station feed.
The live student-radio stream may contain explicit language or mature themes;
the store content-rating questionnaire is answered accordingly. Version 1.0
supports both iPhone and iPad.

`TODO(RELEASE): Add an institutional statement confirming authorization to
publish the WLFM stream, branding, schedule, and articles.`

Reviewer contact:

- Name: `TODO(RELEASE)`
- Email: `TODO(RELEASE)`
- Phone: `TODO(RELEASE)`

## Google Play review notes

- App access restrictions: None; no login is required.
- Ads declaration: No. The current Live365 station stream does not contain
  advertising, and the app does not include an advertising SDK.
- Exact alarms: The app declares `SCHEDULE_EXACT_ALARM` to support listener-
  initiated, time-specific reminders for scheduled radio shows. Reminders are
  optional, user-configured, visible in the Notifications screen, and
  cancellable by the user.
- Foreground service: Used only for user-started background media playback and
  the Android media notification.
- Data Safety: Complete from the final privacy review and production behavior;
  do not rely solely on the preliminary notes in `metadata/en-US.md`.

