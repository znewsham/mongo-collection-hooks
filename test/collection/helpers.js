import { setTimeout } from "node:timers/promises";
import assert from "node:assert";
import { HookedCollection } from "../../lib/hookedCollection.js";
import { FakeCollection } from "./fakeCollection.js";

/**
 * @typedef {import("../../src/events.js").EventNames} EventNames
 */

export function getHookedCollection(data = []) {
  const fakeCollection = new FakeCollection(data);
  const hookedCollection = new HookedCollection(fakeCollection);
  return {
    fakeCollection,
    hookedCollection
  };
}
/**
 * @callback HookTestCallback
 * @param {{
 *   hookedCollection: HookedCollection<any>,
 *   fakeCollection: FakeCollection
 * }} arg0
 */

/**
 *
 * @param {EventNames} hookName
 * @param {HookTestCallback} fn
 */
export async function hookInParallel(hookName, fn) {
  let first = 0;
  let second = 0;
  const { fakeCollection, hookedCollection } = getHookedCollection([]);

  hookedCollection.on(hookName, async () => {
    first = performance.now();
    await setTimeout(100);
  });
  hookedCollection.on(hookName, () => {
    second = performance.now();
  });
  await fn({ hookedCollection, fakeCollection });
  assert.ok(first !== 0, "The value was set");
  assert.ok(second - first < 100, `first call: ${first}, second call: ${second} should be less than 100ms`);
}

/**
 *
 * @param {EventNames} hookName
 * @param {string} chainKey
 * @param {HookTestCallback} fn
 */
export async function hooksChain(hookName, chainKey, fn, hookResults = ["Hello", "Hello World"]) {
  let first = 0;
  let second = 0;
  let cachedValueOrig;
  const { fakeCollection, hookedCollection } = getHookedCollection([{ _id: "test", value: 1 }, { _id: "test2", value: 2 }, { _id: "test3", value: 3 }]);
  hookedCollection.on(hookName, async ({
    [chainKey]: value,
    [`${chainKey}Orig`]: valueOrig
  }) => {
    first = performance.now();
    cachedValueOrig = valueOrig;
    assert.deepEqual(valueOrig, value, "In the first hook, the value and orig value match");
    await setTimeout(100);
    return hookResults[0];
  });
  hookedCollection.on(hookName, async ({
    [chainKey]: value,
    [`${chainKey}Orig`]: valueOrig
  }) => {
    second = performance.now();
    assert.notDeepEqual(value, valueOrig);
    assert.deepEqual(cachedValueOrig, valueOrig, "In the second hook");
    return hookResults[1];
  });
  const result = await fn({ hookedCollection, fakeCollection });
  assert.ok(second - first >= 95, `first call: ${first}, second call: ${second} should be ~100ms`);
  return result;
}
