// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";
import { getHookedCollection } from "../collection/helpers.js";
import { Test } from "../testClass.js";

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


    it("should call the (generic) before hooks in parallel", async () => {
      await hooksChain("before.cursor.forEach", "args", ({ hookedCursor }) => hookedCursor.forEach(() => {}), [[() => {}], [() => {}]]);
    });

    it("should call the (generic) error hooks in parallel", async () => {
      await hookInParallel("after.cursor.forEach.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "forEach", () => { throw new Error("test"); });
        try {
          await hookedCursor.forEach();
        }
        catch (e) {}
      });
    });
    it("should pass the result between (generic) after hooks correctly", async () => {
      await hookInParallel("after.cursor.forEach.success", ({ hookedCursor }) => hookedCursor.forEach(() => {}));
    });

    it("the transform should work", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }], { transform: doc => new Test(doc) });
      await hookedCollection.find({}).forEach((doc) => {
        assert.ok(doc instanceof Test, "transform worked");
      });
    });
  });
}
