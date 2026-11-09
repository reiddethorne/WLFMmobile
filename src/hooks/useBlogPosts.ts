import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { BlogError, blogErrorDiagnostic, getBlogEndpoint, getBlogPosts, type BlogPost } from "@/services/wordpress";

export function useBlogPosts() {
  const [posts, setPosts] = useState<readonly BlogPost[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "coming-soon" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setError(null);
      setDiagnostic(null);
      try {
        if (!getBlogEndpoint()) {
          setStatus("coming-soon");
          return;
        }
        setStatus("loading");
        const result = await getBlogPosts({ signal: controller.signal });
        if (!active) return;
        setPosts(result);
        setStatus("ready");
      } catch (failure: unknown) {
        if (!active) return;
        setError(failure instanceof BlogError ? failure.message : "Unable to load the station blog. Try again.");
        if (__DEV__) setDiagnostic(blogErrorDiagnostic(failure));
        setStatus("error");
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [revision]));

  return { posts, status, error, diagnostic, refresh };
}
