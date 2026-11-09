import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { BlogError, blogErrorDiagnostic, getBlogPost, type BlogPost } from "@/services/wordpress";

export function useBlogPost(id: string | string[] | undefined) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setPost(null);
    setError(null);
    setDiagnostic(null);
    setLoading(true);
    async function load() {
      try {
        const articleId = typeof id === "string" && /^\d+$/u.test(id) ? Number(id) : NaN;
        const result = await getBlogPost(articleId, { signal: controller.signal });
        if (active) setPost(result);
      } catch (failure: unknown) {
        if (!active) return;
        setError(failure instanceof BlogError && failure.code === "not-found" ? "This story is no longer available."
          : failure instanceof BlogError ? failure.message : "Unable to load this story. Try again.");
        if (__DEV__) setDiagnostic(blogErrorDiagnostic(failure));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [id, revision]));

  return { post, loading, error, diagnostic, retry };
}
