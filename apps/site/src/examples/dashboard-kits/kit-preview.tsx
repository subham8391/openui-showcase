"use client";

import { Renderer } from "@openuidev/react-lang";
import { useKitRenderer } from "./use-kit-renderer";

/** One gallery dashboard rendered as it is in the gallery, for previews elsewhere. */
export function KitPreview({ kitId, index = 0 }: { kitId: string; index?: number }) {
  const { kit, library, toolProvider } = useKitRenderer(kitId);
  return (
    <Renderer
      response={kit.gallery[index].program}
      library={library}
      isStreaming={false}
      toolProvider={toolProvider}
    />
  );
}
