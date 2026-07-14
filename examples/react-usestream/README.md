# `react-usestream` example

A minimal Next.js app that streams from a **skein-js** server using
[`@langchain/langgraph-sdk/react`](https://www.npmjs.com/package/@langchain/langgraph-sdk)'s
`useStream` hook. It is the front-end harness for verifying that skein-js's SSE wiring
satisfies the LangChain React SDK — token-by-token streaming in a real browser.

See [`../../docs/react-sdk.md`](../../docs/react-sdk.md).

## Run

This is the frontend half of the end-to-end demo. Start a skein-js backend first, then this app.

1. **Backend** — in one terminal, run the [`gemini-chat`](../gemini-chat) example (a real Gemini
   agent), which listens on `http://localhost:2024` and serves the `gemini` assistant:

   ```bash
   cd ../gemini-chat
   cp .env.example .env               # paste your GOOGLE_API_KEY
   pnpm install && pnpm dev           # skein dev --port 2024
   ```

2. **Frontend** — in a second terminal:

   ```bash
   cp .env.local.example .env.local   # already points at :2024, assistant `gemini`
   pnpm install
   pnpm dev                           # http://localhost:3005
   ```

Open <http://localhost:3005>, send a message, and watch the reply stream in token-by-token — the
front-end signal that skein-js's SSE wiring satisfies the LangChain React SDK.

> Point it anywhere: `NEXT_PUBLIC_SKEIN_URL` and `NEXT_PUBLIC_SKEIN_ASSISTANT_ID` let you aim this
> at any skein-js server and graph id (e.g. the [`express-basic`](../express-basic) `agent` graph).
