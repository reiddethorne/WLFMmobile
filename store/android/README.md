# Google Play listing assets

Capture the final release candidate, without development menus or diagnostics,
and save approved exports here:

```text
store/android/phone-screenshots/01-home.png
store/android/phone-screenshots/02-now-playing.png
store/android/phone-screenshots/03-schedule.png
store/android/phone-screenshots/04-reminders.png
store/android/phone-screenshots/05-blog.png
store/android/feature-graphic.png
store/android/play-store-icon.png
```

## Required graphics

- Provide at least two phone screenshots. Google currently accepts JPEG or
  24-bit PNG screenshots from 320 to 3840 pixels, with the long side no more
  than twice the short side.
- Export the Play Store icon as a 512 by 512 pixel PNG.
- Export the feature graphic as a 1024 by 500 pixel JPEG or 24-bit PNG without
  transparency.
- Confirm the latest requirements in Google's [preview asset
  documentation](https://support.google.com/googleplay/android-developer/answer/9866151)
  immediately before upload.

## Launcher icon

The repository already contains foreground, background, and monochrome Android
icon source files, but `app.json` does not currently configure an
`android.adaptiveIcon`. Configure and preview those layers before building the
production Android App Bundle.

