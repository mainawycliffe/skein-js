// A plain LangGraph.js graph — exactly what you'd already have written for `langgraph dev`. Nothing
// here is skein-specific: the same `langgraph.json` + `path:export` runs unchanged under `skein dev`.
// It's deterministic (no API key, no network), so it's easy to point a client at, and it appends to
// the message history so persisted state is visible across restarts (each turn adds a reply).

import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";

function respond(state: typeof MessagesAnnotation.State): { messages: BaseMessage[] } {
  const last = state.messages.at(-1);
  const text = typeof last?.content === "string" ? last.content : "";
  const turn = state.messages.length;
  return { messages: [new AIMessage(`(turn ${turn}) you said: ${text}`)] };
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("respond", respond)
  .addEdge("__start__", "respond")
  .addEdge("respond", "__end__")
  .compile();
