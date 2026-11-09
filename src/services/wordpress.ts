import { fetch } from "expo/fetch";

import { BLOG_QUERY_AFTER, isBlogPublicationAllowed, parseBlogPost, parseBlogPosts, type BlogPost } from "./blogPosts";
import { basicAuthorization, WordPressAuthError } from "./wordpressAuth";
import { getWordPressCredentials, isWordPressConfigured } from "./wordpressCredentials";

const POSTS_ENDPOINT = "https://solwlfm.lawrence.edu/wp-json/wp/v2/posts";
const MAX_RESPONSE_BYTES = 1_048_576;
const ARTICLE_CACHE_MS = 5 * 60_000;
const articleCache = new Map<number, { readonly post: BlogPost; readonly expiresAt: number }>();
const ARTICLE_FIELDS = "id,status,link,title,excerpt,content,date_gmt,author,featured_media,_links,_embedded";
const WORDPRESS_ERROR_CODES = new Set([
  "invalid_username", "incorrect_password", "invalid_application_password",
  "application_passwords_disabled", "application_passwords_disabled_for_user",
  "rest_not_logged_in", "rest_forbidden", "rest_cannot_access", "rest_cannot_view",
  "rest_invalid_param", "rest_no_route",
]);

export type { BlogPost } from "./blogPosts";

export class BlogError extends Error {
  readonly wordpressCode: string | null;

  constructor(
    readonly code: "configuration" | "storage" | "authentication" | "network" | "response" | "timeout" | "aborted" | "not-found",
    message: string,
    readonly status: number | null = null,
    wordpressCode: unknown = null,
  ) {
    super(message);
    this.name = "BlogError";
    this.wordpressCode = typeof wordpressCode === "string" && WORDPRESS_ERROR_CODES.has(wordpressCode) ? wordpressCode : null;
  }
}

/** Only error categories, numeric status, and allowlisted WordPress codes. */
export function blogErrorDiagnostic(error: unknown): string {
  if (!(error instanceof BlogError)) return "Blog check: unexpected-error";
  return `Blog check: ${error.code}${error.status === null ? "" : ` · HTTP ${error.status}`}${error.wordpressCode ? ` · ${error.wordpressCode}` : ""}`;
}

/** Fixed HTTPS endpoint; never accept arbitrary URLs for authenticated requests. */
export function getBlogEndpoint(): string | null {
  try {
    if (!isWordPressConfigured()) return null;
    const url = new URL(POSTS_ENDPOINT);
    url.search = new URLSearchParams({
      context: "view", status: "publish", per_page: "20", orderby: "date", order: "desc",
      after: BLOG_QUERY_AFTER,
      _embed: "author,wp:featuredmedia", _fields: ARTICLE_FIELDS,
    }).toString();
    return url.href;
  } catch {
    throw new BlogError("configuration", "The station blog connection is not configured correctly.");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Awaited<ReturnType<typeof fetch>>): Promise<unknown> {
  if (!response.body) throw new Error();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error();
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    reader.releaseLock();
  }
}

interface BlogRequestOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number }

async function requestPosts(endpoint: string, options: BlogRequestOptions): Promise<unknown> {
  if (options.signal?.aborted) throw new BlogError("aborted", "The blog request was cancelled.");
  let authorization: string;
  try {
    const credentials = await getWordPressCredentials();
    if (!credentials) throw new BlogError("configuration", "The station blog is coming soon.");
    authorization = basicAuthorization(credentials);
  } catch (error: unknown) {
    if (error instanceof WordPressAuthError) throw new BlogError(error.code, error.message);
    if (error instanceof BlogError) throw error;
    throw new BlogError("storage", "Unable to securely load the station blog connection. Try again.");
  }
  if (options.signal?.aborted) throw new BlogError("aborted", "The blog request was cancelled.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: authorization },
      credentials: "omit",
      // expo/fetch implements redirect blocking natively on both iOS and Android.
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      let wordpressCode: unknown = null;
      try {
        const errorBody = await readJson(response);
        if (record(errorBody)) wordpressCode = errorBody.code;
      } catch { /* Unreadable bodies must not hide the original HTTP status. */ }
      throw new BlogError(response.status === 401 || response.status === 403 ? "authentication" : response.status === 404 ? "not-found" : "response",
        "The station blog is temporarily unavailable. Try again later.", response.status, wordpressCode);
    }
    let body: unknown;
    try {
      body = await readJson(response);
    } catch {
      throw new BlogError("response", "The station blog returned an unreadable response.");
    }
    if (controller.signal.aborted) throw new Error();
    return body;
  } catch (error: unknown) {
    if (options.signal?.aborted) throw new BlogError("aborted", "The blog request was cancelled.");
    if (timedOut) throw new BlogError("timeout", "The blog request timed out. Try again.");
    if (error instanceof BlogError) throw error;
    throw new BlogError("network", "Unable to load the station blog. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

function cachePost(post: BlogPost): void {
  articleCache.delete(post.id);
  articleCache.set(post.id, { post, expiresAt: Date.now() + ARTICLE_CACHE_MS });
  if (articleCache.size > 40) {
    const oldest = articleCache.keys().next().value;
    if (oldest !== undefined) articleCache.delete(oldest);
  }
}

export function getCachedBlogPost(id: number): BlogPost | null {
  if (!getBlogEndpoint()) return null;
  const cached = articleCache.get(id);
  if (!cached || Date.now() >= cached.expiresAt || !isBlogPublicationAllowed(cached.post.publishedAt)) {
    articleCache.delete(id);
    return null;
  }
  return cached.post;
}

export function getCachedBlogPostByUrl(url: string): BlogPost | null {
  let canonical: URL;
  try { canonical = new URL(url); } catch { return null; }
  canonical.hash = "";
  canonical.search = "";
  for (const [id, entry] of articleCache) {
    const candidate = new URL(entry.post.url);
    candidate.hash = "";
    candidate.search = "";
    if (candidate.href === canonical.href) return getCachedBlogPost(id);
  }
  return null;
}

export async function getBlogPosts(options: BlogRequestOptions = {}): Promise<readonly BlogPost[]> {
  const endpoint = getBlogEndpoint();
  if (!endpoint) throw new BlogError("configuration", "The station blog is coming soon.");
  const body = await requestPosts(endpoint, options);
  let posts: readonly BlogPost[];
  try { posts = parseBlogPosts(body); } catch {
    throw new BlogError("response", "The station blog returned an unreadable response.");
  }
  // A refresh must not leave a previously public article available after it is
  // removed from the feed or becomes private/protected. Other eligible links can refetch.
  articleCache.clear();
  for (const post of posts) cachePost(post);
  return posts;
}

/** Deep links fetch a single ID; normal feed navigation reuses a short-lived public article cache. */
export async function getBlogPost(id: number, options: BlogRequestOptions = {}): Promise<BlogPost> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new BlogError("not-found", "This story is not available.");
  const endpoint = getBlogEndpoint();
  if (!endpoint) throw new BlogError("configuration", "The station blog is coming soon.");
  if (options.signal?.aborted) throw new BlogError("aborted", "The blog request was cancelled.");
  const cached = getCachedBlogPost(id);
  if (cached) return cached;
  const url = new URL(`${POSTS_ENDPOINT}/${id}`);
  url.search = new URLSearchParams({ context: "view", _embed: "author,wp:featuredmedia", _fields: ARTICLE_FIELDS }).toString();
  const body = await requestPosts(url.href, options);
  let post: BlogPost | null;
  try { post = parseBlogPost(body); } catch {
    throw new BlogError("response", "The station blog returned an unreadable response.");
  }
  if (!post || post.id !== id) throw new BlogError("not-found", "This story is not available.");
  cachePost(post);
  return post;
}
