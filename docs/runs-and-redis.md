# Runs & Redis

This doc covers how Skein executes runs and how it scales horizontally — modeled on
[aegra](https://github.com/aegra/aegra)'s worker + Redis architecture, adapted to Node.

> **Reuse note:** `@skein/redis` is the run **queue + pub/sub** — the piece LangGraph OSS
> does not provide (the open [`@langchain/langgraph-api`](https://www.npmjs.com/package/@langchain/langgraph-api)
> server runs runs in-process, in-memory). It is _not_ a checkpointer; for Redis-backed
> checkpoints use `@langchain/langgraph-checkpoint-redis`. See [reuse.md](./reuse.md).

## Run modes

The [Agent Protocol](./agent-protocol.md) defines three ways to execute a graph:

| Mode           | Endpoint                                     | Behavior                                                   |
| -------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **wait**       | `POST /runs/wait`, `GET /runs/{id}/wait`     | Run to completion, return final output.                    |
| **stream**     | `POST /runs/stream`, `GET /runs/{id}/stream` | [SSE](./streaming.md) as output is produced.               |
| **background** | `POST /threads/{id}/runs`                    | Enqueue; poll (`GET /runs/{id}`) or join its stream later. |

A **concurrency guard** prevents two active runs on the same thread (the protocol's
concurrency-control requirement).

## Run engine

`@skein/agent-protocol` owns a run engine that:

1. Resolves the target graph via [`@skein/config`](./langgraph-cli-compat.md).
2. Persists a run row through [`SkeinStore`](./storage.md) (`pending → running → success/error`).
3. Invokes the graph (`invoke` for wait, `stream` for streaming), threading the LangGraph
   **checkpointer** so state/history persist and **interrupt/resume** (human-in-the-loop)
   works.
4. Publishes stream frames to subscribers (local bus or Redis pub/sub).

## Queue drivers

The engine talks to a small queue/pub-sub interface with two implementations:

### In-memory (dev)

- Single-process queue + event bus. No external services.
- Used by `skein dev` so nothing beyond Node is required locally.

### `@skein/redis` (prod)

- **Job queue** — background runs are enqueued in Redis; worker processes pull and execute
  them, enabling multiple instances behind one queue.
- **Lease-based recovery** — a crashed worker's in-flight run lease expires and is retried,
  so runs survive restarts.
- **Cross-instance pub/sub** — run stream frames are published to Redis channels so a client
  connected to instance B can join a run executing on instance A (see [streaming.md](./streaming.md)).

This is the same shape aegra uses (Redis job queue + pub/sub, lease-based recovery,
Postgres checkpoints) — <https://github.com/aegra/aegra>.

## Deployment topology (`skein up`)

```
        ┌──────────┐     ┌──────────┐        clients (SSE)
        │ instance │     │ instance │  ◄───────────────────
        │    A     │     │    B     │
        └────┬─────┘     └────┬─────┘
             │  queue + pub/sub │
             └───────┬──────────┘
                 ┌───▼───┐        ┌───────────────┐
                 │ Redis │        │   Postgres    │
                 └───────┘        │ checkpoints + │
                                  │ resources +   │
                                  │ pgvector      │
                                  └───────────────┘
```

`skein up` brings this stack up via Docker Compose. Horizontal scaling is verified by
starting a run on instance A and joining its SSE stream from instance B through Redis (see
[roadmap.md](./roadmap.md#verification)).
