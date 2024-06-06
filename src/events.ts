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
import { ChainedAwaiatableEventEmitter } from "./awaiatableEventEmitter.js";
import { Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ThisArg } from "./commentedTypes.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";

export type InsertOneCallArgs<TSchema extends Document> = readonly [OptionalUnlessRequiredId<TSchema>, InsertOneOptions | undefined];
type FindCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, FindOptions<TSchema> | undefined];
type AggregateCallArgs = readonly [Document[], AggregateOptions | undefined];
type InsertManyCallArgs<TSchema extends Document> = readonly [OptionalUnlessRequiredId<TSchema>[], BulkWriteOptions | undefined];
type UpdateCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, UpdateOptions | undefined];
type DeleteCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, DeleteOptions | undefined];
type DistinctCallArgs<TSchema extends Document> = readonly [keyof WithId<TSchema>, Filter<TSchema>, DistinctOptions];

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
type ReturnsNamedEmitArg<O extends {emitArgs: {[k in Key]: any}, isPromise?: boolean}, Key extends string> = O & {
  returns: O["emitArgs"][Key],
  returnEmitName: Key,
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
  caller: keyof BeforeAfterEventDefinitions<Document, any>
}

type TopLevelCall<O extends CommonDefinition> = {
  before: ReturnsArgs<BeforeTopLevelEmitArgs<O>>,
  after: ReturnsResult<AfterTopLevelEmitArgs<O>>,
  caller: never
};

type InsertCommon<TSchema extends Document> = {
  caller: "insertOne" | "insertMany",
  args: InsertManyCallArgs<TSchema> | InsertOneCallArgs<TSchema>,
  thisArg: HookedCollection<TSchema>,
  result: InsertOneResult<TSchema>,
  custom: {
    /** The document to be inserted */
    doc: OptionalUnlessRequiredId<TSchema>
  },
  isPromise: true
}

type DeleteCommon<TSchema extends Document> = {
  caller: "deleteOne" | "deleteMany",
  args: DeleteCallArgs<TSchema>,
  thisArg: HookedCollection<TSchema>,
  result: DeleteResult,
  custom: {
    /** The ID of the document to be deleted */
    _id: InferIdType<TSchema>,
    /** The filter used to identify the document. Originally this will the main filter, but you can return a mutated version per document. It will be combined with the document ID for the final deletion */
    filter: Filter<TSchema>
  },
  isPromise: true
}

type UpdateCommon<TSchema extends Document> = {
  caller: "updateOne" | "updateMany",
  args: UpdateCallArgs<TSchema>,
  thisArg: HookedCollection<TSchema>,
  result: UpdateResult,
  custom: {

  },
  isPromise: true
}


type CursorParams<
  TSchema extends Document,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema, any> },
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
  TSchema extends Document,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema, any>, result: any },
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
  TSchema extends Document,
  HookedCursorType,
  CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema, any>, result: any, args: any, isPromise?: boolean },
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

export type BeforeAfterEventDefinitions<TSchema extends Document, U> = {
  "cursor.execute": CursorParams<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.toArray" | "find.cursor.count" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "cursor.asyncIterator",
  }>
  "cursor.next": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema> | HookedAggregationCursor<TSchema>, {
    caller: "find" | "aggregate" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "cursor.asyncIterator",
    result: TSchema | U | null
  }>,
  "cursor.forEach": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find" | "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "cursor.asyncIterator": CursorParams<TSchema, HookedFindCursor<TSchema>, {
    caller: "find" | "aggregate",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "find.cursor.execute": CursorParams<TSchema, HookedFindCursor<TSchema>, {
    caller: "find" | "find.cursor.toArray" | "find.cursor.count" | "find.cursor.forEach" | "find.cursor.asyncIterator"
  }>,
  "find.cursor.next": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator",
    result: TSchema | U | null
  }>,
  "find.cursor.toArray": CursorParamsWithResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find",
    result: TSchema[] | U[]
  }>,
  "find.cursor.count": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find",
    result: number,
    args: [CountOptions | undefined]
  }>,
  "find.cursor.forEach": CursorParamsWithArgsAndResult<TSchema, HookedFindCursor<TSchema>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "find.cursor.asyncIterator": CursorParams<TSchema, HookedFindCursor<TSchema>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,

  "aggregate.cursor.execute": CursorParams<TSchema, HookedAggregationCursor<TSchema>, {
    caller: "aggregate"
  }>,
  "aggregate.cursor.next": CursorParamsWithResult<TSchema, HookedAggregationCursor<TSchema>, {
    caller: "aggregate",
    result: TSchema | U | null
  }>,
  "aggregate.cursor.toArray": CursorParamsWithResult<TSchema, HookedAggregationCursor<TSchema>, {
    caller: "aggregate",
    result: TSchema[] | U[]
  }>,
  "aggregate.cursor.forEach": CursorParamsWithArgsAndResult<TSchema, HookedAggregationCursor<TSchema>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "aggregate.cursor.asyncIterator": CursorParams<TSchema, HookedAggregationCursor<TSchema>, {
    caller: "find",
    result: void,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,

  aggregate: TopLevelCall<{
    args: AggregateCallArgs,
    thisArg: HookedCollection<TSchema>,
    result: HookedAggregationCursor<TSchema>,
    isPromise: false
  }>,
  find: TopLevelCall<{
    args: FindCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: HookedFindCursor<TSchema, U>,
    isPromise: false
  }>,
  insertOne: TopLevelCall<{
    args: InsertOneCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: InsertOneResult<TSchema>,
  }>
  insertMany: TopLevelCall<{
    args: InsertManyCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: InsertManyResult<TSchema>,
  }>,
  insert: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<InsertCommon<TSchema>>, "doc">,
    after: NoReturns<AfterInternalEmitArgs<InsertCommon<TSchema>>>,
    caller: "insertOne" | "insertMany",
  },
  deleteOne: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: DeleteResult
  }>,
  delete: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<DeleteCommon<TSchema>>, "filter">,
    after: NoReturns<AfterInternalEmitArgs<DeleteCommon<TSchema>>>,
    caller: "deleteOne" | "deleteMany",
  },
  deleteMany: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: DeleteResult
  }>,
  updateOne: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: UpdateResult
  }>,
  updateMany: TopLevelCall<{
    args: UpdateCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: UpdateResult
  }>,
  update: {
    before: ReturnsArgs<BeforeInternalEmitArgs<UpdateCommon<TSchema>>>,
    after: NoReturns<AfterInternalEmitArgs<UpdateCommon<TSchema>>>,
    caller: "updateOne" | "updateMany",
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: any[]
  }>
}

export type CallerType<k extends keyof BeforeAfterEventDefinitions<Document, any> = keyof BeforeAfterEventDefinitions<Document, any>> = BeforeAfterEventDefinitions<Document, any>[k]["caller"]

type BeforeEventDefinitions<TSchema extends Document, U extends any> = {
  [k in keyof BeforeAfterEventDefinitions<TSchema, U> as `before.${k}`]: BeforeAfterEventDefinitions<TSchema, U>[k]["before"]
}

type AfterEventDefinitions<TSchema extends Document, U extends any> = {
  [k in keyof BeforeAfterEventDefinitions<TSchema, U> as `after.${k}`]: BeforeAfterEventDefinitions<TSchema, U>[k]["after"]
}

export type EventDefinitions<TSchema extends Document, U> = BeforeEventDefinitions<TSchema, U> & AfterEventDefinitions<TSchema, U>;

export type EventNames = keyof EventDefinitions<Document, any>;
export type BeforeEventNames = keyof BeforeEventDefinitions<Document, any>;
export type AfterEventNames = keyof AfterEventDefinitions<Document, any>;

type BeforeCallbackArgsAndReturn<TSchema extends Document, U extends any> = {
  [k in keyof BeforeEventDefinitions<TSchema, U>]: {
    callbackArgs:
    {
      /** The original arguments before any hook was applied */
      [rek in BeforeEventDefinitions<TSchema, U>[k]["returnEmitName"] as `${rek}Orig`]: BeforeEventDefinitions<TSchema, U>[k]["returns"]
    } & BeforeEventDefinitions<TSchema, U>[k]["emitArgs"],
    emitArgs: BeforeEventDefinitions<TSchema, U>[k]["emitArgs"],
    returns: BeforeEventDefinitions<TSchema, U>[k]["returns"],
    isPromise: BeforeEventDefinitions<TSchema, U>[k]["isPromise"]
  }
}

type AfterCallbackArgsAndReturn<TSchema extends Document, U extends any> = {
  [k in keyof AfterEventDefinitions<TSchema, U>]: {
    callbackArgs:
    {
      [rek in AfterEventDefinitions<TSchema, U>[k]["returnEmitName"] as `${rek}Orig`]: AfterEventDefinitions<TSchema, U>[k]["returns"]
    } & AfterEventDefinitions<TSchema, U>[k]["emitArgs"],
    emitArgs: AfterEventDefinitions<TSchema, U>[k]["emitArgs"],
    returns: AfterEventDefinitions<TSchema, U>[k]["returns"],
    isPromise: AfterEventDefinitions<TSchema, U>[k]["isPromise"]
  }
}

export type HookedEventMap<TSchema extends Document, U> = BeforeCallbackArgsAndReturn<TSchema, U> & AfterCallbackArgsAndReturn<TSchema, U>

export class HookedEventEmitter<TSchema extends Document, U extends any> extends ChainedAwaiatableEventEmitter<HookedEventMap<TSchema, U>> {
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
  before: { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `before.${k}`},
  after: { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `after.${k}`}
} = {
  before: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `before.${key}`])) as { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `before.${k}`},
  after: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}`])) as { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `after.${k}`}
}

export const InternalEvents = Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, key])) as { [k in keyof BeforeAfterEventDefinitions<Document, any>]: k};

export function internalSymbolToBeforeAfterKey<
  K extends keyof BeforeAfterEventDefinitions<Document, any>
>(key: K): { before: EventNames & `before.${K}`, after: EventNames & `after.${K}` } {
  return {
    before: `before.${key}` as (EventNames & `before.${K}`),
    after: `after.${key}` as (EventNames & `after.${K}`)
  }
}
