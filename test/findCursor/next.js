// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";
import { getHookedCollection } from "../collection/helpers.js";
import { Test } from "../testClass.js";

export function defineNextTests() {
  describe("next", () => {
    declareSimpleTests("next", [], 1, [1, 2, 3]);

    it("should call the before hooks in parallel", async () => {
      await hookInParallel("before.find.cursor.next", ({ hookedCursor }) => hookedCursor.next());
    });

    it("should call the error hooks in parallel", async () => {
      await hookInParallel("after.find.cursor.next.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "next", () => { throw new Error("test"); });
        try {
          await hookedCursor.next();
        }
        catch (e) {}
      });
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.find.cursor.next.success", "result", ({ hookedCursor }) => hookedCursor.next());
      assert.deepEqual(result, "Hello World");
    });


    it("should call the (generic) before hooks in parallel", async () => {
      await hookInParallel("before.cursor.next", ({ hookedCursor }) => hookedCursor.next());
    });

    it("should call the (generic) error hooks in parallel", async () => {
      await hookInParallel("after.cursor.next.error", async ({ hookedCursor, fakeCursor }) => {
        mock.method(fakeCursor, "next", () => { throw new Error("test"); });
        try {
          await hookedCursor.next();
        }
        catch (e) {}
      });
    });
    it("should pass the result between (generic) after hooks correctly", async () => {
      const result = await hooksChain("after.cursor.next.success", "result", ({ hookedCursor }) => hookedCursor.next());
      assert.deepEqual(result, "Hello World");
    });

    it("the transform should work", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }], { transform: doc => new Test(doc) });
      hookedCollection.on("after.find.cursor.next", ({
        result
      }) => {
        assert.ok(result instanceof Test, "transformed in hook");
      });
      const result = await hookedCollection.find({}).next();

      assert.ok(result instanceof Test, "transform worked");
    });
  });
}
