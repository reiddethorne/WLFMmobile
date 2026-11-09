import type { WordPressCredentials } from "./wordpressAuth";

// No bootstrap credential references or browser storage in the web build.
export function isWordPressConfigured(): boolean {
  return false;
}

export async function getWordPressCredentials(): Promise<WordPressCredentials | null> {
  return null;
}
