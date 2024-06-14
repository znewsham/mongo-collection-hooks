import type {
  Document,
  BulkWriteOptions,
  DeleteOptions,
  Filter,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  DeleteResult,
  UpdateResult,
  WithId,
  DistinctOptions,
  InferIdType,
  FindOptions,
  AggregateOptions,
  WithoutId,
  ReplaceOptions
} from "mongodb"

import { AfterInternalEmitArgs, AfterInternalErrorEmitArgs, BeforeAfterCallbackArgsAndReturn, BeforeInternalEmitArgs, BeforeInternalEmitArgsNoArgsOrig, CommonDefinition, ExtractEventDefinitions, NestedProjectionOfTSchema, NoReturns, ReturnsArgs, ReturnsNamedEmitArg, ReturnsResult, SkipDocument } from "./helpersTypes.js"
import { ChainedCallbackEventMap, StandardDefineHookOptions, StandardInvokeHookOptions } from "../awaiatableEventEmitter.js";
import { Args, ArgsOrig, ErrorT, InvocationSymbol, Result, ThisArg } from "../commentedTypes.js";
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js";
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js";
import { HookedCollectionInterface } from "./hookedCollectionInterface.js";
import { BeforeAfterErrorFindOnlyCursorEventDefinitions, FindCursorHookedEventMap } from "./findCursorEvents.js";
import { AggregationCursorHookedEventMap, BeforeAfterErrorAggregationOnlyCursorEventDefinitions } from "./aggregationCursorEvents.js";
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js";

type WithDocumentDefineHookOptions<TSchema extends Document> = {
  /** The projection used when you call `.fullDocument()` it will be combined with the `projection` of every other hook being ran */
  projection?: NestedProjectionOfTSchema<TSchema>
}

type AllowGreedyDefineHookOptions = {
  /** Whether to fetch the entire document as part of the initial cursor (vs using the cursor just for _id and loading the document lazily). Set this to true if you always need every document. */
  greedyFetch?: boolean
}

type WithPreviousDocumentDefineHookOptions<TSchema extends Document> = {
  /** fetch the document before updating */
  fetchPrevious?: boolean,

  /** The projection used to populate the previousDoc it will be combined with the `fetchPreviousProjection` of every other hook being ran */
  fetchPreviousProjection?: NestedProjectionOfTSchema<TSchema>
}

export type CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema extends Document> = BeforeAfterErrorCollectionEventDefinitions<TSchema>;

export type CollectionBeforeAfterErrorEventDefinitions<TSchema extends Document> = CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema>
  & BeforeAfterErrorFindOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorAggregationOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorGenericCursorEventDefinitions<TSchema>;

type UpdateDeleteDefineHookOptions<TSchema extends Document, K extends "update" | "delete"> = {
  /** A function to indicate whether the hook should run or not. Mostly useful for before update hooks, or after update using fetchPrevious. These hooks will run *before* we fetch the document. */
  shouldRun?(...args: CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema>[K]["before"]["emitArgs"]["args"]): Promise<boolean>
};

type BeforeUpdateDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & UpdateDeleteDefineHookOptions<TSchema, "update">
  & WithDocumentDefineHookOptions<TSchema>

type AfterUpdateDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & UpdateDeleteDefineHookOptions<TSchema, "update">
  & WithDocumentDefineHookOptions<TSchema>
  & WithPreviousDocumentDefineHookOptions<TSchema>

type BeforeDeleteDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & UpdateDeleteDefineHookOptions<TSchema, "delete">
  & WithDocumentDefineHookOptions<TSchema>

type AfterDeleteDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & UpdateDeleteDefineHookOptions<TSchema, "delete">
  & WithPreviousDocumentDefineHookOptions<TSchema>

type AfterInsertOptions<TSchema extends Document> = StandardDefineHookOptions
  & WithDocumentDefineHookOptions<TSchema>

type BeforeTopLevelEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & InvocationSymbol
    & O["custom"]
}

type AfterTopLevelEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & InvocationSymbol
};

type AfterTopLevelErrorEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & InvocationSymbol
    & ErrorT
};

type InsertCommon<TSchema extends Document> = {
  caller: "insertOne" | "insertMany" | "updateOne" | "updateMany" | "replaceOne",
  args: InsertManyCallArgs<TSchema> | InsertOneCallArgs<TSchema> | UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>,
  beforeHookReturns: OptionalUnlessRequiredId<TSchema> | typeof SkipDocument
  thisArg: HookedCollectionInterface<TSchema>,
  result: InsertOneResult<TSchema> | UpdateResult | Document,
  custom: {
    /** The document to be inserted */
    doc: OptionalUnlessRequiredId<TSchema>
  },
  isPromise: true
}

type DeleteCommon<TSchema extends Document> = {
  caller: "deleteOne" | "deleteMany",
  args: DeleteCallArgs<TSchema>,
  thisArg: HookedCollectionInterface<TSchema>,
  result: DeleteResult,
  beforeHookReturns: Filter<TSchema> | typeof SkipDocument,
  custom: {
    /** The ID of the document to be deleted */
    _id: InferIdType<TSchema>,
    /** The filter used to identify the document. Originally this will the main filter, but you can return a mutated version per document. It will be combined with the document ID for the final deletion */
    filter: Filter<TSchema>
  },
  isPromise: true
}


type FullDocument = {
  /** Returns a document the projection of which is the union of all hooks' projections. This function will result in at most one database operation per document, regardless of how many times it's called across all hooks. */
  getDocument(): Promise<Document | null>,
}

type PreviousDocument = {
  /** A copy of the document from before the update was made */
  previousDocument: Document
}

type UpdateCommon<TSchema extends Document> = {
  caller: "updateOne" | "updateMany" | "replaceOne",
  args: UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>,
  thisArg: HookedCollectionInterface<TSchema>,
  result: UpdateResult | Document,
  beforeHookReturns: UpdateCommon<TSchema>["custom"]["filterMutator"] | typeof SkipDocument,
  custom: {
    /** The ID of the document being updated */
    _id: InferIdType<TSchema>,
    filterMutator: {
      /** The filter used to identify the document. Originally this will the main filter, but you can return a mutated version per document. It will be combined with the document ID for the final update */
      filter: Filter<TSchema>,
      /** The per document mutator. Originally this will the main mutator, but you can return a mutated version per document - mutex with replacement */
      mutator?: UpdateFilter<TSchema> | Partial<TSchema>,
      /** In the case of replaceOne calls, this will be the provided replacement - mutex with mutator */
      replacement?: WithoutId<TSchema>
    }
  } & FullDocument,
  isPromise: true,
}

export type CollectionBeforeEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "before", "before">
export type CollectionAfterEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "after", "after", "success">
export type CollectionErrorEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "after", "error", "error">

export type AllCollectionEventDefinitions<TSchema extends Document> = CollectionBeforeEventDefinitions<TSchema> & CollectionAfterEventDefinitions<TSchema> & CollectionErrorEventDefinitions<TSchema>


type CollectionBeforeCallbackArgsAndReturn<TSchema extends Document> = BeforeAfterCallbackArgsAndReturn<CollectionBeforeEventDefinitions<TSchema>>
type CollectionAfterCallbackArgsAndReturn<TSchema extends Document> = BeforeAfterCallbackArgsAndReturn<CollectionAfterEventDefinitions<TSchema>>
type CollectionErrorCallbackArgsAndReturn<TSchema extends Document> = BeforeAfterCallbackArgsAndReturn<CollectionErrorEventDefinitions<TSchema>>

/**
 * @external
 */
export type CollectionHookedEventMap<TSchema extends Document> = CollectionBeforeCallbackArgsAndReturn<TSchema>
  & CollectionAfterCallbackArgsAndReturn<TSchema>
  & CollectionErrorCallbackArgsAndReturn<TSchema>
  & FindCursorHookedEventMap<TSchema>
  & AggregationCursorHookedEventMap<TSchema>

export type AmendedInsertOneOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "insertOne"> & InsertOneOptions;
export type AmendedBulkWriteOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "insertMany"> & BulkWriteOptions;
export type AmendedUpdateOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "updateOne" | "updateMany"> & UpdateOptions;
export type AmendedDeleteOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "deleteOne" | "deleteMany"> & DeleteOptions;
export type AmendedAggregateOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "aggregate"> & AggregateOptions;
export type AmendedReplaceOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "replaceOne"> & ReplaceOptions;
export type AmendedDistinctOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "distinct"> & DistinctOptions;
export type AmendedFindOptions<TSchema extends Document, caller extends "before.find" | "before.findOne" = "before.find" | "before.findOne", HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, caller> & FindOptions<TSchema>


type InsertOneCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>, AmendedInsertOneOptions | undefined];
type InsertManyCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>[], AmendedBulkWriteOptions | undefined];
type FindCallArgs<TSchema extends Document> = readonly [Filter<TSchema> | undefined, AmendedFindOptions<TSchema> | undefined];
type AggregateCallArgs = readonly [Document[], AmendedAggregateOptions | undefined];
export type UpdateCallArgs<TSchema> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, AmendedUpdateOptions | undefined];
export type ReplaceCallArgs<TSchema> = readonly [Filter<TSchema>, WithoutId<TSchema>, AmendedReplaceOptions | undefined];
type DeleteCallArgs<TSchema> = readonly [Filter<TSchema>, AmendedDeleteOptions | undefined];
type DistinctCallArgs<TSchema> = readonly [keyof WithId<TSchema>, Filter<TSchema>, AmendedDistinctOptions];

type TopLevelCall<O extends CommonDefinition & { result: any }> = {
  before: ReturnsArgs<O> & BeforeTopLevelEmitArgs<O> & Pick<O, "options">,
  after: ReturnsResult<O> & AfterTopLevelEmitArgs<O> & Pick<O, "options">,
  error: NoReturns<O> & AfterTopLevelErrorEmitArgs<O> & Pick<O, "options">,
  caller: never
};

type AllCommon<TSchema extends Document> = {
  args: any,
  thisArg: HookedCollectionInterface<TSchema> | HookedAggregationCursorInterface<TSchema> | HookedFindCursorInterface<TSchema>,
  isPromise: true,
  caller: keyof BeforeAfterErrorCollectionEventDefinitions<any> | keyof BeforeAfterErrorAggregationOnlyCursorEventDefinitions<any> | keyof BeforeAfterErrorFindOnlyCursorEventDefinitions<any>
};

export type BeforeAfterErrorCollectionEventDefinitions<TSchema extends Document> = {
  aggregate: TopLevelCall<{
    args: AggregateCallArgs,
    thisArg: HookedCollectionInterface<TSchema>,
    result: HookedAggregationCursorInterface<any>,
    isPromise: false
  }>,
  findOne: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: TSchema
  }>,
  find: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: HookedFindCursorInterface<any>,
    isPromise: false
  }>,
  insertOne: TopLevelCall<{
    args: InsertOneCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: InsertOneResult<TSchema>
  }>
  insertMany: TopLevelCall<{
    args: InsertManyCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: InsertManyResult<TSchema>
  }>,
  insert: {
    before: ReturnsNamedEmitArg<Pick<InsertCommon<TSchema>, "beforeHookReturns"> & BeforeInternalEmitArgs<InsertCommon<TSchema>>, "doc"> & { options: StandardDefineHookOptions, caller: InsertCommon<TSchema>["caller"] },
    after: ReturnsResult<InsertCommon<TSchema>> & AfterInternalEmitArgs<InsertCommon<TSchema>> & { options: AfterInsertOptions<TSchema>, caller: InsertCommon<TSchema>["caller"] },
    error: NoReturns & AfterInternalErrorEmitArgs<InsertCommon<TSchema>> & { caller: InsertCommon<TSchema>["caller"] },
    caller: InsertCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  deleteOne: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: DeleteResult,
    options: StandardDefineHookOptions,
  }>,
  delete: {
    before: ReturnsNamedEmitArg<Pick<DeleteCommon<TSchema>, "beforeHookReturns"> & BeforeInternalEmitArgs<DeleteCommon<TSchema> & FullDocument>, "filter"> & { options: BeforeDeleteDefineHookOptions<TSchema> & AllowGreedyDefineHookOptions, caller: DeleteCommon<TSchema>["caller"] },
    after: ReturnsResult<DeleteCommon<TSchema>> & AfterInternalEmitArgs<DeleteCommon<TSchema> & PreviousDocument> & { options: AfterDeleteDefineHookOptions<TSchema>, caller: DeleteCommon<TSchema>["caller"] },
    error: NoReturns & AfterInternalErrorEmitArgs<DeleteCommon<TSchema>> & { caller: DeleteCommon<TSchema>["caller"] },
    caller: DeleteCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: DeleteResult
  }>,
  replaceOne: TopLevelCall<{
    args: ReplaceCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema> | Document
  }>,
  updateOne: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>
  }>,
  update: {
    before: ReturnsNamedEmitArg<Pick<UpdateCommon<TSchema>, "beforeHookReturns"> & BeforeInternalEmitArgs<UpdateCommon<TSchema> & FullDocument>, "filterMutator"> & { options: BeforeUpdateDefineHookOptions<TSchema> & AllowGreedyDefineHookOptions, caller: UpdateCommon<TSchema>["caller"] },
    after: ReturnsResult<UpdateCommon<TSchema>> & AfterInternalEmitArgs<UpdateCommon<TSchema> & PreviousDocument & FullDocument> & { options: AfterUpdateDefineHookOptions<TSchema>, caller: UpdateCommon<TSchema>["caller"] },
    error: NoReturns & AfterInternalErrorEmitArgs<Omit<UpdateCommon<TSchema>, "custom"> & Omit<UpdateCommon<TSchema>["custom"], "getDocument">> & { caller: UpdateCommon<TSchema>["caller"] },
    caller: UpdateCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: any[]
  }>,
  "*": {
    before: NoReturns & BeforeInternalEmitArgsNoArgsOrig<AllCommon<TSchema>>
    after: NoReturns & BeforeInternalEmitArgsNoArgsOrig<AllCommon<TSchema>>
    error: NoReturns & BeforeInternalEmitArgsNoArgsOrig<AllCommon<TSchema>>,
    caller: AllCommon<TSchema>["caller"]
  }
};
