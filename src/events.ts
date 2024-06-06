import {
  type Document,
  type BulkWriteOptions,
  type DeleteOptions,
  type Filter,
  type InsertManyResult,
  type InsertOneOptions,
  type InsertOneResult,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
  type UpdateOptions,
  DeleteResult,
  UpdateResult,
  WithId,
  DistinctOptions,
  InferIdType,
  FindOptions,
  AggregateOptions,
  CountDocumentsOptions,
  CountOptions
} from "mongodb"
import { HookedCollection } from "./hookedCollection.js"
import { HookedFindCursor } from "./hookedFindCursor.js";
import { ChainedAwaiatableEventEmitter, ChainedCallbackEventMap, ConvertCallbackArgsToArgs, ListenerCallback } from "./awaiatableEventEmitter.js";
import { Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ThisArg } from "./commentedTypes.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";


export type InsertOneCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>, InsertOneOptions | undefined];
type FindCallArgs<TSchema> = readonly [Filter<TSchema>, FindOptions<TSchemaOrDocument<TSchema>> | undefined];
type AggregateCallArgs = readonly [Document[], AggregateOptions | undefined];
type InsertManyCallArgs<TSchema> = readonly [OptionalUnlessRequiredId<TSchema>[], BulkWriteOptions | undefined];
type UpdateCallArgs<TSchema> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, UpdateOptions | undefined];
type DeleteCallArgs<TSchema> = readonly [Filter<TSchema>, DeleteOptions | undefined];
type DistinctCallArgs<TSchema> = readonly [keyof WithId<TSchema>, Filter<TSchema>, DistinctOptions];
type TSchemaOrDocument<T> = T extends Document ? T : Document;

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
  returns: [],
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
  result: any,
  custom?: Record<string, any>
  isPromise?: boolean
};

type CommonDefinitionWithCaller = CommonDefinition & {
  caller: BeforeAfterEventNames
}

type TopLevelCall<O extends CommonDefinition> = {
  before: ReturnsArgs<BeforeTopLevelEmitArgs<O>>,
  after: ReturnsResult<AfterTopLevelEmitArgs<O>>,
  caller: never
};

type InsertCommon<TSchema, This> = {
  caller: "insertOne" | "insertMany",
  args: InsertManyCallArgs<TSchema> | InsertOneCallArgs<TSchema>,
  thisArg: This,
  result: InsertOneResult<TSchema>,
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
  caller: "updateOne" | "updateMany",
  args: UpdateCallArgs<TSchema>,
  thisArg: This,
  result: UpdateResult,
  custom: {

  },
  isPromise: true
}


type CursorParams<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema> },
  O extends CommonDefinition = {
    args: never,
    thisArg: HookedCursorType,
    result: never,
    isPromise: true
  }
> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  after: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  caller: CO["caller"]
};
type CursorParamsWithResult<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema>, result: any },
  O extends CommonDefinition = {
    args: never,
    thisArg: HookedCursorType
  } & CO
> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  after: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  caller: CO["caller"]
};

type CursorParamsWithArgsAndResult<
  TSchema,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema>, result: any, args: any, isPromise?: boolean },
  O extends CommonDefinition = {
    thisArg: HookedCursorType
  } & CO
> = {
  before: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "argsOrig">
  },
  after: ReturnsResult<AfterInternalEmitArgs<O & CO>>,
  caller: CO["caller"]
};

export type BeforeAfterEventDefinitions<TSchema, This = any> = {
  "cursor.execute": CursorParams<TSchema, HookedFindCursor<any> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.toArray" | "find.cursor.count" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "cursor.asyncIterator",
  }>
  "cursor.next": CursorParamsWithResult<TSchema, HookedFindCursor<any> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "cursor.asyncIterator",
    result: TSchema | null
  }>,
  "cursor.forEach": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<any>, {
    caller: "find" | "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "cursor.asyncIterator": CursorParams<TSchema, HookedFindCursor<any>, {
    caller: "find" | "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "find.cursor.execute": CursorParams<TSchema, HookedFindCursor<any>, {
    caller: "find" | "find.cursor.toArray" | "find.cursor.count" | "find.cursor.forEach" | "find.cursor.asyncIterator"
  }>,
  "find.cursor.next": CursorParamsWithResult<TSchema, HookedFindCursor<any>, {
    caller: "find" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator",
    result: TSchema | null
  }>,
  "find.cursor.toArray": CursorParamsWithResult<TSchema, HookedFindCursor<any>, {
    caller: "find",
    result: TSchema[]
  }>,
  "find.cursor.count": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<any>, {
    caller: "find",
    result: number,
    args: [CountOptions | undefined]
  }>,
  "find.cursor.forEach": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<any>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "find.cursor.asyncIterator": CursorParams<TSchema, HookedFindCursor<any>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,

  "aggregate.cursor.execute": CursorParams<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate"
  }>,
  "aggregate.cursor.next": CursorParamsWithResult<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate",
    result: TSchema | null
  }>,
  "aggregate.cursor.toArray": CursorParamsWithResult<TSchema, HookedAggregationCursor<any>, {
    caller: "aggregate",
    result: TSchema[]
  }>,
  "aggregate.cursor.forEach": CursorParamsWithArgsAndResult<TSchema, HookedAggregationCursor<any>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "aggregate.cursor.asyncIterator": CursorParams<TSchema, HookedAggregationCursor<any>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,

  aggregate: TopLevelCall<{
    args: AggregateCallArgs,
    thisArg: This,
    result: HookedAggregationCursor<any>,
    isPromise: false
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
    caller: "insertOne" | "insertMany",
  },
  deleteOne: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: This,
    result: DeleteResult
  }>,
  delete: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<DeleteCommon<TSchema, This>>, "filter">,
    after: NoReturns<AfterInternalEmitArgs<DeleteCommon<TSchema, This>>>,
    caller: "deleteOne" | "deleteMany",
  },
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: This,
    result: DeleteResult
  }>,
  updateOne: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: This,
    result: UpdateResult
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: This,
    result: UpdateResult
  }>,
  update: {
    before: ReturnsArgs<BeforeInternalEmitArgs<UpdateCommon<TSchema, This>>>,
    after: NoReturns<AfterInternalEmitArgs<UpdateCommon<TSchema, This>>>,
    caller: "updateOne" | "updateMany",
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: This,
    result: any[]
  }>
}

export type BeforeAfterEventNames<limit extends keyof BeforeAfterEventDefinitions<Document> = keyof BeforeAfterEventDefinitions<Document>> = keyof BeforeAfterEventDefinitions<Document> & limit;

export type CallerType<k extends BeforeAfterEventNames = BeforeAfterEventNames> = BeforeAfterEventDefinitions<Document>[k]["caller"]

type BeforeEventDefinitions<TSchema, This> = {
  [k in BeforeAfterEventNames as `before.${k}`]: BeforeAfterEventDefinitions<TSchema, This>[k]["before"]
}

type AfterEventDefinitions<TSchema, This> = {
  [k in BeforeAfterEventNames as `after.${k}`]: BeforeAfterEventDefinitions<TSchema, This>[k]["after"]
}

export type EventDefinitions<TSchema, This> = BeforeEventDefinitions<TSchema, This> & AfterEventDefinitions<TSchema, This>;

export type EventNames<limit extends keyof EventDefinitions<Document, any> = keyof EventDefinitions<Document, any>> = keyof EventDefinitions<Document, any> & limit;
export type BeforeEventNames<limit extends EventNames = keyof BeforeEventDefinitions<Document, any>> = keyof BeforeEventDefinitions<Document, any> & limit;
export type AfterEventNames<limit extends EventNames = keyof AfterEventDefinitions<Document, any>> = keyof AfterEventDefinitions<Document, any> & limit;

type BeforeCallbackArgsAndReturn<TSchema, This> = {
  [k in BeforeEventNames]: {
    callbackArgs:
    {
      /** The original arguments before any hook was applied */
      [rek in BeforeEventDefinitions<TSchema, This>[k]["returnEmitName"] as `${rek}Orig`]: BeforeEventDefinitions<TSchema, This>[k]["returns"]
    } & BeforeEventDefinitions<TSchema, This>[k]["emitArgs"],
    emitArgs: BeforeEventDefinitions<TSchema, This>[k]["emitArgs"],
    returns: BeforeEventDefinitions<TSchema, This>[k]["returns"],
    isPromise: BeforeEventDefinitions<TSchema, This>[k]["isPromise"]
  }
}

type AfterCallbackArgsAndReturn<TSchema, This> = {
  [k in AfterEventNames]: {
    callbackArgs:
    {
      [rek in AfterEventDefinitions<TSchema, This>[k]["returnEmitName"] as `${rek}Orig`]: AfterEventDefinitions<TSchema, This>[k]["returns"]
    } & AfterEventDefinitions<TSchema, This>[k]["emitArgs"],
    emitArgs: AfterEventDefinitions<TSchema, This>[k]["emitArgs"],
    returns: AfterEventDefinitions<TSchema, This>[k]["returns"],
    isPromise: AfterEventDefinitions<TSchema, This>[k]["isPromise"]
  }
}

export type HookedEventMap<TSchema, This> = BeforeCallbackArgsAndReturn<TSchema, This> & AfterCallbackArgsAndReturn<TSchema, This>
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
  "find",
  "aggregate",
  "distinct",
  ...FindCursorEventsSuffixes,
  ...AggregateCursorEventsSuffixes,
  ...GenericCursorEventsSuffixes
] as const


export const Events: {
  before: { [k in BeforeAfterEventNames]: `before.${k}`},
  after: { [k in BeforeAfterEventNames]: `after.${k}`}
} = {
  before: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `before.${key}`])) as { [k in keyof BeforeAfterEventDefinitions<Document>]: `before.${k}`},
  after: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}`])) as { [k in keyof BeforeAfterEventDefinitions<Document>]: `after.${k}`}
}

export const InternalEvents = Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, key])) as { [k in keyof BeforeAfterEventDefinitions<Document>]: k};

export function internalSymbolToBeforeAfterKey<
  K extends BeforeAfterEventNames
>(key: K): { before: BeforeEventNames & `before.${K}`, after: AfterEventNames & `after.${K}` } {
  return {
    before: `before.${key}` as (BeforeEventNames & `before.${K}`),
    after: `after.${key}` as (AfterEventNames & `after.${K}`)
  }
}



export function assertCaller<
  IE extends BeforeAfterEventNames
>(caller: CallerType, internalEvent: IE): asserts caller is CallerType<typeof internalEvent> {

}

