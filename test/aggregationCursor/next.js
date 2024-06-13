// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";

export function defineNextTests() {
  describe("next", () => {
    declareSimpleTests("next", [], 1, [1, 2, 3]);

    it("should call the before hooks in parallel", async () => {
      await hookInParallel("before.aggregation.cursor.next", ({ hookedCursor }) => hookedCursor.next());
    });

    it("should call the error hooks in parallel", async () => {
      await hookInParallel("after.aggregation.cursor.next.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "next", () => { throw new Error("test"); });
        try {
          await hookedCursor.next();
        }
        catch (e) {}
      });
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.aggregation.cursor.next.success", "result", ({ hookedCursor }) => hookedCursor.next());
      assert.deepEqual(result, "Hello World");
    });
  });
}
