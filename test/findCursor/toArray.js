// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";


export function defineToArrayTests() {
  describe("toArray", () => {
    declareSimpleTests("toArray", [], [1, 2, 3], [1, 2, 3]);
    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.find.cursor.toArray.success", "result", ({ hookedCursor }) => hookedCursor.toArray());
      assert.deepEqual(result, "Hello World");
    });

    it("should call the before hooks in parallel", async () => {
      await hookInParallel("before.find.cursor.toArray", ({ hookedCursor }) => hookedCursor.toArray());
    });

    it("should call the error hooks in parallel", async () => {
      await hookInParallel("after.find.cursor.toArray.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "toArray", () => { throw new Error("test"); });
        try {
          await hookedCursor.toArray();
        }
        catch (e) {}
      });
    });


    it("should call the (generic) before hooks in parallel", async () => {
      await hookInParallel("before.cursor.toArray", ({ hookedCursor }) => hookedCursor.toArray());
    });

    it("should call the (generic) error hooks in parallel", async () => {
      await hookInParallel("after.cursor.toArray.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "toArray", () => { throw new Error("test"); });
        try {
          await hookedCursor.toArray();
        }
        catch (e) {}
      });
    });
    it("should pass the result between (generic) after hooks correctly", async () => {
      const result = await hooksChain("after.cursor.toArray.success", "result", ({ hookedCursor }) => hookedCursor.toArray());
      assert.deepEqual(result, "Hello World");
    });
  });
}
