export interface WordPressCredentials {
  readonly username: string;
  readonly applicationPassword: string;
}

export class WordPressAuthError extends Error {
  constructor(readonly code: "configuration" | "storage", message: string) {
    super(message);
    this.name = "WordPressAuthError";
  }
}

export function normalizeWordPressCredentials(username: unknown, password: unknown): WordPressCredentials {
  if (typeof username !== "string" || !username.trim() || /[:\x00-\x1f\x7f]/u.test(username) ||
      typeof password !== "string" || !password.trim() || /[\x00-\x1f\x7f]/u.test(password)) {
    throw new WordPressAuthError("configuration", "The station blog connection is not configured correctly.");
  }
  const credentials = { username: username.trim(), applicationPassword: password.replace(/ /gu, "") };
  // Keep the single SecureStore record comfortably below historical native size limits.
  if (new TextEncoder().encode(JSON.stringify(credentials)).byteLength > 1_024) {
    throw new WordPressAuthError("configuration", "The station blog connection is not configured correctly.");
  }
  return credentials;
}

export function basicAuthorization(credentials: WordPressCredentials): string {
  const normalized = normalizeWordPressCredentials(credentials.username, credentials.applicationPassword);
  const bytes = new TextEncoder().encode(`${normalized.username}:${normalized.applicationPassword}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}
