import { BulkWriteError, SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { deleteTests } from "./delete.js";
import { assertImplements } from "../helpers.js";
import { MongoBulkWriteError } from "mongodb";


export function defineDeleteMany() {
  describe("deleteMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.deleteMany", "args", ({ hookedCollection }) => hookedCollection.deleteMany({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, deletedCount: 1 }, "It deleted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.deleteMany.success", "result", ({ hookedCollection }) => hookedCollection.deleteMany({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should provide the correct args to the hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockBefore = mock.fn();
      const mockAfter = mock.fn();
      hookedCollection.on("before.deleteMany", mockBefore);
      hookedCollection.on("after.deleteMany.success", mockAfter);
      await hookedCollection.deleteMany({});
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
          result: { acknowledged: true, deletedCount: 2 },
          resultOrig: { acknowledged: true, deletedCount: 2 },
          thisArg: hookedCollection
        }],
        "after hook is correct"
      );
    });

    it("should provide the correct args (with id) to the hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockBefore = mock.fn();
      const mockAfter = mock.fn();
      hookedCollection.on("before.deleteMany", mockBefore, { includeIds: true });
      hookedCollection.on("after.deleteMany.success", mockAfter, { includeIds: true });
      await hookedCollection.deleteMany({});
      assertImplements(
        mockBefore.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          _ids: ["test", "test2"],
          thisArg: hookedCollection
        }],
        "before hook is correct"
      );

      assertImplements(
        mockAfter.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          _ids: ["test", "test2"],
          result: { acknowledged: true, deletedCount: 2 },
          resultOrig: { acknowledged: true, deletedCount: 2 },
          thisArg: hookedCollection
        }],
        "after hook is correct"
      );
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.deleteMany.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "deleteMany", () => { throw new Error("BAD CALL"); });
          return hookedCollection.deleteMany({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("if one delete hook throws an error, we should throw a MongoBulkWriteError", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {
        if (first) {
          first = false;
          return;
        }
        throw new Error("Bad Error");
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({});
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 1;
        },
        "It rejected correctly"
      );
    });

    it("if first delete throws an error, we should throw a MongoBulkWriteError", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {

      });

      const deleteMock = mock.method(fakeCollection, "deleteOne", () => {
        if (first) {
          first = false;
          throw new Error("bad error");
        }
        return {
          ok: 1,
          deletedCount: 1
        };
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({});
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 0;
        },
        "It rejected correctly"
      );

      assert.strictEqual(deleteMock.mock.callCount(), 1, "Should have called delete once");
    });

    it("if second delete throws an error, we should throw a MongoBulkWriteError", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {

      });

      const deleteMock = mock.method(fakeCollection, "deleteOne", () => {
        if (first) {
          first = false;
          return {
            ok: 1,
            deletedCount: 1
          };
        }
        throw new Error("bad error");
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({});
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 1;
        },
        "It rejected correctly"
      );

      assert.strictEqual(deleteMock.mock.callCount(), 2, "Should have called delete twice");
    });

    it("when ordered=false if one delete throws an error, we should throw a MongoBulkWriteError but continue.", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {

      });

      const deleteMock = mock.method(fakeCollection, "deleteOne", () => {
        if (first) {
          first = false;
          throw new Error("bad error");
        }
        return {
          ok: 1,
          deletedCount: 1
        };
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({}, { ordered: false });
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 1;
        },
        "It rejected correctly"
      );

      assert.strictEqual(deleteMock.mock.callCount(), 2, "Should have called delete twice");
    });

    deleteTests("deleteMany");
  });
}
