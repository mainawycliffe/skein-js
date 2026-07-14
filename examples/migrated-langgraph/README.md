# migrated-langgraph — the `skein dev` drop-in proof

A stock LangGraph.js project: a `langgraph.json` pointing at a compiled graph
([src/graph.ts](src/graph.ts)), nothing skein-specific. The point of this example is that it runs
**unchanged** under `skein dev` in place of `langgraph dev`.

```bash
# what you'd run with the LangGraph CLI:
#   langgraph dev
# with skein-js, same project, same config:
pnpm dev            # → skein dev
```

`skein dev`:

- boots an in-process Agent Protocol server (Express) from `langgraph.json` — **no Docker**;
- loads TypeScript graphs through **vite** (no separate loader/build step);
- **hot-reloads** on save while **keeping** threads, runs, and memory (state survives the reload);
- **persists** dev state to `.skein/` so it also survives a full restart (disable with
  `--no-persist`);
- loads `langgraph.json`'s `env` and a conventional `.env` into `process.env` at boot.

Point any Agent Protocol client at `http://127.0.0.1:2024` (the `@langchain/langgraph-sdk` `Client`,
the Agent Chat UI, or React `useStream`). The graph id is `agent`.

## Test it with the current build

From the repo root, build the CLI once (rerun after changing any `packages/*` source; the graph
files in `src/` hot-reload without a rebuild):

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
`curl http://127.0.0.1:2024/threads/$TID/state` still returns your thread. State lives in `.skein/`
(gitignored). Run with `--no-persist` to stay ephemeral.

**Automated end-to-end** (spawns the built CLI, drives it with the real SDK, checks restart
persistence):

```bash
pnpm nx test example-migrated-langgraph
```
