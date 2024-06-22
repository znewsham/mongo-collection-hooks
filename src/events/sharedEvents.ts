import type { Document } from "mongodb";
import { AfterStar, AfterStarCaller, BeforeAfterCallbackArgsAndReturn, BeforeStar, BeforeStarCaller, ExtractEventDefinitions, NoReturns } from "./helpersTypes.js"
import { ErrorT, ResultOrError, Result } from "./commentedTypes.js"
import { HookedCollectionInterface } from "./hookedCollectionInterface.js";
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js";
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js";
import { BeforeAfterErrorCollectionEventDefinitions } from "./collectionEvents.js";
import { BeforeAfterErrorFindOnlyCursorEventDefinitions } from "./findCursorEvents.js";
import { BeforeAfterErrorAggregationOnlyCursorEventDefinitions } from "./aggregationCursorEvents.js";

export type BeforeAfterErrorSharedEventDefinitions<TSchema extends Document> = {
  "*": {
    before: NoReturns & BeforeStarCaller<AllCommon<TSchema>>,
    success: NoReturns & AfterStarCaller<AllCommon<TSchema>, Result<AllCommon<TSchema>>>,
    after: NoReturns & AfterStarCaller<AllCommon<TSchema>, ResultOrError<AllCommon<TSchema>>>,
    error: NoReturns & AfterStarCaller<AllCommon<TSchema>, ErrorT>,
    caller: AllCommon<TSchema>["caller"]
  }
}
type SharedBeforeEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorSharedEventDefinitions<TSchema>, "before", "before">
type SharedAfterSuccessEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorSharedEventDefinitions<TSchema>, "after", "success", "success">
type SharedAfterErrorEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorSharedEventDefinitions<TSchema>, "after", "error", "error">
type SharedAfterEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorSharedEventDefinitions<TSchema>, "after", "after">

export type AllSharedEventDefinitions<TSchema extends Document> = SharedBeforeEventDefinitions<TSchema>
  & SharedAfterErrorEventDefinitions<TSchema>
  & SharedAfterSuccessEventDefinitions<TSchema>
  & SharedAfterEventDefinitions<TSchema>

type AllCommon<TSchema extends Document> = {
  args: readonly any[],
  thisArg: HookedCollectionInterface<TSchema> | HookedAggregationCursorInterface<any> | HookedFindCursorInterface<any>,
  isPromise: true,
  caller: string,
  result?: any,
  custom: {
    operation: keyof BeforeAfterErrorCollectionEventDefinitions<any> | keyof BeforeAfterErrorAggregationOnlyCursorEventDefinitions<any> | keyof BeforeAfterErrorFindOnlyCursorEventDefinitions<any>
  }
};

export type SharedCallbackArgsAndReturn<TSchema extends Document> = BeforeAfterCallbackArgsAndReturn<AllSharedEventDefinitions<TSchema>>
