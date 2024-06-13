// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";


export function defineToArrayTests() {
  describe("toArray", () => {
    declareSimpleTests("toArray", [], [1, 2, 3], [1, 2, 3]);
    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.aggregation.cursor.toArray.success", "result", ({ hookedCursor }) => hookedCursor.toArray());
      assert.deepEqual(result, "Hello World");
    });

    it("should call the before hooks in parallel", async () => {
      await hookInParallel("before.aggregation.cursor.toArray", ({ hookedCursor }) => hookedCursor.toArray());
    });

    it("should call the error hooks in parallel", async () => {
      await hookInParallel("after.aggregation.cursor.toArray.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "toArray", () => { throw new Error("test"); });
        try {
          await hookedCursor.toArray();
        }
        catch (e) {}
      });
    });
  });
}
