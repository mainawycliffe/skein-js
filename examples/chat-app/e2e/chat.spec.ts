import { expect, test } from "@playwright/test";

// A real browser drives the shadcn chat UI end to end: type a prompt, watch the reply stream in, and
// assert the three things this example exists to show — a streamed answer, the model's thinking, and
// a tool call. Requires GOOGLE_API_KEY (the whole suite self-skips without one; see the config).
const hasKey = Boolean(process.env["GOOGLE_API_KEY"]);

test.skip(!hasKey, "requires GOOGLE_API_KEY to drive a live Gemini model");

test("streams a reply, renders thinking, and shows a tool call", async ({ page }) => {
  await page.goto("/");

  // The history sidebar is present from the start.
  await expect(page.getByTestId("chat-sidebar")).toBeVisible();

  await page
    .getByTestId("composer-input")
    .fill(
      "Research the current state of WebGPU browser support, and remember that I prefer concise answers.",
    );
  await page.getByTestId("send-button").click();

  // The assistant turn appears and the answer streams in.
  const assistant = page.getByTestId("assistant-message").first();
  await expect(assistant).toBeVisible({ timeout: 90_000 });

  // The model's thinking is rendered (Gemini thinking, streamed as reasoning content).
  await expect(page.getByTestId("thinking-block").first()).toBeVisible({ timeout: 90_000 });

  // The agent used at least one tool (web_search / save_memory / recall_memory).
  await expect(page.getByTestId("tool-call").first()).toBeVisible({ timeout: 90_000 });

  // And a non-empty answer landed.
  await expect(assistant).toContainText(/[a-z]/i, { timeout: 90_000 });
});
