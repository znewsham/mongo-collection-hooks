import { FakeCollection } from "mongo-collection-helpers/testHelpers";
import assert from "node:assert";
import { mock, describe, it, beforeEach, afterEach } from "node:test";
import {
  HookedCollection,
  ExtendableHookedFindCursor
} from "mongo-collection-hooks";

// --- Define Extended Hooked Find Cursor Locally ---

class ExtendedHookedFindCursor extends ExtendableHookedFindCursor {

  constructor(
    filter,
    findCursor,
    options
  ) {
    super(filter, findCursor, { events: {}, ...options });
  }

  async _customCursorMethod(chainedArg) {
    // Core logic
    await new Promise(resolve => setTimeout(resolve, 5)); // Simulate async work
    return chainedArg > 10;
  }

  async customCursorMethod(arg, options) {
    return this._tryCatchEmit(
      "customCursorMethod",
      { args: [arg] },
      "args",
      true, // Chain result from after hook
      async ({ beforeHooksResult: [chainedArg] }) => {
        return this._customCursorMethod(chainedArg, options);
      },
      options
    );
  }
}

// --- Define Extended Hooked Collection Locally ---

class ExtendedHookedCollection extends HookedCollection {
  constructor(collection) {
    super(collection, { findCursorImpl: ExtendedHookedFindCursor });
  }
}
export function defineExtendedTests() {
  describe("ExtendedHookedFindCursor (defined locally)", () => {
    let collection;
    let unhookedCursor;
    let fakeDbCollection;

    beforeEach(() => {
      fakeDbCollection = new FakeCollection("test-extended-cursor");
      collection = new ExtendedHookedCollection(fakeDbCollection);
      unhookedCursor = collection.find();
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it("should execute customCursorMethod without hooks", async () => {
      let result = await unhookedCursor.customCursorMethod(15);
      assert.strictEqual(result, true, "Should return true for input > 10");

      result = await unhookedCursor.customCursorMethod(5);
      assert.strictEqual(result, false, "Should return false for input <= 10");
    });

    it("should allow before hook to modify arguments", async () => {
      const beforeFn = mock.fn(({ argsOrig }) => {
        assert.deepStrictEqual(argsOrig, [5], "Hook should receive original args");
        return [20];
      });
      collection.on("before.customCursorMethod", beforeFn);

      const cursor = collection.find();

      const result = await cursor.customCursorMethod(5);

      assert.strictEqual(beforeFn.mock.calls.length, 1);
      assert.strictEqual(result, true, "Result should be true due to modified argument");
    });

    it("should allow after hook to modify the result", async () => {
      const afterFn = mock.fn(({ result, thisArg }) => {
        assert.strictEqual(result, true, "Hook should receive original result (true for 15)");
        return false;
      });
      collection.on("after.customCursorMethod.success", afterFn);

      const cursor = collection.find();
      const result = await cursor.customCursorMethod(15);

      assert.strictEqual(afterFn.mock.calls.length, 1);
      assert.strictEqual(result, false, "Final result should be the one returned by the after hook");
    });

    it("should pass original and potentially modified args to after hook", async () => {
      const beforeFn = mock.fn(() => {
        return [30];
      });
      collection.on("before.customCursorMethod", beforeFn);

      const afterFn = mock.fn(({ args, argsOrig, result }) => {
        assert.deepStrictEqual(argsOrig, [10], "after hook argsOrig should be original input");
        assert.deepStrictEqual(args, [30], "after hook args should be the modified input");
        assert.strictEqual(result, true, "after hook result should be from core logic with modified arg");
      });
      collection.on("after.customCursorMethod.success", afterFn);

      const cursor = collection.find();

      await cursor.customCursorMethod(10);

      assert.strictEqual(beforeFn.mock.calls.length, 1);
      assert.strictEqual(afterFn.mock.calls.length, 1);
    });

    it("should emit error event if operation fails", async () => {
      const errorFn = mock.fn(({ error, argsOrig }) => {
        assert(error instanceof Error, "Error object should be passed");
        assert.strictEqual(error.message, "Cursor operation failed");
        assert.deepStrictEqual(argsOrig, [7], "Error hook should receive original args");
      });
      collection.on("after.customCursorMethod.error", errorFn);

      const cursor = collection.find();

      mock.method(cursor, "_customCursorMethod", function() {
        throw new Error("Cursor operation failed");
      });

      try {
        await cursor.customCursorMethod(7);
        assert.fail("Operation should have thrown an error");
      } catch (err) {
        assert.strictEqual(err.message, "Cursor operation failed");
        assert.strictEqual(errorFn.mock.calls.length, 1);
      }
    });
  });
}
