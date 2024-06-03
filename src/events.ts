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
  InferIdType
} from "mongodb"
import { HookedCollection } from "./hookedCollection.js"
import { HookedFindCursor } from "./hookedFindCursor.js";
import { ChainedAwaiatableEventEmitter } from "./awaiatableEventEmitter.js";
import { Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ThisArg } from "./commentedTypes.js";

export type InsertOneCallArgs<TSchema extends Document> = readonly [OptionalUnlessRequiredId<TSchema>, InsertOneOptions | undefined];
type InsertManyCallArgs<TSchema extends Document> = readonly [OptionalUnlessRequiredId<TSchema>[], BulkWriteOptions | undefined];
type UpdateCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, UpdateFilter<TSchema> | Partial<TSchema>, UpdateOptions | undefined];
type DeleteCallArgs<TSchema extends Document> = readonly [Filter<TSchema>, DeleteOptions | undefined];
type DistinctCallArgs<TSchema extends Document> = readonly [keyof WithId<TSchema>, Filter<TSchema>, DistinctOptions];

type ReturnsArgs<O extends {args: ARGS}, ARGS = O["args"]> = O & {
  returns: ARGS,
  returnEmitName: "args"
}
type ReturnsResult<O extends {result: RESULT}, RESULT = O["result"]> = O & {
  returns: RESULT,
  returnEmitName: "result"
}
type ReturnsNamedEmitArg<O extends {emitArgs: {[k in Key]: any}}, Key extends string> = O & {
  returns: O["emitArgs"][Key],
  returnEmitName: Key
}
type NoReturns<O> = O & {
  returns: [],
  returnEmitName: never
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
};

type CommonDefinitionWithCaller = CommonDefinition & {
  caller: keyof BeforeAfterEventDefinitions<Document, any>
}

type TopLevelCall<O extends CommonDefinition> = {
  before: ReturnsArgs<BeforeTopLevelEmitArgs<O>>,
  after: ReturnsResult<AfterTopLevelEmitArgs<O>>
};

type CursorParams<
TSchema extends Document,
CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema, any> },
O extends CommonDefinition = {
  args: never,
  thisArg: HookedFindCursor<TSchema>,
  result: never
}> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  after: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
};


type CursorParamsWithResult<
TSchema extends Document,
U extends any,
CO extends { caller: keyof BeforeAfterEventDefinitions<TSchema, any> },
O extends CommonDefinition = {
  args: never,
  thisArg: HookedFindCursor<TSchema>,
  result: TSchema | U | null,
}> = {
  before: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  after: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
};


type InsertCommon<TSchema extends Document> = {
  caller: "insertOne" | "insertMany",
  args: InsertManyCallArgs<TSchema> | InsertOneCallArgs<TSchema>,
  thisArg: HookedCollection<TSchema>,
  result: InsertOneResult<TSchema>,
  custom: {
    /** The document to be inserted */
    doc: OptionalUnlessRequiredId<TSchema>
  }
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
  }
}

type UpdateCommon<TSchema extends Document> = {
  caller: "updateOne" | "updateMany",
  args: UpdateCallArgs<TSchema>,
  thisArg: HookedCollection<TSchema>,
  result: UpdateResult,
  custom: {

  }
}

export type BeforeAfterEventDefinitions<TSchema extends Document, U> = {
  "cursor.execute": CursorParams<TSchema, {
    caller: "find.cursor.execute"
  }>
  "find.cursor.execute": CursorParams<TSchema, {
    caller: "find.cursor.execute"
  }>,
  "cursor.next": CursorParamsWithResult<TSchema, U, {
    caller: "find.cursor.execute"
  }>,
  "find.cursor.next": CursorParamsWithResult<TSchema, U, {
    caller: "find.cursor.execute"
  }>,
  insertOne: TopLevelCall<{
    args: InsertOneCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: InsertOneResult<TSchema>
  }>
  insertMany: TopLevelCall<{
    args: InsertManyCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: InsertManyResult<TSchema>,
  }>,
  insert: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<InsertCommon<TSchema>>, "doc">,
    after: NoReturns<AfterInternalEmitArgs<InsertCommon<TSchema>>>,
  },
  deleteOne: TopLevelCall<{
    args: DeleteCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: DeleteResult
  }>,
  delete: {
    before: ReturnsNamedEmitArg<BeforeInternalEmitArgs<DeleteCommon<TSchema>>, "filter">,
    after: NoReturns<AfterInternalEmitArgs<DeleteCommon<TSchema>>>,
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
  },
  distinct: TopLevelCall<{
    args: DistinctCallArgs<TSchema>,
    thisArg: HookedCollection<TSchema>,
    result: any[]
  }>
}

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
    returns: BeforeEventDefinitions<TSchema, U>[k]["returns"]
  }
}

type AfterCallbackArgsAndReturn<TSchema extends Document, U extends any> = {
  [k in keyof AfterEventDefinitions<TSchema, U>]: {
    callbackArgs:
    {
      [rek in AfterEventDefinitions<TSchema, U>[k]["returnEmitName"] as `${rek}Orig`]: AfterEventDefinitions<TSchema, U>[k]["returns"]
    } & AfterEventDefinitions<TSchema, U>[k]["emitArgs"],
    emitArgs: AfterEventDefinitions<TSchema, U>[k]["emitArgs"],
    returns: AfterEventDefinitions<TSchema, U>[k]["returns"]
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
  "close"
] as const
type CursorEvents<T extends string | undefined, E extends string> = T extends string ? `${T}.cursor.${E}` : `cursor.${E}`;
function specificAndGenericCursorEvents<T extends string, E extends string>(
  cursorType: T,
  cursorEvents: readonly E[]
): CursorEvents<T | undefined, E>[] {
  return [
    ...cursorEvents.map(event => `cursor.${event}` as CursorEvents<undefined, E>),
    ...cursorEvents.map(event => `${cursorType}.${event}` as CursorEvents<T, E>)
  ];
}
const FindCursorEventsSuffixes = specificAndGenericCursorEvents("find", cursorEvents);
const AggregateCursorEventsSuffixes = specificAndGenericCursorEvents("aggregate", cursorEvents);

export const FindCursorEventsSet = new Set(FindCursorEventsSuffixes.flatMap(eventSuffix => [`before.${eventSuffix}`, `after.${eventSuffix}`]));

const beforeAfterEvents = [
  ...selfOneOrMany("insert"),
  ...selfOneOrMany("delete"),
  ...selfOneOrMany("update"),
  "distinct",
  "aggregate",
  ...FindCursorEventsSuffixes,
  ...AggregateCursorEventsSuffixes,
] as const;

export const Events: {
  before: { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `before.${k}`},
  after: { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `after.${k}`}
} = {
  before: Object.fromEntries(beforeAfterEvents.map(key => [key, `before.${key}`])) as { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `before.${k}`},
  after: Object.fromEntries(beforeAfterEvents.map(key => [key, `after.${key}`])) as { [k in keyof BeforeAfterEventDefinitions<Document, any>]: `after.${k}`}
}

export const InternalEvents = Object.fromEntries(beforeAfterEvents.map(key => [key, key])) as { [k in keyof BeforeAfterEventDefinitions<Document, any>]: k};

export function internalSymbolToBeforeAfterKey<
  K extends keyof BeforeAfterEventDefinitions<Document, any>
>(key: K): { before: EventNames & `before.${K}`, after: EventNames & `after.${K}` } {
  return {
    before: `before.${key}` as (EventNames & `before.${K}`),
    after: `after.${key}` as (EventNames & `after.${K}`)
  }
}
