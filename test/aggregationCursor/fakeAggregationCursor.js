import { FakeFindCursor } from "../findCursor/fakeFindCursor.js";
import { HookedAggregationCursor } from "../../lib/hookedAggregationCursor.js";

export class FakeAggregationCursor extends FakeFindCursor {
  #pipeline;
  #options;
  constructor(data, pipeline, options) {
    super(data);
    this.#pipeline = pipeline;
    this.#options = options;
  }
}


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
