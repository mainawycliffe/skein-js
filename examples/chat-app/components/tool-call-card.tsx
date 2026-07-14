"use client";

import { Brain, Search, Wrench } from "lucide-react";
import type { ComponentType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { type ToolCall, toolLabel } from "@/lib/messages";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  web_search: Search,
  save_memory: Brain,
  recall_memory: Brain,
};

/**
 * One tool call the agent made, with the argument it was called with and — once the matching tool
 * message arrives — its result. This is the "the agent used a tool" affordance in the transcript.
 */
export function ToolCallCard({ call, result }: { call: ToolCall; result?: string }) {
  const Icon = ICONS[call.name] ?? Wrench;
  const primaryArg = call.args["query"] ?? call.args["content"];

  return (
    <Card className="bg-muted/40" data-testid="tool-call">
      <CardContent className="flex flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Icon className="size-3.5 text-muted-foreground" />
          <span>{toolLabel(call.name)}</span>
          {typeof primaryArg === "string" && (
            <span className="truncate text-muted-foreground">“{primaryArg}”</span>
          )}
        </div>
        {result && (
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-background/60 p-2 text-xs leading-relaxed text-muted-foreground">
            {result}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
