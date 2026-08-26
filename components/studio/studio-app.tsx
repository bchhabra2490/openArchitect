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
import { cn } from "@/lib/utils";

export function StudioApp({ chatEnabled = false }: { chatEnabled?: boolean }) {
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

  function toggleSidebar() {
    setSidebarOpen((open) => !open);
  }

  const toggleButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={toggleSidebar}
      title={sidebarOpen ? "Hide sidebar (⌘L)" : "Show sidebar (⌘L)"}
      aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      aria-pressed={sidebarOpen}
      className="rounded-full border bg-background shadow-sm"
    >
      {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
    </Button>
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-tight">OpenArchitect</p>
          <p className="text-xs text-muted-foreground">
            Agents draw on the canvas. You stay in the loop.
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
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {sidebarOpen ? (
          <aside className="relative flex h-[42vh] w-full shrink-0 flex-col border-b p-3 md:h-auto md:w-[380px] md:border-r md:border-b-0">
            {hydrated ? (
              <ChatPanel key={chatKey} chatEnabled={chatEnabled} />
            ) : (
              <p className="text-sm text-muted-foreground">Restoring session…</p>
            )}
            <div
              className={cn(
                "absolute z-20",
                "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
                "md:top-1/2 md:right-0 md:bottom-auto md:left-auto md:translate-x-1/2 md:-translate-y-1/2",
              )}
            >
              {toggleButton}
            </div>
          </aside>
        ) : (
          <div
            className={cn(
              "absolute z-20",
              "top-3 left-1/2 -translate-x-1/2",
              "md:top-1/2 md:left-0 md:translate-x-1/2 md:-translate-y-1/2",
            )}
          >
            {toggleButton}
          </div>
        )}
        <FloorPlanCanvas key={chatKey} />
      </div>
      <FloorPlan3dViewer />
    </div>
  );
}
