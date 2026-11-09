import {
  articleImageUrl, articlePlainText, firstArticleImage, imageDimension, parseArticleContent,
  publishedAtUtc, type ArticleBlock, type ArticleImage,
} from "./articleContent";

// Start of 2026 in the station's Central timezone; displayed 2025 posts are excluded.
export const BLOG_PUBLICATION_CUTOFF = "2026-01-01T00:00:00-06:00";
const CUTOFF_TIMESTAMP = Date.parse(BLOG_PUBLICATION_CUTOFF);
// Query one second before the inclusive boundary; parsing enforces the exact cutoff.
export const BLOG_QUERY_AFTER = new Date(CUTOFF_TIMESTAMP - 1_000).toISOString().replace(".000Z", "Z");

export function isBlogPublicationAllowed(publishedAt: string | null): boolean {
  return publishedAt !== null && Date.parse(publishedAt) >= CUTOFF_TIMESTAMP;
}

export interface BlogPost {
  readonly id: number;
  readonly title: string;
  readonly excerpt: string;
  readonly url: string;
  readonly author: string;
  readonly publishedAt: string | null;
  readonly coverImage: ArticleImage | null;
  readonly featuredImage: ArticleImage | null;
  readonly blocks: readonly ArticleBlock[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function embeddedFirst(embedded: unknown, name: string): Record<string, unknown> | null {
  if (!record(embedded)) return null;
  const entries = embedded[name];
  return Array.isArray(entries) && record(entries[0]) ? entries[0] : null;
}

function featuredImage(embedded: unknown, baseUrl: string): ArticleImage | null {
  const media = embeddedFirst(embedded, "wp:featuredmedia");
  if (!media) return null;
  const details = record(media.media_details) ? media.media_details : null;
  const sizes = details && record(details.sizes) ? details.sizes : null;
  const large = sizes && record(sizes.large) ? sizes.large : null;
  const url = articleImageUrl(large?.source_url, baseUrl) ?? articleImageUrl(media.source_url, baseUrl);
  if (!url) return null;
  return {
    url, alt: typeof media.alt_text === "string" ? articlePlainText(media.alt_text) : "",
    width: imageDimension(large?.width ?? details?.width),
    height: imageDimension(large?.height ?? details?.height),
  };
}

/** Normalize only public article fields; embedded author email/profile data is discarded. */
export function parseBlogPost(post: unknown): BlogPost | null {
  if (!record(post)) throw new Error("Invalid post.");
  if (post.status !== "publish") return null;
  const publishedAt = publishedAtUtc(post.date_gmt);
  if (!isBlogPublicationAllowed(publishedAt)) return null;
  if (!record(post.excerpt) || typeof post.excerpt.protected !== "boolean" ||
      !record(post.content) || typeof post.content.protected !== "boolean") throw new Error("Invalid post protection.");
  if (post.excerpt.protected || post.content.protected) return null;
  if (typeof post.id !== "number" || !Number.isSafeInteger(post.id) || post.id <= 0 ||
      !record(post.title) || typeof post.title.rendered !== "string" || typeof post.excerpt.rendered !== "string" ||
      typeof post.content.rendered !== "string" || typeof post.link !== "string") throw new Error("Invalid post fields.");
  const url = new URL(post.link);
  if (url.origin !== "https://solwlfm.lawrence.edu" || url.username || url.password) throw new Error("Invalid article link.");
  const author = embeddedFirst(post._embedded, "author");
  const blocks = parseArticleContent(post.content.rendered, url.href);
  const featured = featuredImage(post._embedded, url.href);
  return {
    id: post.id,
    title: articlePlainText(post.title.rendered) || "Untitled story",
    excerpt: articlePlainText(post.excerpt.rendered),
    url: url.href,
    author: typeof author?.name === "string" ? articlePlainText(author.name) || "WLFM" : "WLFM",
    publishedAt,
    coverImage: featured ?? firstArticleImage(blocks),
    featuredImage: featured,
    blocks,
  };
}

export function parseBlogPosts(body: unknown): readonly BlogPost[] {
  if (!Array.isArray(body) || body.length > 20) throw new Error("Invalid post collection.");
  const ids = new Set<number>();
  return body.flatMap((value) => {
    const post = parseBlogPost(value);
    if (!post) return [];
    if (ids.has(post.id)) throw new Error("Duplicate article.");
    ids.add(post.id);
    return [post];
  });
}
