import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";


export function defineUpdateMany() {
  describe("updateMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.updateMany", "args", ({ hookedCollection }) => hookedCollection.updateMany({ _id: "test" }), [[[{ _id: "test" }]], [[{ _id: "test" }]]]);
      assert.deepEqual(result.acknowledged, true, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.updateMany.success", "result", ({ hookedCollection }) => hookedCollection.updateMany({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      assert.rejects(
        () => hookInParallel("after.updateMany.error", "result", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "updateMany", () => { throw new Error(); });
          return hookedCollection.updateMany({}, {});
        })
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

    it("if there are no before/after update hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection.updateMany({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after update hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("after.update", () => {});
      hookedCollection.on("after.update", () => {});
      await hookedCollection.updateMany({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });

    it("if before hooks access the document, there should be a single extraneous DB operation per document", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      });
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      });
      await hookedCollection.updateMany({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 3, "Only three DB operation");
    });

    it("if any before hook running specifies greedyFetch, there should NOT be a single extraneous DB operation per document", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      }, { greedyFetch: true });
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      });
      await hookedCollection.updateMany({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });
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

  it("Should skip documents correctly", async () => {
    const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
    let first = true;
    hookedCollection.on("before.update", () => {
      if (first) {
        first = false;
        return SkipDocument;
      }
    });
    const afterUpdateMock = mock.fn();
    hookedCollection.on("after.update.success", afterUpdateMock);
    const result = await hookedCollection.updateMany({}, { $set: { a: 1 } });
    assert.deepEqual(result, {
      acknowledged: true, matchedCount: 2, modifiedCount: 1, upsertedCount: 0, upsertedId: null
    });
    assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.insert for one doc");
  });
}
