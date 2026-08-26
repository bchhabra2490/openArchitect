"use client";

import { useEffect } from "react";
import { toolInputSchemas, type ToolName } from "@/lib/floor-plan/schema";
import { READ_ONLY_TOOLS, TOOL_DESCRIPTIONS, TOOL_TITLES, toWebMcpInputSchema } from "@/lib/tools/catalog";
import { executeStudioTool } from "@/lib/tools/execute-studio-tool";
import { useStudioStore } from "@/lib/store/use-studio-store";

const TOOL_NAMES = Object.keys(toolInputSchemas) as ToolName[];

/** Registers canvas commands via document.modelContext.registerTool for ChatGPT / Chrome agents. */
export function useWebMcpTools() {
  const setWebmcpStatus = useStudioStore((state) => state.setWebmcpStatus);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const modelContext = document.modelContext ?? navigator.modelContext;
    if (typeof modelContext?.registerTool !== "function") {
      setWebmcpStatus("unavailable");
      return;
    }

    setWebmcpStatus("available");
    const controller = new AbortController();

    void Promise.all(
      TOOL_NAMES.map((name) => {
        const tool = {
          name,
          title: TOOL_TITLES[name],
          description: TOOL_DESCRIPTIONS[name],
          inputSchema: toWebMcpInputSchema(name),
          annotations: {
            readOnlyHint: READ_ONLY_TOOLS.has(name),
          },
          execute: async (input: Record<string, unknown>) =>
            executeStudioTool(name, input),
        };

        if (document.modelContext) {
          return document.modelContext.registerTool(tool, {
            signal: controller.signal,
          });
        }
        return modelContext.registerTool(tool, { signal: controller.signal });
      }),
    ).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("WebMCP tool registration failed", error);
      setWebmcpStatus("unavailable");
    });

    return () => controller.abort();
  }, [setWebmcpStatus]);
}
