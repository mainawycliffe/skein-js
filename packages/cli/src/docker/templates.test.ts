import { describe, expect, it } from "vitest";

import { generateCompose } from "./compose.js";
import { generateDockerfile } from "./dockerfile.js";

describe("generateDockerfile", () => {
  it("pins the base image to the config's node_version and appends dockerfile_lines before CMD", () => {
    const out = generateDockerfile({
      nodeVersion: "22",
      dockerfileLines: ["RUN echo hello", "ENV FOO=bar"],
      port: 8123,
    });
    expect(out).toContain("FROM node:22-slim");
    expect(out).toContain("RUN echo hello");
    expect(out).toContain("ENV FOO=bar");
    expect(out.indexOf("RUN echo hello")).toBeLessThan(out.indexOf("CMD ["));
  });

  it("defaults to node 20 and boots the compiled artifact via `skein start`", () => {
    const out = generateDockerfile({ port: 8123 });
    expect(out).toContain("FROM node:20-slim");
    // Pre-built path: runs `skein start` (compiled JS), not `skein dev` (runtime TS transform).
    expect(out).toContain('"npx", "skein", "start"');
    expect(out).not.toContain('"dev"');
    expect(out).toContain('"--store", "postgres"');
    expect(out).toContain('"--queue", "redis"');
    expect(out).toContain("EXPOSE 8123");
  });

  it("ships a slim image: prod-only install, no vite/tsx toolchain, no chown", () => {
    const out = generateDockerfile({ port: 8123 });
    expect(out).toContain("npm install --omit=dev --omit=optional --no-audit --no-fund");
    // No dev toolchain, no runtime TS transform, no vite cache to chown.
    expect(out).not.toContain("chown");
    expect(out).not.toMatch(/vite|tsx|corepack|--frozen-lockfile/);
  });

  it("runs as the non-root node user before the CMD", () => {
    const out = generateDockerfile({ port: 8123 });
    expect(out).toContain("USER node");
    expect(out.indexOf("USER node")).toBeLessThan(out.indexOf("CMD ["));
  });

  it("sets production env and enables source maps for readable stack traces", () => {
    const out = generateDockerfile({ port: 8123 });
    expect(out).toContain("ENV NODE_ENV=production");
    expect(out).toContain("ENV NODE_OPTIONS=--enable-source-maps");
  });

  it("declares a healthcheck against /ok on the bound port", () => {
    const out = generateDockerfile({ port: 8123 });
    expect(out).toContain("HEALTHCHECK");
    expect(out).toContain("/ok");
  });

  it("enables the BuildKit cache mount and the syntax directive on line 1", () => {
    const out = generateDockerfile({ port: 8123 });
    expect(out).toMatch(/^# syntax=docker\/dockerfile:1/);
    expect(out).toContain("--mount=type=cache");
  });

  it("omits --port so the container binds the platform-injected PORT", () => {
    const out = generateDockerfile({ port: 8123 });
    // Exec-form CMD keeps node as PID 1 for graceful SIGTERM; --host stays, --port is dropped.
    expect(out).toContain('"--host", "0.0.0.0"');
    expect(out).not.toContain('"--port"');
  });
});

describe("generateCompose", () => {
  it("wires app + pgvector Postgres + Redis with healthcheck-gated startup", () => {
    const out = generateCompose({ hostPort: 8123, host: "0.0.0.0", containerPort: 8123 });
    expect(out).toContain("image: pgvector/pgvector:pg16");
    expect(out).toContain("image: redis:7");
    expect(out).toContain("condition: service_healthy");
    expect(out).toContain("POSTGRES_URI: postgresql://postgres:postgres@postgres:5432/skein");
    expect(out).toContain("REDIS_URI: redis://redis:6379");
    // PORT is injected so the app binds the container port the mapping publishes; init reaps zombies.
    expect(out).toContain('PORT: "8123"');
    expect(out).toContain("init: true");
  });

  it("publishes on all interfaces by default and binds a specific host when given one", () => {
    expect(generateCompose({ hostPort: 9000, host: "0.0.0.0", containerPort: 8123 })).toContain(
      '- "9000:8123"',
    );
    expect(generateCompose({ hostPort: 9000, host: "127.0.0.1", containerPort: 8123 })).toContain(
      '- "127.0.0.1:9000:8123"',
    );
  });
});
