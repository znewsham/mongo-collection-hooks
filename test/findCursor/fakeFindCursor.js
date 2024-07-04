import { HookedFindCursor } from "../../lib/hookedFindCursor.js";
import { FakeFindCursor } from "mongo-collection-helpers/testHelpers";

/**
 * @typedef {import("../../src/events.js").EventNames} EventNames
 * @typedef {import("mongodb").FindCursor} FindCursor
 */

/**
 *
 * @param {any[]} data
 * @param {Record<K, HookedListenerCallback<K, any, any>[]>} events
 * @template {EventNames} K
 */
export function getHookedCursor(
  data = [],
  events = {}
) {
  const fakeCursor = new FakeFindCursor(data, {});
  const hookedCursor = new HookedFindCursor({}, fakeCursor, { invocationSymbol: Symbol("findCall"), events, interceptExecute: true });
  return { hookedCursor, fakeCursor };
}
