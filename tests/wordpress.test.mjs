import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = await mkdtemp(join(tmpdir(), "wlfm-wordpress-tests-"));
after(() => rm(temp, { recursive: true, force: true }));
for (const [source, output] of [
  ["../src/services/wordpress.ts", "wordpress.mjs"],
  ["../src/services/wordpressAuth.ts", "wordpressAuth.mjs"],
  ["../src/services/wordpressCredentials.ts", "wordpressCredentials.mjs"],
  ["../src/services/wordpressCredentials.web.ts", "wordpressCredentials.web.mjs"],
  ["../src/services/articleContent.ts", "articleContent.mjs"],
  ["../src/services/blogPosts.ts", "blogPosts.mjs"],
]) {
  const input = await readFile(new URL(source, import.meta.url), "utf8");
  const compiled = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    .replaceAll('"./articleContent"', '"./articleContent.mjs"')
    .replaceAll('"./blogPosts"', '"./blogPosts.mjs"')
    .replaceAll('"htmlparser2"', JSON.stringify(import.meta.resolve("htmlparser2")))
    .replaceAll('"domhandler"', JSON.stringify(import.meta.resolve("domhandler")))
    .replaceAll('"./wordpressAuth"', '"./wordpressAuth.mjs"')
    .replaceAll('"./wordpressCredentials"', '"./wordpressCredentials.mjs"')
    .replaceAll('"expo-secure-store"', '"./secureStore.mjs"')
    .replaceAll('"expo/fetch"', '"./expoFetch.mjs"');
  await writeFile(join(temp, output), compiled);
}
await writeFile(join(temp, "secureStore.mjs"), `
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 7;
  export const state = {};
  export function reset() {
    Object.assign(state, { record: null, available: true, failRead: false, failWrite: false,
      ignoreWrite: false, calls: [], gate: null });
  }
  reset();
  export async function isAvailableAsync() { state.calls.push(["available"]); return state.available; }
  export async function getItemAsync(key, options) {
    state.calls.push(["get", key, options]);
    if (state.gate) await state.gate;
    if (state.failRead) throw new Error("private-storage-details");
    return state.record;
  }
  export async function setItemAsync(key, value, options) {
    state.calls.push(["set", key, options]);
    if (state.failWrite) throw new Error("private-storage-details");
    if (!state.ignoreWrite) state.record = value;
  }
`);
await writeFile(join(temp, "expoFetch.mjs"), "export const fetch = (...args) => globalThis.fetch(...args);");

const importTemp = (file) => import(pathToFileURL(join(temp, file)).href);
const { BlogError, blogErrorDiagnostic, getBlogEndpoint, getBlogPosts, getBlogPost, getCachedBlogPostByUrl } = await importTemp("wordpress.mjs");
const { parseBlogPost } = await importTemp("blogPosts.mjs");
const { parseArticleContent, firstArticleImage, articlePlainText, publishedAtUtc, formatBlogDate, safeArticleLink } = await importTemp("articleContent.mjs");
const { basicAuthorization } = await importTemp("wordpressAuth.mjs");
const { getWordPressCredentials, isWordPressConfigured } = await importTemp("wordpressCredentials.mjs");
const web = await importTemp("wordpressCredentials.web.mjs");
const { state: secureStore, reset: resetStorage } = await importTemp("secureStore.mjs");

// Fake credentials only. These tests never contact the station or need real secrets.
const username = "test-rádio";
const password = "aaaa bbbb cccc dddd eeee ffff";
const normalized = { username, applicationPassword: "aaaabbbbccccddddeeeeffff" };
const post = (changes = {}) => ({
  id: 1, status: "publish", link: "https://solwlfm.lawrence.edu/story/",
  title: { rendered: "Radio &amp; music" },
  excerpt: { rendered: "<p>Campus news</p>", protected: false },
  content: { rendered: "", protected: false }, date_gmt: "2026-11-04T18:00:00",
  ...changes,
});
const parsedPost = {
  id: 1, title: "Radio & music", excerpt: "Campus news", url: "https://solwlfm.lawrence.edu/story/",
  author: "WLFM", publishedAt: "2026-11-04T18:00:00.000Z", coverImage: null, featuredImage: null, blocks: [],
};
const noFetch = async () => assert.fail("No network request should occur");

async function withClient(action, { fetchImpl = noFetch, env = {}, storage = {} } = {}) {
  const values = {
    EXPO_PUBLIC_WORDPRESS_ENABLED: "true",
    EXPO_PUBLIC_WORDPRESS_USERNAME: username,
    EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD: password,
    ...env,
  };
  const originals = new Map(Object.keys(values).map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  for (const [name, value] of Object.entries(values)) {
    if (value === null) delete process.env[name];
    else process.env[name] = value;
  }
  resetStorage();
  Object.assign(secureStore, storage);
  globalThis.fetch = fetchImpl;
  try { await action(); } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originals) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("disabled or blank configuration stays offline and ignores old Keychain credentials", async () => {
  for (const env of [
    { EXPO_PUBLIC_WORDPRESS_ENABLED: "false" },
    { EXPO_PUBLIC_WORDPRESS_ENABLED: null },
    { EXPO_PUBLIC_WORDPRESS_USERNAME: "", EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD: "" },
  ]) {
    await withClient(async () => {
      assert.equal(getBlogEndpoint(), null);
      assert.equal(isWordPressConfigured(), false);
      assert.equal(await getWordPressCredentials(), null);
      await assert.rejects(getBlogPosts(), (error) => error.code === "configuration");
      assert.deepEqual(secureStore.calls, []);
    }, { env, storage: { record: JSON.stringify(normalized), available: false } });
  }
});

test("first native use saves and reads back one encrypted credential record", async () => {
  await withClient(async () => {
    assert.deepEqual(await getWordPressCredentials(), normalized);
    assert.deepEqual(JSON.parse(secureStore.record), normalized);
    assert.deepEqual(secureStore.calls.map(([name]) => name), ["available", "get", "set", "get"]);
    const [, key, options] = secureStore.calls.find(([name]) => name === "set");
    assert.equal(options.keychainAccessible, 7);
    assert.equal(options.requireAuthentication, false);
    assert.ok(options.keychainService);
    for (const [, readKey, readOptions] of secureStore.calls.filter(([name]) => name === "get")) {
      assert.equal(readKey, key);
      assert.deepEqual(readOptions, options);
    }
    secureStore.calls.length = 0;
    assert.deepEqual(await getWordPressCredentials(), normalized);
    assert.deepEqual(secureStore.calls.map(([name]) => name), ["available", "get"]);
  });
});

test("new bundle credentials replace rotated, corrupt, or leftover reinstall records", async () => {
  for (const record of ["not-json", JSON.stringify({ username: "old-user", applicationPassword: "old-password" })]) {
    await withClient(async () => {
      assert.deepEqual(await getWordPressCredentials(), normalized);
      assert.deepEqual(JSON.parse(secureStore.record), normalized);
      assert.equal(secureStore.calls.filter(([name]) => name === "set").length, 1);
    }, { storage: { record } });
  }
});

test("storage unavailable, read/write errors, or failed readback block requests without plaintext fallback", async () => {
  for (const storage of [{ available: false }, { failRead: true }, { failWrite: true }, { ignoreWrite: true }]) {
    await withClient(async () => {
      await assert.rejects(getBlogPosts(), (error) => {
        assert.equal(error.message.includes("private-storage-details"), false);
        return error instanceof BlogError && error.code === "storage";
      });
    }, { storage });
  }
});

test("incomplete, oversized, colon-bearing, and control-character credentials fail before storage/network", async () => {
  for (const env of [
    { EXPO_PUBLIC_WORDPRESS_USERNAME: null },
    { EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD: "" },
    { EXPO_PUBLIC_WORDPRESS_USERNAME: "bad:user" },
    { EXPO_PUBLIC_WORDPRESS_USERNAME: "bad\nuser" },
    { EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD: "bad\npassword" },
    { EXPO_PUBLIC_WORDPRESS_APPLICATION_PASSWORD: "x".repeat(2_048) },
  ]) {
    await withClient(async () => {
      await assert.rejects(getBlogPosts(), (error) => error instanceof BlogError && error.code === "configuration");
      assert.deepEqual(secureStore.calls, []);
    }, { env });
  }
});

test("Basic Auth encodes UTF-8 username:password and removes WordPress display spaces", () => {
  assert.equal(basicAuthorization({ username: ` ${username} `, applicationPassword: password }),
    `Basic ${Buffer.from(`${username}:${normalized.applicationPassword}`, "utf8").toString("base64")}`);
});

test("direct GET sends Basic Auth only to the fixed HTTPS WordPress feed with redirects blocked", async () => {
  await withClient(async () => {
    assert.deepEqual(await getBlogPosts(), [parsedPost]);
  }, { fetchImpl: async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://solwlfm.lawrence.edu");
    assert.equal(url.pathname, "/wp-json/wp/v2/posts");
    assert.equal(url.searchParams.get("status"), "publish");
    assert.equal(url.searchParams.get("context"), "view");
    assert.equal(url.searchParams.get("per_page"), "20");
    assert.equal(url.searchParams.get("orderby"), "date");
    assert.equal(url.searchParams.get("after"), "2026-01-01T05:59:59Z");
    assert.equal(url.searchParams.get("_embed"), "author,wp:featuredmedia");
    for (const field of ["content", "date_gmt", "_links", "_embedded"]) assert.ok(url.searchParams.get("_fields").split(",").includes(field));
    assert.equal(url.searchParams.has("password"), false);
    assert.equal(url.href.includes(normalized.applicationPassword), false);
    assert.equal(options.headers.Authorization, basicAuthorization(normalized));
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(secureStore.record), normalized);
    return Response.json([post({ author: "omit-me", extra: "omit-me" })]);
  } });
});

test("private, draft, future, and password-protected posts are excluded even if WordPress ignores the query", async () => {
  await withClient(async () => assert.deepEqual(await getBlogPosts(), [parsedPost]), {
    fetchImpl: async () => Response.json([
      post(), post({ id: 2, status: "private" }), post({ id: 3, status: "draft" }), post({ id: 4, status: "future" }),
      post({ id: 5, excerpt: { rendered: "Secret", protected: true } }),
    ]),
  });
});

test("rendered HTML becomes native text and missing titles get a deliberate fallback", async () => {
  await withClient(async () => assert.deepEqual(await getBlogPosts(), [{
    ...parsedPost, title: "Untitled story", excerpt: "Campus & music 🎵",
  }]), { fetchImpl: async () => Response.json([post({
    title: { rendered: "<p> </p>" },
    excerpt: { rendered: "<script>bad()</script><style>bad</style><p>Campus &amp; music &#x1f3b5;</p>", protected: false },
  })]) });
});

test("malformed posts, unknown protection, duplicates, and unsafe links fail closed", async () => {
  for (const body of [null, {}, [null], [post(), post()],
    [post({ excerpt: { rendered: "Unknown protection" } })],
    [post({ id: -1 })], [post({ title: null })],
    [post({ link: "javascript:alert(1)" })], [post({ link: "http://solwlfm.lawrence.edu/story/" })],
    [post({ link: "https://user:secret@solwlfm.lawrence.edu/story/" })],
    [post({ link: "https://elsewhere.example/story/" })],
  ]) {
    await withClient(async () => {
      await assert.rejects(getBlogPosts(), (error) => error.code === "response");
    }, { fetchImpl: async () => Response.json(body) });
  }
});

test("authentication failures are distinct and never expose the upstream body or credentials", async () => {
  for (const status of [401, 403]) {
    await withClient(async () => {
      await assert.rejects(getBlogPosts(), (error) => error.code === "authentication" && error.status === status &&
        blogErrorDiagnostic(error) === `Blog check: authentication · HTTP ${status}` && !error.message.includes("private-details"));
    }, { fetchImpl: async () => new Response("private-details", { status }) });
  }
});

test("development diagnostics reveal only the local error category and HTTP status", async () => {
  assert.equal(blogErrorDiagnostic(new Error(`private-details ${normalized.applicationPassword}`)), "Blog check: unexpected-error");
  assert.equal(blogErrorDiagnostic(new BlogError("storage", "private-details")), "Blog check: storage");
  await withClient(async () => {
    await assert.rejects(getBlogPosts(), (error) => error.status === 429 &&
      blogErrorDiagnostic(error) === "Blog check: response · HTTP 429");
  }, { fetchImpl: async () => new Response(`private-details ${normalized.applicationPassword}`, { status: 429 }) });
});

test("WordPress diagnostics allow known failure codes but never reflect messages or arbitrary codes", async () => {
  for (const code of ["rest_cannot_access", "invalid_username", "incorrect_password", "private-details"]) {
    await withClient(async () => {
      await assert.rejects(getBlogPosts(), (error) => {
        const known = code !== "private-details";
        assert.equal(error.status, 401);
        assert.equal(error.wordpressCode, known ? code : null);
        assert.equal(blogErrorDiagnostic(error), `Blog check: authentication · HTTP 401${known ? ` · ${code}` : ""}`);
        assert.equal(JSON.stringify(error).includes("private-details"), false);
        assert.equal(JSON.stringify(error).includes(normalized.applicationPassword), false);
        return true;
      });
    }, { fetchImpl: async () => Response.json({ code, message: `private-details ${normalized.applicationPassword}` }, { status: 401 }) });
  }
});

test("network, HTTP, unreadable JSON, and oversized body failures are redacted", async () => {
  for (const fetchImpl of [
    async () => new Response("private-details", { status: 502 }),
    async () => new Response("private-details"),
    async () => { throw new Error(`private-details ${normalized.applicationPassword}`); },
    async () => Response.json([post({ title: { rendered: "x".repeat(1_048_577) } })]),
  ]) {
    await withClient(async () => {
      await assert.rejects(getBlogPosts(), (error) => error instanceof BlogError &&
        !error.message.includes("private-details") && !error.message.includes(normalized.applicationPassword));
    }, { fetchImpl });
  }
});

test("pre-cancelled calls and cancellation during secure storage never start a network request", async () => {
  await withClient(async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(getBlogPosts({ signal: controller.signal }), (error) => error.code === "aborted");
    assert.deepEqual(secureStore.calls, []);
    let release;
    secureStore.gate = new Promise((resolve) => { release = resolve; });
    const liveController = new AbortController();
    const pending = getBlogPosts({ signal: liveController.signal });
    await setImmediate();
    liveController.abort();
    release();
    await assert.rejects(pending, (error) => error.code === "aborted");
  });
});

test("timeouts cover fetch and streamed body reading, while caller cancellation stays distinct", async () => {
  const waitForAbort = (signal) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("private-details")), { once: true });
  });
  await withClient(async () => {
    await assert.rejects(getBlogPosts({ timeoutMs: 5 }), (error) => error.code === "timeout");
  }, { fetchImpl: async (url, options) => waitForAbort(options.signal) });
  await withClient(async () => {
    await assert.rejects(getBlogPosts({ timeoutMs: 5 }), (error) => error.code === "timeout");
    const controller = new AbortController();
    const pending = getBlogPosts({ signal: controller.signal });
    await setImmediate();
    controller.abort();
    await assert.rejects(pending, (error) => error.code === "aborted");
  }, { fetchImpl: async (url, options) => new Response(new ReadableStream({
    start(controller) {
      options.signal.addEventListener("abort", () => controller.error(new Error("private-details")), { once: true });
    },
  })) });
});

test("web never loads or exposes the bundled shared credential, even with native configuration enabled", async () => {
  await withClient(async () => {
    assert.equal(web.isWordPressConfigured(), false);
    assert.equal(await web.getWordPressCredentials(), null);
    assert.deepEqual(secureStore.calls, []);
    const source = await readFile(new URL("../src/services/wordpressCredentials.web.ts", import.meta.url), "utf8");
    assert.equal(source.includes("process.env"), false);
    assert.equal(source.includes("localStorage"), false);
  });
});

test("author, GMT publication date and featured image are normalized without retaining author account fields", () => {
  const result = parseBlogPost(post({ _embedded: {
    author: [{ name: "Student &amp; DJ", email: "not-for-the-app", description: "not-for-the-app" }],
    "wp:featuredmedia": [{ source_url: "https://solwlfm.lawrence.edu/original.jpg", alt_text: "Live &amp; local", media_details: {
      width: 2000, height: 1000, sizes: { large: { source_url: "https://solwlfm.lawrence.edu/large.jpg", width: 1000, height: 500 } },
    } }],
  } }));
  assert.equal(result.author, "Student & DJ");
  assert.equal(result.publishedAt, "2026-11-04T18:00:00.000Z");
  assert.deepEqual(result.coverImage, { url: "https://solwlfm.lawrence.edu/large.jpg", alt: "Live & local", width: 1000, height: 500 });
  assert.equal(JSON.stringify(result).includes("not-for-the-app"), false);
});

test("missing featured media uses the first inline image and missing author falls back to the station", () => {
  const result = parseBlogPost(post({ _embedded: { author: [{ code: "rest_forbidden" }] }, content: {
    rendered: '<figure><img src="/wp-content/uploads/cover.jpg" alt="The show" width="900" height="600"><figcaption>A caption</figcaption></figure>', protected: false,
  } }));
  assert.equal(result.author, "WLFM");
  assert.equal(result.publishedAt, parsedPost.publishedAt);
  assert.equal(result.featuredImage, null);
  assert.deepEqual(result.coverImage, { url: "https://solwlfm.lawrence.edu/wp-content/uploads/cover.jpg", alt: "The show", width: 900, height: 600 });
  assert.ok(result.blocks.some((block) => block.type === "text" && block.style === "caption"));
});

test("protected article bodies are excluded independently of excerpt protection", () => {
  assert.equal(parseBlogPost(post({ content: { rendered: "Private body", protected: true } })), null);
  assert.throws(() => parseBlogPost(post({ content: { rendered: "Unknown protection" } })));
});

test("native content preserves headings, emphasis, lists, quotes, line breaks, images and captions", () => {
  const blocks = parseArticleContent('<h5>New music</h5><p>Hello <strong>world</strong><br><em>again</em>.</p><ol start="3"><li>One<ul><li>Nested</li></ul></li><li>Two</li></ol><blockquote><p>A quote</p></blockquote><figure><img src="/photo.jpg" alt="Band &amp; fans"><figcaption>At the station</figcaption></figure>', parsedPost.url);
  assert.equal(blocks[0].style, "heading");
  assert.equal(blocks[0].level, 5);
  assert.ok(blocks[1].spans.some((span) => span.bold && span.text === "world"));
  assert.ok(blocks[1].spans.some((span) => span.italic && span.text === "again"));
  assert.ok(blocks[1].spans.some((span) => span.text === "\n"));
  assert.equal(blocks[2].type, "list");
  assert.equal(blocks[2].start, 3);
  assert.equal(blocks[2].items[0][1].type, "list");
  assert.equal(blocks[3].type, "quote");
  assert.equal(firstArticleImage(blocks).alt, "Band & fans");
});

test("scripts, styles, unsafe media and unsafe links never enter the native article model", () => {
  const blocks = parseArticleContent('<script>steal()</script><style>.bad{}</style><form>Secret form</form><p><a href="javascript:steal()">Safe text</a><a href="https://example.com/music">Music</a></p><img src="data:image/svg+xml,bad"><img src="https://user:secret@example.com/photo.jpg"><iframe src="javascript:steal()"></iframe>', parsedPost.url);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].spans[0].href, null);
  assert.equal(blocks[0].spans[1].href, "https://example.com/music");
  assert.equal(JSON.stringify(blocks).includes("steal()"), false);
  assert.equal(JSON.stringify(blocks).includes("Secret form"), false);
  assert.equal(safeArticleLink("file:///private/file"), null);
  assert.equal(safeArticleLink("mailto:radio@example.edu"), "mailto:radio@example.edu");
  assert.equal(articlePlainText("<p>Music &hellip; &copy; &#x1f3b5;</p><style>hidden</style>"), "Music … © 🎵");
});

test("YouTube embeds become explicit media links without executing an iframe", () => {
  assert.deepEqual(parseArticleContent('<iframe src="https://www.youtube.com/embed/abc123" onload="bad()"></iframe>', parsedPost.url), [
    { type: "embed", url: "https://www.youtube.com/watch?v=abc123", label: "Watch on YouTube" },
  ]);
});

test("legacy images attempt HTTPS and lazy image sources replace placeholder data URLs", () => {
  const blocks = parseArticleContent('<img src="http://legacy.example/photo.jpg"><img src="data:image/svg+xml,placeholder" data-src="/real-photo.jpg">', parsedPost.url);
  assert.equal(blocks[0].image.url, "https://legacy.example/photo.jpg");
  assert.equal(blocks[1].image.url, "https://solwlfm.lawrence.edu/real-photo.jpg");
});

test("deep HTML is bounded and unrecognized layout containers retain readable content", () => {
  const html = '<section><div><p>Keep this story.</p></div></section>' + '<div>'.repeat(100) + 'too deep' + '</div>'.repeat(100);
  const blocks = parseArticleContent(html, parsedPost.url);
  assert.equal(blocks[0].spans[0].text, "Keep this story.");
  assert.equal(JSON.stringify(blocks).includes("too deep"), false);
});

test("publication dates are UTC instants formatted for Central time, with invalid dates rejected", () => {
  assert.equal(publishedAtUtc("2026-11-05T01:00:00"), "2026-11-05T01:00:00.000Z");
  assert.equal(formatBlogDate(publishedAtUtc("2026-11-05T01:00:00")), "November 4, 2026");
  assert.equal(publishedAtUtc("2026-02-30T01:00:00"), null);
  assert.equal(publishedAtUtc("not a date"), null);
  assert.equal(formatBlogDate(null), "Date unavailable");
});

test("the publication cutoff excludes 2025 and unknown dates, including early UTC hours still in Central 2025", () => {
  for (const date_gmt of ["2024-11-05T18:00:00", "2025-12-31T23:59:59", "2026-01-01T05:59:59", null, "invalid", "2026-02-30T12:00:00"]) {
    assert.equal(parseBlogPost(post({ date_gmt })), null);
  }
  for (const date_gmt of ["2026-01-01T06:00:00", "2026-01-01T06:00:01", "2027-04-01T12:00:00"]) {
    assert.ok(parseBlogPost(post({ date_gmt })));
  }
});

test("the feed filters older and undated posts even when WordPress ignores the after parameter", async () => {
  await withClient(async () => assert.deepEqual(await getBlogPosts(), [parsedPost]), {
    fetchImpl: async () => Response.json([
      post(), post({ id: 2, date_gmt: "2025-06-01T12:00:00" }),
      post({ id: 3, date_gmt: "2026-01-01T05:59:59" }), post({ id: 4, date_gmt: null }),
    ]),
  });
});

test("direct article links cannot bypass the publication cutoff", async () => {
  await withClient(async () => {
    await assert.rejects(getBlogPost(125), (error) => error.code === "not-found");
  }, { fetchImpl: async () => Response.json(post({ id: 125, date_gmt: "2025-12-31T23:59:59" })) });
});

test("opening a feed article reuses its cached native body without another request", async () => {
  let calls = 0;
  await withClient(async () => {
    const posts = await getBlogPosts();
    assert.deepEqual(await getBlogPost(121), posts[0]);
    assert.equal(getCachedBlogPostByUrl(`${posts[0].url}#section`).id, 121);
    assert.equal(calls, 1);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(getBlogPost(121, { signal: controller.signal }), (error) => error.code === "aborted");
  }, { fetchImpl: async () => { calls += 1; return Response.json([post({ id: 121, link: "https://solwlfm.lawrence.edu/cached-story/" })]); } });
});

test("a direct article deep link fetches only its numeric ID and rejects private, protected or mismatched posts", async () => {
  await withClient(async () => assert.equal((await getBlogPost(122)).id, 122), { fetchImpl: async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/wp-json/wp/v2/posts/122");
    assert.equal(url.searchParams.get("context"), "view");
    return Response.json(post({ id: 122 }));
  } });
  for (const body of [post({ id: 123, status: "private" }), post({ id: 123, content: { rendered: "Protected", protected: true } }), post({ id: 999 })]) {
    await withClient(async () => {
      await assert.rejects(getBlogPost(123), (error) => error.code === "not-found");
    }, { fetchImpl: async () => Response.json(body) });
  }
  await withClient(async () => {
    for (const id of [0, -1, NaN, 1.5]) await assert.rejects(getBlogPost(id), (error) => error.code === "not-found");
  });
});

test("successful feed refresh removes old cached article bodies instead of resurrecting private or removed posts", async () => {
  let calls = 0;
  await withClient(async () => {
    await getBlogPosts();
    await getBlogPosts();
    await assert.rejects(getBlogPost(124), (error) => error.code === "not-found");
    assert.equal(calls, 3);
    assert.equal(getCachedBlogPostByUrl("invalid-url"), null);
  }, { fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return Response.json([post({ id: 124 })]);
    if (calls === 2) return Response.json([]);
    return Response.json(post({ id: 124, status: "private" }));
  } });
});
