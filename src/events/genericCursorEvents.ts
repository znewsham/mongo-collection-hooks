import { CursorParams, CursorParamsWithArgs, CursorParamsWithCaller, CursorParamsWithResult } from "./cursorHelperTypes.js"
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js"
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js"

export type BeforeAfterErrorGenericCursorEventDefinitions<TSchema> = {
  "cursor.execute": CursorParamsWithCaller<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.next" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "aggregation.cursor.next" | "aggregation.cursor.toArray" | "aggregation.cursor.forEach" | "aggregation.cursor.asyncIterator",
    custom: {
      operation: "aggregation.cursor.execute" | "find.cursor.execute"
    },
  }>,
  "cursor.next": CursorParamsWithResult<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    result: TSchema | null,
    custom: {
      operation: "aggregation.cursor.next" | "find.cursor.next"
    },
  }>,
  "cursor.toArray": CursorParamsWithResult<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    result: TSchema[],
    custom: {
      operation: "aggregation.cursor.toArray" | "find.cursor.toArray"
    },
  }>,
  "cursor.forEach": CursorParamsWithArgs<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    result: never,
    args: [iterator: (doc: TSchema) => boolean | void],
    custom: {
      operation: "aggregation.cursor.forEach" | "find.cursor.forEach"
    },
  }>,
  "cursor.asyncIterator": CursorParams<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    result: never,
    custom: {
      operation: "aggregation.cursor.asyncIterator" | "find.cursor.asyncIterator"
    },
  }>,
  "cursor.rewind": CursorParams<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    custom: {
      operation: "aggregation.cursor.rewind" | "find.cursor.rewind"
    },
    isPromise: false,
  }>
  "cursor.close": CursorParams<HookedFindCursorInterface<TSchema> | HookedAggregationCursorInterface<TSchema>, {
    custom: {
      operation: "aggregation.cursor.close" | "find.cursor.close"
    },
    isPromise: false,
  }>
}
