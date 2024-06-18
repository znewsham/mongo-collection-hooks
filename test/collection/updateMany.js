import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";
import { updateTests } from "./update.js";


export function defineUpdateMany() {
  describe("updateMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.updateMany", "args", ({ hookedCollection }) => hookedCollection.updateMany({ _id: "test" }, { $set: { value: "test" } }), [[[{ _id: "test" }, { $set: { value: "test" } }]], [[{ _id: "test" }, { $set: { value: "test" } }]]]);
      assert.deepEqual(result.acknowledged, true, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.updateMany.success", "result", ({ hookedCollection }) => hookedCollection.updateMany({ _id: "test" }, { $set: { value: "test" } }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.updateMany.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "updateMany", () => { throw new Error("BAD CALL"); });
          return hookedCollection.updateMany({}, {});
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

      await hookedCollection.updateMany(
        { _id: "test" },
        { $setOnInsert: { _id: "test", field: "someField" } },
        { upsert: true }
      );
      assert.strictEqual(insertMock.mock.callCount(), 2, "We called the insert hook once");
      assert.strictEqual(updateMock.mock.callCount(), 0, "we didn't call the update hook");
    });

    it("should call update hooks once per document", async () => {
      const { hookedCollection } = getHookedCollection([]);
      const updateMock = mock.fn(() => {});
      await hookedCollection.insertOne({ _id: "test" });
      await hookedCollection.insertOne({ _id: "test1" });
      hookedCollection.on("before.update", updateMock);
      hookedCollection.on("after.update.success", updateMock);
      await hookedCollection.updateMany({}, { $set: { thing: 1 } });
      assert.strictEqual(updateMock.mock.callCount(), 4, "we didn't call the update hook");
    });

    it("should allow access to the doc inside the hook", async () => {
      const { hookedCollection } = getHookedCollection([]);
      await hookedCollection.insertOne({ _id: "test" });
      await hookedCollection.insertOne({ _id: "test1" });
      hookedCollection.on("before.update", async ({
        getDocument
      }) => {
        const doc = await getDocument();
        assert.ok(doc._id, "doc has an ID");
      });
      hookedCollection.on("after.update.success", async ({
        getDocument
      }) => {
        const doc = await getDocument();
        assert.strictEqual(doc.thing, 1, "thing is set");
      });
      await hookedCollection.updateMany({}, { $set: { thing: 1 } });
    });

    it("should call the hooks with the correct arguments", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const beforeUpdateMock = mock.fn();
      const beforeUpdateManyMock = mock.fn();
      const afterUpdateMock = mock.fn();
      const afterUpdateManyMock = mock.fn();
      hookedCollection.on("before.update", beforeUpdateMock);
      hookedCollection.on("after.update.success", afterUpdateMock);
      hookedCollection.on("before.updateMany", beforeUpdateManyMock);
      hookedCollection.on("after.updateMany.success", afterUpdateManyMock);
      await hookedCollection.updateMany({}, { $set: { field: "value" } });
      assertImplements(beforeUpdateMock.mock.calls, [
        {
          arguments: [{
            args: [{}, { $set: { field: "value" } }, undefined],
            argsOrig: [{}, { $set: { field: "value" } }, undefined],
            caller: "updateMany",
            filterMutator: {
              filter: {},
              mutator: { $set: { field: "value" } }
            },
            filterMutatorOrig: {
              filter: {},
              mutator: { $set: { field: "value" } }
            },
            _id: "test",
            thisArg: hookedCollection
          }]
        },
        {
          arguments: [{
            args: [{}, { $set: { field: "value" } }, undefined],
            argsOrig: [{}, { $set: { field: "value" } }, undefined],
            caller: "updateMany",
            filterMutator: {
              filter: {},
              mutator: { $set: { field: "value" } }
            },
            filterMutatorOrig: {
              filter: {},
              mutator: { $set: { field: "value" } }
            },
            _id: "test2",
            thisArg: hookedCollection
          }]
        }
      ], "called the beforeUpdate hook correctly");
      assertImplements(beforeUpdateManyMock.mock.calls[0].arguments, [{
        args: [{}, { $set: { field: "value" } }, undefined],
        argsOrig: [{}, { $set: { field: "value" } }, undefined],
        thisArg: hookedCollection
      }], "called the beforeUpdateMany hook correctly");
      assertImplements(afterUpdateManyMock.mock.calls[0].arguments, [{
        args: [{}, { $set: { field: "value" } }, undefined],
        argsOrig: [{}, { $set: { field: "value" } }, undefined],
        result: {
          acknowledged: true, matchedCount: 2, modifiedCount: 2, upsertedCount: 0, upsertedId: null
        },
        resultOrig: {
          acknowledged: true, matchedCount: 2, modifiedCount: 2, upsertedCount: 0, upsertedId: null
        },
        thisArg: hookedCollection
      }], "called the afterUpdateManyMock hook correctly");

      assertImplements(afterUpdateMock.mock.calls, [
        {
          arguments: [{
            args: [{}, { $set: { field: "value" } }, undefined],
            argsOrig: [{}, { $set: { field: "value" } }, undefined],
            filterMutator: {
              filter: {},
              mutator: { $set: { field: "value" } }
            },
            _id: "test",
            result: {
              acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
            },
            resultOrig: {
              acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
            },
            thisArg: hookedCollection
          }]
        },
        {
          arguments: [{
            args: [{}, { $set: { field: "value" } }, undefined],
            argsOrig: [{}, { $set: { field: "value" } }, undefined],
            filterMutator: {
              filter: {},
              mutator: { $set: { field: "value" } }
            },
            _id: "test2",
            result: {
              acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
            },
            resultOrig: {
              acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
            },
            thisArg: hookedCollection
          }]
        }
      ], "called the afterUpdate hook correctly");
    });
    updateTests("updateMany");
  });
}
