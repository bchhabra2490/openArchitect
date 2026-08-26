"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClarifyingQuestion } from "@/lib/floor-plan/types";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function ClarifyingForm({
  questions,
  onSubmitToChat,
}: {
  questions: ClarifyingQuestion[];
  onSubmitToChat?: (text: string) => void;
}) {
  const submitAnswers = useStudioStore((state) => state.submitAnswers);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((question) => [question.id, ""])),
  );

  function update(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim().length > 0),
    );
    if (Object.keys(filled).length === 0) return;
    submitAnswers(filled);
    const summary = questions
      .filter((question) => filled[question.id])
      .map((question) => `${question.prompt}: ${filled[question.id]}`)
      .join("\n");
    onSubmitToChat?.(summary);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {questions.map((question) => (
        <div key={question.id} className="flex flex-col gap-1">
          <Label htmlFor={question.id} className="text-xs">
            {question.prompt}
          </Label>
          {question.type === "choice" && question.options?.length ? (
            <select
              id={question.id}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              value={values[question.id] ?? ""}
              onChange={(event) => update(question.id, event.target.value)}
            >
              <option value="">Select…</option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={question.id}
              type={question.type === "number" ? "number" : "text"}
              value={values[question.id] ?? ""}
              onChange={(event) => update(question.id, event.target.value)}
            />
          )}
        </div>
      ))}
      <Button type="submit" size="sm">
        Send answers
      </Button>
    </form>
  );
}
