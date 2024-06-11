import { CursorParams, CursorParamsWithArgs, CursorParamsWithArgsAndResult, CursorParamsWithResult } from "./cursorHelperTypes.js"
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js"
import { BeforeAfterCallbackArgsAndReturn, ExtractEventDefinitions } from "./helpersTypes.js"
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js"


export type BeforeAfterErrorAggregationOnlyCursorEventDefinitions<TSchema> = {
  "aggregate.cursor.execute": CursorParams<HookedAggregationCursorInterface<any>, {
    caller: "aggregate" | "aggregate.cursor.toArray" | "aggregate.cursor.forEach"
  }>,
  "aggregate.cursor.next": CursorParamsWithResult<HookedAggregationCursorInterface<any>, {
    caller: "aggregate" | "aggregate.cursor.toArray" | "aggregate.cursor.forEach",
    result: TSchema | null
  }>,
  "aggregate.cursor.toArray": CursorParamsWithResult<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    result: TSchema[]
  }>,
  "aggregate.cursor.forEach": CursorParamsWithArgs<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "aggregate.cursor.asyncIterator": CursorParams<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    args: []
  }>,
}

type BeforeAfterErrorAggregateCursorEventDefinitions<TSchema> = BeforeAfterErrorAggregationOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorGenericCursorEventDefinitions<TSchema>;

type AggregationCursorBeforeEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "before", "before">
type AggregationCursorAfterEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "after", "after", "success">
type AggregationCursorErrorEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "after", "error", "error">


type BeforeAfterErrorAggregationCursorEventDefinitions<TSchema> = AggregationCursorBeforeEventDefinitions<TSchema>
  & AggregationCursorAfterEventDefinitions<TSchema>
  & AggregationCursorErrorEventDefinitions<TSchema>;


type AggregationCursorCallbackArgsAndReturn<TSchema> = BeforeAfterCallbackArgsAndReturn<BeforeAfterErrorAggregationCursorEventDefinitions<TSchema>>

export type AggregationCursorHookedEventMap<TSchema> = AggregationCursorCallbackArgsAndReturn<TSchema>;
