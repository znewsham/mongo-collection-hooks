import type {
  Document
} from "mongodb"
export { ProjectionOfTSchema, NestedProjectionOfTSchema, FilterOfTSchema } from "mongo-collection-helpers";
import { CallbackAndOptionsOfEm, ChainedAwaiatableEventEmitter, ChainedCallbackEntry, ChainedCallbackEventMap, ChainedListenerCallback } from "../awaiatableEventEmitter.js";
import { SkipDocument } from "./helpersTypes.js";
import { BeforeAfterErrorCollectionEventDefinitions, CollectionBeforeAfterErrorEventDefinitions, CollectionHookedEventMap } from "./collectionEvents.js";
import { BeforeAfterErrorFindOnlyCursorEventDefinitions, FindCursorHookedEventMap } from "./findCursorEvents.js";
import { AggregationCursorHookedEventMap, BeforeAfterErrorAggregationOnlyCursorEventDefinitions } from "./aggregationCursorEvents.js";
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js";
import { BeforeAfterErrorSharedEventDefinitions } from "./sharedEvents.js";
export {
  AmendedInsertOneOptions,
  AmendedBulkWriteOptions,
  AmendedUpdateOptions,
  AmendedDeleteOptions,
  AmendedAggregateOptions,
  AmendedReplaceOptions,
  AmendedDistinctOptions,
  AmendedFindOptions,
  AmendedCountDocumentsOptions,
  AmendedCountOptions,
  AmendedEstimatedDocumentCountOptions,
  AmendedFindOneAndDeleteOptions,
  AmendedFindOneAndReplaceOptions,
  AmendedFindOneAndUpdateOptions,
  AmendedFindOneOptions,
} from "./collectionEvents.js";

export { UpdateCallArgs, ReplaceCallArgs, CollectionHookedEventMap } from "./collectionEvents.js";
export { FindCursorHookedEventMap } from "./findCursorEvents.js";
export { AggregationCursorHookedEventMap } from "./aggregationCursorEvents.js";
export { HookedCollectionInterface } from "./hookedCollectionInterface.js";
export { HookedAggregationCursorInterface } from "./hookedAggregationCursorInterface.js";
export { HookedFindCursorInterface } from "./hookedFindCursorInterface.js";

export { CollectionBeforeAfterErrorEventDefinitions }
export { SkipDocument };


type _BeforeAfterEventNames = keyof BeforeAfterErrorCollectionEventDefinitions<Document>
  | keyof BeforeAfterErrorFindOnlyCursorEventDefinitions<Document>
  | keyof BeforeAfterErrorAggregationOnlyCursorEventDefinitions<Document>
  | keyof BeforeAfterErrorGenericCursorEventDefinitions<Document>
  | keyof BeforeAfterErrorSharedEventDefinitions<Document>;
type BeforeAfterEventNames<limit extends _BeforeAfterEventNames = _BeforeAfterEventNames> = _BeforeAfterEventNames & limit;
export type BeforeAfterEventNamesOfName<k extends string> = `before.${k}` | `after.${k}` | `after.${k}.error` | `after.${k}.success`;

type MapWithCaller={[k in string]: { caller: string | undefined }}

export type GenericCallerType<map extends MapWithCaller, k extends keyof map = keyof map> = map[k]["caller"]
export type CallerType<k extends BeforeAfterEventNames = BeforeAfterEventNames> = CollectionBeforeAfterErrorEventDefinitions<Document>[k]["caller"]



type _EventNames = keyof CollectionHookedEventMap<Document>
  | keyof FindCursorHookedEventMap<Document>
  | keyof AggregationCursorHookedEventMap<Document>;


export type EventNames<limit extends _EventNames = _EventNames> = _EventNames & limit;



export type PartialCallbackMap<K extends keyof EM, EM extends ChainedCallbackEventMap> = {
  [k in K]?: CallbackAndOptionsOfEm<EM, K>[]
}


export type HookedListenerCallback<K extends keyof HEM, HEM extends ChainedCallbackEventMap> = ChainedListenerCallback<HEM, K>


type ChainedCallbackEntryWithCaller = ChainedCallbackEntry & { caller: string | undefined };
export type ChainedCallbackEventMapWithCaller = Record<string, ChainedCallbackEntryWithCaller>

export class HookedEventEmitter<HEM extends ChainedCallbackEventMapWithCaller> extends ChainedAwaiatableEventEmitter<HEM> {
  assertCaller<IE extends keyof HEM>(caller: GenericCallerType<HEM>, eventName: IE): asserts caller is GenericCallerType<HEM, typeof eventName> {

  }
}

type SelfOneOrMany<T extends string> = T | `${T}One` | `${T}Many`;

function selfOneOrMany<T extends string>(keyword: T): SelfOneOrMany<T>[] {
  return [keyword, `${keyword}One`, `${keyword}Many`];
}

const cursorEvents = [
  "execute",
  "next",
  "rewind",
  "close",
  "toArray",
  // "count",
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

const findCursorEvents = [
  ...cursorEvents,
  "count"
] as const;
const FindCursorEventsSuffixes = specificCursorEvents(findCursorEvents, "find.");
const AggregateCursorEventsSuffixes = specificCursorEvents(cursorEvents, "aggregation.");
const GenericCursorEventsSuffixes = specificCursorEvents(cursorEvents, "");

type BeforeAfterNames<K extends string> = `before.${K}` | `after.${K}.success` | `after.${K}.error` | `after.${K}`;
function beforeAfterNames<K extends string>(k: K): BeforeAfterNames<K>[] {
  return [`before.${k}`, `after.${k}.success`, `after.${k}.error`, `after.${k}`];
}

type BeforeAfterGenericCursorNames = BeforeAfterNames<typeof GenericCursorEventsSuffixes[0] | "*">;
type BeforeAferFindCursorNames = BeforeAfterGenericCursorNames | BeforeAfterNames<typeof FindCursorEventsSuffixes[0]>;
type BeforeAfterAggregateCursorNames = BeforeAfterGenericCursorNames | BeforeAfterNames<typeof AggregateCursorEventsSuffixes[0]>
export const FindCursorEventsSet = new Set<BeforeAfterGenericCursorNames | BeforeAferFindCursorNames>([...FindCursorEventsSuffixes, ...GenericCursorEventsSuffixes].flatMap(eventSuffix => beforeAfterNames(eventSuffix)));
export const AggregateCursorEventsSet = new Set<BeforeAfterGenericCursorNames | BeforeAfterAggregateCursorNames>([...AggregateCursorEventsSuffixes, ...GenericCursorEventsSuffixes].flatMap(eventSuffix => beforeAfterNames(eventSuffix)));

const beforeAfterEvents = [
  ...selfOneOrMany("insert"),
  ...selfOneOrMany("delete"),
  ...selfOneOrMany("update"),
  "replaceOne",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOne*",
  "aggregate",
  "distinct",
  "count",
  "countDocuments",
  "estimatedDocumentCount",
  "count*",
  "*",
  ...FindCursorEventsSuffixes,
  ...AggregateCursorEventsSuffixes,
  ...GenericCursorEventsSuffixes
] as const


export const Events: {
  before: { [k in BeforeAfterEventNames]: `before.${k}`},
  afterSuccess: { [k in BeforeAfterEventNames]: `after.${k}.success`},
  afterError: { [k in BeforeAfterEventNames]: `after.${k}.error`},
  after: { [k in BeforeAfterEventNames]: `after.${k}`}
} = {
  before: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `before.${key}`])) as { [k in BeforeAfterEventNames]: `before.${k}`},
  afterSuccess: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}.success`])) as { [k in BeforeAfterEventNames]: `after.${k}.success`},
  afterError: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}.error`])) as { [k in BeforeAfterEventNames]: `after.${k}.error`},
  after: Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, `after.${key}`])) as { [k in BeforeAfterEventNames]: `after.${k}`}
}

export const InternalEvents = Object.fromEntries(beforeAfterEvents.filter(key => typeof key === "string").map(key => [key, key])) as { [k in BeforeAfterEventNames]: k};
export function internalEventToBeforeAfterKey<
  // BAEM extends Record<string, any>,
  K extends string
>(key: K): { before: `before.${K}`, afterSuccess: `after.${K}.success`, afterError: `after.${K}.error`, after: `after.${K}` } {
  return {
    before: `before.${key}`,
    afterSuccess: `after.${key}.success`,
    afterError: `after.${key}.error`,
    after: `after.${key}`
  }
}



export function assertCaller<
  IE extends BeforeAfterEventNames
>(caller: CallerType, internalEvent: IE): asserts caller is CallerType<typeof internalEvent> {

}

export function getAssertCaller<
  BEAD extends MapWithCaller
>() {
  return function assertCaller<IE extends keyof BEAD>(
    caller: GenericCallerType<BEAD>,
    internalEvent: IE
  ): asserts caller is GenericCallerType<BEAD, typeof internalEvent> {

  };
}

export function assertArgs<
  IE extends BeforeAfterEventNames,
  EE extends CollectionBeforeAfterErrorEventDefinitions<any>[BeforeAfterEventNames]["before"]["emitArgs"]= CollectionBeforeAfterErrorEventDefinitions<any>[BeforeAfterEventNames]["before"]["emitArgs"]
>(args: EE extends { args: any } ? EE["args"] : never, internalEvent: IE): asserts args is CollectionBeforeAfterErrorEventDefinitions<any>[typeof internalEvent]["before"]["emitArgs"] extends { args: any } ? CollectionBeforeAfterErrorEventDefinitions<any>[typeof internalEvent]["before"]["emitArgs"]["args"] : never {

}
