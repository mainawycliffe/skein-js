# `migrated-langgraph` example

The **drop-in proof**: a stock LangGraph.js project — a `langgraph.json` pointing at a compiled graph
([src/graph.ts](src/graph.ts)), nothing skein-specific — run **unchanged** under `skein dev` in place
of `langgraph dev`.

The whole config is minimal and identical to what the LangGraph CLI expects:

```json
{ "node_version": "20", "graphs": { "agent": "./src/graph.ts:graph" }, "env": ".env" }
```

## What you'll learn

- **`skein dev` is a drop-in for `langgraph dev`.** The same project, config, and clients keep
  working — migrating is a one-word script change (`langgraph dev` → `skein dev`).
- **No Docker.** It boots an in-process Agent Protocol server (Express) straight from `langgraph.json`.
- **TypeScript graphs load via vite** — no separate loader or build step.
- **State-preserving hot reload.** Editing a graph and saving reloads it while **keeping** threads,
  runs, and memory — the state survives the reload.
- **Dev state persists across restarts.** State is written to `.skein/` (gitignored) so it survives a
  full `Ctrl-C` + restart. Disable with `--no-persist` to stay ephemeral.

Point any Agent Protocol client at `http://127.0.0.1:2024` (the `@langchain/langgraph-sdk` `Client`,
Agent Chat UI, or React `useStream`). The graph id is `agent`.

## How to run

From the repo root, build the CLI once (only needed when running from source; rerun after changing any
`packages/*` source — the graph files in `src/` hot-reload without a rebuild):

```bash
pnpm install
pnpm nx build cli
```

Start the dev server:

```bash
cd examples/migrated-langgraph
pnpm dev                     # → skein dev, http://127.0.0.1:2024
```

You'll see a boot line, then one log line per request as you hit it:

```text
skein-js listening on http://127.0.0.1:2024
POST /threads 200 6ms
POST /threads/<id>/runs/wait 200 14ms
```

**Smoke test** (another terminal) — create a thread and run the graph:

```bash
TID=$(curl -s -X POST http://127.0.0.1:2024/threads -H 'content-type: application/json' -d '{}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["thread_id"])')

curl -s -X POST "http://127.0.0.1:2024/threads/$TID/runs/wait" \
  -H 'content-type: application/json' \
  -d "{\"assistant_id\":\"agent\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}}"
# → messages array ending in an AIMessage: "(turn 1) you said: hello"
```

**Hot reload keeps state** — with the server running, edit [src/graph.ts](src/graph.ts) (e.g. change
`you said:` to `echo:`) and save. The log shows `change detected, reloading… → reloaded`. Run again
on the same `$TID`: the new wording appears **and** the earlier turns are still there.

**Persistence across restart** — `Ctrl-C`, then `pnpm dev` again. It logs `restored dev state.` and
`curl http://127.0.0.1:2024/threads/$TID/state` still returns your thread. State lives in `.skein/`.
Run with `--no-persist` to stay ephemeral.

**Automated end-to-end** (spawns the built CLI, drives it with the real SDK, checks restart
persistence):

```bash
pnpm nx test example-migrated-langgraph
```

## What to look at

- [`src/graph.ts`](src/graph.ts) — the entire agent: a plain compiled LangGraph.js graph with nothing
  skein-specific.
- [`langgraph.json`](./langgraph.json) — the unchanged LangGraph CLI config skein reads as-is.
