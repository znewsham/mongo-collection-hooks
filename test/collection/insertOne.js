import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";


export function defineInsertOne() {
  describe("insertOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.insertOne", "args", ({ hookedCollection }) => hookedCollection.insertOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, insertedId: "test" }, "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.insertOne.success", "result", ({ hookedCollection }) => hookedCollection.insertOne({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.insertOne.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "insertOne", () => { throw new Error("BAD CALL"); });
          return hookedCollection.insertOne({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("should call the hooks with the correct arguments", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      const beforeInsert = mock.fn();
      const beforeInsertOne = mock.fn();
      const afterInsert = mock.fn();
      const afterInsertOne = mock.fn();
      hookedCollection.on("before.insert", beforeInsert);
      hookedCollection.on("after.insert.success", afterInsert);
      hookedCollection.on("before.insertOne", beforeInsertOne);
      hookedCollection.on("after.insertOne.success", afterInsertOne);
      const args = [{ _id: "test2" }, undefined];
      await hookedCollection.insertOne(...args);
      assertImplements(beforeInsert.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        caller: "insertOne",
        doc: args[0],
        docOrig: args[0],
        thisArg: hookedCollection
      }], "called the beforeInsert hook correctly");
      assertImplements(beforeInsertOne.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        thisArg: hookedCollection
      }], "called the before{N} hook correctly");
      assertImplements(afterInsertOne.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        result: {
          acknowledged: true, insertedId: "test2"
        },
        resultOrig: {
          acknowledged: true, insertedId: "test2"
        },
        thisArg: hookedCollection
      }], "called the after{N} hook correctly");

      assertImplements(afterInsert.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        caller: "insertOne",
        doc: args[0],
        result: {
          acknowledged: true, insertedId: "test2"
        },
        resultOrig: {
          acknowledged: true, insertedId: "test2"
        },
        thisArg: hookedCollection
      }], "called the afterInsert hook correctly");
    });

    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection();
      hookedCollection.on("before.insert", () => SkipDocument);
      const afterInsertMock = mock.fn();
      hookedCollection.on("after.insert.success", afterInsertMock);
      const result = await hookedCollection.insertOne({ _id: "test" });
      assert.strictEqual(afterInsertMock.mock.callCount(), 0, "Should have only called after.insert for one doc");
      assert.deepEqual(result, { acknowledged: false, insertedId: null });
    });

    it("should use chained options instead of original options", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection();
      const mockInsertOne = mock.method(fakeCollection, "insertOne");

      hookedCollection.on("before.insertOne", ({ args }) => {
        const [doc, options] = args;
        return [doc, { ...options, comment: "modified options" }];
      });

      const doc = { _id: "test" };
      const originalOptions = { comment: "original options" };
      await hookedCollection.insertOne(doc, originalOptions);

      assert.strictEqual(mockInsertOne.mock.calls.length, 1);
      const passedOptions = mockInsertOne.mock.calls[0].arguments[1];
      assert.deepEqual(passedOptions, { comment: "modified options" });
    });
  });
}
