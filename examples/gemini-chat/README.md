# `gemini-chat` example

The **end-to-end, model-backed** skein-js demo: a real **Gemini** ReAct agent served by
`skein dev`, streamed token-by-token into a React frontend. This is the frontend + backend proof
for [roadmap step 7](../../docs/roadmap.md) — the whole thing runs against your own Gemini key with
only a URL pointing the client at skein-js.

| Graph id | File                                           | Needs a key?        | What it is                                                        |
| -------- | ---------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `gemini` | [`src/gemini-graph.ts`](./src/gemini-graph.ts) | ✅ `GOOGLE_API_KEY` | A Gemini ReAct agent with a `get_weather` tool; streams over SSE. |

It's a plain LangGraph.js graph (`createReactAgent` with `ChatGoogleGenerativeAI`) — skein-js serves
it unchanged.

## Backend — run it

Get a Gemini Developer API key from <https://aistudio.google.com/apikey>, then:

```bash
cp .env.example .env          # paste your GOOGLE_API_KEY
pnpm install
pnpm dev                      # skein dev --port 2024
```

The server listens on `http://localhost:2024` and serves the `gemini` assistant. Its
[`langgraph.json`](./langgraph.json) also enables **CORS for `http://localhost:3005`** — skein's
CORS is off by default, and that origin is the `react-usestream` frontend below.

Point any Agent Protocol client at it:

- Vanilla SDK — `new Client({ apiUrl: "http://localhost:2024" })`, assistant `gemini`.
- React — the [`react-usestream`](../react-usestream) app (see its README); it defaults to the
  `gemini` assistant.

## Frontend — stream it in a browser

In a second terminal:

```bash
cd ../react-usestream
cp .env.local.example .env.local   # already points at :2024, assistant `gemini`
pnpm install
pnpm dev                            # http://localhost:3005
```

Open <http://localhost:3005>, ask _"what's the weather in Nairobi?"_, and watch Gemini's reply
stream in token-by-token (the `get_weather` tool round-trips on the way).

## Test

```bash
# Drives a live Gemini model through the official @langchain/langgraph-sdk client.
# Skips automatically when GOOGLE_API_KEY is unset.
GOOGLE_API_KEY=... pnpm exec vitest run
```
