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

import { ProjectionOfTSchema, FilterOfTSchema } from "mongo-collection-helpers";

import { AfterInternalSuccessEmitArgs, AfterInternalErrorEmitArgs, BeforeAfterCallbackArgsAndReturn, BeforeInternalEmitArgs, CommonDefinition, ExtractEventDefinitions, NoReturns, ReturnsArgs, ReturnsNamedEmitArg, ReturnsResult, SkipDocument, AfterInternalEmitArgs, BeforeStar, AfterStar } from "./helpersTypes.js"
import { StandardDefineHookOptions, StandardInvokeHookOptions } from "../awaiatableEventEmitter.js";
import { Abortable, Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ResultOrError, ThisArg } from "./commentedTypes.js";
import { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js";
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js";
import { HookedCollectionInterface } from "./hookedCollectionInterface.js";
import { BeforeAfterErrorFindOnlyCursorEventDefinitions, FindCursorHookedEventMap } from "./findCursorEvents.js";
import { AggregationCursorHookedEventMap, BeforeAfterErrorAggregationOnlyCursorEventDefinitions } from "./aggregationCursorEvents.js";
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js";
import { BeforeAfterErrorSharedEventDefinitions, SharedCallbackArgsAndReturn } from "./sharedEvents.js";
import { BeforeAfterEventNamesOfName } from "./index.js";

type WithDocumentDefineHookOptions<TSchema extends Document, ARGS> = {
  /** The projection used when you call `.fullDocument()` it will be combined with the `projection` of every other hook being ran */
  projection?: ProjectionOfTSchema<TSchema> | (({ argsOrig, thisArg }: { argsOrig: ARGS, thisArg: HookedCollectionInterface<TSchema> }) => ProjectionOfTSchema<TSchema>)
}

type AllowGreedyDefineHookOptions = {
  /** Whether to fetch the entire document as part of the initial cursor (vs using the cursor just for _id and loading the document lazily). Set this to true if you always need every document. */
  greedyFetch?: boolean
}

type WithPreviousDocumentDefineHookOptions<TSchema extends Document, ARGS> = {
  /** fetch the document before updating */
  fetchPrevious?: boolean,

  /** The projection used to populate the previousDoc it will be combined with the `fetchPreviousProjection` of every other hook being ran */
  fetchPreviousProjection?: ProjectionOfTSchema<TSchema> | (({ argsOrig, thisArg }: { argsOrig: ARGS, thisArg: HookedCollectionInterface<TSchema> }) => ProjectionOfTSchema<TSchema>)
}

export type CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema extends Document> = BeforeAfterErrorCollectionEventDefinitions<TSchema>;

export type CollectionBeforeAfterErrorEventDefinitions<TSchema extends Document> = CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema>
  & BeforeAfterErrorFindOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorAggregationOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorGenericCursorEventDefinitions<TSchema>
  & BeforeAfterErrorSharedEventDefinitions<TSchema>;

type ShouldRun<TSchema extends Document, ARGS> = {
  shouldRun?({ argsOrig, thisArg }: { argsOrig: ARGS, thisArg: HookedCollectionInterface<TSchema>}): Promise<boolean> | boolean
}

type UpdateOrDeleteNDefineHookOptions<TSchema extends Document, CallArgs> = StandardDefineHookOptions
  & ShouldRun<TSchema, CallArgs>

type BeforeUpdateDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & ShouldRun<TSchema, UpdateCallArgs<TSchema>>
  & WithDocumentDefineHookOptions<TSchema, UpdateCallArgs<TSchema>>

type AfterUpdateDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & ShouldRun<TSchema, UpdateCallArgs<TSchema>>
  & WithDocumentDefineHookOptions<TSchema, UpdateCallArgs<TSchema>>
  & WithPreviousDocumentDefineHookOptions<TSchema, UpdateCallArgs<TSchema>>

type BeforeDeleteDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & ShouldRun<TSchema, DeleteCallArgs<TSchema>>
  & WithDocumentDefineHookOptions<TSchema, DeleteCallArgs<TSchema>>

type AfterDeleteDefineHookOptions<TSchema extends Document> = StandardDefineHookOptions
  & ShouldRun<TSchema, DeleteCallArgs<TSchema>>
  & WithPreviousDocumentDefineHookOptions<TSchema, DeleteCallArgs<TSchema>>

type AfterInsertOptions<TSchema extends Document> = StandardDefineHookOptions
  & WithDocumentDefineHookOptions<TSchema, DeleteCallArgs<TSchema>>

type BeforeTopLevelEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & InvocationSymbol
    & Abortable
    & O["custom"]
}

type AfterTopLevelSuccessEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & InvocationSymbol
    & Abortable
    & O["custom"]
};

type AfterTopLevelErrorEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & InvocationSymbol
    & ErrorT
    & Abortable
    & O["custom"]
};

type AfterTopLevelEmitArgs<O extends CommonDefinition> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & InvocationSymbol
    & ResultOrError<O>
    & Abortable
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
      filter: MaybeStrictFilter<TSchema>,
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
    & Abortable
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
  beforeHookReturns: MaybeStrictFilter<TSchema> | typeof SkipDocument,
  custom: {
    /** The ID of the document to be deleted */
    _id: InferIdType<TSchema>,
    /** The filter used to identify the document. Originally this will the main filter, but you can return a mutated version per document. It will be combined with the document ID for the final deletion */
    filter: MaybeStrictFilter<TSchema>
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
    & Abortable
};

type DeleteCommonResultEmitArgs<TSchema extends Document> = {
  emitArgs: Omit<DeleteCommonEmitArgs<TSchema>["emitArgs"], "caller">
    & PreviousDocument
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
    & PreviousDocument
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

type MaybeOrderedBatch = {
  /** Whether to run the operations in parallel or serially. For operations that support this option, it will be sent to the DB too, otherwise only meaningful if there are individual hooks (e.g., after.insert for an insertMany) */
  ordered?: boolean
  /** If ordered: false, how many operations to run in parallel (defaults to 1000) - there is a potential memory cost to running too many in parallel, but a wallclock cost to running them all serially */
  hookBatchSize?: number
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
export type CollectionHookedEventMap<TSchema extends Document = Document> = CollectionCallbackArgsAndReturn<TSchema>
  & FindCursorHookedEventMap<TSchema>
  & AggregationCursorHookedEventMap<TSchema>
  & SharedCallbackArgsAndReturn<TSchema>
;

type ReplaceProjection<Options extends { projection?: Document }, TSchema extends Document> = Omit<Options, "projection"> & { projection?: ProjectionOfTSchema<TSchema> | Document}

export type AmendedInsertOneOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "insertOne" | "insert">> & InsertOneOptions;
export type AmendedBulkWriteOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "insertMany" | "insert">> & BulkWriteOptions & AlwaysAttemptOperation;
export type AmendedUpdateOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "updateOne" | "updateMany" | "insert" | "update">> & UpdateOptions & AlwaysAttemptOperation & MaybeOrderedBatch;
export type AmendedDeleteOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "deleteOne" | "deleteMany" | "delete">> & DeleteOptions & AlwaysAttemptOperation & MaybeOrderedBatch;
export type AmendedAggregateOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "aggregate" | "aggregation.cursor.next" | "aggregation.cursor.toArray" | "aggregation.cursor.forEach" | "aggregation.cursor.execute" | "aggregation.cursor.asyncIterator" | "aggregation.cursor.close" | "cursor.next" | "cursor.toArray" | "cursor.forEach" | "cursor.execute" | "cursor.asyncIterator" | "cursor.close">> & AggregateOptions;
export type AmendedReplaceOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "replaceOne" | "insert" | "update">> & ReplaceOptions & AlwaysAttemptOperation;
export type AmendedDistinctOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "distinct">> & DistinctOptions;
  export type AmendedFindOptions<
  TSchema extends Document
>
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "find" | "find.cursor.next" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.execute" | "find.cursor.asyncIterator" | "find.cursor.close" | "cursor.next" | "cursor.toArray" | "cursor.forEach" | "cursor.execute" | "cursor.asyncIterator" | "cursor.close">> & ReplaceProjection<FindOptions<TSchema>, TSchema>

export type AmendedFindOneOptions<
  TSchema extends Document,
>
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "findOne" | "findOne*">> & ReplaceProjection<FindOptions<TSchema>, TSchema>
export type AmendedEstimatedDocumentCountOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "estimatedDocumentCount" | "count*">> & EstimatedDocumentCountOptions;
export type AmendedCountOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "count" | "count*">> & CountOptions;
export type AmendedCountDocumentsOptions
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "countDocuments" | "count*">> & CountDocumentsOptions;

export type AmendedFindOneAndDeleteOptions<TSchema extends Document>
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "findOneAndDelete" | "delete" | "findOne*">> & ReplaceProjection<FindOneAndDeleteOptions, TSchema> & AlwaysAttemptOperation;
export type AmendedFindOneAndUpdateOptions<TSchema extends Document>
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "findOneAndUpdate" | "update" | "insert" | "findOne*">> & ReplaceProjection<FindOneAndUpdateOptions, TSchema> & AlwaysAttemptOperation;
export type AmendedFindOneAndReplaceOptions<TSchema extends Document>
  = StandardInvokeHookOptions<CollectionHookedEventMap, BeforeAfterEventNamesOfName<"*" | "findOneAndReplace" | "update" | "insert" | "findOne*">> & ReplaceProjection<FindOneAndReplaceOptions, TSchema> & AlwaysAttemptOperation;

type AlwaysAttemptOperation = {
  /** In the case of underlying implementations with a partial view (e.g., client side) always attempt the underlying operation, omitting those explicitly attempted. Only useful if `update` or `delete` hooks are in use */
  alwaysAttemptOperation?: boolean
}


export type MaybeStrictFilter<TSchema extends Document> = FilterOfTSchema<TSchema> | Filter<TSchema>


type InsertOneCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>, AmendedInsertOneOptions | undefined];
type InsertManyCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>[], AmendedBulkWriteOptions | undefined];
type FindCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema> | undefined, AmendedFindOptions<TSchema> | undefined];
type AggregateCallArgs = readonly [Document[], AmendedAggregateOptions | undefined];
export type UpdateCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, AmendedUpdateOptions | undefined];
export type ReplaceCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema>, WithoutId<TSchema>, AmendedReplaceOptions | undefined];
type DeleteCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema>, AmendedDeleteOptions | undefined];
type DistinctCallArgs<TSchema extends Document> = readonly [keyof WithId<TSchema>, MaybeStrictFilter<TSchema>, AmendedDistinctOptions];
type CountCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema> | undefined, AmendedCountOptions | undefined];
type EstimatedDocumentCountCallArgs = readonly [AmendedEstimatedDocumentCountOptions | undefined];
type CountDocumentsCallArgs = readonly [MaybeStrictFilter<Document> | undefined, AmendedCountDocumentsOptions | undefined];
export type FindOneAndDeleteCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema>, AmendedFindOneAndDeleteOptions<TSchema> | undefined];
export type FindOneAndUpdateCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema>, UpdateFilter<TSchema>, AmendedFindOneAndUpdateOptions<TSchema> | undefined];
export type FindOneAndReplaceCallArgs<TSchema extends Document> = readonly [MaybeStrictFilter<TSchema>, WithoutId<TSchema>, AmendedFindOneAndReplaceOptions<TSchema> | undefined];

export type UpsertCallArgs<
  TSchema extends Document,
  ActualCaller extends "updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace"
> = ActualCaller extends "updateOne" | "updateMany"
  ? UpdateCallArgs<TSchema>
  : ActualCaller extends "replaceOne"
    ? ReplaceCallArgs<TSchema>
    : ActualCaller extends "findOneAndUpdate"
      ? FindOneAndUpdateCallArgs<TSchema>
      : ActualCaller extends "findOneAndReplace"
        ? FindOneAndReplaceCallArgs<TSchema>
        : never
;

export type UpsertAndCallerCallArgs<
  TSchema extends Document,
  ActualCaller extends "updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace"
> = ActualCaller extends "updateOne" | "updateMany"
  ? { caller: ActualCaller, args: UpdateCallArgs<TSchema> }
  : ActualCaller extends "replaceOne"
    ? { caller: ActualCaller, args: ReplaceCallArgs<TSchema> }
    : ActualCaller extends "findOneAndUpdate"
      ? { caller: ActualCaller, args: FindOneAndUpdateCallArgs<TSchema> }
      : ActualCaller extends "findOneAndReplace"
        ? { caller: ActualCaller, args: FindOneAndReplaceCallArgs<TSchema> }
        : never
;
type TopLevelCall<O extends CommonDefinition & { result: any }> = {
  before: ReturnsArgs<O> & BeforeTopLevelEmitArgs<O> & (O extends { options: StandardDefineHookOptions } ? Pick<O, "options"> : { options: StandardDefineHookOptions }),
  success: ReturnsResult<O> & AfterTopLevelSuccessEmitArgs<O> & (O extends { options: StandardDefineHookOptions } ? Pick<O, "options"> : { options: StandardDefineHookOptions }),
  error: NoReturns<O> & AfterTopLevelErrorEmitArgs<O> & (O extends { options: StandardDefineHookOptions } ? Pick<O, "options"> : { options: StandardDefineHookOptions }),
  after: ReturnsResult<O> & AfterTopLevelEmitArgs<O> & (O extends { options: StandardDefineHookOptions } ? Pick<O, "options"> : { options: StandardDefineHookOptions }),
  caller: never,
  options: O extends { options: StandardDefineHookOptions } ? O["options"] : StandardDefineHookOptions
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
    result: InsertOneResult<TSchema>,
    options: StandardDefineHookOptions
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
      & { emitArgs: DeleteCommonEmitArgs<TSchema>["emitArgs"]& FullDocument },
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
    options: StandardDefineHookOptions & UpdateOrDeleteNDefineHookOptions<TSchema, DeleteCallArgs<TSchema>> & { includeId?: boolean }
  }>,
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: DeleteResult
    custom: {
      _ids?: InferIdType<TSchema>[]
    },
    options: StandardDefineHookOptions & UpdateOrDeleteNDefineHookOptions<TSchema, DeleteCallArgs<TSchema>> & { includeIds?: boolean }
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
    options: StandardDefineHookOptions & UpdateOrDeleteNDefineHookOptions<TSchema, UpdateCallArgs<TSchema>> & { includeId?: boolean }
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollectionInterface<TSchema>,
    result: UpdateResult<TSchema>,
    custom: {
      _ids?: InferIdType<TSchema>[]
    },
    options: StandardDefineHookOptions & UpdateOrDeleteNDefineHookOptions<TSchema, UpdateCallArgs<TSchema>> & { includeIds?: boolean }
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
