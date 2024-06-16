import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";
import { updateTests } from "./update.js";

export function defineUpdateOne() {
  describe("updateOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.updateOne", "args", ({ hookedCollection }) => hookedCollection.updateOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result.acknowledged, true, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.updateOne.success", "result", ({ hookedCollection }) => hookedCollection.updateOne({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.updateOne.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "updateOne", () => { throw new Error("BAD CALL"); });
          return hookedCollection.updateOne({}, {});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("should call insert hooks when a document is upserted", async () => {
      const { hookedCollection } = getHookedCollection([]);
      const insertMock = mock.fn(() => {});
      const updateMock = mock.fn(() => {});
      hookedCollection.on("before.insert", insertMock);
      hookedCollection.on("after.insert.success", insertMock);
      hookedCollection.on("after.insert.error", insertMock);
      hookedCollection.on("before.update", updateMock);
      hookedCollection.on("after.update.success", updateMock);
      hookedCollection.on("after.update.error", updateMock);

      await hookedCollection.updateOne(
        { _id: "test" },
        { $setOnInsert: { _id: "test", field: "someField" } },
        { upsert: true }
      );
      assert.strictEqual(insertMock.mock.callCount(), 2, "We called the insert hook once");
      assert.strictEqual(updateMock.mock.callCount(), 0, "we didn't call the update hook");
    });



    it("should call the hooks with the correct arguments", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      const beforeUpdateMock = mock.fn();
      const beforeUpdateOneMock = mock.fn();
      const afterUpdateMock = mock.fn();
      const afterUpdateOneMock = mock.fn();
      hookedCollection.on("before.update", beforeUpdateMock);
      hookedCollection.on("after.update.success", afterUpdateMock);
      hookedCollection.on("before.updateOne", beforeUpdateOneMock);
      hookedCollection.on("after.updateOne.success", afterUpdateOneMock);
      await hookedCollection.updateOne({ _id: "test" }, { $set: { field: "value" } });
      assertImplements(beforeUpdateMock.mock.calls[0].arguments, [{
        args: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        argsOrig: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        caller: "updateOne",
        filterMutator: {
          filter: { _id: "test" },
          mutator: { $set: { field: "value" } }
        },
        filterMutatorOrig: {
          filter: { _id: "test" },
          mutator: { $set: { field: "value" } }
        },
        _id: "test",
        thisArg: hookedCollection
      }], "called the beforeUpdate hook correctly");
      assertImplements(beforeUpdateOneMock.mock.calls[0].arguments, [{
        args: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        argsOrig: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        thisArg: hookedCollection
      }], "called the beforeUpdateOne hook correctly");
      assertImplements(afterUpdateOneMock.mock.calls[0].arguments, [{
        args: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        argsOrig: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        result: {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        },
        resultOrig: {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        },
        thisArg: hookedCollection
      }], "called the afterUpdateOneMock hook correctly");

      assertImplements(afterUpdateMock.mock.calls[0].arguments, [{
        args: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        argsOrig: [{ _id: "test" }, { $set: { field: "value" } }, undefined],
        filterMutator: {
          filter: { _id: "test" },
          mutator: { $set: { field: "value" } }
        },
        result: {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        },
        resultOrig: {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        },
        thisArg: hookedCollection
      }], "called the afterUpdate hook correctly");
    });

    updateTests("updateOne");
  });
}
