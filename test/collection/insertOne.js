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

    it("Should skip documents correctly when multiple hooks are chained, even if a later hook returns a non-SkipDocument value", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection();
      const mockInsertOne = mock.method(fakeCollection, "insertOne");
      const seenDocs = [];
      hookedCollection.on("before.insert", ({ doc }) => {
        seenDocs.push({ hook: "A", doc });
        return { ...doc, a: 1 };
      });
      hookedCollection.on("before.insert", ({ doc }) => {
        seenDocs.push({ hook: "B", doc });
        return SkipDocument;
      });
      hookedCollection.on("before.insert", ({ doc, isSkipped }) => {
        seenDocs.push({ hook: "C", doc, isSkipped });
        return { ...doc, c: 1 };
      });
      hookedCollection.on("before.insert", ({ doc, isSkipped }) => {
        seenDocs.push({ hook: "D", doc, isSkipped });
      });
      const afterInsertMock = mock.fn();
      hookedCollection.on("after.insert.success", afterInsertMock);
      const result = await hookedCollection.insertOne({ _id: "test" });
      assert.strictEqual(seenDocs.length, 4, "All four before.insert hooks should run");
      assert.deepEqual(seenDocs[0].doc, { _id: "test" }, "Hook A receives the original doc");
      assert.deepEqual(seenDocs[1].doc, { _id: "test", a: 1 }, "Hook B receives the doc returned by Hook A");
      assert.deepEqual(seenDocs[2].doc, { _id: "test", a: 1 }, "Hook C must not receive SkipDocument; it receives the previous chained value");
      assert.deepEqual(seenDocs[3].doc, { _id: "test", a: 1, c: 1 }, "Hook D receives the value returned by Hook C, even though Hook B returned SkipDocument");
      assert.deepEqual(seenDocs[2].isSkipped, true, "Hook C isSkipped");
      assert.deepEqual(seenDocs[3].isSkipped, true, "Hook D isSkipped");
      assert.strictEqual(mockInsertOne.mock.calls.length, 0, "The underlying insertOne must not be called when SkipDocument was returned");
      assert.strictEqual(afterInsertMock.mock.callCount(), 0, "after.insert.success must not run when the document was skipped");
      assert.deepEqual(result, { acknowledged: false, insertedId: null }, "The skip is respected even though a later hook returned a non-SkipDocument value");
    });

    it("after.* hooks should fire (success and error) when no before.* hooks are present", async () => {
      const { hookedCollection: hcOk } = getHookedCollection();
      const okAfterInsert = mock.fn();
      const okAfterInsertOne = mock.fn();
      hcOk.on("after.insert.success", okAfterInsert);
      hcOk.on("after.insertOne.success", okAfterInsertOne);
      hcOk.on("after.insert.error", () => assert.fail("after.insert.error must not fire on success"));
      hcOk.on("after.insertOne.error", () => assert.fail("after.insertOne.error must not fire on success"));
      await hcOk.insertOne({ _id: "ok" });
      assert.strictEqual(okAfterInsert.mock.callCount(), 1, "after.insert.success fires without before hooks");
      assert.strictEqual(okAfterInsertOne.mock.callCount(), 1, "after.insertOne.success fires without before hooks");

      const { hookedCollection: hcErr, fakeCollection: fcErr } = getHookedCollection();
      mock.method(fcErr, "insertOne", () => { throw new Error("BAD INSERT"); });
      const errAfterInsert = mock.fn();
      const errAfterInsertOne = mock.fn();
      hcErr.on("after.insert.error", errAfterInsert);
      hcErr.on("after.insertOne.error", errAfterInsertOne);
      hcErr.on("after.insert.success", () => assert.fail("after.insert.success must not fire on error"));
      hcErr.on("after.insertOne.success", () => assert.fail("after.insertOne.success must not fire on error"));
      await assert.rejects(() => hcErr.insertOne({ _id: "fail" }), /BAD INSERT/);
      assert.strictEqual(errAfterInsert.mock.callCount(), 1, "after.insert.error fires without before hooks");
      assert.strictEqual(errAfterInsertOne.mock.callCount(), 1, "after.insertOne.error fires without before hooks");
    });

    it("after.insert hooks fire correctly (success and error) when before.insert returns a totally new object", async () => {
      const { hookedCollection: hcOk, fakeCollection: fcOk } = getHookedCollection();
      const mockInsertOk = mock.method(fcOk, "insertOne");
      hcOk.on("before.insert", () => ({ _id: "transformed", brand: "new" }));
      const okAfterInsert = mock.fn();
      hcOk.on("after.insert.success", okAfterInsert);
      hcOk.on("after.insert.error", () => assert.fail("after.insert.error must not fire on success"));

      const result = await hcOk.insertOne({ _id: "original", legacy: true });
      assert.deepEqual(result, { acknowledged: true, insertedId: "transformed" }, "the inserted id reflects the new doc");
      assert.deepEqual(mockInsertOk.mock.calls[0].arguments[0], { _id: "transformed", brand: "new" }, "the underlying insertOne receives the totally-new doc");
      assert.strictEqual(okAfterInsert.mock.callCount(), 1);
      assert.deepEqual(okAfterInsert.mock.calls[0].arguments[0].doc, { _id: "transformed", brand: "new" }, "after.insert.success receives the new doc");
      assert.deepEqual(okAfterInsert.mock.calls[0].arguments[0].docOrig, { _id: "original", legacy: true }, "after.insert.success still has access to the original doc via docOrig");
      assert.deepEqual(okAfterInsert.mock.calls[0].arguments[0].result, { acknowledged: true, insertedId: "transformed" });

      const { hookedCollection: hcErr, fakeCollection: fcErr } = getHookedCollection();
      mock.method(fcErr, "insertOne", () => { throw new Error("BAD INSERT"); });
      hcErr.on("before.insert", () => ({ _id: "transformed", brand: "new" }));
      const errAfterInsert = mock.fn();
      hcErr.on("after.insert.error", errAfterInsert);
      hcErr.on("after.insert.success", () => assert.fail("after.insert.success must not fire on error"));
      await assert.rejects(() => hcErr.insertOne({ _id: "original", legacy: true }), /BAD INSERT/);
      assert.strictEqual(errAfterInsert.mock.callCount(), 1);
      assert.deepEqual(errAfterInsert.mock.calls[0].arguments[0].doc, { _id: "transformed", brand: "new" }, "after.insert.error receives the new doc");
      assert.deepEqual(errAfterInsert.mock.calls[0].arguments[0].docOrig, { _id: "original", legacy: true });
      assert.match(errAfterInsert.mock.calls[0].arguments[0].error.message, /BAD INSERT/);
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
