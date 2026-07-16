import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";

// Reached through the `@fixture/lib` tsconfig-path alias — proves the build inlines workspace-aliased
// source (used in the node body, not the state type, so schema extraction stays alias-independent).
import { banner } from "@fixture/lib";

// Return a plain message dict (the MessagesAnnotation reducer coerces it) rather than importing a
// message class, so the fixture's only runtime external is `@langchain/langgraph`.
function reply(state: typeof MessagesAnnotation.State): {
  messages: Array<{ role: string; content: string }>;
} {
  const last = state.messages.at(-1);
  const text = typeof last?.content === "string" ? last.content : "";
  return { messages: [{ role: "assistant", content: `${banner()}: ${text}` }] };
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("reply", reply)
  .addEdge("__start__", "reply")
  .addEdge("reply", "__end__")
  .compile();
