"use client";

import { useEffect, useState } from "react";
import { FloorPlan3dViewer } from "@/components/studio/floor-plan-3d-viewer";
import { FloorPlanCanvas } from "@/components/studio/floor-plan-canvas";
import { ChatPanel } from "@/components/studio/chat-panel";
import { UnitSelector } from "@/components/studio/unit-selector";
import { WebMcpStatus } from "@/components/studio/webmcp-status";
import { Button } from "@/components/ui/button";
import { useExportDownload } from "@/hooks/use-export-download";
import { useWebMcpTools } from "@/hooks/use-webmcp-tools";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function StudioApp() {
  const [hydrated, setHydrated] = useState(
    () => useStudioStore.persist?.hasHydrated() ?? false,
  );
  const [chatKey, setChatKey] = useState(0);
  const resetStore = useStudioStore((state) => state.reset);

  useEffect(() => {
    const unsub = useStudioStore.persist.onFinishHydration(() => setHydrated(true));
    void useStudioStore.persist.rehydrate();
    return unsub;
  }, []);
  useWebMcpTools();
  useExportDownload();

  function reset() {
    resetStore();
    setChatKey((key) => key + 1);
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div>
          <p className="text-sm font-medium tracking-tight">Floor Plan Architect</p>
          <p className="text-xs text-muted-foreground">
            Three layouts per home. Agents draw; you stay in the loop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UnitSelector />
          <WebMcpStatus />
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex h-[42vh] w-full shrink-0 flex-col border-b p-3 md:h-auto md:w-[380px] md:border-r md:border-b-0">
          {hydrated ? (
            <ChatPanel key={chatKey} />
          ) : (
            <p className="text-sm text-muted-foreground">Restoring session…</p>
          )}
        </aside>
        <FloorPlanCanvas key={chatKey} />
      </div>
      <FloorPlan3dViewer />
    </div>
  );
}
