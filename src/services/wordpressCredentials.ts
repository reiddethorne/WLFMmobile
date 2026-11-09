import { normalizeWordPressCredentials, WordPressAuthError, type WordPressCredentials } from "./wordpressAuth";

const STORAGE_KEY = "wlfm.wordpress.credentials.v1";
const KEYCHAIN_SERVICE = "dev.studentradio.wlfm.wordpress";

function bundledCredentials(): WordPressCredentials | null {
  // The dedicated blog account is approved; each build explicitly enables it.
  // These bootstrap values are extractable from native bundles, even after copying
  // them to SecureStore. Never use an administrator or otherwise sensitive account.
  if (process.env.EXPO_PUBLIC_WORDPRESS_ENABLED !== "true") return null;
  const username = process.env.EXPO_PUBLIC_WORDPRESS_USERNAME;
  const password = process.env.EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD;
  if (!username?.trim() && !password?.trim()) return null;
  return normalizeWordPressCredentials(username, password);
}

export function isWordPressConfigured(): boolean {
  return bundledCredentials() !== null;
}

export async function getWordPressCredentials(): Promise<WordPressCredentials | null> {
  const bootstrap = bundledCredentials();
  // Never fall back to an old Keychain record when disabled or missing configuration.
  if (!bootstrap) return null;
  const expected = JSON.stringify(bootstrap);
  try {
    // Keep an unconfigured app usable in an older client without this native module.
    const secureStore = await import("expo-secure-store");
    if (!await secureStore.isAvailableAsync()) throw new Error();
    const options = {
      keychainService: KEYCHAIN_SERVICE,
      keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      requireAuthentication: false,
    };
    let saved = await secureStore.getItemAsync(STORAGE_KEY, options);
    if (saved !== expected) {
      // A new bundle replaces rotated credentials or a stale iOS reinstall record.
      await secureStore.setItemAsync(STORAGE_KEY, expected, options);
      saved = await secureStore.getItemAsync(STORAGE_KEY, options);
    }
    if (saved !== expected) throw new Error();
    const record = JSON.parse(saved) as WordPressCredentials;
    return normalizeWordPressCredentials(record.username, record.applicationPassword);
  } catch {
    // No AsyncStorage or plaintext fallback, including when the device is locked.
    throw new WordPressAuthError("storage", "Unable to securely load the station blog connection. Try again.");
  }
}
