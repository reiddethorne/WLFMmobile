import { useCallback, useEffect, useRef, useState } from "react";

import { getStationInfo } from "@/services/live365";
import type { Live365StationInfo } from "@/types/live365";

type DiagnosticsState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly station: Live365StationInfo }
  | { readonly status: "error"; readonly message: string };

/** One snapshot per mount/manual refresh. No playback or background polling. */
export function useLive365Diagnostics() {
  const [state, setState] = useState<DiagnosticsState>({ status: "loading" });
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setState({ status: "loading" });
    void getStationInfo({ signal: request.signal }).then(
      (station) => {
        if (!request.signal.aborted) setState({ status: "ready", station });
      },
      (error: unknown) => {
        if (!request.signal.aborted) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Live365 request failed." });
        }
      },
    );
  }, []);

  useEffect(() => {
    refresh();
    return () => requestRef.current?.abort();
  }, [refresh]);

  return { state, refresh };
}
