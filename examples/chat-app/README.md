# `chat-app` example

The **flagship** skein-js demo: a real research assistant with a ChatGPT/Gemini-style UI. A Gemini
agent **thinks out loud**, **searches the web**, and **remembers what you tell it across
conversations** — served by `skein dev`, streamed into a Next.js + [shadcn/ui](https://ui.shadcn.com)
frontend via [`useStream`](../../docs/react-sdk.md).

| Graph id   | File                                               | Needs a key?        | What it is                                                                                          |
| ---------- | -------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `research` | [`src/research-agent.ts`](./src/research-agent.ts) | ✅ `GOOGLE_API_KEY` | A Gemini ReAct agent: **thinking** + a `web_search` tool + `save_memory` with auto-injected recall. |

It's a plain LangGraph.js graph — skein serves it unchanged. What makes it a good showcase:

- **Thinking.** Gemini "thinking" is enabled (`thinkingConfig.includeThoughts`), so the agent
  streams its reasoning as `thinking` content blocks. The UI renders them in a collapsible panel.
- **Web search.** A `web_search` tool uses [Tavily](https://tavily.com) when `TAVILY_API_KEY` is set,
  and falls back to a deterministic placeholder otherwise — so the demo runs on the Gemini key alone.
- **Long-term memory.** A `save_memory` tool writes durable facts, and relevant memories are **auto-injected**
  into the system prompt before each turn (a dynamic `prompt` on `createReactAgent`), so the agent
  remembers you **across threads** without depending on the model to call a recall tool. Both use
  skein's injected LangGraph [`BaseStore`](../../docs/storage.md#long-term-memory-in-the-graph-getstore)
  (`getStore()`). Run with a Postgres store to get **pgvector semantic recall** (see below).

  > **Recall is your choice, not skein's.** skein (like LangGraph) only makes the store available via
  > `getStore()`; _how_ you recall is application code. This example auto-injects (see
  > [`buildPromptWithMemories`](./src/research-tools.ts)); equally valid: expose recall as a tool the
  > model calls, use a library like `langmem`, or skip memory entirely.

## Backend — run it

Get a Gemini Developer API key from <https://aistudio.google.com/apikey>, then:

```bash
cp .env.example .env          # paste your GOOGLE_API_KEY (optionally TAVILY_API_KEY)
pnpm install
pnpm dev                      # → skein dev --port 2024, serving the `research` graph
```

Its [`langgraph.json`](./langgraph.json) enables **CORS for `http://localhost:3005`** (the frontend)
and declares a `store.index` so semantic recall lights up on the Postgres store.

## Frontend — the chat UI

In a second terminal:

```bash
cp .env.local.example .env.local   # already points at :2024, graph `research`
pnpm dev:ui                        # → next dev on http://localhost:3005
```

The UI has a **conversation history sidebar** (like ChatGPT/Gemini): "New chat" starts a fresh
thread, and each past chat is listed by its first message — selecting one re-opens that thread and
loads its messages from the server. (The list is remembered per browser via localStorage; the
transcripts live on the skein-js server.)

Open <http://localhost:3005> and try, in order:

1. _"Research the current state of WebGPU browser support."_ — watch the **Thinking** panel and a
   **web_search** tool card appear, then the answer stream in.
2. _"Remember that I prefer concise, bulleted answers."_ — the agent calls **save_memory**.
3. Click **New chat**, then ask _"What do you remember about me?"_ — it answers _"You prefer concise,
   bulleted answers."_ The memory was saved in the first thread and auto-injected into this new one
   from skein's injected store — no recall tool call needed.

## Long-term memory with a durable store (optional)

The default in-memory store keeps memories only for the life of the process and does substring
recall. For durable, **pgvector semantic** recall — exactly what production would use — point
`skein dev` at Postgres (no full Docker needed):

```bash
export DATABASE_URL=postgres://…      # a Postgres with the `vector` extension available
pnpm exec skein dev --port 2024 --store postgres
```

`buildRuntime` resolves the `store.index.embed` from `langgraph.json`
(`google_genai:text-embedding-004`) and enables pgvector search. Memories now survive restarts and
recall ranks by semantic similarity.

## Authentication (optional)

[`src/auth.ts`](./src/auth.ts) is a LangGraph-style [`Auth`](https://langchain-ai.github.io/langgraphjs/)
handler, referenced from [`langgraph.json`](./langgraph.json)'s `auth` block. skein applies it to
every request across the whole Agent Protocol surface — the same custom-auth model as LangGraph
Platform.

It's frictionless by default: with no `SKEIN_API_KEY` set the server is open. Set one to require an
`X-Api-Key` header:

```bash
# backend
export SKEIN_API_KEY=some-secret
pnpm exec skein dev --port 2024

# frontend — send the key from the browser (useStream({ apiKey }))
echo 'NEXT_PUBLIC_SKEIN_API_KEY=some-secret' >> .env.local
```

Requests without a valid key get `401`; every caller's threads and runs are scoped to them
(`@auth.on("threads")` returns an `owner` filter), so one user can't read or mutate another's.

## Tests

```bash
# 1. Graph-logic unit tests — hermetic, no key, no network.
pnpm exec vitest run

# 2. Model-backed e2e over the official @langchain/langgraph-sdk (waits, streams, and asserts a
#    thinking frame). Skips automatically unless GOOGLE_API_KEY is set.
GOOGLE_API_KEY=... pnpm exec vitest run

# 3. Browser e2e — Playwright drives the shadcn UI and asserts streaming + a Thinking block + a tool
#    card render. Boots the backend and UI for you; needs a key and a browser.
npx playwright install chromium
GOOGLE_API_KEY=... pnpm test:e2e
```
