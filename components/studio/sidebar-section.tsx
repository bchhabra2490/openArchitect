"use client";

import { useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarSection({
  title,
  badge,
  action,
  defaultOpen = true,
  grow = false,
  children,
}: {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  grow?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    setOpen((current) => !current);
  }

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10",
        grow && open && "min-h-0 flex-1",
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left font-medium outline-none select-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={toggle}
        >
          <span className="truncate">{title}</span>
          {badge}
        </button>
        {action}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={toggle}
        >
          <ChevronUp
            aria-hidden
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      {open ? (
        <div
          className={cn(
            "border-t px-3 py-2",
            grow && "flex min-h-0 flex-1 flex-col overflow-hidden",
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
