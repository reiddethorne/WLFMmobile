import { isTag, isText, type ChildNode } from "domhandler";
import { parseDocument } from "htmlparser2";

const STATION_ORIGIN = "https://solwlfm.lawrence.edu";
const OMITTED_TAGS = new Set(["script", "style", "noscript", "template", "form", "input", "button", "object", "svg", "head"]);
const INLINE_TAGS = new Set(["a", "span", "strong", "b", "em", "i", "s", "del", "u", "code", "small", "sup", "sub", "mark"]);

export interface ArticleImage {
  readonly url: string;
  readonly alt: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface ArticleSpan {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly strike: boolean;
  readonly code: boolean;
  readonly href: string | null;
}

export type ArticleBlock =
  | { readonly type: "text"; readonly style: "paragraph" | "heading" | "caption" | "pre"; readonly level: number; readonly spans: readonly ArticleSpan[] }
  | { readonly type: "image"; readonly image: ArticleImage }
  | { readonly type: "list"; readonly ordered: boolean; readonly start: number; readonly items: readonly (readonly ArticleBlock[])[] }
  | { readonly type: "quote"; readonly blocks: readonly ArticleBlock[] }
  | { readonly type: "embed"; readonly url: string; readonly label: string }
  | { readonly type: "rule" };

/** Media requests never receive the WordPress Authorization header. */
export function safeArticleUrl(value: unknown, baseUrl = STATION_ORIGIN): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol === "http:" && url.hostname === "solwlfm.lawrence.edu") url.protocol = "https:";
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function safeArticleLink(value: unknown, baseUrl = STATION_ORIGIN): string | null {
  if (typeof value === "string" && /^(?:mailto:[^\s<>]+@[^\s<>]+|tel:[+\d() .-]+)$/iu.test(value)) return value;
  return safeArticleUrl(value, baseUrl);
}

export function articleImageUrl(value: unknown, baseUrl = STATION_ORIGIN): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    // Old posts can contain HTTP image URLs. Attempt HTTPS, never enable cleartext networking.
    if (url.protocol === "http:") url.protocol = "https:";
    return safeArticleUrl(url.href, baseUrl);
  } catch { return null; }
}

export function imageDimension(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 && number <= 50_000 ? number : null;
}

const DEFAULT_SPAN = { bold: false, italic: false, strike: false, code: false, href: null } as const;
type Marks = Omit<ArticleSpan, "text">;

/** Parse published HTML into a native view model; scripts, CSS and event handlers never execute. */
export function parseArticleContent(html: string, baseUrl: string): readonly ArticleBlock[] {
  let visited = 0;
  function flow(nodes: readonly ChildNode[], marks: Marks = DEFAULT_SPAN, depth = 0, preserve = false): ArticleBlock[] {
    if (depth > 40) return [];
    const result: ArticleBlock[] = [];
    let spans: ArticleSpan[] = [];
    const flush = () => {
      if (spans.some((span) => span.text.trim())) result.push({ type: "text", style: preserve ? "pre" : "paragraph", level: 0, spans });
      spans = [];
    };
    function visit(children: readonly ChildNode[], inherited: Marks, nesting: number) {
      if (nesting > 40) return;
      for (const node of children) {
        if (++visited > 10_000) return;
        if (isText(node)) {
          spans.push({ ...inherited, text: preserve ? node.data : node.data.replace(/\s+/gu, " ") });
          continue;
        }
        if (!isTag(node) || OMITTED_TAGS.has(node.name)) continue;
        const tag = node.name;
        if (tag === "br") { spans.push({ ...inherited, text: "\n" }); continue; }
        if (INLINE_TAGS.has(tag)) {
          visit(node.children, {
            ...inherited,
            bold: inherited.bold || tag === "strong" || tag === "b",
            italic: inherited.italic || tag === "em" || tag === "i",
            strike: inherited.strike || tag === "s" || tag === "del",
            code: inherited.code || tag === "code",
            href: tag === "a" ? safeArticleLink(node.attribs.href, baseUrl) : inherited.href,
          }, nesting + 1);
          continue;
        }
        flush();
        if (tag === "img") {
          const url = articleImageUrl(node.attribs["data-src"], baseUrl)
            ?? articleImageUrl(node.attribs["data-lazy-src"], baseUrl)
            ?? articleImageUrl(node.attribs.src, baseUrl);
          if (url) result.push({ type: "image", image: {
            url, alt: node.attribs.alt?.trim() ?? "",
            width: imageDimension(node.attribs.width), height: imageDimension(node.attribs.height),
          } });
        } else if (tag === "hr") {
          result.push({ type: "rule" });
        } else if (tag === "iframe" || tag === "video" || tag === "audio") {
          const source = node.attribs.src || node.children.find((child) => isTag(child) && child.name === "source" && child.attribs.src);
          let url = safeArticleUrl(typeof source === "string" ? source : source && isTag(source) ? source.attribs.src : null, baseUrl);
          if (url) {
            const parsed = new URL(url);
            const youtube = /^(?:www\.)?youtube(?:-nocookie)?\.com$/iu.test(parsed.hostname);
            if (youtube && parsed.pathname.startsWith("/embed/")) {
              const id = parsed.pathname.split("/")[2];
              if (id) url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
            }
            result.push({ type: "embed", url, label: youtube ? "Watch on YouTube" : tag === "audio" ? "Listen to audio" : "Open embedded media" });
          }
        } else if (tag === "ul" || tag === "ol") {
          const items = node.children.filter((child) => isTag(child) && child.name === "li")
            .map((child) => flow(isTag(child) ? child.children : [], inherited, nesting + 1));
          if (items.length) result.push({ type: "list", ordered: tag === "ol", start: imageDimension(node.attribs.start) ?? 1, items });
        } else if (tag === "blockquote") {
          result.push({ type: "quote", blocks: flow(node.children, inherited, nesting + 1) });
        } else {
          const blocks = flow(node.children, inherited, nesting + 1, tag === "pre");
          for (const block of blocks) {
            if (block.type === "text" && (/^h[1-6]$/u.test(tag) || tag === "figcaption")) {
              result.push({ ...block, style: tag === "figcaption" ? "caption" : "heading", level: Number(tag[1]) || 0 });
            } else result.push(block);
          }
        }
      }
    }
    visit(nodes, marks, depth);
    flush();
    return result;
  }
  return flow(parseDocument(html, { decodeEntities: true }).children);
}

export function firstArticleImage(blocks: readonly ArticleBlock[]): ArticleImage | null {
  for (const block of blocks) {
    if (block.type === "image") return block.image;
    const nested = block.type === "quote" ? firstArticleImage(block.blocks)
      : block.type === "list" ? block.items.map(firstArticleImage).find((image) => image !== null) : null;
    if (nested) return nested;
  }
  return null;
}

export function articlePlainText(html: string): string {
  function text(nodes: readonly ChildNode[], depth = 0): string {
    if (depth > 40) return "";
    return nodes.map((node) => isText(node) ? node.data
      : isTag(node) && !OMITTED_TAGS.has(node.name) ? ` ${text(node.children, depth + 1)} ` : "").join("");
  }
  return text(parseDocument(html).children).replace(/\s+/gu, " ").trim();
}

export function publishedAtUtc(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/u.test(value)) return null;
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return date.toISOString();
}

export function formatBlogDate(publishedAt: string | null): string {
  return publishedAt ? new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago",
  }).format(new Date(publishedAt)) : "Date unavailable";
}
