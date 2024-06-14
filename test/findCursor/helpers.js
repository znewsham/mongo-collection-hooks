import { getHookedCursor } from "./fakeFindCursor.js";
import {
  hookInParallel as baseHookInParallel,
  hooksChain as baseHooksChain,
  declareSimpleTests as baseDeclareSimpleTests
} from "../helpers.js";

export { getHookedCursor };
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
  return baseHookInParallel(hookName, fn, getHookedCursor);
}

/**
 *
 * @param {string} hookName
 * @param {string} chainKey
 * @param {HookTestCallback} fn
 */
export async function hooksChain(hookName, chainKey, fn, hookResults = ["Hello", "Hello World"]) {
  return baseHooksChain(hookName, chainKey, fn, getHookedCursor, hookResults);
}


export function declareSimpleTests(name, args, expected, data) {
  return baseDeclareSimpleTests(name, args, expected, data, getHookedCursor, "find");
}
