import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

/**
 * A real Gemini-backed ReAct agent with one tool. Streams tokens over SSE, so it's the graph to
 * point `useStream` at (see examples/react-usestream) — the model-backed end-to-end signal for
 * skein-js's frontend + backend drop-in promise.
 *
 * Requires GOOGLE_API_KEY (a Gemini Developer API key from https://aistudio.google.com/apikey).
 * Model is overridable via GOOGLE_MODEL.
 */
const getWeather = tool(async ({ city }: { city: string }) => `It's always sunny in ${city}.`, {
  name: "get_weather",
  description: "Get the current weather for a city.",
  schema: z.object({ city: z.string().describe("City to look up") }),
});

const model = new ChatGoogleGenerativeAI({
  model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
  temperature: 0,
});

export const graph = createReactAgent({ llm: model, tools: [getWeather] });
