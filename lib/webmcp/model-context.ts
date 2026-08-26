export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    extra?: { signal?: AbortSignal },
  ) => Promise<unknown> | unknown;
};

export type WebMcpRegisterOptions = {
  signal?: AbortSignal;
  exposedTo?: string[];
};

export type ModelContext = {
  registerTool: (
    tool: WebMcpToolDefinition,
    options?: WebMcpRegisterOptions,
  ) => Promise<void> | void;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContext?: ModelContext;
  }
}

export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  if (document.modelContext && "registerTool" in document.modelContext) {
    return document.modelContext;
  }
  if (navigator.modelContext && "registerTool" in navigator.modelContext) {
    return navigator.modelContext;
  }
  return null;
}
