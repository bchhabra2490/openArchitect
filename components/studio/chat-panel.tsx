"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Loader2, Mic, MicOff, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ClarifyingForm } from "@/components/studio/clarifying-form";
import { DesignIssuesCard } from "@/components/studio/design-issues-card";
import { DesignRulesCard } from "@/components/studio/design-rules-card";
import { RequirementsCard } from "@/components/studio/requirements-card";
import { SidebarSection } from "@/components/studio/sidebar-section";
import { joinSpeech, useDictation } from "@/hooks/use-dictation";
import type { ArchitectUIMessage } from "@/lib/agents/architect-agent";
import type { ClarifyingQuestion, CommandResult } from "@/lib/floor-plan/types";
import { useStudioStore } from "@/lib/store/use-studio-store";
import { cn } from "@/lib/utils";

function isCommandResult(value: unknown): value is CommandResult & {
  questions?: ClarifyingQuestion[];
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "plan" in value &&
      "brief" in value &&
      "summary" in value,
  );
}

function toolLabel(type: string) {
  return type.replace(/^tool-/, "").replaceAll("_", " ");
}

function rememberedToolIds(messages: ArchitectUIMessage[]) {
  const ids = new Set<string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith("tool-")) continue;
      if ("toolCallId" in part && part.toolCallId) ids.add(String(part.toolCallId));
    }
  }
  return ids;
}

export function ChatPanel() {
  const applyResult = useStudioStore((state) => state.applyResult);
  const setPendingQuestions = useStudioStore((state) => state.setPendingQuestions);
  const pendingQuestions = useStudioStore((state) => state.pendingQuestions);
  const questionSource = useStudioStore((state) => state.questionSource);
  const setChatMessages = useStudioStore((state) => state.setChatMessages);
  const restoredMessages = useStudioStore.getState().chatMessages as ArchitectUIMessage[];
  const applied = useRef(rememberedToolIds(restoredMessages));
  const [input, setInput] = useState("");
  const [interim, setInterim] = useState("");
  const [dictation, setDictation] = useState(false);

  const { supported: dictationSupported, listening, error: dictationError } =
    useDictation({
      active: dictation,
      onFinal: (phrase) => {
        setInput((current) => joinSpeech(current, phrase));
        setInterim("");
      },
      onInterim: setInterim,
      onDenied: () => setDictation(false),
    });

  const draft = interim ? joinSpeech(input, interim) : input;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ArchitectUIMessage>({
        api: "/api/chat",
        body: () => {
          const { brief, plan } = useStudioStore.getState();
          return { brief, plan };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop } = useChat<ArchitectUIMessage>({
    id: "studio-architect",
    transport,
    messages: restoredMessages,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    setChatMessages(messages);
  }, [messages, setChatMessages]);

  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (!part.type.startsWith("tool-")) continue;
        if (!("state" in part) || part.state !== "output-available") continue;
        const id = "toolCallId" in part ? String(part.toolCallId) : null;
        if (!id || applied.current.has(id)) continue;
        applied.current.add(id);
        if (!("output" in part) || !isCommandResult(part.output)) continue;
        applyResult(part.output);
        if (part.output.questions?.length) {
          setPendingQuestions(part.output.questions);
        }
      }
    }
  }, [messages, applyResult, setPendingQuestions]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setInput("");
    setInterim("");
    await sendMessage({ text });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await send();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <RequirementsCard />
      <DesignRulesCard />
      <DesignIssuesCard />
      <SidebarSection title="Chat" grow>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 pr-2">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
              Example: “3BHK apartment, about 1200 sqft, open kitchen facing the living
              room, two bathrooms.” Turn on Dictation to speak instead of type.
              </p>
            ) : null}
            {messages.map((message) => (
              <article key={message.id} className="flex flex-col gap-1.5">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {message.role === "user" ? "You" : "Architect"}
                </p>
                {message.parts.map((part, index) => {
                  if (part.type === "text" && part.text.trim()) {
                    return (
                      <p
                        key={`${message.id}-${index}`}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm leading-relaxed",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const summary =
                      "output" in part && isCommandResult(part.output)
                        ? part.output.summary
                        : "state" in part
                          ? part.state
                          : "";
                    return (
                      <p
                        key={`${message.id}-${index}`}
                        className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {toolLabel(part.type)}
                        {summary ? ` — ${summary}` : ""}
                      </p>
                    );
                  }
                  return null;
                })}
              </article>
            ))}
            {busy ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Drawing…
              </p>
            ) : null}
            {error ? (
              <p className="text-xs text-destructive">{error.message}</p>
            ) : null}
          </div>
        </ScrollArea>
      </SidebarSection>
      {pendingQuestions?.length ? (
        <SidebarSection title="Questions">
          <ClarifyingForm
            key={pendingQuestions.map((question) => question.id).join("-")}
            questions={pendingQuestions}
            onSubmitToChat={
              questionSource === "chat"
                ? (text) => {
                    void sendMessage({ text });
                  }
                : undefined
            }
          />
        </SidebarSection>
      ) : null}
      <SidebarSection title="Message" defaultOpen>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(event) => {
            setInput(event.target.value);
            setInterim("");
          }}
          placeholder={
            dictation
              ? listening
                ? "Listening… describe the home"
                : "Starting microphone…"
              : "Describe the home you want…"
          }
          rows={3}
          aria-label="Message"
          className={cn(dictation && listening && "border-emerald-500/80")}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {dictationError ? (
          <p className="text-[11px] text-destructive">{dictationError}</p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant={dictation ? "secondary" : "outline"}
            aria-pressed={dictation}
            disabled={!dictationSupported}
            title={
              dictationSupported
                ? dictation
                  ? "Turn dictation off"
                  : "Turn dictation on and speak"
                : "Dictation needs Chrome or Safari with a microphone"
            }
            onClick={() => setDictation((current) => !current)}
          >
            {dictationSupported ? (
              <Mic data-icon="inline-start" />
            ) : (
              <MicOff data-icon="inline-start" />
            )}
            {dictation ? (
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  listening ? "bg-emerald-500" : "bg-muted-foreground/50",
                )}
              />
            ) : null}
            Dictation
          </Button>
          <div className="flex gap-2">
            {busy ? (
              <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
                Stop
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
              <SendHorizontal data-icon="inline-start" />
              Send
            </Button>
          </div>
        </div>
      </form>
      </SidebarSection>
    </div>
  );
}
