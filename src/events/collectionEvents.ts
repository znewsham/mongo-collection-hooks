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
  ReplaceOptions,
  CountOptions,
  EstimatedDocumentCountOptions,
  CountDocumentsOptions,
  FindOneAndDeleteOptions,
  ModifyResult,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions
} from "mongodb"

import { AfterInternalSuccessEmitArgs, AfterInternalErrorEmitArgs, BeforeAfterCallbackArgsAndReturn, BeforeInternalEmitArgs, BeforeInternalEmitArgsNoArgsOrig, CommonDefinition, ExtractEventDefinitions, NestedProjectionOfTSchema, NoReturns, ReturnsArgs, ReturnsNamedEmitArg, ReturnsResult, SkipDocument, AfterInternalEmitArgs, BeforeStar, AfterStar } from "./helpersTypes.js"
import { ChainedCallbackEventMap, StandardDefineHookOptions, StandardInvokeHookOptions } from "../awaiatableEventEmitter.js";
import { Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ResultOrError, ThisArg } from "../commentedTypes.js";
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js";
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js";
import { HookedCollectionInterface } from "./hookedCollectionInterface.js";
import { BeforeAfterErrorFindOnlyCursorEventDefinitions, FindCursorHookedEventMap } from "./findCursorEvents.js";
import { AggregationCursorHookedEventMap, BeforeAfterErrorAggregationOnlyCursorEventDefinitions } from "./aggregationCursorEvents.js";
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js";
import { BeforeAfterErrorSharedEventDefinitions, SharedCallbackArgsAndReturn } from "./sharedEvents.js";

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
  & BeforeAfterErrorGenericCursorEventDefinitions<TSchema>
  & BeforeAfterErrorSharedEventDefinitions<TSchema>;

type UpdateDeleteDefineHookOptions<TSchema extends Document, K extends "update" | "delete"> = {
  /** A function to indicate whether the hook should run or not. Mostly useful for before update hooks, or after update using fetchPrevious. These hooks will run *before* we fetch the document. */
  shouldRun?(...args: CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema>[K]["before"]["emitArgs"]["args"]): Promise<boolean> | boolean
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

type AfterTopLevelSuccessEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & InvocationSymbol
    & O["custom"]
};

type AfterTopLevelErrorEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & InvocationSymbol
    & ErrorT
    & O["custom"]
};

type AfterTopLevelEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & InvocationSymbol
    & ResultOrError<O>
    & O["custom"]
};

type UpdateCommon<TSchema extends Document> = {
  caller: "updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace",
  args: UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema> | FindOneAndUpdateCallArgs<TSchema> | FindOneAndReplaceCallArgs<TSchema>,
  thisArg: HookedCollectionInterface<TSchema>,
  result: WithId<TSchema> | UpdateResult<TSchema> | ModifyResult<TSchema> | null,
  beforeHookReturns: UpdateCommon<TSchema>["custom"]["filterMutator"] | typeof SkipDocument,
  custom: {
    /** The ID of the document being updated */
    _id: InferIdType<TSchema>,
    // TODO: this could be a SkipDocument too.
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

type UpdateCommonEmitArgs<TSchema extends Document> = {
  emitArgs: UpdateCommon<TSchema>["custom"]
    & Caller<UpdateCommon<TSchema>>
    & ThisArg<UpdateCommon<TSchema>>
    & Args<UpdateCommon<TSchema>>
    & ArgsOrig<UpdateCommon<TSchema>>
    & InvocationSymbol
    & ParentInvocationSymbol
    & PreviousDocument
    & FullDocument
};

type UpdateCommonResultEmitArgs<TSchema extends Document> = {
  emitArgs: Omit<UpdateCommonEmitArgs<TSchema>["emitArgs"], "caller">
    & (
      { caller: "findOneAndUpdate" | "findOneAndReplace", result: WithId<TSchema> | ModifyResult<TSchema> | null }
      | { caller: "updateOne" | "updateMany", result: UpdateResult<TSchema> }
      | { caller: "replaceOne", result: UpdateResult<TSchema> }
    )
}

type UpdateCommonErrorEmitArgs<TSchema extends Document> = {
  emitArgs: UpdateCommonEmitArgs<TSchema>["emitArgs"]
    & ErrorT
};

type UpdateCommonErrorOrResultEmitArgs<TSchema extends Document> = {
  emitArgs: Omit<UpdateCommonEmitArgs<TSchema>["emitArgs"], "caller">
    & {
      /** The error caused by the action. Mutually exclusive with result */
      error?: any
    }
    & (
      { caller: "findOneAndUpdate" | "findOneAndReplace", result?: WithId<TSchema> | ModifyResult<TSchema> | null }
      | { caller: "updateOne" | "updateMany", result?: UpdateResult<TSchema> }
      | { caller: "replaceOne", result: UpdateResult<TSchema> }
    )
}

type InsertCommon<TSchema extends Document> = {
  caller: "insertOne" | "insertMany" | "updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace",
  args: InsertManyCallArgs<TSchema> | InsertOneCallArgs<TSchema> | UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema> | FindOneAndReplaceCallArgs<TSchema> | FindOneAndUpdateCallArgs<TSchema>,
  beforeHookReturns: OptionalUnlessRequiredId<TSchema> | typeof SkipDocument
  thisArg: HookedCollectionInterface<TSchema>,
  result: InsertOneResult<TSchema> | UpdateResult,
  custom: {
    /** The document to be inserted */
    doc: OptionalUnlessRequiredId<TSchema>
  },
  isPromise: true
}

type DeleteCommon<TSchema extends Document> = {
  caller: "deleteOne" | "deleteMany" | "findOneAndDelete",
  args: DeleteCallArgs<TSchema> | FindOneAndDeleteCallArgs<TSchema>,
  thisArg: HookedCollectionInterface<TSchema>,
  result: DeleteResult | WithId<TSchema> | ModifyResult<TSchema> | null,
  beforeHookReturns: Filter<TSchema> | typeof SkipDocument,
  custom: {
    /** The ID of the document to be deleted */
    _id: InferIdType<TSchema>,
    /** The filter used to identify the document. Originally this will the main filter, but you can return a mutated version per document. It will be combined with the document ID for the final deletion */
    filter: Filter<TSchema>
  },
  isPromise: true
}

type DeleteCommonEmitArgs<TSchema extends Document> = {
  emitArgs: DeleteCommon<TSchema>["custom"]
    & Caller<DeleteCommon<TSchema>>
    & ThisArg<DeleteCommon<TSchema>>
    & Args<DeleteCommon<TSchema>>
    & ArgsOrig<DeleteCommon<TSchema>>
    & InvocationSymbol
    & ParentInvocationSymbol
    & PreviousDocument
};

type DeleteCommonResultEmitArgs<TSchema extends Document> = {
  emitArgs: Omit<DeleteCommonEmitArgs<TSchema>["emitArgs"], "caller">
    & (
      { caller: "findOneAndDelete", result: WithId<TSchema> | ModifyResult<TSchema> | null }
      | { caller: "deleteOne" | "deleteMany", result: DeleteResult }
    )
}

type DeleteCommonErrorEmitArgs<TSchema extends Document> = {
  emitArgs: DeleteCommonEmitArgs<TSchema>["emitArgs"]
    & ErrorT
};

type DeleteCommonErrorOrResultEmitArgs<TSchema extends Document> = {
  emitArgs: Omit<DeleteCommonEmitArgs<TSchema>["emitArgs"], "caller">
    & {
      /** The error caused by the action. Mutually exclusive with result */
      error?: any
    }
    & (
      { caller: "findOneAndDelete", result?: WithId<TSchema> | ModifyResult<TSchema> | null }
      | { caller: "deleteOne" | "deleteMany", result?: DeleteResult }
    )
}


type FullDocument = {
  /** Returns a document the projection of which is the union of all hooks' projections. This function will result in at most one database operation per document, regardless of how many times it's called across all hooks. */
  getDocument(): Promise<Document | null>,
}

type PreviousDocument = {
  /** A copy of the document from before the update was made */
  previousDocument?: Document | undefined | null
}

type CollectionBeforeEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "before", "before">
type CollectionAfterSuccessEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "after", "success", "success">
type CollectionAfterErrorEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "after", "error", "error">
type CollectionAfterEventDefinitions<TSchema extends Document> = ExtractEventDefinitions<BeforeAfterErrorCollectionEventDefinitions<TSchema>, "after", "after">

type AllCollectionEventDefinitions<TSchema extends Document> = CollectionBeforeEventDefinitions<TSchema>
  & CollectionAfterErrorEventDefinitions<TSchema>
  & CollectionAfterSuccessEventDefinitions<TSchema>
  & CollectionAfterEventDefinitions<TSchema>


type CollectionCallbackArgsAndReturn<TSchema extends Document> = BeforeAfterCallbackArgsAndReturn<AllCollectionEventDefinitions<TSchema>>


/**
 * @external
 */
export type CollectionHookedEventMap<TSchema extends Document> = CollectionCallbackArgsAndReturn<TSchema>
  & FindCursorHookedEventMap<TSchema>
  & AggregationCursorHookedEventMap<TSchema>
  & SharedCallbackArgsAndReturn<TSchema>

;

export type AmendedInsertOneOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "insertOne"> & InsertOneOptions;
export type AmendedBulkWriteOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "insertMany"> & BulkWriteOptions;
export type AmendedUpdateOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "updateOne" | "updateMany"> & UpdateOptions;
export type AmendedDeleteOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "deleteOne" | "deleteMany"> & DeleteOptions;
export type AmendedAggregateOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "aggregate"> & AggregateOptions;
export type AmendedReplaceOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "replaceOne"> & ReplaceOptions;
export type AmendedDistinctOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "distinct"> & DistinctOptions;
export type AmendedFindOptions<TSchema extends Document, caller extends "before.find" | "before.findOne" = "before.find" | "before.findOne", HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, caller> & FindOptions<TSchema>
export type AmendedEstimatedDocumentCountOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "estimatedDocumentCount"> & EstimatedDocumentCountOptions;
export type AmendedCountOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "count"> & CountOptions;
export type AmendedCountDocumentsOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "countDocuments"> & CountDocumentsOptions;
export type AmendedFindOneAndDeleteOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "findOneAndDelete"> & FindOneAndDeleteOptions;
export type AmendedFindOneAndUpdateOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "findOneAndUpdate"> & FindOneAndUpdateOptions;
export type AmendedFindOneAndReplaceOptions<HEM extends ChainedCallbackEventMap = ChainedCallbackEventMap> = StandardInvokeHookOptions<HEM, "findOneAndReplace"> & FindOneAndReplaceOptions;

type InsertOneCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>, AmendedInsertOneOptions | undefined];
type InsertManyCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>[], AmendedBulkWriteOptions | undefined];
type FindCallArgs<TSchema extends Document> = readonly [Filter<TSchema> | undefined, AmendedFindOptions<TSchema> | undefined];
type AggregateCallArgs = readonly [Document[], AmendedAggregateOptions | undefined];
export type UpdateCallArgs<TSchema> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, AmendedUpdateOptions | undefined];
export type ReplaceCallArgs<TSchema> = readonly [Filter<TSchema>, WithoutId<TSchema>, AmendedReplaceOptions | undefined];
type DeleteCallArgs<TSchema> = readonly [Filter<TSchema>, AmendedDeleteOptions | undefined];
type DistinctCallArgs<TSchema> = readonly [keyof WithId<TSchema>, Filter<TSchema>, AmendedDistinctOptions];
type CountCallArgs<TSchema> = readonly [Filter<TSchema> | undefined, AmendedCountOptions | undefined];
type EstimatedDocumentCountCallArgs = readonly [AmendedEstimatedDocumentCountOptions | undefined];
type CountDocumentsCallArgs = readonly [Filter<Document> | undefined, AmendedCountDocumentsOptions | undefined];
export type FindOneAndDeleteCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, AmendedFindOneAndDeleteOptions | undefined];
export type FindOneAndUpdateCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, UpdateFilter<TSchema>, AmendedFindOneAndUpdateOptions | undefined];
export type FindOneAndReplaceCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, WithoutId<TSchema>, AmendedFindOneAndReplaceOptions | undefined];

export type UpsertCallArgs<
  TSchema extends Document,
  Caller extends "updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace"
> = Caller extends "updateOne" | "updateMany"
  ? UpdateCallArgs<TSchema>
  : Caller extends "replaceOne"
    ? ReplaceCallArgs<TSchema>
    : Caller extends "findOneAndUpdate"
      ? FindOneAndUpdateCallArgs<TSchema>
      : Caller extends "findOneAndReplace"
        ? FindOneAndReplaceCallArgs<TSchema>
        : never
;

export type UpsertAndCallerCallArgs<
  TSchema extends Document,
  Caller extends "updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace"
> = Caller extends "updateOne" | "updateMany"
  ? { caller: Caller, args: UpdateCallArgs<TSchema> }
  : Caller extends "replaceOne"
    ? { caller: Caller, args: ReplaceCallArgs<TSchema> }
    : Caller extends "findOneAndUpdate"
      ? { caller: Caller, args: FindOneAndUpdateCallArgs<TSchema> }
      : Caller extends "findOneAndReplace"
        ? { caller: Caller, args: FindOneAndReplaceCallArgs<TSchema> }
        : never
;
type TopLevelCall<O extends CommonDefinition & { result: any }> = {
  before: ReturnsArgs<O> & BeforeTopLevelEmitArgs<O> & Pick<O, "options">,
  success: ReturnsResult<O> & AfterTopLevelSuccessEmitArgs<O> & Pick<O, "options">,
  error: NoReturns<O> & AfterTopLevelErrorEmitArgs<O> & Pick<O, "options">,
  after: ReturnsResult<O> & AfterTopLevelEmitArgs<O> & Pick<O, "options">
  caller: never
};

export type CountCommon<TSchema extends Document> = {
  args: CountCallArgs<TSchema> | CountDocumentsCallArgs | EstimatedDocumentCountCallArgs,
  thisArg: HookedCollectionInterface<TSchema>,
  isPromise: true,
  result: number,
  custom: {
    operation: "count" | "countDocuments" | "estimatedDocumentCount"
  }
}

export type FindOneCommon<TSchema extends Document> = {
  args: FindCallArgs<TSchema> | FindOneAndDeleteCallArgs<TSchema> | FindOneAndUpdateCallArgs<TSchema> | FindOneAndReplaceCallArgs<TSchema>,
  thisArg: HookedCollectionInterface<TSchema>,
  isPromise: true,
  result: WithId<TSchema> | ModifyResult<TSchema> | null,
  custom: {
    operation: "findOne" | "findOneAndDelete" | "findOneAndUpdate" | "findOneAndReplace"
  }
}

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
    result: Document | null
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
    success: ReturnsResult<InsertCommon<TSchema>> & AfterInternalSuccessEmitArgs<InsertCommon<TSchema>> & { options: AfterInsertOptions<TSchema>, caller: InsertCommon<TSchema>["caller"] },
    error: NoReturns & AfterInternalErrorEmitArgs<InsertCommon<TSchema>> & { caller: InsertCommon<TSchema>["caller"] },
    after: ReturnsResult<InsertCommon<TSchema>> & AfterInternalEmitArgs<InsertCommon<TSchema>> & { options: StandardDefineHookOptions, caller: InsertCommon<TSchema>["caller"] }
    caller: InsertCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  delete: {
    before: ReturnsNamedEmitArg<
      Pick<DeleteCommon<TSchema>, "beforeHookReturns">
      & DeleteCommonEmitArgs<TSchema>,
      "filter"
    >
    & { options: BeforeDeleteDefineHookOptions<TSchema> & AllowGreedyDefineHookOptions, caller: DeleteCommon<TSchema>["caller"] },
    success: ReturnsResult<DeleteCommon<TSchema>>
      & DeleteCommonResultEmitArgs<TSchema>
      & { options: AfterDeleteDefineHookOptions<TSchema>, caller: DeleteCommon<TSchema>["caller"] },
    error: NoReturns
      & DeleteCommonErrorEmitArgs<TSchema>
      & { options: AfterDeleteDefineHookOptions<TSchema>, caller: DeleteCommon<TSchema>["caller"] },
    after: ReturnsResult<DeleteCommon<TSchema>>
      & DeleteCommonErrorOrResultEmitArgs<TSchema>
      & { options: AfterDeleteDefineHookOptions<TSchema>, caller: DeleteCommon<TSchema>["caller"] },
    caller: DeleteCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  deleteOne: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: DeleteResult,
    custom: {
      _id?: InferIdType<TSchema>[]
    },
    options: StandardDefineHookOptions & { includeId?: boolean }
  }>,
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: DeleteResult
    custom: {
      _ids?: InferIdType<TSchema>[]
    },
    options: StandardDefineHookOptions & { includeIds?: boolean }
  }>,
  replaceOne: TopLevelCall<{
    args: ReplaceCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema> | Document
  }>,
  updateOne: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>,
    custom: {
      _id?: InferIdType<TSchema>
    },
    options: StandardDefineHookOptions & { includeId?: boolean }
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>,
    custom: {
      _ids?: InferIdType<TSchema>[]
    },
    options: StandardDefineHookOptions & { includeIds?: boolean }
  }>,
  update: {
    before: ReturnsNamedEmitArg<Pick<UpdateCommon<TSchema>, "beforeHookReturns">
      & BeforeInternalEmitArgs<UpdateCommon<TSchema> & FullDocument>, "filterMutator">
      & { options: BeforeUpdateDefineHookOptions<TSchema> & AllowGreedyDefineHookOptions, caller: UpdateCommon<TSchema>["caller"] },
    success: ReturnsResult<UpdateCommon<TSchema>>
      & UpdateCommonResultEmitArgs<TSchema>
      & { options: AfterUpdateDefineHookOptions<TSchema>, caller: UpdateCommon<TSchema>["caller"] },
    error: NoReturns
      & UpdateCommonErrorEmitArgs<TSchema>
      & { options: AfterUpdateDefineHookOptions<TSchema>, caller: UpdateCommon<TSchema>["caller"] },
    after: ReturnsResult<UpdateCommon<TSchema>>
      & UpdateCommonErrorOrResultEmitArgs<TSchema>
      & { options: AfterUpdateDefineHookOptions<TSchema>, caller: UpdateCommon<TSchema>["caller"] },
    caller: UpdateCommon<TSchema>["caller"],
    options: StandardDefineHookOptions,
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: any[]
  }>,
  count: TopLevelCall<{
    args: CountCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: number
  }>,
  countDocuments: TopLevelCall<{
    args: CountDocumentsCallArgs,
    thisArg: HookedCollectionInterface<TSchema>,
    result: number
  }>,
  estimatedDocumentCount: TopLevelCall<{
    args: EstimatedDocumentCountCallArgs,
    thisArg: HookedCollectionInterface<TSchema>,
    result: number
  }>,
  "count*": {
    before: ReturnsArgs<CountCommon<TSchema>> & BeforeStar<CountCommon<TSchema>>,
    success: ReturnsResult<CountCommon<TSchema>> & AfterStar<CountCommon<TSchema>, Result<CountCommon<TSchema>>>,
    after: ReturnsResult<CountCommon<TSchema>> & AfterStar<CountCommon<TSchema>, ResultOrError<CountCommon<TSchema>>>,
    error: NoReturns & AfterStar<CountCommon<TSchema>, ErrorT>,
    caller: never
  }
  // "findOne*": TopLevelCall<{
  //   args: FindCallArgs<TSchema> | FindOneAndDeleteCallArgs<TSchema> | FindOneAndUpdateCallArgs<TSchema> | FindOneAndReplaceCallArgs<TSchema>,
  //   thisArg: HookedCollectionInterface<TSchema>,
  //   result: WithId<TSchema> | ModifyResult<TSchema> | null
  // }>,
  "findOne*": {
    before: ReturnsArgs<FindOneCommon<TSchema>> & BeforeStar<FindOneCommon<TSchema>>,
    success: ReturnsResult<FindOneCommon<TSchema>> & AfterStar<FindOneCommon<TSchema>, Result<FindOneCommon<TSchema>>>,
    after: ReturnsResult<FindOneCommon<TSchema>> & AfterStar<FindOneCommon<TSchema>, ResultOrError<FindOneCommon<TSchema>>>,
    error: NoReturns & AfterStar<FindOneCommon<TSchema>, ErrorT>,
    caller: never
  },
  findOneAndDelete: TopLevelCall<{
    args: FindOneAndDeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: WithId<TSchema> | ModifyResult<TSchema> | null
  }>,
  findOneAndUpdate: TopLevelCall<{
    args: FindOneAndUpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: ModifyResult<TSchema> | WithId<TSchema> | null
  }>,
  findOneAndReplace: TopLevelCall<{
    args: FindOneAndReplaceCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: ModifyResult<TSchema> | WithId<TSchema> | null
  }>
};
