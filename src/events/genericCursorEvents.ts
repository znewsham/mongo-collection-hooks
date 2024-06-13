import { CursorParams, CursorParamsWithArgs, CursorParamsWithResult } from "./cursorHelperTypes.js"
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js"
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js"

export type BeforeAfterErrorGenericCursorEventDefinitions<TSchema> = {
  "cursor.execute": CursorParams<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.next" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "aggregation.cursor.next" | "aggregation.cursor.toArray" | "aggregation.cursor.forEach" | "aggregation.cursor.asyncIterator",
  }>
  "cursor.next": CursorParamsWithResult<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    caller: "find" | "aggregate",
    result: TSchema | null
  }>,
  "cursor.toArray": CursorParamsWithResult<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    caller: "find" | "aggregate",
    result: TSchema[]
  }>,
  "cursor.forEach": CursorParamsWithArgs<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    caller: "find" | "aggregate",
    result: never,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "cursor.asyncIterator": CursorParams<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    caller: "find" | "aggregate",
    result: never,
  }>,
}
