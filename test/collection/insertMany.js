import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";


export function defineInsertMany() {
  describe("insertMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain(
        "before.insertMany",
        "args",
        ({ hookedCollection }) => hookedCollection.insertMany([{ _id: "test" }, { _id: "test2" }]),
        [[[{ _id: "test" }, { _id: "test2" }]], [[{ _id: "test" }, { _id: "test2" }]]]
      );
      assert.deepEqual(result, { acknowledged: true, insertedCount: 2, insertedIds: { 0: "test", 1: "test2" } }, "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.insertMany.success", "result", ({ hookedCollection }) => hookedCollection.insertMany([{ _id: "test" }]));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.insertMany.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "insertMany", () => { throw new Error("BAD CALL"); });
          return hookedCollection.insertMany([]);
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("should call the hooks with the correct arguments", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      const beforeInsert = mock.fn();
      const beforeInsertMany = mock.fn();
      const afterInsert = mock.fn();
      const afterInsertMany = mock.fn();
      hookedCollection.on("before.insert", beforeInsert);
      hookedCollection.on("after.insert.success", afterInsert);
      hookedCollection.on("before.insertMany", beforeInsertMany);
      hookedCollection.on("after.insertMany.success", afterInsertMany);
      const args = [[{ _id: "test2" }, { _id: "test3" }], undefined];
      await hookedCollection.insertMany(...args);
      assertImplements(beforeInsert.mock.calls, [
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][0],
            docOrig: args[0][0],
            thisArg: hookedCollection
          }]
        },
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][1],
            docOrig: args[0][1],
            thisArg: hookedCollection
          }]
        }
      ], "called the beforeUpdate hook correctly");
      assertImplements(beforeInsertMany.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        thisArg: hookedCollection
      }], "called the before{N} hook correctly");
      assertImplements(afterInsertMany.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        result: {
          acknowledged: true, insertedCount: 2, insertedIds: { 0: "test2", 1: "test3" }
        },
        resultOrig: {
          acknowledged: true, insertedCount: 2, insertedIds: { 0: "test2", 1: "test3" }
        },
        thisArg: hookedCollection
      }], "called the after{N} hook correctly");

      assertImplements(afterInsert.mock.calls, [
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][0],
            result: {
              acknowledged: true, insertedId: "test2"
            },
            resultOrig: {
              acknowledged: true, insertedId: "test2"
            },
            thisArg: hookedCollection
          }]
        },
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][1],
            result: {
              acknowledged: true, insertedId: "test3"
            },
            resultOrig: {
              acknowledged: true, insertedId: "test3"
            },
            thisArg: hookedCollection
          }]
        }
      ], "called the afterUpdate hook correctly");
    });
    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection();
      let first = true;
      hookedCollection.on("before.insert", () => {
        if (first) {
          first = false;
          return SkipDocument;
        }
      });
      const afterInsertMock = mock.fn();
      hookedCollection.on("after.insert.success", afterInsertMock);
      const result = await hookedCollection.insertMany([{ _id: "test" }, { _id: "test2" }]);
      assert.deepEqual(result, { acknowledged: true, insertedIds: { 0: "test2" }, insertedCount: 1 });
      assert.strictEqual(afterInsertMock.mock.callCount(), 1, "Should have only called after.insert for one doc");
    });
  });
}
