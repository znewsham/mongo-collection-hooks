import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { Test } from "../testClass.js";

export function defineFindOne() {
  describe("findOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.findOne", "args", ({ hookedCollection }) => hookedCollection.findOne());
      assert.deepEqual(result, undefined, "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.findOne.success", "result", ({ hookedCollection }) => hookedCollection.findOne());
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.findOne.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "findOne", () => { throw new Error("BAD CALL"); });
          return hookedCollection.findOne();
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("the transform should work", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }], { transform: doc => new Test(doc) });
      hookedCollection.on("after.findOne", ({
        result
      }) => {
        assert.ok(result instanceof Test, "transformed in hook");
      });
      const result = await hookedCollection.findOne({});

      assert.ok(result instanceof Test, "transform worked");
    });
  });
}
