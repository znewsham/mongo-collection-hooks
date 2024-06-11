import type { AggregationCursor } from "mongodb";

export interface HookedAggregationCursorInterface<TSchema> extends AggregationCursor<TSchema> {

}
