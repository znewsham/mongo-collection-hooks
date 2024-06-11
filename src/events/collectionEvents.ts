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

import { AfterInternalEmitArgs, AfterInternalErrorEmitArgs, BeforeAfterCallbackArgsAndReturn, BeforeInternalEmitArgs, CommonDefinition, ExtractEventDefinitions, NestedProjectionOfTSchema, NoReturns, ReturnsArgs, ReturnsNamedEmitArg, ReturnsResult } from "./helpersTypes.js"
import { StandardDefineHookOptions, StandardInvokeHookOptions } from "../awaiatableEventEmitter.js";
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
  shouldRun?(...args: CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema>[K]["before"]["args"]): Promise<boolean>
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

type BeforeTopLevelEmitArgs<O extends CommonDefinition> = Omit<O, "result"> & {
  // result: never[],
  emitArgs:
    ThisArg<O>
    & Args<O>
    & InvocationSymbol
    & O["custom"]
}

type AfterTopLevelEmitArgs<O extends CommonDefinition> = O & {
  hasOrigResult: true,
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & InvocationSymbol
};

type AfterTopLevelErrorEmitArgs<O extends CommonDefinition> = O & {
  hasOrigResult: true,
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

export type CollectionHookedEventMap<TSchema extends Document> = CollectionBeforeCallbackArgsAndReturn<TSchema>
  & CollectionAfterCallbackArgsAndReturn<TSchema>
  & CollectionErrorCallbackArgsAndReturn<TSchema>
  & FindCursorHookedEventMap<TSchema>
  & AggregationCursorHookedEventMap<TSchema>

// TODO: this shouldn't be tied to collection.
type HookedStandardInvokeHookOptions = StandardInvokeHookOptions<keyof CollectionHookedEventMap<any>, CollectionHookedEventMap<any>>;


type AmendedOptions<InvokeHookOptions extends HookedStandardInvokeHookOptions, RegularOptions extends Record<string, any>> = InvokeHookOptions & RegularOptions;
export type AmendedInsertOneOptions = AmendedOptions<HookedStandardInvokeHookOptions, InsertOneOptions>;
export type AmendedBulkWriteOptions = AmendedOptions<HookedStandardInvokeHookOptions, BulkWriteOptions>;
export type AmendedUpdateOptions = AmendedOptions<HookedStandardInvokeHookOptions, UpdateOptions>;
export type AmendedDeleteOptions = AmendedOptions<HookedStandardInvokeHookOptions, DeleteOptions>;
export type AmendedAggregateOptions = AmendedOptions<HookedStandardInvokeHookOptions, AggregateOptions>;
export type AmendedReplaceOptions = AmendedOptions<HookedStandardInvokeHookOptions, ReplaceOptions>;
export type AmendedDistinctOptions = AmendedOptions<HookedStandardInvokeHookOptions, DistinctOptions>;
export type AmendedFindOptions<TSchema extends Document> = AmendedOptions<HookedStandardInvokeHookOptions, FindOptions<TSchema>>


type InsertOneCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>, AmendedInsertOneOptions | undefined];
type InsertManyCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>[], AmendedBulkWriteOptions | undefined];
type FindCallArgs<TSchema extends Document> = readonly [Filter<TSchema> | undefined, AmendedFindOptions<TSchema> | undefined];
type AggregateCallArgs = readonly [Document[], AmendedAggregateOptions | undefined];
export type UpdateCallArgs<TSchema> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, AmendedUpdateOptions | undefined];
export type ReplaceCallArgs<TSchema> = readonly [Filter<TSchema>, WithoutId<TSchema>, AmendedReplaceOptions | undefined];
type DeleteCallArgs<TSchema> = readonly [Filter<TSchema>, AmendedDeleteOptions | undefined];
type DistinctCallArgs<TSchema> = readonly [keyof WithId<TSchema>, Filter<TSchema>, AmendedDistinctOptions];



type TopLevelCall<O extends CommonDefinition & { result: any }> = {
  before: ReturnsArgs<BeforeTopLevelEmitArgs<O>>,
  after: ReturnsResult<AfterTopLevelEmitArgs<O>>,
  error: NoReturns<AfterTopLevelErrorEmitArgs<O>>,
  caller: never
};

export type BeforeAfterErrorCollectionEventDefinitions<TSchema extends Document> = {
  aggregate: TopLevelCall<{
    args: AggregateCallArgs,
    thisArg: HookedCollectionInterface<TSchema>,
    result: HookedAggregationCursorInterface<any>,
    isPromise: false,
    options: StandardDefineHookOptions
  }>,
  findOne: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: TSchema,
    options: StandardDefineHookOptions
  }>,
  find: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: HookedFindCursorInterface<any>,
    isPromise: false,
    options: StandardDefineHookOptions
  }>,
  insertOne: TopLevelCall<{
    args: InsertOneCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: InsertOneResult<TSchema>,
    options: StandardDefineHookOptions,
  }>
  insertMany: TopLevelCall<{
    args: InsertManyCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: InsertManyResult<TSchema>,
    options: StandardDefineHookOptions,
  }>,
  insert: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<InsertCommon<TSchema> & { options: StandardDefineHookOptions }>, "doc">,
    after: NoReturns<AfterInternalEmitArgs<InsertCommon<TSchema> & { options: AfterInsertOptions<TSchema> }>>,
    error: NoReturns<AfterInternalErrorEmitArgs<InsertCommon<TSchema>>>,
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
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<DeleteCommon<TSchema> & FullDocument & { options: BeforeDeleteDefineHookOptions<TSchema> & AllowGreedyDefineHookOptions }>, "filter">,
    after: NoReturns<AfterInternalEmitArgs<DeleteCommon<TSchema> & PreviousDocument & { options: AfterDeleteDefineHookOptions<TSchema> }>>,
    error: NoReturns<AfterInternalErrorEmitArgs<DeleteCommon<TSchema>>>,
    caller: DeleteCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: DeleteResult,
    options: StandardDefineHookOptions,
  }>,
  replaceOne: TopLevelCall<{
    args: ReplaceCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema> | Document,
    options: StandardDefineHookOptions,
  }>,
  updateOne: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>,
    options: StandardDefineHookOptions,
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>,
    options: StandardDefineHookOptions,
  }>,
  update: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<UpdateCommon<TSchema> & FullDocument & { options: BeforeUpdateDefineHookOptions<TSchema> & AllowGreedyDefineHookOptions }>, "filterMutator">,
    after: NoReturns<AfterInternalEmitArgs<UpdateCommon<TSchema> & PreviousDocument & FullDocument & { options: AfterUpdateDefineHookOptions<TSchema> }>>,
    error: NoReturns<AfterInternalErrorEmitArgs<Omit<UpdateCommon<TSchema>, "custom"> & Omit<UpdateCommon<TSchema>["custom"], "getDocument">>>,
    caller: UpdateCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: any[],
    options: StandardDefineHookOptions,
  }>
};
