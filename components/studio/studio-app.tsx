"use client";

import { useEffect, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const resetStore = useStudioStore((state) => state.reset);

  useEffect(() => {
    const unsub = useStudioStore.persist.onFinishHydration(() => setHydrated(true));
    void useStudioStore.persist.rehydrate();
    return unsub;
  }, []);
  useWebMcpTools();
  useExportDownload();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "l") {
        return;
      }
      event.preventDefault();
      setSidebarOpen((open) => !open);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  function reset() {
    resetStore();
    setChatKey((key) => key + 1);
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen((open) => !open)}
            title={sidebarOpen ? "Hide sidebar (⌘L)" : "Show sidebar (⌘L)"}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-pressed={sidebarOpen}
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-tight">OpenArchitect</p>
            <p className="text-xs text-muted-foreground">
              Agents draw on the canvas. You stay in the loop.
            </p>
          </div>
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
        {sidebarOpen ? (
          <aside className="flex h-[42vh] w-full shrink-0 flex-col border-b p-3 md:h-auto md:w-[380px] md:border-r md:border-b-0">
            {hydrated ? (
              <ChatPanel key={chatKey} />
            ) : (
              <p className="text-sm text-muted-foreground">Restoring session…</p>
            )}
          </aside>
        ) : null}
        <FloorPlanCanvas key={chatKey} />
      </div>
      <FloorPlan3dViewer />
    </div>
  );
}
