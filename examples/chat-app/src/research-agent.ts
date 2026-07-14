// A real-world research assistant graph: a Gemini ReAct agent that (1) thinks out loud (Gemini
// "thinking" streamed as reasoning content blocks), (2) searches the web, and (3) remembers facts
// about the user across threads via skein's long-term store (`getStore()`, injected by the run
// engine — see docs/storage.md). It's a plain LangGraph.js graph; skein serves it unchanged.
//
// The tools and their pure helpers live in `research-tools.ts` so tests can exercise them without a
// model. This module only assembles the model + agent.

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { buildPromptWithMemories, saveMemoryTool, webSearchTool } from "./research-tools.js";

/**
 * The model. Gemini "thinking" is enabled so the agent streams its reasoning as `thinking` content
 * blocks — the frontend renders these in a collapsible panel. Model overridable via `GOOGLE_MODEL`.
 */
const model = new ChatGoogleGenerativeAI({
  model: process.env["GOOGLE_MODEL"] ?? "gemini-2.5-flash",
  temperature: 0,
  thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 },
});

export const graph = createReactAgent({
  llm: model,
  tools: [webSearchTool, saveMemoryTool],
  // Recall is an application choice (see buildPromptWithMemories): this example auto-injects relevant
  // memories into the system prompt before each model call, so recall doesn't depend on the model
  // invoking a tool. skein itself stays unopinionated — it only makes getStore() available.
  prompt: buildPromptWithMemories,
});
