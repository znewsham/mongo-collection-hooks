// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";

export function defineForEachTests() {
  describe("forEach", () => {
    declareSimpleTests("forEach", [() => {}], undefined, [1, 2, 3]);

    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain(
        "before.find.cursor.forEach",
        "args",
        ({ hookedCursor }) => hookedCursor.forEach(() => {}),
        [[() => {}], [() => {}]]
      );
      assert.deepEqual(result, undefined);
    });

    it("should call the error hooks in parallel", async () => {
      await hookInParallel("after.find.cursor.forEach.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "forEach", () => { throw new Error("test"); });
        try {
          await hookedCursor.forEach(() => {});
        }
        catch (e) {}
      });
    });
  });
}
