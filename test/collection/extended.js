import { FakeCollection } from "mongo-collection-helpers/testHelpers"; // Keep for mocking underlying collection
import { HookedCollection } from "mongo-collection-hooks"; // Import the real HookedCollection
import assert from "node:assert"; // Import Node.js assert
import { mock, describe, it, beforeEach, afterEach } from "node:test"; // Import Node.js mock

// --- Extended Hooked Collection ---

class ExtendedCollection extends HookedCollection {
  // Constructor accepts a name, creates a FakeCollection, and passes it to super
  constructor(name) {
    const fakeDbCollection = new FakeCollection(name);
    // Pass the fake collection instance to the HookedCollection constructor
    super(fakeDbCollection);
  }

  // Define the custom method using the actual _tryCatchEmit from HookedCollection
  async customMethod(arg) {
    return this._tryCatchEmit(
      "customMethod", // The base name of the event
      { args: [arg], argsOrig: [arg] }, // Arguments for the 'before' hook and the operation
      "args", // Key in emitArgs to chain from 'before' to the operation
      async ({ beforeHooksResult: [chainedArg] }) => {
        // This is the core logic of the custom method
        console.log("Running customMethod with arg:", chainedArg);
        // Simulate async work (can interact with fakeDbCollection if needed)
        await new Promise(resolve => setTimeout(resolve, 5));
        // Return the result based on the (potentially modified) argument
        return `processed:${chainedArg}`;
      },
      undefined // options
    );
  }
}

// --- Tests ---
export function defineExtendedTests() {
  describe("ExtendedCollection (extending HookedCollection)", () => {
    let collection;

    beforeEach(() => {
      // Instantiate the new ExtendedCollection
      collection = new ExtendedCollection("test-extended");
      // Reset the underlying fake collection's state if necessary (optional)
      if (collection.collection && typeof collection.collection.reset === 'function') {
          collection.collection.reset();
      }
    });

    afterEach(() => {
      // Restore all mocks created with mock.method, mock.getter, etc.
      mock.restoreAll();
    });

    it("should execute customMethod without hooks", async () => {
      const result = await collection.customMethod("input");
      assert.strictEqual(result, "processed:input");
    });

    it("should allow before hook to modify arguments", async () => {
      const beforeFn = mock.fn(() => {
        return ["modified"]; // Modify the argument
      });
      collection.on("before.customMethod", beforeFn);

      const result = await collection.customMethod("original");

      assert.strictEqual(beforeFn.mock.calls.length, 1);
      // HookedCollection passes argsOrig correctly
      assert.deepStrictEqual(beforeFn.mock.calls[0].arguments[0].argsOrig, ["original"]);
      assert.strictEqual(result, "processed:modified");
    });

    it("should allow after hook to modify the result", async () => {
      const afterFn = mock.fn(({ result }) => {
        assert.strictEqual(result, "processed:input"); // Verify original result from operation
        return "final_result"; // Return a new result
      });
      // HookedCollection uses 'after.success.customMethod'
      collection.on("after.customMethod.success", afterFn);

      const result = await collection.customMethod("input");

      assert.strictEqual(afterFn.mock.calls.length, 1);
      assert.strictEqual(result, "final_result");
    });

    it("should pass original and potentially modified args to after hook", async () => {
      const beforeFn = mock.fn(() => {
        return ["modified_arg"];
      });
      collection.on("before.customMethod", beforeFn);

      const afterFn = mock.fn(({ args, argsOrig, result }) => {
        assert.deepStrictEqual(argsOrig, ["original_input"]);
        assert.deepStrictEqual(args, ["modified_arg"]);
        assert.strictEqual(result, "processed:modified_arg");
      });
      // HookedCollection uses 'after.success.customMethod'
      collection.on("after.customMethod.success", afterFn);

      await collection.customMethod("original_input");

      assert.strictEqual(afterFn.mock.calls.length, 1);
    });

    it("should emit error event if operation fails", async () => {
      const errorFn = mock.fn();
      // HookedCollection uses 'after.error.customMethod'
      collection.on("after.customMethod.error", errorFn);

      // Temporarily mock the internal operation within _tryCatchEmit to throw an error
      // This avoids modifying the prototype or instance directly
      const originalTryCatchEmit = collection._tryCatchEmit;
      mock.method(collection, "_tryCatchEmit", function(baseName, emitArgs, chainKey, operation, options) {
          // Call the original _tryCatchEmit but replace the operation logic
          return originalTryCatchEmit.call(this, baseName, emitArgs, chainKey, async () => {
              throw new Error("Operation failed"); // Force error
          }, options);
      });


      try {
        await collection.customMethod("input");
        // Should not reach here
        assert.fail("Operation should have thrown an error");
      } catch (err) {
        assert.strictEqual(err.message, "Operation failed");
        assert.strictEqual(errorFn.mock.calls.length, 1);
        const errorEventArgs = errorFn.mock.calls[0].arguments[0];
        assert(errorEventArgs.error instanceof Error);
        assert.strictEqual(errorEventArgs.error.message, "Operation failed");
        assert.deepStrictEqual(errorEventArgs.argsOrig, ["input"]);
      }
      // No finally block needed as mock.restoreAll() in afterEach handles cleanup
    });
  });
}
