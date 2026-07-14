"use client";

import { Brain, ChevronDown } from "lucide-react";
import { useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * The model's reasoning, rendered as a collapsible panel (the "thinking" you see in ChatGPT/Gemini).
 * Open by default so the reasoning is visible as it streams; the user can fold it away.
 */
export function ThinkingBlock({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(true);
  if (!thinking.trim()) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="thinking-block">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <Brain className="size-3.5" />
        <span>Thinking</span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="mt-1.5 whitespace-pre-wrap rounded-md border border-dashed bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
