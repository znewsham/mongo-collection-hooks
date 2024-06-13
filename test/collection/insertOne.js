import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hooksChain } from "./helpers.js";
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
      }], "called the beforeUpdate hook correctly");
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
      }], "called the afterUpdate hook correctly");
    });
  });
}
