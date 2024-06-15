import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCursor } from "./fakeFindCursor.js";


async function gatherFromIterator(cursor) {
  const results = [];
  for await (const item of cursor) {
    results.push(item);
  }
  return results;
}

export function defineAsyncIteratorTests() {
  describe("asyncIterator", () => {
    it("should work with no hooks", async () => {
      const { hookedCursor } = getHookedCursor([1, 2, 3]);
      assert.deepEqual(await gatherFromIterator(hookedCursor), [1, 2, 3]);
    });
    it("should work with before hooks", async () => {
      const calledMock = mock.fn(() => {});
      const { hookedCursor } = getHookedCursor(
        [1, 2, 3],
        {
          "before.find.cursor.asyncIterator": [{ listener: calledMock }]
        }
      );
      assert.deepEqual(await gatherFromIterator(hookedCursor), [1, 2, 3]);
      assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
    });
    it("should work with after hooks", async () => {
      const calledMock = mock.fn(() => {});
      const { hookedCursor } = getHookedCursor(
        [1, 2, 3],
        {
          "after.find.cursor.asyncIterator.success": [{ listener: calledMock }]
        }
      );
      assert.deepEqual(await gatherFromIterator(hookedCursor), [1, 2, 3]);
      assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
    });
    it("should work with after hooks when we don't consume all", async () => {
      const calledMock = mock.fn(() => {});
      const results = [];
      const { hookedCursor } = getHookedCursor(
        [1, 2, 3],
        {
          "after.find.cursor.asyncIterator.success": [{ listener: calledMock }]
        }
      );
      for await (const result of hookedCursor) {
        results.push(result);
        break;
      }
      assert.deepEqual(results, [1]);
      assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
    });
    it("should work with error hooks", async () => {
      const calledMock = mock.fn(() => {});
      const { hookedCursor, fakeCursor } = getHookedCursor(
        [1, 2, 3],
        {
          "after.find.cursor.asyncIterator.error": [{ listener: calledMock }]
        }
      );
      mock.method(fakeCursor, Symbol.asyncIterator, () => { throw new Error("test"); });
      try {
        await gatherFromIterator(hookedCursor);
        assert.fail("Should have thrown");
      }
      catch (e) {

      }
      assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
    });


    it("should call everything in order", async () => {
      const callOrder = [];
      const beforeMock = mock.fn(async () => {
        callOrder.push("before");
      });
      const afterMock = mock.fn(async () => {
        callOrder.push("after");
      });
      // @ts-expect-error
      const { hookedCursor, fakeCursor } = getHookedCursor([1, 2, 3], {
        "before.find.cursor.asyncIterator": [{ listener: beforeMock }],
        "after.find.cursor.asyncIterator.success": [{ listener: afterMock }]
      });
      mock.method(fakeCursor, Symbol.asyncIterator, async function *iterator() {
        callOrder.push("fn");
      });
      await gatherFromIterator(hookedCursor);
      assert.deepEqual(callOrder, ["before", "fn", "after"], "should call things in order");
    });

    // it would appear to be impossible to make an async iterator throw :shrug:
    // it("should call the error hook on error and re-throw the error", async () => {
    //   const afterSuccessMock = mock.fn(async () => {});
    //   const afterErrorMock = mock.fn(async () => {});
    //   // @ts-expect-error
    //   const { hookedCursor, fakeCursor } = getHookedCursor([1, 2, 3], {
    //     "after.find.cursor.asyncIterator.success": [afterSuccessMock],
    //     "after.find.cursor.asyncIterator.error": [afterErrorMock]
    //   });
    //   mock.method(fakeCursor, Symbol.asyncIterator, function () {
    //     const x = {
    //       async next() {
    //         return { done: false, value: true }
    //       },
    //       throw(...args) {
    //         console.log("throw", ...args);
    //       },
    //       [Symbol.asyncIterator]() { return this; }
    //     };
    //     return x;
    //   });

    //   try {
    //     await gatherFromIterator(hookedCursor);
    //     assert.fail("Should have thrown an error");
    //   }
    //   catch (e) {
    //     assert.strictEqual(e.message, "async", "threw the expected error");
    //   }
    //   assert.deepEqual(afterSuccessMock.mock.callCount(), 0, "should not call the after hook");
    //   assert.deepEqual(afterErrorMock.mock.callCount(), 1, "should call the error hook");
    // });

    it("should provide the same invocationSymbol before and after", async () => {
      let beforeSymbol;
      let afterSymbol;
      const beforeMock = mock.fn(async ({ invocationSymbol }) => {
        beforeSymbol = invocationSymbol;
      });
      const afterMock = mock.fn(async ({ invocationSymbol }) => {
        afterSymbol = invocationSymbol;
      });
      // @ts-expect-error
      const { hookedCursor } = getHookedCursor([1, 2, 3], {
        "before.find.cursor.asyncIterator": [{ listener: beforeMock }],
        "after.find.cursor.asyncIterator.success": [{ listener: afterMock }]
      });
      await gatherFromIterator(hookedCursor);
      assert.ok(beforeSymbol !== undefined, "the before symbol was set");
      assert.strictEqual(beforeSymbol, afterSymbol, "The symbols should match");
    });

    it("should record the correct caller for execute and provide the parentInvocationSymbol before and after", async () => {
      let beforeNextSymbol;
      let afterNextSymbol;
      let beforeSymbol = false;

      let beforeCaller;
      let afterCaller;
      const setupMock = mock.fn(async ({ invocationSymbol }) => {
        beforeSymbol = invocationSymbol;
      });
      const beforeMock = mock.fn(async ({ parentInvocationSymbol, caller }) => {
        beforeNextSymbol = parentInvocationSymbol;
        beforeCaller = caller;
      });
      const afterMock = mock.fn(async ({ parentInvocationSymbol, caller }) => {
        afterNextSymbol = parentInvocationSymbol;
        afterCaller = caller;
      });
      // @ts-expect-error
      const { hookedCursor, fakeCursor } = getHookedCursor([1, 2, 3], {
        "before.find.cursor.execute": [{ listener: beforeMock }],
        "after.find.cursor.execute.success": [{ listener: afterMock }],
        "before.find.cursor.asyncIterator": [{ listener: setupMock }]
      });
      await gatherFromIterator(hookedCursor);
      assert.ok(beforeSymbol !== undefined, "the before symbol was set");
      assert.strictEqual(beforeNextSymbol, beforeSymbol, "The before symbols should match");
      assert.strictEqual(afterNextSymbol, beforeSymbol, "The after symbols should match");
      assert.strictEqual(beforeCaller, "find.cursor.asyncIterator", "The before caller should match");
      assert.strictEqual(afterCaller, "find.cursor.asyncIterator", "The after caller should match");
    });
  });
}
