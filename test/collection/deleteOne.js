import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { deleteTests } from "./delete.js";
import { assertImplements } from "../helpers.js";


export function defineDeleteOne() {
  describe("deleteOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.deleteOne", "args", ({ hookedCollection }) => hookedCollection.deleteOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, deletedCount: 1 }, "It deleted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.deleteOne.success", "result", ({ hookedCollection }) => hookedCollection.deleteOne({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should provide the correct args to the hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockBefore = mock.fn();
      const mockAfter = mock.fn();
      hookedCollection.on("before.deleteOne", mockBefore);
      hookedCollection.on("after.deleteOne.success", mockAfter);
      await hookedCollection.deleteOne({});
      assertImplements(
        mockBefore.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          thisArg: hookedCollection
        }],
        "before hook is correct"
      );

      assertImplements(
        mockAfter.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          result: { acknowledged: true, deletedCount: 1 },
          resultOrig: { acknowledged: true, deletedCount: 1 },
          thisArg: hookedCollection
        }],
        "after hook is correct"
      );
    });

    it("should provide the correct args (with id) to the hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockBefore = mock.fn();
      const mockAfter = mock.fn();
      hookedCollection.on("before.deleteOne", mockBefore, { includeId: true });
      hookedCollection.on("after.deleteOne.success", mockAfter, { includeId: true });
      await hookedCollection.deleteOne({});
      assertImplements(
        mockBefore.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          _id: "test",
          thisArg: hookedCollection
        }],
        "before hook is correct"
      );

      assertImplements(
        mockAfter.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          _id: "test",
          result: { acknowledged: true, deletedCount: 1 },
          resultOrig: { acknowledged: true, deletedCount: 1 },
          thisArg: hookedCollection
        }],
        "after hook is correct"
      );
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.deleteOne.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "deleteOne", () => { throw new Error("BAD CALL"); });
          return hookedCollection.deleteOne({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    deleteTests("deleteOne");
  });
}
