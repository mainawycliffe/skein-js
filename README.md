# skein-js

**A TypeScript [Agent Protocol](https://github.com/langchain-ai/agent-protocol) server for [LangGraph.js](https://github.com/langchain-ai/langgraphjs) — and a drop-in replacement for the LangGraph CLI.**

skein-js lets you self-host your LangGraph.js graphs behind the standard Agent Protocol API,
from any Node HTTP framework (Express first; Fastify and NestJS to follow). Think of it as
[**aegra**](https://github.com/aegra/aegra) for the TypeScript ecosystem: zero vendor
lock-in, full control over your agent infrastructure, and the same client tooling you
already use.

**Reuse-first.** On JavaScript, the Agent Protocol server internals are already open
([`@langchain/langgraph-api`](https://www.npmjs.com/package/@langchain/langgraph-api), MIT),
so skein-js doesn't rebuild them. It reuses the LangGraph runtime, checkpointers, `langgraph.json`
parser, schemas, and SDK/types, and adds only the durable-production, multi-framework, and
drop-in-CLI layer that OSS lacks. See [docs/reuse.md](./docs/reuse.md).

> **skein-js** _(noun)_ — a coiled length of thread. The Agent Protocol's first-class
> **threads**, and the strands of a graph.

## The drop-in promise

Already using the LangGraph CLI? Switch by changing one word in your `package.json` — and
keep your existing `langgraph.json` **unchanged**:

```diff
  "scripts": {
-   "dev": "langgraph dev",
-   "up":  "langgraph up"
+   "dev": "skein dev",
+   "up":  "skein up"
  }
```

Your existing clients keep working against `localhost` with only a URL change:

- **`@langchain/langgraph-sdk`** — the vanilla JS client (`client.threads` / `client.runs` / …)
- **`@langchain/langgraph-sdk/react`** — the **`useStream`** hook, streaming over SSE
- **[Agent Chat UI](https://github.com/langchain-ai/agent-chat-ui)** and **LangGraph Studio**

## Why skein-js

|                           | LangGraph Platform | aegra            | **skein-js**                          |
| ------------------------- | ------------------ | ---------------- | ------------------------------------- |
| Self-hosted               | ❌ hosted          | ✅               | ✅                                    |
| Language                  | —                  | Python / FastAPI | **TypeScript / Node**                 |
| HTTP framework            | —                  | FastAPI          | **Express / Fastify / NestJS**        |
| Agent Protocol            | ✅                 | ✅               | ✅                                    |
| Drop-in for LangGraph CLI | —                  | partial          | **✅ (`skein dev` / `up` / `build`)** |

## Status

🚧 **Pre-alpha — the drop-in dev loop works today.** In place: the shared contract
(`@skein-js/core`), the `langgraph.json` loader (`@skein-js/config`), the in-memory driver
(`@skein-js/storage-memory`), the framework-agnostic **run engine + Agent Protocol handlers**
(`@skein-js/agent-protocol`), the **Express adapter** (`@skein-js/express`), and **`skein dev`** —
an in-process dev server that runs an unchanged `langgraph.json` with no Docker, TypeScript graphs
loaded via vite, state-preserving hot reload, and on-disk persistence across restarts. Next up:
Postgres + Redis drivers and `skein up`. See the [roadmap](./docs/roadmap.md).

## Try it from source

```bash
pnpm install
pnpm nx build cli                     # builds the `skein` binary

cd examples/migrated-langgraph        # a stock LangGraph project, unchanged
pnpm dev                              # → skein dev, http://127.0.0.1:2024
```

In another terminal, talk to it with the official SDK (or point the Agent Chat UI at the same URL,
graph id `agent`):

```bash
TID=$(curl -s -X POST http://127.0.0.1:2024/threads -H 'content-type: application/json' -d '{}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["thread_id"])')

curl -s -X POST "http://127.0.0.1:2024/threads/$TID/runs/wait" \
  -H 'content-type: application/json' \
  -d "{\"assistant_id\":\"agent\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}}"
```

Edit `examples/migrated-langgraph/src/graph.ts` and save — the server hot-reloads while keeping your
threads. `Ctrl-C` and restart — state is restored from `.skein/`. Full walkthrough and the
end-to-end test: [examples/migrated-langgraph](./examples/migrated-langgraph/README.md).

## Architecture

An Nx monorepo of small packages:

| Package                                  | Purpose                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@skein-js/core`                         | The shared contract — Agent Protocol wire types, `SkeinStore` + queue/bus interfaces, edge error                 |
| `@skein-js/agent-protocol`               | Framework-agnostic Agent Protocol engine — run engine, handler table, SSE (the heart); independently publishable |
| `@skein-js/config`                       | `langgraph.json` parser + graph loader (`path:export`)                                                           |
| `@skein-js/express`                      | Express adapter (v1)                                                                                             |
| `@skein-js/fastify` / `@skein-js/nestjs` | Additional adapters (later)                                                                                      |
| `@skein-js/storage-memory`               | In-memory storage driver (dev/tests)                                                                             |
| `@skein-js/storage-postgres`             | Postgres driver + pgvector (prod)                                                                                |
| `@skein-js/redis`                        | Redis job queue + cross-instance pub/sub streaming                                                               |
| `skein-js` (CLI)                         | `skein dev` / `up` / `build` / `dockerfile`                                                                      |

Read the full design in [`docs/`](./docs):

- [Overview & vision](./docs/index.md)
- [Reuse-first architecture](./docs/reuse.md) — what we reuse vs. rebuild
- [Code practices](./docs/code-practices.md) — readable, functional, simple
- [Agent Protocol surface](./docs/agent-protocol.md)
- [LangGraph CLI compatibility](./docs/langgraph-cli-compat.md)
- [Streaming (SSE)](./docs/streaming.md)
- [React SDK / `useStream`](./docs/react-sdk.md)
- [Storage](./docs/storage.md)
- [Runs & Redis](./docs/runs-and-redis.md)
- [Roadmap](./docs/roadmap.md)

## License

[Apache-2.0](./LICENSE)
