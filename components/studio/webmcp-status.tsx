"use client";

import { Badge } from "@/components/ui/badge";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function WebMcpStatus() {
  const status = useStudioStore((state) => state.webmcpStatus);

  if (status === "available") {
    return (
      <Badge variant="secondary" title="document.modelContext is available">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-emerald-500"
        />
        WebMCP on
      </Badge>
    );
  }

  if (status === "unavailable") {
    return (
      <Badge
        variant="outline"
        title="Enable chrome://flags/#enable-webmcp-testing in Chrome, then reload"
      >
        WebMCP off
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      WebMCP…
    </Badge>
  );
}
