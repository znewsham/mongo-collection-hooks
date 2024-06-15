import { CursorParams, CursorParamsWithArgs, CursorParamsWithArgsAndResult, CursorParamsWithResult } from "./cursorHelperTypes.js"
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js"
import { BeforeAfterCallbackArgsAndReturn, ExtractEventDefinitions } from "./helpersTypes.js"
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js"


export type BeforeAfterErrorAggregationOnlyCursorEventDefinitions<TSchema> = {
  "aggregation.cursor.execute": CursorParams<HookedAggregationCursorInterface<any>, {
    caller: "aggregate" | "aggregation.cursor.toArray" | "aggregation.cursor.forEach" | "aggregation.cursor.next" | "aggregation.cursor.asyncIterator"
  }>,
  "aggregation.cursor.next": CursorParamsWithResult<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    result: TSchema | null
  }>,
  "aggregation.cursor.toArray": CursorParamsWithResult<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    result: TSchema[]
  }>,
  "aggregation.cursor.forEach": CursorParamsWithArgs<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "aggregation.cursor.asyncIterator": CursorParams<HookedAggregationCursorInterface<any>, {
    caller: "aggregate",
    args: []
  }>,
  "aggregation.cursor.rewind": CursorParams<HookedAggregationCursorInterface<TSchema>, {
    caller: "find",
    isPromise: false,
  }>,
  "aggregation.cursor.close": CursorParams<HookedAggregationCursorInterface<TSchema>, {
    caller: "aggregate"
  }>
}

export type BeforeAfterErrorAggregateCursorEventDefinitions<TSchema> = BeforeAfterErrorAggregationOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorGenericCursorEventDefinitions<TSchema>;

type AggregationCursorBeforeEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "before", "before">
type AggregationCursorAfterSuccessEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "after", "success", "success">
type AggregationCursorAfterErrorEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "after", "error", "error">
type AggregationCursorAfterEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>, "after", "after">


type BeforeAfterErrorAggregationCursorEventDefinitions<TSchema> = AggregationCursorBeforeEventDefinitions<TSchema>
  & AggregationCursorAfterSuccessEventDefinitions<TSchema>
  & AggregationCursorAfterErrorEventDefinitions<TSchema>
  & AggregationCursorAfterEventDefinitions<TSchema>;


type AggregationCursorCallbackArgsAndReturn<TSchema> = BeforeAfterCallbackArgsAndReturn<BeforeAfterErrorAggregationCursorEventDefinitions<TSchema>>

export type AggregationCursorHookedEventMap<TSchema> = AggregationCursorCallbackArgsAndReturn<TSchema>;
