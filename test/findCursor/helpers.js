import assert from "node:assert";
import { it, mock } from "node:test";
import { setTimeout } from "node:timers/promises";

import { FakeFindCursor, getHookedCursor } from "./fakeFindCursor.js";

/**
 * @typedef {import("../src/hookedFindCursor.js").HookedFindCursor<TSchema>} HookedFindCursor<TSchema>
 * @template {any} TSchema
 */
/**
 * @typedef {import("mongodb").FindCursor<TSchema>} FindCursor<TSchema>
 * @template {any} TSchema
 */
/**
 * @callback HookTestCallback
 * @param {{
 *   hookedCursor: HookedFindCursor<any>,
 *   fakeCursor: FakeFindCursor
 * }} arg0
 */
/**
 *
 * @param {string} hookName
 * @param {HookTestCallback} fn
 */
export async function hookInParallel(hookName, fn) {
  let first = 0;
  let second = 0;
  const { hookedCursor, fakeCursor } = getHookedCursor(
    [1, 2, 3],
    {
      [hookName]: [
        async () => {
          first = performance.now();
          await setTimeout(100);
        },
        () => {
          second = performance.now();
        }
      ]
    }
  );
  await fn({ hookedCursor, fakeCursor });
  assert.ok(first !== 0, "The value was set");
  assert.ok(second - first < 100, `first call: ${first}, second call: ${second} should be less than 100ms`);
}

/**
 *
 * @param {string} hookName
 * @param {string} chainKey
 * @param {HookTestCallback} fn
 */
export async function hooksChain(hookName, chainKey, fn, hookResults = ["Hello", "Hello World"]) {
  let first = 0;
  let second = 0;
  let cachedValueOrig;
  const { hookedCursor, fakeCursor } = getHookedCursor(
    [1, 2, 3],
    {
      [hookName]: [
        async ({
          [chainKey]: value,
          [`${chainKey}Orig`]: valueOrig
        }) => {
          first = performance.now();
          cachedValueOrig = valueOrig;
          assert.deepEqual(valueOrig, value, "In the first hook, the value and orig value match");
          await setTimeout(100);
          return hookResults[0];
        },
        ({
          [chainKey]: value,
          [`${chainKey}Orig`]: valueOrig
        }) => {
          second = performance.now();
          assert.notDeepEqual(value, valueOrig);
          assert.deepEqual(cachedValueOrig, valueOrig, "In the second hook");
          return hookResults[1];
        }
      ]
    }
  );
  const result = await fn({ hookedCursor, fakeCursor });
  assert.ok(second - first >= 95, `first call: ${first}, second call: ${second} should be ~100ms`);
  return result;
}


export function declareSimpleTests(name, args, expected, data) {
  it("should work without hooks", async () => {
    const { hookedCursor } = getHookedCursor(data);
    assert.deepEqual(await hookedCursor[name](...args), expected);
  });

  it("should work with a before hook", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`before.find.cursor.${name}`]: [calledMock]
    });
    const actual = await hookedCursor[name](...args);
    assert.deepEqual(actual, expected, "should get the correct result");
    assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
  });

  it("should work with an after hook", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`after.find.cursor.${name}.success`]: [calledMock]
    });
    const actual = await hookedCursor[name](...args);
    assert.deepEqual(actual, expected, "should get the correct result");
    assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
  });

  it("should work with both before and after hooks", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`before.find.cursor.${name}`]: [calledMock],
      [`after.find.cursor.${name}.success`]: [calledMock]
    });
    const actual = await hookedCursor[name](...args);
    assert.deepEqual(actual, expected, "should get the correct result");
    assert.strictEqual(calledMock.mock.callCount(), 2, "should call the hook");
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
    const { hookedCursor, fakeCursor } = getHookedCursor(data, {
      [`before.find.cursor.${name}`]: [beforeMock],
      [`after.find.cursor.${name}.success`]: [afterMock]
    });
    mock.method(fakeCursor, name, async () => {
      callOrder.push("fn");
    });
    await hookedCursor[name](...args);
    assert.deepEqual(callOrder, ["before", "fn", "after"], `should call things in order ${callOrder}`);
  });

  it("should call the error hook on error and re-throw the error", async () => {
    const afterSuccessMock = mock.fn(async () => {});
    const afterErrorMock = mock.fn(async () => {});
    // @ts-expect-error
    const { hookedCursor, fakeCursor } = getHookedCursor(data, {
      [`after.find.cursor.${name}.success`]: [afterSuccessMock],
      [`after.find.cursor.${name}.error`]: [afterErrorMock]
    });
    mock.method(fakeCursor, name, async () => {
      throw new Error(name);
    });

    try {
      await hookedCursor[name](...args);
      assert.fail("Should have thrown an error");
    }
    catch (e) {
      assert.strictEqual(e.message, name, "threw the expected error");
    }
    assert.deepEqual(afterSuccessMock.mock.callCount(), 0, "should not call the after hook");
    assert.deepEqual(afterErrorMock.mock.callCount(), 1, "should call the error hook");
  });

  it("should NOT call the error hook if an after hook errors, but should throw it.", async () => {
    const afterSuccessMock = mock.fn(async () => {});
    const afterErrorMock = mock.fn(async () => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`after.find.cursor.${name}.success`]: [() => { throw new Error(name); }, afterSuccessMock],
      [`after.find.cursor.${name}.error`]: [afterErrorMock]
    });

    try {
      await hookedCursor[name](...args);
      assert.fail("Should have thrown an error");
    }
    catch (e) {
      assert.strictEqual(e.message, name, "threw the expected error");
    }
    assert.deepEqual(afterSuccessMock.mock.callCount(), 0, "should not call the second after hook");
    assert.deepEqual(afterErrorMock.mock.callCount(), 0, "should not call the error hook");
  });

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
    const { hookedCursor } = getHookedCursor(data, {
      [`before.find.cursor.${name}`]: [beforeMock],
      [`after.find.cursor.${name}.success`]: [afterMock]
    });
    await hookedCursor[name](...args);
    assert.ok(beforeSymbol !== undefined, "the before symbol was set");
    assert.strictEqual(beforeSymbol, afterSymbol, "The symbols should match");
  });

  it("should provide the same invocationSymbol before and error", async () => {
    let beforeSymbol;
    let afterSymbol;
    const beforeMock = mock.fn(async ({ invocationSymbol }) => {
      beforeSymbol = invocationSymbol;
    });
    const afterMock = mock.fn(async ({ invocationSymbol }) => {
      afterSymbol = invocationSymbol;
    });
    // @ts-expect-error
    const { hookedCursor, fakeCursor } = getHookedCursor(data, {
      [`before.find.cursor.${name}`]: [beforeMock],
      [`after.find.cursor.${name}.error`]: [afterMock]
    });
    mock.method(fakeCursor, name, async () => {
      throw new Error(name);
    });

    try {
      await hookedCursor[name](...args);
      assert.fail("Should have thrown an error");
    }
    catch (e) {

    }
    assert.ok(beforeSymbol !== undefined, "the before symbol was set");
    assert.strictEqual(beforeSymbol, afterSymbol, "The symbols should match");
  });

  if (name !== "count") {
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
      const { hookedCursor, fakeCursor } = getHookedCursor(data, {
        "before.find.cursor.execute": [beforeMock],
        "after.find.cursor.execute.success": [afterMock],
        [`before.find.cursor.${name}`]: [setupMock]
      });
      await hookedCursor[name](...args);
      assert.ok(beforeSymbol !== undefined, "the before symbol was set");
      assert.strictEqual(beforeNextSymbol, beforeSymbol, "The before symbols should match");
      assert.strictEqual(afterNextSymbol, beforeSymbol, "The after symbols should match");
      assert.strictEqual(beforeCaller, `find.cursor.${name}`, "The before caller should match");
      assert.strictEqual(afterCaller, `find.cursor.${name}`, "The after caller should match");
    });
  }
}
