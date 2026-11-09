# Direct WordPress blog connection

The native app connects directly to
`https://solwlfm.lawrence.edu/wp-json/wp/v2/posts`. No separate server or hosting
service is required. **The connection is working, and the site owner accepted
the documented credential-extraction risk for this dedicated account.** On
November 5, 2026, the initial live posts check, before the date
cutoff was added, returned HTTP 200 and 16 published, unprotected posts matching
the app's expected response format.
The user also confirmed Blog is working in the app. No credentials or post
contents were included in the check's output.

## Accepted risk and account scope

The site administrator confirmed that the dedicated account only reads posts
on the solwlfm blog, has no writing privileges, and cannot access compromising
information. After the shared credential's potential extraction and use outside
the app were discussed, the site owner accepted that deployment tradeoff for
this specific account. That decision does not apply to an Editor or
administrator account and does not mean the bundled credential is secret.

These access assurances come from the site owner. The successful live check
verified feed access and response parsing; it did not audit the account's full
capabilities or attempt to read private content or perform writes. The app's
GET-only requests and post filtering do not restrict what the credential itself
can do on WordPress. If the account's access changes, review whether the shared
credential is still appropriate to distribute.

## Configuration

Configure native development builds in the existing ignored `.env.local` using
an editor, keeping the calendar values already there:

```dotenv
EXPO_PUBLIC_WORDPRESS_ENABLED=true
EXPO_PUBLIC_WORDPRESS_USERNAME="<dedicated-wordpress-username>"
EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD="<application-password>"
```

Use the WordPress login username associated with the generated Application
Password, not a display name or the password's application label. Use the
generated Application Password, never a WordPress login password. Straight
double quotes around both values are supported and are not part of the loaded
credentials. WordPress's display spaces are accepted. Do not put real values in
`.env.example`, source control, screenshots, logs, or shell commands/history.
For cloud builds, configure the same three variables in the matching EAS
environment. Restart Metro and reload after changing local values; shipped
apps require a new bundle to receive changed configuration.

The committed `.env.example` sets `EXPO_PUBLIC_WORDPRESS_ENABLED=true` but
leaves both credential fields blank so it can be shared without credentials.
Keep the flag enabled in the local or EAS environment that should load Blog.
A disabled flag or two blank credential fields makes no WordPress requests and
shows Blog's coming-soon message. Partially filled or invalid credentials show
a configuration error without making a request.
It never uses a previous Keychain record to bypass this setting. Browser
previews also retain the coming-soon message: authenticated blog access is
native-only, and the web credential module contains no bootstrap values or
browser-storage fallback.

## Encryption and credential distribution

Listeners do not need to type a password. Each native build includes the shared
credential as bootstrap configuration. On first Blog access, the app saves a
single credential record with Expo SecureStore and reads it back before making
an authenticated request. Later requests read the stored record; new bundle
credentials replace stale or rotated records, including a record left by an iOS
reinstall. Storage failures stop the request; there is no AsyncStorage or
plaintext-storage fallback.

**The bundled bootstrap values remain extractable.** Expo inlines
`EXPO_PUBLIC_*` variables into the compiled app as readable values. Copying them
to SecureStore does not remove or encrypt the copy in the bundle. EAS variable
visibility settings do not change that. The site owner accepted this tradeoff
for the specific dedicated account described above. That decision does not make
the bundled copy encrypted or secret. Keeping a shared credential
secret from listeners would require a different architecture.

SecureStore encrypts the persisted device copy using Android Keystore-backed
storage or iOS Keychain. iOS accessibility is
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`; credentials do not migrate to another device.
Biometric prompts are not required for browsing. The config plugin excludes
SecureStore data from Android backups. iOS Keychain data can survive an
uninstall, so reinstalling is not a reliable way to erase it.

For rotation, replace the environment values and distribute a new bundle.
Revoke the old Application Password in WordPress when it should stop working.
An old installed bundle still contains its old credential and cannot obtain a
replacement automatically without receiving an updated bundle.

## Rebuild once for SecureStore

The integration uses `expo-secure-store` **57.0.4** and its Expo config plugin.
Rebuild a development client if it predates this native dependency; a Metro
reload cannot add the native module. Once the client includes SecureStore,
changes to credentials or the enabled flag only require restarting Metro and
fully reloading the app. For a local native rebuild, regenerate configuration
first:

```bash
npx expo prebuild
npm run ios
# Or:
npm run android
```

The existing EAS development profiles can also rebuild the client. An
unconfigured app does not load SecureStore, so its placeholder can still work
in an older client without this native module.

The article reader adds `htmlparser2` and `domhandler`, which are JavaScript-only
dependencies. Install updated packages and restart Metro after pulling this
change. No additional native rebuild is required if SecureStore is already in
the installed client.

## Requests and verification

Requests send `Authorization: Basic <base64(username:application_password)>`
only to the fixed station posts endpoint and numeric `/posts/{id}` article
endpoints over HTTPS. Base64 is encoding, not
encryption. `expo/fetch` implements native redirect blocking on Android and iOS;
redirects fail instead of forwarding the header to another destination. Cookies
are omitted. Image requests and outbound links never receive this header.

The feed requests up to 20 of the newest posts with `context=view` and
`status=publish`. Only articles published from **January 1, 2026 at midnight
Central time** onward are shown (after the end of 2025). The request includes an
`after` bound one second before that instant, and local parsing enforces the
inclusive cutoff using `date_gmt`. This also excludes UTC times on January 1
that still fall on December 31 in Central time. Missing or invalid dates are
excluded because their eligibility cannot be verified. The same restriction
applies to cached articles and individual article links.

Posts with private, draft, or future status, and password-protected posts, are
excluded again when parsing; protection is checked on both excerpt and body.
Requests include `date_gmt`, rendered content, and embedded author/featured-media
data. `_links` and `_embedded` are included in the requested fields so WordPress
can return those embedded resources. Only public display fields are retained;
author account details such as email addresses are discarded. Older-post
pagination is not part of this integration.

## Feed and article reader

Cards display the title, author, publication date, a short excerpt, and a cover
image. Featured images are preferred; otherwise the first inline article image
is used. Missing author names fall back to WLFM, undated articles are excluded,
and text-only articles do not get a fabricated image.
WordPress GMT dates are parsed as UTC and displayed in `America/Chicago`.

Tapping a card opens `/article/[id]` inside the app. The native reader displays
the author and date, full article text, headings, emphasis, lists, blockquotes,
inline images, image descriptions, and captions. Images preserve their aspect
ratio, and failed loads display an unavailable state. Legacy HTTP image URLs
are attempted over HTTPS; cleartext networking is not enabled. Some old source
images may no longer be available from their publishers.

HTML is parsed into a limited native view model, not loaded into a WebView.
Scripts, CSS, forms, event handlers, and unsafe URLs are omitted. Website layout
and styling are not reproduced. YouTube and other media embeds appear as
explicit links that open externally when tapped. Links to other currently
cached blog stories open the native reader; other outbound links open the
system browser without WordPress credentials.

Article bodies are cached only in memory for five minutes, with at most 40
entries. Normal card navigation reuses the loaded body without another request;
direct article links fetch and validate the numeric ID when necessary. Successful
feed refreshes replace the article cache so removed or newly protected entries
are not kept from the previous feed. Only the ID goes into navigation parameters,
not the full article body. Private/protected articles and mismatched IDs are
rejected on individual article requests too.

Blog loads on tab focus and offers pull to refresh and Retry. Leaving the tab
cancels network work; failed refreshes retain the previously loaded stories.
Network timeouts cover both headers and body reading, and responses are capped
at 1 MiB. Errors never display upstream bodies, raw transport errors, or
credentials. Native storage and networking are separate from audio playback.

In development builds, a failed request also shows a `Blog check` line with the
local error category, HTTP status, and an allowlisted WordPress error code when
available. This line is safe to share; it never includes response messages,
headers, usernames, passwords, or arbitrary server error codes. It is hidden in
release builds. HTTP 401 alone does not prove the password is wrong: the server
can also reject API access or fail to pass the Authorization header to WordPress.
`invalid_username` or `incorrect_password` points to the supplied credentials;
`rest_cannot_access` indicates an API access restriction that the site
administrator may need to check alongside Application Password authentication
and header forwarding.

```bash
npm run test:wordpress
npm run typecheck
```

The WordPress suite uses fake credentials and mocked SecureStore/network
adapters. It covers metadata and media fallbacks, native HTML blocks, safe links,
protected article bodies, GMT dates, cached navigation, direct article requests,
and cache replacement in addition to authentication and error handling.
TypeScript and iOS/Android/web bundle exports passed.

The November 5, 2026 live check, before the publication cutoff was added,
separately confirmed HTTP 200 for both the
expanded feed and a single article. All 16 posts had parseable article content
and publication dates, 12 had embedded author names, and article HTML contained
27 image elements. No featured images were present, so card covers use inline
images. Two legacy image URLs did not have working HTTPS versions when checked.
These counts describe that snapshot, not fixed expectations. The original Blog
connection was also confirmed working in the app by the user.

After the publication cutoff was added, the filtered feed returned HTTP 200 with
one eligible article on November 5, 2026. All 32 WordPress tests and TypeScript
passed, including the Central-time year boundary, missing dates, and attempts to
open older articles through direct links.

Remaining device acceptance on both Android and iOS includes feed/reader layout,
back navigation, direct article links, image loading/fallbacks, pull to refresh,
offline Retry, credential rotation, large text, VoiceOver/TalkBack, and continued
radio playback. Native visual automation was unavailable during this change
because computer-use permissions were not granted. Disable the flag and check
that no WordPress request occurs even with an existing stored record. The live
HTTP check and mocked tests do not verify native encryption, backup behavior,
or these device interactions.

References: [Expo 57 SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/),
[Expo 57 fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/#expofetch-api),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/),
[WordPress authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/),
and [WordPress posts](https://developer.wordpress.org/rest-api/reference/posts/).
