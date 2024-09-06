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
  CountDocumentsOptions,
  CountOptions,
  WithoutId,
  ReplaceOptions
} from "mongodb"
import { HookedFindCursor } from "./hookedFindCursor.js";
import { ChainedAwaiatableEventEmitter, ChainedCallbackEventMap, ConvertCallbackArgsToArgs, ListenerCallback } from "./awaiatableEventEmitter.js";
import { Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ThisArg } from "./commentedTypes.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";


type InsertOneCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>, InsertOneOptions | undefined];
type FindCallArgs<TSchema> = readonly [Filter<TSchema> | undefined, FindOptions<TSchemaOrDocument<TSchema>> | undefined];
type AggregateCallArgs = readonly [Document[], AggregateOptions | undefined];
type InsertManyCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>[], BulkWriteOptions | undefined];
export type UpdateCallArgs<TSchema> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, UpdateOptions | undefined];
export type ReplaceCallArgs<TSchema> = readonly [Filter<TSchema>, WithoutId<TSchema>, ReplaceOptions | undefined];
type DeleteCallArgs<TSchema> = readonly [Filter<TSchema>, DeleteOptions | undefined];
type DistinctCallArgs<TSchema> = readonly [keyof WithId<TSchema>, Filter<TSchema>, DistinctOptions];
type TSchemaOrDocument<T> = T extends Document ? T : Document;

type BaseHookShape = {
  emitArgs: Record<string, any>,
  isPromise: boolean,
  returnEmitName: string | never,
  returns: any | never
}

type ObjectExtends<key extends string, value> = {[k in key]: value} & Record<string, any>

type HookShape<
  O extends BaseHookShape = BaseHookShape,
  EMITARGS extends ObjectExtends<O["returnEmitName"], returns> = O["emitArgs"],
  REM extends keyof EMITARGS = O["returnEmitName"] extends never ? never : keyof EMITARGS,
  returns = REM extends never ? never : EMITARGS[REM]
> = {
  isPromise: O["isPromise"],
  emitArgs: O["emitArgs"]
  returnEmitName: keyof O["emitArgs"],
  returns: O["emitArgs"][O["returnEmitName"]]
};

type ReturnsNamedEmitArg<O extends {emitArgs: {[k in Key]: any}, isPromise?: boolean}, Key extends string> = O & {
  returns: O["emitArgs"][Key],
  returnEmitName: Key,
  isPromise: O["isPromise"] extends false ? false : true
}

type ReturnsArgs<O extends {args: O["args"], isPromise?: boolean}> = O & {
  returns: O["args"],
  returnEmitName: "args",
  isPromise: O["isPromise"] extends false ? false : true
}
type ReturnsResult<O extends {result: O["result"], isPromise?: boolean}> = O & {
  returns: O["result"],
  returnEmitName: "result",
  isPromise: O["isPromise"] extends false ? false : true
}
type NoReturns<O extends { isPromise?: boolean }> = O & {
  returnEmitName: never,
  isPromise: O["isPromise"] extends false ? false : true
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
type AfterInternalEmitArgs<O extends CommonDefinitionWithCaller> = O & {
  hasOrigResult: false,
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & O["custom"]
}

type AfterInternalErrorEmitArgs<O extends CommonDefinitionWithCaller> = Omit<O, "result"> & {
  hasOrigResult: false,
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & ErrorT
    & O["custom"]
}


type BeforeTopLevelEmitArgs<O extends CommonDefinition> = Omit<O, "result"> & {
  // result: never[],
  emitArgs:
    ThisArg<O>
    & Args<O>
    & InvocationSymbol
    & O["custom"]
}

type BeforeInternalEmitArgs<O extends CommonDefinitionWithCaller> = Omit<O, "result"> & {
  result: never[],
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Caller<O>
    & ParentInvocationSymbol
    & InvocationSymbol
    & O["custom"]
}

type CommonDefinition = {
  args: any,
  thisArg: any,
  custom?: Record<string, any>
  isPromise?: boolean
};

type CommonDefinitionWithCaller = CommonDefinition & {
  caller: BeforeAfterEventNames
}

type TopLevelCall<O extends CommonDefinition & { result: any }> = {
  before: ReturnsArgs<BeforeTopLevelEmitArgs<O>>,
  after: ReturnsResult<AfterTopLevelEmitArgs<O>>,
  error: NoReturns<AfterTopLevelErrorEmitArgs<O>>,
  caller: never
};

type InsertCommon<TSchema, This> = {
  caller: "insertOne" | "insertMany" | "updateOne" | "updateMany" | "replaceOne",
  args: InsertManyCallArgs<TSchema> | InsertOneCallArgs<TSchema> | UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>,
  thisArg: This,
  result: InsertOneResult<TSchema> | UpdateResult | Document,
  custom: {
    /** The document to be inserted */
    doc: OptionalUnlessRequiredId<TSchema>
  },
  isPromise: true
}

type DeleteCommon<TSchema, This> = {
  caller: "deleteOne" | "deleteMany",
  args: DeleteCallArgs<TSchema>,
  thisArg: This,
  result: DeleteResult,
  custom: {
    /** The ID of the document to be deleted */
    _id: InferIdType<TSchema>,
    /** The filter used to identify the document. Originally this will the main filter, but you can return a mutated version per document. It will be combined with the document ID for the final deletion */
    filter: Filter<TSchema>
  },
  isPromise: true
}

type UpdateCommon<TSchema, This> = {
  caller: "updateOne" | "updateMany" | "replaceOne",
  args: UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>,
  thisArg: This,
  result: UpdateResult | Document,
  custom: {
    _id: InferIdType<TSchema>,
    filterMutator: {
      filter: Filter<TSchema>,
      mutator?: UpdateFilter<TSchema> | Partial<TSchema>,
      replacement?: WithoutId<TSchema>
    }
  },
  isPromise: true
}


type CursorParams<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterErrorEventDefinitions<TSchema> },
  O extends CommonDefinition = {
    args: never,
    thisArg: HookedCursorType,
    isPromise: true
  }
> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  after: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  error: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  caller: CO["caller"]
};
type CursorParamsWithResult<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterErrorEventDefinitions<TSchema>, result: any },
  O extends CommonDefinition = {
    args: never,
    thisArg: HookedCursorType
  } & CO
> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  after: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  error: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  caller: CO["caller"]
};
type CursorParamsWithArgs<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterErrorEventDefinitions<TSchema>, result: any, args: any },
  O extends CommonDefinition = {
    thisArg: HookedCursorType
  } & CO
> = {
  before: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "argsOrig">,
  },
  after: NoReturns<AfterInternalEmitArgs<O & CO>>,
  error: NoReturns<AfterInternalErrorEmitArgs<O & CO>>,
  caller: CO["caller"]
};

type CursorParamsWithArgsAndResult<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterErrorEventDefinitions<TSchema>, result: any, args: any, isPromise?: boolean },
  O extends CommonDefinition = {
    thisArg: HookedCursorType
  } & CO
> = {
  before: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "argsOrig">
  },
  after: ReturnsResult<AfterInternalEmitArgs<O & CO>>,
  error: NoReturns<AfterInternalErrorEmitArgs<O & CO>>,
  caller: CO["caller"]
};
export type BeforeAfterErrorEventDefinitions<TSchema, This = any> = {
  "cursor.execute": CursorParams<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.next" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "cursor.asyncIterator",
  }>
  "cursor.next": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "cursor.asyncIterator",
    result: TSchema | null
  }>,
  "cursor.toArray": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate",
    result: TSchema[]
  }>,
  "cursor.forEach": CursorParamsWithArgs<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate",
    result: never,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "cursor.asyncIterator": CursorParams<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate",
    result: never,
  }>,
  "find.cursor.execute": CursorParams<TSchema, HookedFindCursor<TSchema>, {
    caller: "find" | "find.cursor.toArray" | "find.cursor.next" | "find.cursor.forEach" | "find.cursor.asyncIterator"
  }>,
  "find.cursor.next": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator",
    result: TSchema | null
  }>,
  "find.cursor.toArray": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find",
    result: TSchema[]
  }>,
  "find.cursor.count": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<any>, {
    caller: "find",
    result: number,
    args: [CountOptions | undefined]
  }>,
  "find.cursor.forEach": CursorParamsWithArgs<TSchema, HookedFindCursor<any>, {
    caller: "find",
    result: never,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "find.cursor.asyncIterator": CursorParams<TSchema, HookedFindCursor<any>, {
    caller: "find",
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,

  "aggregate.cursor.execute": CursorParams<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate" | "aggregate.cursor.toArray" | "aggregate.cursor.forEach"
  }>,
  "aggregate.cursor.next": CursorParamsWithResult<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate" | "aggregate.cursor.toArray" | "aggregate.cursor.forEach",
    result: TSchema | null
  }>,
  "aggregate.cursor.toArray": CursorParamsWithResult<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate",
    result: TSchema[]
  }>,
  "aggregate.cursor.forEach": CursorParamsWithArgs<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "aggregate.cursor.asyncIterator": CursorParams<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate",
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,

  aggregate: TopLevelCall<{
    args: AggregateCallArgs,
    thisArg: This,
    result: HookedAggregationCursor<any>,
    isPromise: false
  }>,
  findOne: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: This,
    result: TSchema
  }>,
  find: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: This,
    result: HookedFindCursor<any>,
    isPromise: false
  }>,
  insertOne: TopLevelCall<{
    args: InsertOneCallArgs<TSchema>,
    thisArg: This,
    result: InsertOneResult<TSchema>,
  }>
  insertMany: TopLevelCall<{
    args: InsertManyCallArgs<TSchema>,
    thisArg: This,
    result: InsertManyResult<TSchema>,
  }>,
  insert: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<InsertCommon<TSchema, This>>, "doc">,
    after: NoReturns<AfterInternalEmitArgs<InsertCommon<TSchema, This>>>,
    error: NoReturns<AfterInternalErrorEmitArgs<InsertCommon<TSchema, This>>>,
    caller: InsertCommon<TSchema, This>["caller"],
  },
  deleteOne: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: This,
    result: DeleteResult
  }>,
  delete: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<DeleteCommon<TSchema, This>>, "filter">,
    after: NoReturns<AfterInternalEmitArgs<DeleteCommon<TSchema, This>>>,
    error: NoReturns<AfterInternalErrorEmitArgs<DeleteCommon<TSchema, This>>>,
    caller: DeleteCommon<TSchema, This>["caller"],
  },
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: This,
    result: DeleteResult
  }>,
  replaceOne: TopLevelCall<{
    args: ReplaceCallArgs<TSchema>,
    thisArg: This,
    result: UpdateResult<TSchemaOrDocument<TSchema>> | Document
  }>,
  updateOne: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: This,
    result: UpdateResult<TSchemaOrDocument<TSchema>>
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: This,
    result: UpdateResult<TSchemaOrDocument<TSchema>>
  }>,
  update: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<UpdateCommon<TSchema, This>>, "filterMutator">,
    after: NoReturns<AfterInternalEmitArgs<UpdateCommon<TSchema, This>>>,
    error: NoReturns<AfterInternalErrorEmitArgs<UpdateCommon<TSchema, This>>>,
    caller: UpdateCommon<TSchema, This>["caller"],
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: This,
    result: any[]
  }>
}

export type BeforeAfterEventNames<limit extends keyof BeforeAfterErrorEventDefinitions<Document> = keyof BeforeAfterErrorEventDefinitions<Document>> = keyof BeforeAfterErrorEventDefinitions<Document> & limit;

export type CallerType<k extends BeforeAfterEventNames = BeforeAfterEventNames> = BeforeAfterErrorEventDefinitions<Document>[k]["caller"]

type BeforeEventDefinitions<TSchema, This> = {
  [k in BeforeAfterEventNames as `before.${k}`]: BeforeAfterErrorEventDefinitions<TSchema, This>[k]["before"]
}

type AfterEventSuccessDefinitions<TSchema, This> = {
  [k in BeforeAfterEventNames as `after.${k}.success`]: BeforeAfterErrorEventDefinitions<TSchema, This>[k]["after"]
}

type AfterEventErrorDefinitions<TSchema, This> = {
  [k in BeforeAfterEventNames as `after.${k}.error`]: BeforeAfterErrorEventDefinitions<TSchema, This>[k]["error"]
}

export type EventDefinitions<TSchema, This> = BeforeEventDefinitions<TSchema, This> & AfterEventSuccessDefinitions<TSchema, This> & AfterEventErrorDefinitions<TSchema, This>;

export type EventNames<limit extends keyof EventDefinitions<Document, any> = keyof EventDefinitions<Document, any>> = keyof EventDefinitions<Document, any> & limit;
export type BeforeEventNames<limit extends EventNames = keyof BeforeEventDefinitions<Document, any>> = keyof BeforeEventDefinitions<Document, any> & limit;
export type AfterEventSuccessNames<limit extends EventNames = keyof AfterEventSuccessDefinitions<Document, any>> = keyof AfterEventSuccessDefinitions<Document, any> & limit;
export type AfterEventErrorNames<limit extends EventNames = keyof AfterEventErrorDefinitions<Document, any>> = keyof AfterEventErrorDefinitions<Document, any> & limit;

type BeforeCallbackArgsAndReturn<TSchema, This> = {
  [k in BeforeEventNames]: {
    callbackArgs:
    {
      /** The original arguments before any hook was applied */
      [rek in BeforeEventDefinitions<TSchema, This>[k]["returnEmitName"] as `${rek}Orig`]: BeforeEventDefinitions<TSchema, This>[k] extends { returns: any } ? BeforeEventDefinitions<TSchema, This>[k]["returns"] : never
    } & BeforeEventDefinitions<TSchema, This>[k]["emitArgs"],
    emitArgs: BeforeEventDefinitions<TSchema, This>[k]["emitArgs"],
    returns: BeforeEventDefinitions<TSchema, This>[k] extends { returns: any } ? BeforeEventDefinitions<TSchema, This>[k]["returns"] : never,
    isPromise: BeforeEventDefinitions<TSchema, This>[k]["isPromise"]
  }
}

type AfterSuccessCallbackArgsAndReturn<TSchema, This> = {
  [k in AfterEventSuccessNames]: {
    callbackArgs:
    {
      [rek in AfterEventSuccessDefinitions<TSchema, This>[k]["returnEmitName"] as `${rek}Orig`]: AfterEventSuccessDefinitions<TSchema, This>[k] extends { returns: any } ? AfterEventSuccessDefinitions<TSchema, This>[k]["returns"] : never
    } & AfterEventSuccessDefinitions<TSchema, This>[k]["emitArgs"],
    emitArgs: AfterEventSuccessDefinitions<TSchema, This>[k]["emitArgs"],
    returns: AfterEventSuccessDefinitions<TSchema, This>[k] extends { returns: any } ? AfterEventSuccessDefinitions<TSchema, This>[k]["returns"] : never,
    isPromise: AfterEventSuccessDefinitions<TSchema, This>[k]["isPromise"]
  }
}

type AfterErrorCallbackArgsAndReturn<TSchema, This> = {
  [k in AfterEventErrorNames]: {
    callbackArgs:
    {
      [rek in AfterEventErrorDefinitions<TSchema, This>[k]["returnEmitName"] as `${rek}Orig`]: AfterEventErrorDefinitions<TSchema, This>[k] extends { returns: any } ? AfterEventErrorDefinitions<TSchema, This>[k]["returns"] : never
    } & AfterEventErrorDefinitions<TSchema, This>[k]["emitArgs"],
    emitArgs: AfterEventErrorDefinitions<TSchema, This>[k]["emitArgs"],
    returns: AfterEventErrorDefinitions<TSchema, This>[k] extends { returns: any } ? AfterEventErrorDefinitions<TSchema, This>[k]["returns"] : never,
    isPromise: AfterEventErrorDefinitions<TSchema, This>[k]["isPromise"]
  }
}

export type HookedEventMap<TSchema, This> = BeforeCallbackArgsAndReturn<TSchema, This> & AfterSuccessCallbackArgsAndReturn<TSchema, This> & AfterErrorCallbackArgsAndReturn<TSchema, This>
export type HookedListenerCallback<K extends EventNames, TSchema, This> = ListenerCallback<K, ConvertCallbackArgsToArgs<HookedEventMap<TSchema, This>>>


export class HookedEventEmitter<HEM extends ChainedCallbackEventMap> extends ChainedAwaiatableEventEmitter<HEM> {
}


type SelfOneOrMany<T extends string> = T | `${T}One` | `${T}Many`;

function selfOneOrMany<T extends string>(keyword: T): SelfOneOrMany<T>[] {
  return [keyword, `${keyword}One`, `${keyword}Many`];
}

const cursorEvents = [
  "execute",
  "next",
//  "close",
  "toArray",
  "count",
  "forEach",
  "asyncIterator"
] as const;

type SpecificCursorEvents<T, CE extends string> = T extends string ? `${T}cursor.${CE}` : `cursor.${CE}`;
function specificCursorEvents<T extends string, E extends string>(
  cursorEvents: readonly E[],
  cursorType: T
): SpecificCursorEvents<T, E>[] {
  return cursorEvents.map(event => `${cursorType}cursor.${event}` as SpecificCursorEvents<T, E>);
}
const FindCursorEventsSuffixes = specificCursorEvents(cursorEvents, "find.");
const AggregateCursorEventsSuffixes = specificCursorEvents(cursorEvents, "aggregate.");
const GenericCursorEventsSuffixes = specificCursorEvents(cursorEvents, "");

export const FindCursorEventsSet = new Set(FindCursorEventsSuffixes.flatMap(eventSuffix => [`before.${eventSuffix}`, `after.${eventSuffix}`]));
export const AggregateCursorEventsSet = new Set(AggregateCursorEventsSuffixes.flatMap(eventSuffix => [`before.${eventSuffix}`, `after.${eventSuffix}`]));

const beforeAfterEvents = [
  ...selfOneOrMany("insert"),
  ...selfOneOrMany("delete"),
  ...selfOneOrMany("update"),
  "replaceOne",
  "find",
  "findOne",
  "aggregate",
  "distinct",
  ...FindCursorEventsSuffixes,
  ...AggregateCursorEventsSuffixes,
  ...GenericCursorEventsSuffixes
] as const


export const Events: {
  before: { [k in BeforeAfterEventNames]: `before.${k}`},
  afterSuccess: { [k in BeforeAfterEventNames]: `after.${k}.success`},
  afterError: { [k in BeforeAfterEventNames]: `after.${k}.error`}
} = {
  before: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `before.${key}`])) as { [k in keyof BeforeAfterErrorEventDefinitions<Document>]: `before.${k}`},
  afterSuccess: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}.success`])) as { [k in keyof BeforeAfterErrorEventDefinitions<Document>]: `after.${k}.success`},
  afterError: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}.error`])) as { [k in keyof BeforeAfterErrorEventDefinitions<Document>]: `after.${k}.error`}
}

export const InternalEvents = Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, key])) as { [k in keyof BeforeAfterErrorEventDefinitions<Document>]: k};

export function internalSymbolToBeforeAfterKey<
  K extends BeforeAfterEventNames
>(key: K): { before: BeforeEventNames & `before.${K}`, afterSuccess: AfterEventSuccessNames & `after.${K}.success`, afterError: AfterEventErrorNames & `after.${K}.error` } {
  return {
    before: `before.${key}` as (BeforeEventNames & `before.${K}`),
    afterSuccess: `after.${key}.success` as (AfterEventSuccessNames & `after.${K}.success`),
    afterError: `after.${key}.error` as (AfterEventErrorNames & `after.${K}.error`)
  }
}



export function assertCaller<
  IE extends BeforeAfterEventNames
>(caller: CallerType, internalEvent: IE): asserts caller is CallerType<typeof internalEvent> {

}

export function assertArgs<
  IE extends BeforeAfterEventNames
>(args: BeforeAfterErrorEventDefinitions<any>[keyof BeforeAfterErrorEventDefinitions<any>]["before"]["args"], internalEvent: IE): asserts args is BeforeAfterErrorEventDefinitions<any>[typeof internalEvent]["before"]["args"] {

}
