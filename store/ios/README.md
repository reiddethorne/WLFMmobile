# iOS listing assets

Version 1.0 supports both iPhone and iPad. Test and approve the final release
candidate on both device families and provide the required screenshots.

## Screenshots

Capture the final release candidate, without development menus or diagnostics,
and save approved exports here:

```text
store/ios/iphone-screenshots/01-home.png
store/ios/iphone-screenshots/02-now-playing.png
store/ios/iphone-screenshots/03-schedule.png
store/ios/iphone-screenshots/04-reminders.png
store/ios/iphone-screenshots/05-blog.png
store/ios/ipad-screenshots/01-home.png
store/ios/ipad-screenshots/02-schedule.png
```

Apple currently requires at least one qualifying iPhone screenshot. Because
`ios.supportsTablet` is currently `true`, a qualifying 13-inch iPad screenshot
is also required. App Store Connect accepts up to ten screenshots per device
size. Use exact dimensions accepted by the current [Apple screenshot
specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).

Screenshots must not contain an alpha channel. Remove personal notifications,
carrier details that should not be published, debug controls, and test data.

## App icon

The source `assets/images/wlfm-square.png` is 1024 by 1024 pixels but currently
contains an alpha channel. Before submission, export an approved square version
that fills the canvas and has no transparency, then update `ios.icon` to use it.
Do not pre-round the corners; iOS applies its own mask.

