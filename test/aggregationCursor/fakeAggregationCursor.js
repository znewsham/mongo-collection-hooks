import { HookedAggregationCursor } from "../../lib/hookedAggregationCursor.js";
import { FakeAggregationCursor } from "mongo-collection-helpers/testHelpers";


/**
 * @typedef {import("../../src/events.js").EventNames} EventNames
 * @typedef {import("mongodb").FakeAggregationCursor} FakeAggregationCursor
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
  /** @type FindCursor */
  const fakeCursor = new FakeAggregationCursor(data, [], {});
  const hookedCursor = new HookedAggregationCursor(fakeCursor, { invocationSymbol: Symbol("aggregationCall"), events, interceptExecute: true });
  return { hookedCursor, fakeCursor };
}
