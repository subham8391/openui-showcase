"use client";

// Wires one kit to the Renderer: its openui-lang library and a tool provider
// that runs the kit's data tools through this example's API route.

import { type OpenUIError } from "@openuidev/react-lang";
import { useMemo, useState } from "react";
import { KITS } from "../kits";
import { createToolProvider, KIT_LIBRARIES, type ToolCall } from "../kits/client";

/** Where this example's API routes live (app/dashboard-kits/api/). */
export const API = "/dashboard-kits/api";

export function useKitRenderer(kitId: string) {
  const kit = KITS.find((k) => k.id === kitId)!;
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  const toolProvider = useMemo(
    () =>
      createToolProvider(kit, {
        endpoint: `${API}/tools`,
        onCall: (call) => setCalls((prev) => [...prev.slice(-49), call]),
      }),
    [kit],
  );
  return {
    kit,
    library: KIT_LIBRARIES[kitId],
    toolProvider,
    calls,
    errors,
    onError: setErrors,
    reset: () => {
      setCalls([]);
      setErrors([]);
    },
  };
}
