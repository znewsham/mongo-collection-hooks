// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";

export function defineCountTests() {
  describe("count", () => {
    declareSimpleTests("count", [], 3, [1, 2, 3]);

    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.find.cursor.count", "args", ({ hookedCursor }) => hookedCursor.count());
      assert.deepEqual(result, 3);
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.find.cursor.count.success", "result", ({ hookedCursor }) => hookedCursor.count());
      assert.deepEqual(result, "Hello World");
    });
  });
}
