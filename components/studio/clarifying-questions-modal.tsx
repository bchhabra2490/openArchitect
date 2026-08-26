"use client";

import { ClarifyingForm } from "@/components/studio/clarifying-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function ClarifyingQuestionsModal() {
  const pendingQuestions = useStudioStore((state) => state.pendingQuestions);
  const questionSource = useStudioStore((state) => state.questionSource);
  const chatReplyHandler = useStudioStore((state) => state.chatReplyHandler);
  const open = Boolean(pendingQuestions?.length);

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>A few questions</DialogTitle>
          <DialogDescription>
            Answer these so the architect can finish your floor plan. You can also reply in
            ChatGPT if you started from site tools.
          </DialogDescription>
        </DialogHeader>
        {pendingQuestions?.length ? (
          <ClarifyingForm
            key={pendingQuestions.map((question) => question.id).join("-")}
            questions={pendingQuestions}
            onSubmitToChat={
              questionSource === "chat" ? (chatReplyHandler ?? undefined) : undefined
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
