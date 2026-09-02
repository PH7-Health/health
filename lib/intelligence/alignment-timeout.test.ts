import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAlignmentTurn, IntelligenceProviderError } from "./provider";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("alignment provider timeout", () => {
  it("aborts an unresolved request after 30 seconds", async () => {
    vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.stubEnv("OPENAI_MODEL", "gpt-5.4");
    let aborted = false;
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise<Response>((_, reject) => { (options.signal as AbortSignal).addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); }); })));
    const pending = generateAlignmentTurn({ userMessage: "I want to be healthy." }); const rejection = expect(pending).rejects.toMatchObject({ message: "OpenAI alignment request timed out.", code: "REQUEST_FAILED" } satisfies Partial<IntelligenceProviderError>);
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(aborted).toBe(true);
  });
});
