import { it, mock } from "node:test";
import assert from "node:assert";
import { setTimeout } from "timers/promises";

export function assertImplements(actual, expected, message = "", path = "") {
  if ((typeof actual) !== "object" || (typeof expected) !== "object") {
    return assert.deepEqual(actual, expected, path ? `${message} for path ${path}` : message);
  }
  if (!expected || !actual) {
    return assert.deepEqual(actual, expected, path ? `${message} for path ${path}` : message);
  }
  Object.entries(expected).forEach(([key, newExpected]) => {
    assertImplements(actual[key], newExpected, message, path ? `${path}.${key}` : key);
  });
}

/**
 *
 * @param {string} hookName
 * @param {string} chainKey
 * @param {HookTestCallback} fn
 */
export async function hooksChain(hookName, chainKey, fn, getHookedCursor, hookResults = ["Hello", "Hello World"]) {
  let first = 0;
  let second = 0;
  let cachedValueOrig;
  const { hookedCursor, fakeCursor } = getHookedCursor(
    [1, 2, 3],
    {
      [hookName]: [
        {
          listener: async ({
            [chainKey]: value,
            [`${chainKey}Orig`]: valueOrig
          }) => {
            first = performance.now();
            cachedValueOrig = valueOrig;
            assert.deepEqual(valueOrig, value, "In the first hook, the value and orig value match");
            await setTimeout(100);
            return hookResults[0];
          }
        },
        {
          listener: ({
            [chainKey]: value,
            [`${chainKey}Orig`]: valueOrig
          }) => {
            second = performance.now();
            assert.notDeepEqual(value, valueOrig);
            assert.deepEqual(cachedValueOrig, valueOrig, "In the second hook");
            return hookResults[1];
          }
        }
      ]
    }
  );
  const result = await fn({ hookedCursor, fakeCursor });
  assert.ok(second - first >= 95, `first call: ${first}, second call: ${second} should be ~100ms`);
  return result;
}

/**
 *
 * @param {string} hookName
 * @param {HookTestCallback} fn
 */
export async function hookInParallel(hookName, fn, getHookedCursor) {
  let first = 0;
  let second = 0;
  const { hookedCursor, fakeCursor } = getHookedCursor(
    [1, 2, 3],
    {
      [hookName]: [
        {
          listener: async () => {
            first = performance.now();
            await setTimeout(100);
          }
        },
        {
          listener: () => {
            second = performance.now();
          }
        }
      ]
    }
  );
  await fn({ hookedCursor, fakeCursor });
  assert.ok(first !== 0, "The value was set");
  assert.ok(second - first < 100, `first call: ${first}, second call: ${second} should be less than 100ms`);
}


export function declareSimpleTests(name, args, expected, data, getHookedCursor, cursorType) {
  it("should work without hooks", async () => {
    const { hookedCursor } = getHookedCursor(data);
    assert.deepEqual(await hookedCursor[name](...args), expected);
  });

  it("should work with a before hook", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`before.${cursorType}.cursor.${name}`]: [{ listener: calledMock }]
    });
    const actual = await hookedCursor[name](...args);
    assert.deepEqual(actual, expected, "should get the correct result");
    assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
  });

  it("should work with an after hook", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`after.${cursorType}.cursor.${name}.success`]: [{ listener: calledMock }]
    });
    const actual = await hookedCursor[name](...args);
    assert.deepEqual(actual, expected, "should get the correct result");
    assert.strictEqual(calledMock.mock.callCount(), 1, "should call the hook");
  });

  it("should work with both before and after hooks", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor } = getHookedCursor(data, {
      [`before.${cursorType}.cursor.${name}`]: [{ listener: calledMock }],
      [`after.${cursorType}.cursor.${name}.success`]: [{ listener: calledMock }]
    });
    const actual = await hookedCursor[name](...args);
    assert.deepEqual(actual, expected, "should get the correct result");
    assert.strictEqual(calledMock.mock.callCount(), 2, "should call the hook");
  });

  it("should work with both before and error hooks", async () => {
    const calledMock = mock.fn(() => {});
    // @ts-expect-error
    const { hookedCursor, fakeCursor } = getHookedCursor(data, {
      [`before.${cursorType}.cursor.${name}`]: [{ listener: calledMock }],
      [`after.${cursorType}.cursor.${name}.error`]: [{ listener: calledMock }]
    });
    mock.method(fakeCursor, name, () => {
      throw new Error();
    });
    try {
      await hookedCursor[name](...args);
      assert.fail("We should have thrown an error");
    }
    catch (e) {

    }
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
      [`before.${cursorType}.cursor.${name}`]: [{ listener: beforeMock }],
      [`after.${cursorType}.cursor.${name}.success`]: [{ listener: afterMock }]
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
      [`after.${cursorType}.cursor.${name}.success`]: [{ listener: afterSuccessMock }],
      [`after.${cursorType}.cursor.${name}.error`]: [{ listener: afterErrorMock }]
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
      [`after.${cursorType}.cursor.${name}.success`]: [{
        listener: () => {
          throw new Error(name);
        }
      }, { listener: afterSuccessMock }],
      [`after.${cursorType}.cursor.${name}.error`]: [{ listener: afterErrorMock }]
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
      [`before.${cursorType}.cursor.${name}`]: [{ listener: beforeMock }],
      [`after.${cursorType}.cursor.${name}`]: [{ listener: afterMock }]
    });
    await hookedCursor[name](...args);
    assert.ok(beforeSymbol !== undefined, "the before symbol was set");
    assert.strictEqual(beforeSymbol, afterSymbol, "The symbols should match");
  });

  it("should provide the same invocationSymbol before and after success", async () => {
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
      [`before.${cursorType}.cursor.${name}`]: [{ listener: beforeMock }],
      [`after.${cursorType}.cursor.${name}.success`]: [{ listener: afterMock }]
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
      [`before.${cursorType}.cursor.${name}`]: [{ listener: beforeMock }],
      [`after.${cursorType}.cursor.${name}.error`]: [{ listener: afterMock }]
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

  if (name !== "count" && name !== "close") {
    it("should record the correct caller for execute and provide the parentInvocationSymbol before and after", async () => {
      let beforeExecuteSymbol;
      let afterExecuteSymbol;
      let beforeSymbol = false;

      let beforeCaller;
      let afterCaller;
      const setupMock = mock.fn(async ({ invocationSymbol }) => {
        beforeSymbol = invocationSymbol;
      });
      const beforeMock = mock.fn(async ({ parentInvocationSymbol, caller }) => {
        beforeExecuteSymbol = parentInvocationSymbol;
        beforeCaller = caller;
      });
      const afterMock = mock.fn(async ({ parentInvocationSymbol, caller }) => {
        afterExecuteSymbol = parentInvocationSymbol;
        afterCaller = caller;
      });
      // @ts-expect-error
      const { hookedCursor, fakeCursor } = getHookedCursor(data, {
        [`before.${cursorType}.cursor.execute`]: [{ listener: beforeMock }],
        [`after.${cursorType}.cursor.execute.success`]: [{ listener: afterMock }],
        [`before.${cursorType}.cursor.${name}`]: [{ listener: setupMock }]
      });
      await hookedCursor[name](...args);
      assert.ok(beforeSymbol !== undefined, "the before symbol was set");
      assert.strictEqual(beforeExecuteSymbol, beforeSymbol, "The before symbols should match");
      assert.strictEqual(afterExecuteSymbol, beforeSymbol, "The after symbols should match");
      assert.strictEqual(beforeCaller, `${cursorType}.cursor.${name}`, "The before execute caller should match");
      assert.strictEqual(afterCaller, `${cursorType}.cursor.${name}`, "The after execute caller should match");
    });
  }
}
