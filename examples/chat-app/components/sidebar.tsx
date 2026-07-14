"use client";

import { MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatSummary } from "@/lib/history";
import { cn } from "@/lib/utils";

/**
 * The conversation history sidebar (like ChatGPT/Gemini): a "New chat" button and the list of past
 * chats. Selecting one re-opens its thread; the highlighted row is the current conversation.
 */
export function Sidebar({
  chats,
  currentThreadId,
  onNewChat,
  onSelectChat,
}: {
  chats: ChatSummary[];
  currentThreadId: string | null;
  onNewChat: () => void;
  onSelectChat: (threadId: string) => void;
}) {
  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r bg-muted/30"
      data-testid="chat-sidebar"
    >
      <div className="p-3">
        <Button variant="outline" className="w-full justify-start" onClick={onNewChat}>
          <Plus />
          New chat
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {chats.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Your conversations will appear here.
          </p>
        )}
        {chats.map((chat) => {
          const active = chat.threadId === currentThreadId;
          return (
            <button
              key={chat.threadId}
              onClick={() => onSelectChat(chat.threadId)}
              title={chat.title}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
              )}
            >
              <MessageSquare className="size-3.5 shrink-0" />
              <span className="truncate">{chat.title}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
