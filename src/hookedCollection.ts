import type{
  Collection,
  Document,
  OptionalUnlessRequiredId,
  WithId,
  // Filter,
  UpdateFilter,
  InsertManyResult,
  UpdateResult,
  WithoutId,
  AggregationCursor,
  FindCursor,
  InferIdType,
  DeleteResult,
  InsertOneResult,
  ModifyResult,
  WriteError,
  Condition,
  RootFilterOperators
} from 'mongodb';
import { HookedFindCursor, HookedFindCursorOptions } from "./hookedFindCursor.js";

import {
  CollectionBeforeAfterErrorEventDefinitions,
  EventNames,
  Events,
  FindCursorEventsSet,
  HookedEventEmitter,
  InternalEvents,
  HookedListenerCallback,
  AggregateCursorEventsSet,
  AmendedFindOptions,
  AmendedDistinctOptions,
  AmendedAggregateOptions,
  AmendedInsertOneOptions,
  AmendedBulkWriteOptions,
  AmendedReplaceOptions,
  AmendedUpdateOptions,
  AmendedDeleteOptions,
  NestedProjectionOfTSchema,
  CollectionHookedEventMap,
  HookedCollectionInterface,
  HookedAggregationCursorInterface,
  HookedFindCursorInterface,
  FindCursorHookedEventMap,
  AggregationCursorHookedEventMap,
  SkipDocument,
} from "./events/index.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";
import { AbstractHookedCollection } from "./abstractCollectionImpl.js";
import { getTryCatch } from "./tryCatchEmit.js";
import { unionOfProjections } from 'mongo-collection-helpers';
import { CallbackAndOptionsOfEm, ChainedCallbackEventMap, StandardInvokeHookOptions } from './awaiatableEventEmitter.js';
import { AmendedCountDocumentsOptions, AmendedCountOptions, AmendedEstimatedDocumentCountOptions, AmendedFindOneAndDeleteOptions, AmendedFindOneAndReplaceOptions, AmendedFindOneAndUpdateOptions, AmendedFindOneOptions, CollectionOnlyBeforeAfterErrorEventDefinitions, MaybeStrictFilter, FindOneAndUpdateCallArgs, UpsertCallArgs } from './events/collectionEvents.js';
import { BeforeAfterErrorSharedEventDefinitions } from './events/sharedEvents.js';
import { BulkWriteError, BulkWriteResult } from './bulkError.js';
import { maybeParallel } from './maybeParallel.js';
import { raceSignal } from './raceSignal.js';
import { DocumentCache } from './documentCache.js';

/** A MongoDB filter can be some portion of the schema or a set of operators @public */
type Filter<TSchema> = {
  [P in keyof WithId<TSchema>]?: Condition<WithId<TSchema>[P]>;
} & RootFilterOperators<TSchema>;

function notUndefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}

type TypedUpdateResult<TSchema extends Document> = {
  type: "UpdateResult",
  result: UpdateResult<TSchema>
} | {
  type: "ModifyResult",
  result: ModifyResult<TSchema>
} | {
  type: "Document",
  result: WithId<TSchema> | null
}

type TypedDeleteResult<TSchema extends Document> = {
  type: "DeleteResult",
  result: DeleteResult
} | {
  type: "ModifyResult",
  result: ModifyResult<TSchema>
} | {
  type: "Document",
  result: WithId<TSchema> | null
}

type T = { a: { b: number, c: string } };

interface HookedFindCursorConstructor<TSchema extends Document> {
  new (filter: MaybeStrictFilter<TSchema> | undefined, cursor: FindCursor, chainedOptions: HookedFindCursorOptions<TSchema>): HookedFindCursor
}

type HookedCollectionOptions<TSchema extends Document> = {
  transform?: (doc: any) => any,
  findCursorImpl?: HookedFindCursorConstructor<TSchema>,
  interceptExecute?: boolean
};

export class HookedCollection<
  TSchema extends Document = Document
> extends AbstractHookedCollection<TSchema> implements HookedCollectionInterface<TSchema> {
  #collection: Collection<TSchema>;
  static Events = Events;
  // #transform?: (doc: TSchema) => any;
  #ee: HookedEventEmitter<CollectionHookedEventMap<TSchema>> = new HookedEventEmitter<CollectionHookedEventMap<TSchema>>();
  #interceptExecute: boolean = false;
  #transform: (doc: any) => any = doc => doc;
  #findCursorImpl: HookedFindCursorConstructor<TSchema> = HookedFindCursor;

  constructor(
    collection: Collection<TSchema>,
    chainedOptions?: HookedCollectionOptions<TSchema>
  ) {
    super(collection);
    this.#collection = collection;
    if (chainedOptions?.findCursorImpl) {
      this.#findCursorImpl = chainedOptions.findCursorImpl;
    }
    if (chainedOptions?.interceptExecute) {
      this.#interceptExecute = chainedOptions.interceptExecute;
    }
    if (chainedOptions?.transform) {
      this.#transform = chainedOptions.transform;
    }
    this.init();
  }

  aggregate<T extends Document>(pipeline: Document[], chainedOptions?: AmendedAggregateOptions): AggregationCursor<T> {
    const invocationSymbol = Symbol("aggregate");
    const [chainedPipeline, chainedOptions] = this.#ee.callSyncChainWithKey(
      "before.aggregate",
      {
        args: [pipeline, chainedOptions],
        invocationSymbol,
        signal: chainedOptions?.signal,
        thisArg: this
      },
      "args",
      chainedOptions
    );

    try {
      const actualCursor = this.#collection.aggregate(chainedPipeline, chainedOptions);
      let cursor = new HookedAggregationCursor(
        actualCursor,
        {
          invocationSymbol,
          events: Object.fromEntries(
            this.#ee.eventNames()
            .filter(name => AggregateCursorEventsSet.has(name as keyof AggregationCursorHookedEventMap<any>))
            .map(name => [name, this.#ee.awaitableListenersWithOptions(name)])
          ),
          interceptExecute: this.#interceptExecute
        }
      ) as unknown as HookedAggregationCursorInterface<T>;

      const chainedCursor = this.#ee.callAllSyncChainWithKey(
        {
          args: [chainedPipeline, chainedOptions],
          result: cursor,
          signal: chainedOptions?.signal,
          argsOrig: [pipeline, chainedOptions],
          thisArg: this,
          invocationSymbol
        },
        "result",
        chainedOptions,
        Events.afterSuccess.aggregate,
        Events.after.aggregate
      );
      if (chainedCursor !== undefined) {
        cursor = chainedCursor;
      }

      return chainedCursor as unknown as HookedAggregationCursor<T>;
    }
    catch (e) {
      this.#ee.callAllSync(
        {
          args: [chainedPipeline, chainedOptions],
          error: e,
          signal: chainedOptions?.signal,
          argsOrig: [pipeline, chainedOptions],
          thisArg: this,
          invocationSymbol
        },
        chainedOptions,
        Events.afterError.aggregate,
        Events.after.aggregate,
      );
      throw e;
    }
  }

  /**
   * This function should be used exclusively to allow for instrumentation
   * it should be called at most once and calling this arbitrarily at runtime has undefined behaviour
   * it's expected to be used as follows: myCollection._setCollection(instrument(myCollection.rawCollection()))
   * this can be combined with patching the AbstractHookedCollection's init to ensure that all collections created will have an instrumented base collection
   * @param collection the collection to use
   */
  _setCollection(collection: Collection<TSchema>) {
    this.#collection = collection;
    super._setCollection(collection);
  }

  rawCollection() {
    return this.#collection;
  }

  distinct<Key extends keyof WithId<TSchema>>(
    key: Key,
    filter: MaybeStrictFilter<TSchema> = {},
    chainedOptions: AmendedDistinctOptions = {}
  ) {
    return this.#tryCatchEmit(
      InternalEvents.distinct,
      { args: [key, filter, chainedOptions] },
      "args",
      ({ beforeHooksResult: [key, filter, chainedOptions] }) => raceSignal(chainedOptions?.signal, this.#collection.distinct(key, filter as Filter<TSchema>, chainedOptions)),
      chainedOptions
    );
  }

  findOne<T extends Document = TSchema>(filter?: MaybeStrictFilter<TSchema>, chainedOptions?: AmendedFindOneOptions<TSchema> | undefined): Promise<T | null> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [filter, chainedOptions],
        operation: "findOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.findOne,
        { args: [filter, chainedOptions] },
        "args",
        async ({ beforeHooksResult: [chainedFilter, chainedOptions] }) => {
          if (chainedFilter && chainedOptions) {
            const ret = await raceSignal(chainedOptions?.signal, this.#collection.findOne<T>(chainedFilter as Filter<TSchema>, chainedOptions));
            return ret && this.#transform(ret);
          }
          if (chainedFilter) {
            const ret = await raceSignal(chainedOptions?.signal, this.#collection.findOne<T>(chainedFilter as Filter<TSchema>));
            return ret && this.#transform(ret);
          }
          const ret = await raceSignal(chainedOptions?.signal, this.#collection.findOne<T>());
          return ret && this.#transform(ret);
        },
        chainedOptions,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOne"
          }
        }
      ),
      chainedOptions
    );
  }

  #find<T extends Document = TSchema>(filter?: MaybeStrictFilter<TSchema>, chainedOptions?: AmendedFindOptions<TSchema>): FindCursor<T> {
    if (filter && chainedOptions) {
      return this.#collection.find<T>(filter as Filter<TSchema>, chainedOptions);
    }
    else if (filter) {
      return this.#collection.find<T>(filter as Filter<TSchema>);
    }
    return this.#collection.find() as unknown as FindCursor<T>;
  }

  find<T extends Document = TSchema>(filter: MaybeStrictFilter<TSchema> = {}, chainedOptions?: AmendedFindOptions<TSchema>): HookedFindCursor<T> {
    const invocationSymbol = Symbol("find");
    const [chainedFilter, chainedOptions] = this.#ee.callSyncChainWithKey(
      Events.before.find,
      {
        args: [filter, chainedOptions],
        thisArg: this,
        signal: chainedOptions?.signal,
        invocationSymbol
      },
      "args",
      chainedOptions
    );
    try {
      const actualCursor = this.#find<T>(chainedFilter as Filter<TSchema>, chainedOptions);
      // we need as X here because it's hard (impossible) to make the args aware of the custom T used by find vs TSchema of the collection
      let cursor = new this.#findCursorImpl(
        chainedFilter as Filter<TSchema>,
        actualCursor,
        {
          // transform: this.#transform,
          interceptExecute: this.#interceptExecute,
          invocationSymbol,
          events: Object.fromEntries(
            this.#ee.eventNames()
            .filter(name => FindCursorEventsSet.has(name as keyof FindCursorHookedEventMap<any>))
            .map(name => [name, this.#ee.awaitableListenersWithOptions(name)])
          ),
          invocationOptions: chainedOptions,
          transform: this.#transform
        }
      ) as HookedFindCursorInterface<T>;

      const chainedCursor = this.#ee.callAllSyncChainWithKey(
        {
          args: [chainedFilter, chainedOptions],
          result: cursor,
          signal: chainedOptions?.signal,
          argsOrig: [filter, chainedOptions],
          thisArg: this,
          invocationSymbol
        },
        "result",
        chainedOptions,
        Events.afterSuccess.find,
        Events.after.find
      );
      if (chainedCursor !== undefined) {
        cursor = chainedCursor;
      }
      return cursor as unknown as HookedFindCursor<T>;
    }
    catch (e) {
      this.#ee.callAllSyncChainWithKey(
        {
          args: [chainedFilter, chainedOptions],
          error: e,
          signal: chainedOptions?.signal,
          argsOrig: [filter, chainedOptions],
          thisArg: this,
          invocationSymbol
        },
        undefined,
        chainedOptions,
        Events.afterError.find,
        Events.after.find,
      );
      throw e;
    }
  }

  async #tryCatchEmit<
    HEM extends CollectionHookedEventMap<TSchema>,
    // TODO: clean this up - ties into tryCatchEmit.ts
    T extends (callArgs: HEM[BE]["emitArgs"]["args"] extends never
      ? { invocationSymbol: symbol }
      : HEM[BE] extends { returns: any }
        ? { invocationSymbol: symbol, beforeHooksResult: HEM[BE]["returns"] }
        : { invocationSymbol: symbol }
      ) => Promise<HEM[AE]["emitArgs"]["result"]>,
    BE extends `before.${IE}` & keyof HEM,
    AE extends `after.${IE}` & keyof HEM,
    IE extends keyof CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema> | keyof BeforeAfterErrorSharedEventDefinitions<TSchema>,
    // TODO: this is a bit of a hack. It stops us getting typeerrors on things like findOne*
    OIE extends keyof CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema> | keyof BeforeAfterErrorSharedEventDefinitions<TSchema>,
    EA extends HEM[BE]["emitArgs"],
    OEA extends Omit<EA, "invocationSymbol" | "thisArg" | "signal">
  >(
    internalEvent: IE,
    emitArgs: OEA,
    beforeChainKey: (keyof OEA & HEM[BE]["returnEmitName"]) | undefined,
    fn: T,
    invocationOptions: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, `before.${IE}` | `after.${IE}.success`> | undefined,
    ...additionalInternalEvents: OIE[] | { event: OIE, emitArgs: Partial<HEM[`before.${OIE}`]["emitArgs"]> }[]
  ): Promise<Awaited<ReturnType<T>>> {
    let {
      args,
      caller,
      ...remainingEmitArgs
    } = emitArgs as OEA & {
      args: EA["args"] extends never ? undefined : EA["args"],
      caller: HEM[BE]["caller"] extends never ? undefined : HEM[BE]["caller"]
    };
    const tryCatchEmit = getTryCatch<CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema> & BeforeAfterErrorSharedEventDefinitions<TSchema>>();
    return tryCatchEmit(
      this.#ee,
      fn,
      caller,
      args,
      // @ts-expect-error
      {
        ...remainingEmitArgs,
        thisArg: this,
      },
      true,
      true,
      beforeChainKey,
      invocationOptions,
      internalEvent,
      ...additionalInternalEvents
    )
  }

  insertOne(doc: OptionalUnlessRequiredId<TSchema>, chainedOptions?: AmendedInsertOneOptions): Promise<InsertOneResult<TSchema>> {
    const argsOrig = [doc, chainedOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "insertOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.insertOne,
        { args: [doc, chainedOptions] },
        "args",
        ({
          invocationSymbol,
          beforeHooksResult: [chainedDoc, chainedOptions]
        }) => this.#tryCatchEmit(
          InternalEvents.insert,
          {
            args: [chainedDoc, chainedOptions],
            argsOrig,
            parentInvocationSymbol: invocationSymbol,
            doc: chainedDoc,
            caller: "insertOne"
          },
          "doc",
          async ({
            beforeHooksResult,
          }) => {
            if (beforeHooksResult === SkipDocument) {
              return {
                acknowledged: false,
                insertedId: null as unknown as InferIdType<TSchema>
              };
            }
            return raceSignal(chainedOptions?.signal, this.#collection.insertOne(beforeHooksResult, chainedOptions))
          },
          chainedOptions
        ),
        chainedOptions
      ),
      chainedOptions
    );
  }

  insertMany(docs: OptionalUnlessRequiredId<TSchema>[], chainedOptions?: AmendedBulkWriteOptions) {
    const argsOrig = [docs, chainedOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "insertMany"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.insertMany,
        { args: argsOrig },
        "args",
        async ({
          invocationSymbol: parentInvocationSymbol,
          beforeHooksResult: [chainedDocs, chainedOptions]
        }) => {
          const beforeHooks = this.#ee.relevantAwaitableListenersWithOptions(Events.before.insert, chainedOptions);
          const afterSuccessHooks = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess.insert, chainedOptions);
          const afterErrorHooks = this.#ee.relevantAwaitableListenersWithOptions(Events.afterError.insert, chainedOptions);
          const afterHooks = this.#ee.relevantAwaitableListenersWithOptions(Events.after.insert, chainedOptions);
          const hasBefore = !!beforeHooks.length;
          const hasAfter = !!afterSuccessHooks.length || !!afterHooks.length;
          const hasAfterError = !!afterErrorHooks.length || !afterHooks.length;
          if (!hasBefore && !hasAfter) {
            return raceSignal(chainedOptions?.signal, this.#collection.insertMany(chainedDocs, chainedOptions));
          }
          else {
            const docMap = new Map<OptionalUnlessRequiredId<TSchema>, { invocationSymbol: symbol, doc: OptionalUnlessRequiredId<TSchema> | typeof SkipDocument }>();
            if (hasBefore) {
              chainedDocs = (await Promise.all(chainedDocs.map(async (doc, index) => {
                const invocationSymbol = Symbol("insert");
                const ret = await this.#ee.callAwaitableChainWithKey(
                  Events.before.insert,
                  {
                    caller: "insertMany",
                    doc,
                    signal: chainedOptions?.signal,
                    parentInvocationSymbol,
                    args: [chainedDocs, chainedOptions],
                    argsOrig,
                    invocationSymbol,
                    thisArg: this
                  },
                  "doc",
                  chainedOptions
                );
                docMap.set(doc, {
                  invocationSymbol,
                  doc: ret
                });
                return ret;
              }))).filter(doc => doc !== SkipDocument) as OptionalUnlessRequiredId<TSchema>[];
            }
            let ret: InsertManyResult<TSchema> | Promise<InsertManyResult<TSchema>>;
            try {
              if (chainedDocs.length) {
                ret = raceSignal(chainedOptions?.signal, this.#collection.insertMany(chainedDocs, chainedOptions));
              }
              else {
                ret = {
                  acknowledged: false,
                  insertedCount: 0,
                  insertedIds: {}
                };
              }
              if (hasAfterError) {
                ret = await ret;
              }
            }
            catch (e) {
              if (hasAfterError) {
                // TODO: when ordered=true, some inserts may have succeeded.
                // We'd need to determine the ones that did, call the success
                await Promise.all(chainedDocs.map((docOrig, i) => {
                  const { invocationSymbol, doc } = docMap.get(docOrig) || {};
                  if (!doc || !invocationSymbol) {
                    throw new Error("Impossible!");
                  }
                  if (doc === SkipDocument) {
                    return;
                  }
                  this.#ee.callAllAwaitableInParallel(
                  {
                    args: [chainedDocs, chainedOptions],
                    argsOrig,
                    caller: "insertMany",
                    doc,
                    signal: chainedOptions?.signal,
                    error: e,
                    invocationSymbol,
                    parentInvocationSymbol,
                    thisArg: this
                  },
                  undefined,
                  Events.afterError.insert,
                  Events.after.insert
                );
                }));
              }
              throw e;
            }
            if (hasAfter) {
              const retToUse = await ret;
              await Promise.all(chainedDocs.map((docOrig, i) => {
                const { invocationSymbol, doc } = docMap.get(docOrig) || {};
                if (!doc || !invocationSymbol) {
                  throw new Error("Impossible!");
                }
                if (doc === SkipDocument) {
                  return;
                }
                return this.#ee.callAllAwaitableChainWithKey(
                  {
                    caller: "insertMany",
                    args: [chainedDocs, chainedOptions],
                    doc,
                    signal: chainedOptions?.signal,
                    argsOrig: [chainedDocs, chainedOptions],
                    result: {
                      acknowledged: retToUse.acknowledged,
                      insertedId: doc._id // is this right? will the resultant insertId ever be different? Are the indexes in order? I kinda doubt it
                    },
                    parentInvocationSymbol,
                    invocationSymbol,
                    thisArg: this
                  },
                  "result",
                  chainedOptions,
                  Events.afterSuccess.insert,
                  Events.after.insert
                );
              }));
            }
            return ret;
          }
        },
        chainedOptions
      ),
      chainedOptions
    );
  }

  async #upsert<
    CA extends {
      [k in ("updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace")]: {
        caller: k,
        args: CollectionHookedEventMap<TSchema>[`before.${k}`]["emitArgs"]["args"]
      }
    }
  >(
    caller: ("updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace"),
    parentInvocationSymbol: symbol,
    argsOrig: UpsertCallArgs<TSchema, typeof caller>,
    args: UpsertCallArgs<TSchema, typeof caller>,
    fn: ({ caller, args }: CA[("updateOne" | "updateMany" | "replaceOne" | "findOneAndUpdate" | "findOneAndReplace")]) => Promise<TypedUpdateResult<TSchema>>,
    chainedOptions: StandardInvokeHookOptions<any, any> | undefined,// QUESTIONable
    doc: OptionalUnlessRequiredId<TSchema> = {} as OptionalUnlessRequiredId<TSchema>,
  ): Promise<TypedUpdateResult<TSchema>> {
    let inner: TypedUpdateResult<TSchema>;
    await this.#tryCatchEmit(
      InternalEvents.insert,
      {
        args,
        argsOrig,
        doc,
        caller,
        parentInvocationSymbol
      },
      "doc",
      async ({
        beforeHooksResult: doc // QUESTION - can we apply the doc? It might be a modifier
      }) => {
        inner = await fn({
          caller,
          args
        } as CA[typeof caller]);
        if (inner.type === "ModifyResult") {
          return {
            acknowledged: true,
            insertedId: inner.result.value?._id as InferIdType<TSchema>
          };
        }
        if (inner.type === "Document") {
          return {
            acknowledged: true,
            insertedId: inner.result?._id as InferIdType<TSchema>
          };
        }
        return inner.result;
      },
      chainedOptions,
    );
    // @ts-expect-error it *HAS* been assigned
    return inner;
  }

  // TODO: rework this entire function - it's henously complicated.
  async #tryCatchDelete<
    BEAD extends CollectionBeforeAfterErrorEventDefinitions<TSchema>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: CollectionBeforeAfterErrorEventDefinitions<TSchema>["delete"]["before"]["returns"] }) => Promise<TypedDeleteResult<TSchema>>,
    T1 extends (ids?: InferIdType<TSchema>[]) => Promise<TypedDeleteResult<TSchema>>,
    BEA extends BEAD["delete"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, "before.delete" | "after.delete.success" | "after.delete.error" | "after.delete">,
    ids?: InferIdType<TSchema>[]
  ): Promise<Awaited<ReturnType<T1>>["result"]> {
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before.delete, invocationOptions)
    .filter(({ chainedOptions: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun({
        argsOrig: beforeEmitArgs.argsOrig,
        thisArg: this
      });
    });
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess.delete, invocationOptions)
    .filter(({ chainedOptions: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun({
        argsOrig: beforeEmitArgs.argsOrig,
        thisArg: this
      });
    });
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after.delete, invocationOptions)
    .filter(({ chainedOptions: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun({
        argsOrig: beforeEmitArgs.argsOrig,
        thisArg: this
      });
    });
    const isBeforeGreedy = beforeListenersWithOptions.map(({ chainedOptions }) => chainedOptions?.greedyFetch).reduce((a, b) => a || b, false) as boolean;
    const beforeProjections = beforeListenersWithOptions.map(({ chainedOptions }) => chainedOptions?.projection).filter(notUndefined).map(a => typeof a === "function" ? a({
      argsOrig: beforeEmitArgs.argsOrig,
      thisArg: this
    }) : a);
    const allAfterListenersWithOptions = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions];
    const fetchPrevious = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].some(({ chainedOptions }) => chainedOptions?.fetchPrevious);
    const fetchPreviousProjections = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ chainedOptions }) => chainedOptions?.fetchPreviousProjection).filter(notUndefined).map(a => typeof a === "function" ? a({
      argsOrig: beforeEmitArgs.argsOrig,
      thisArg: this
    }) : a);
    const isCacheWarmed = isBeforeGreedy || fetchPrevious;
    const alwaysAttemptOperation = !!beforeEmitArgs.args[1]?.alwaysAttemptOperation;

    const beforeProjection = unionOfProjections([...beforeProjections, ...fetchPreviousProjections]);
    if (beforeListenersWithOptions.length === 0 && allAfterListenersWithOptions.length === 0) {
      invocationOptions?.signal?.throwIfAborted();
      return (await noListenersFn()).result;
    }
    if (Object.hasOwnProperty.call(beforeProjection, "_id") && !beforeProjection._id) {
      delete beforeProjection["_id"];
    }
    const sort = beforeEmitArgs.args[1]?.["sort"];
    invocationOptions?.signal?.throwIfAborted();
    const cursor = (ids !== undefined && !isCacheWarmed) ? {
      i: 0,
      next() {
        const id = ids[this.i++];
        if (id) {
          return { _id: id };
        }
        return null;
      }
    } : this.#collection.find<{ _id: any }>(
      beforeEmitArgs.args[0] as Filter<TSchema>,
      {
        projection: isCacheWarmed ? beforeProjection : { _id: 1 },
        limit,
        ...(sort && { sort })
      }
    );
    // QUESTION: Why can't I use Awaited<RetT>
    let result: DeleteResult | WithId<TSchema> | ModifyResult<TSchema> | null = {
      acknowledged: false,
      deletedCount: 0
    };
    const beforeDocumentCache = new DocumentCache(this.#collection, beforeProjection as NestedProjectionOfTSchema<TSchema>, isBeforeGreedy, invocationOptions?.signal);
    const invocationSymbol = Symbol("delete");
    const attemptedIds: InferIdType<TSchema>[] = [];

    const ordered = (beforeEmitArgs.args.slice(-1)[0] as AmendedDeleteOptions | undefined)?.ordered !== false;
    invocationOptions?.signal?.throwIfAborted();
    const errors = await maybeParallel(
      async (nextItem) => {
        const { _id } = nextItem;
        if (alwaysAttemptOperation) {
          attemptedIds.push(nextItem._id);
        }
        if (isBeforeGreedy) {
          beforeDocumentCache.setDocument(nextItem._id, nextItem as unknown as WithId<TSchema>);
        }
        let chainedFilter: Filter<TSchema> | typeof SkipDocument = beforeEmitArgs.filter as Filter<TSchema>;
        try {
          chainedFilter = (await this.#ee.callExplicitAwaitableListenersChainWithKey(
            Events.before.delete,
            {
              ...beforeEmitArgs,
              invocationSymbol,
              _id,
              getDocument: () => beforeDocumentCache.getDocument(_id),
              thisArg: this
            },
            "filter",
            beforeListenersWithOptions,
            invocationOptions?.signal
          )) as Filter<TSchema> | typeof SkipDocument;
        }
        catch (error) {
          return {
            type: ordered ? "Break" : "Continue",
            error
          };
        }

        let gotResult = false;
        try {
          invocationOptions?.signal?.throwIfAborted();
          let partialResult = await perDocFn({
            _id,
            beforeHooksResult: chainedFilter,
            invocationSymbol
          });
          invocationOptions?.signal?.throwIfAborted();
          if (chainedFilter === SkipDocument) {
            return {
              type: "Continue"
            };
          }
          gotResult = true;
          const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
            Events.afterSuccess.delete,
            // I'm not sure how to do this cleanly
            // the goal was to enforce type checking of caller + result between delete<one|many> and findOneAndDelete
            // since their results are very different shapes. But the goal is for that to work *on the callback* not here.
            // @ts-expect-error
            {
              ...beforeEmitArgs,
              invocationSymbol,
              previousDocument: isCacheWarmed ? await beforeDocumentCache.getDocument(_id) : undefined,
              _id,
              thisArg: this,
              result: partialResult.result,
            },
            "result",
            allAfterListenersWithOptions,
            invocationOptions?.signal
          );
          if (chainedResult !== undefined) {
            partialResult.result = chainedResult;
          }

          // things get super messy here. deleteOne and deleteMany perDoc return a deleteOne result
          // in the case of deleteMany this needs to be accumulated.
          // findOneAndDelete returns a projected doc, a ModifyResult or null
          if (partialResult.type === "DeleteResult") {
            if (partialResult.result.acknowledged) {
              // @ts-expect-error TODO: why does this not work, but almost identical code in #tryCatchUpdate does - result *WILL* be defined and the correct shape because only findOneAndDelete can set it to anything other than DeleteResult
              result.acknowledged = true;
            }
            if (partialResult.result.deletedCount) {
              // @ts-expect-error TODO: why does this not work, but almost identical code in #tryCatchUpdate does - result *WILL* be defined and the correct shape because only findOneAndDelete can set it to anything other than DeleteResult
              result.deletedCount += partialResult.result.deletedCount;
            }
          }
          else {
            result = partialResult.result;
          }
          return {
            type: "Continue"
          };
        }
        catch (e) {
          if (gotResult) {
            return {
              type: ordered ? "Break" : "Continue",
              error: e
            };
          }
          await this.#ee.callAllAwaitableInParallel(
            {
              ...beforeEmitArgs,
              invocationSymbol,
              previousDocument: isCacheWarmed ? await beforeDocumentCache.getDocument(_id) : undefined,
              thisArg: this,
              _id,
              error: e,
            },
            invocationOptions,
            Events.afterError.delete,
            Events.after.delete
          );
          return {
            type: ordered ? "Break" : "Continue",
            error: e
          };
        }
      },
      cursor,
      ordered,
      (beforeEmitArgs.args?.slice(-1)[0] as AmendedDeleteOptions | undefined)?.hookBatchSize,
      invocationOptions?.signal
    );
    if (errors.length && limit === 1) {
      throw errors[0];
    }
    if (errors.length) {
      throw new BulkWriteError(
        "There were write errors",
        new BulkWriteResult({
          ok: 0,
          insertedCount: 0,
          upsertedCount: 0,
          matchedCount: 0,
          modifiedCount: 0,
          // NOT @ts-expect-error - even though it should be, result could in theory be ModifyResult or Document - but not when limit=1
          deletedCount: result?.deletedCount,
          upsertedIds: {},
          insertedIds: {}
        }, errors as WriteError[])
      );
    }
    if (alwaysAttemptOperation && (limit !== 1 || attemptedIds.length === 0)) {
      invocationOptions?.signal?.throwIfAborted();
      const partialResult = await noListenersFn(attemptedIds);
      if (partialResult.type === "DeleteResult") {
        const res = result as unknown as DeleteResult;
        res.acknowledged = res.acknowledged || partialResult.result.acknowledged;
        res.deletedCount += partialResult.result.deletedCount;
      }
      else if (partialResult.type === "ModifyResult") {
        const res = result as unknown as ModifyResult;
        if (!res.value) {
          result = partialResult.result;
        }
      }
      else if (partialResult.type === "Document") {
        if (!result) {
          result = partialResult.result;
        }
      }
    }
    return result;
  }

  async #tryCatchUpdate<
    BEAD extends CollectionBeforeAfterErrorEventDefinitions<TSchema>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: BEAD["update"]["before"]["returns"] }) => Promise<TypedUpdateResult<TSchema>>,
    T1 extends (ids?: InferIdType<TSchema>[], result?: TypedUpdateResult<TSchema>) => Promise<TypedUpdateResult<TSchema>>,
    BEA extends BEAD["update"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, "before.update" | "after.update.success" | "after.update.error" | "after.update">,
    ids?: InferIdType<TSchema>[]
  ): Promise<Awaited<ReturnType<T1>>["result"]> {
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before.update, invocationOptions)
    .filter(({ chainedOptions: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun({
        argsOrig: beforeEmitArgs.argsOrig,
        thisArg: this
      });
    });
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess.update, invocationOptions)
    .filter(({ chainedOptions: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun({
        argsOrig: beforeEmitArgs.argsOrig,
        thisArg: this
      });
    });
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after.update, invocationOptions)
    .filter(({ chainedOptions: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun({
        argsOrig: beforeEmitArgs.argsOrig,
        thisArg: this
      });
    });

    const isBeforeGreedy = beforeListenersWithOptions.map(({ chainedOptions }) => chainedOptions?.greedyFetch).reduce((a, b) => a || b, false) as boolean;
    const beforeProjections = beforeListenersWithOptions.map(({ chainedOptions }) => chainedOptions?.projection).filter(notUndefined).map(a => typeof a === "function" ? a({
      argsOrig: beforeEmitArgs.argsOrig,
      thisArg: this
    }) : a);

    const afterProjections = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ chainedOptions }) => chainedOptions?.projection).filter(notUndefined).map(a => typeof a === "function" ? a({
      argsOrig: beforeEmitArgs.argsOrig,
      thisArg: this
    }) : a);
    const allAfterListenersWithOptions = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions];
    const fetchPrevious = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].some(({ chainedOptions }) => chainedOptions?.fetchPrevious);
    const fetchPreviousProjections = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ chainedOptions }) => chainedOptions?.fetchPreviousProjection).filter(notUndefined).map(a => typeof a === "function" ? a({
      argsOrig: beforeEmitArgs.argsOrig,
      thisArg: this
    }) : a);


    const beforeProjection = unionOfProjections([...beforeProjections, ...fetchPreviousProjections]);
    if (beforeListenersWithOptions.length === 0 && allAfterListenersWithOptions.length === 0) {
      invocationOptions?.signal?.throwIfAborted();
      return (await noListenersFn()).result;
    }
    if (Object.hasOwnProperty.call(beforeProjection, "_id") && !beforeProjection._id) {
      delete beforeProjection["_id"];
    }
    const isCacheWarmed = isBeforeGreedy || fetchPrevious;
    invocationOptions?.signal?.throwIfAborted();
    const cursor = (ids !== undefined && !isCacheWarmed) ? {
      i: 0,
      next() {
        const id = ids[this.i++];
        if (id) {
          return { _id: id };
        }
        return null;
      }
    } : this.#collection.find<{ _id: any }>(
      beforeEmitArgs.args[0] as Filter<TSchema>,
      {
        projection: isCacheWarmed ? beforeProjection : { _id: 1 },
        limit
      }
    );
    let nextItem = await cursor.next();
    const alwaysAttemptOperation = !!beforeEmitArgs.args[2]?.alwaysAttemptOperation;
    let result: UpdateResult<TSchema> | Document | ModifyResult<TSchema> | WithId<TSchema> | null = {
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null
    };
    if (!nextItem) {
      if (beforeEmitArgs.args[2]?.upsert) {
        const upsertResult = await this.#upsert(
          beforeEmitArgs.caller,
          beforeEmitArgs.parentInvocationSymbol,
          beforeEmitArgs.argsOrig as UpsertCallArgs<TSchema, typeof beforeEmitArgs.caller>,
          beforeEmitArgs.args as UpsertCallArgs<TSchema, typeof beforeEmitArgs.caller>,
          async({ caller, args }) => {
            invocationOptions?.signal?.throwIfAborted();
            // for whatever reason, destructuring arrays means you lose type inferrence of those items
            // const [chainedFilter, chainedModifier, chainedOptions] = args;
            if (caller === "replaceOne") {
              return {
                type: "UpdateResult",
                result: await raceSignal(invocationOptions?.signal, this.#collection.replaceOne(args[0] as Filter<TSchema>, args[1], args[2])) as UpdateResult<TSchema>
              };
            }
            else if (caller === "updateOne") {
              return {
                type: "UpdateResult",
                result: await raceSignal(invocationOptions?.signal, this.#collection.updateOne(args[0] as Filter<TSchema>, args[1], args[2]))
              };
            }
            else if (caller === "updateMany") {
              return {
                type: "UpdateResult",
                result: await raceSignal(invocationOptions?.signal, this.#collection.updateMany(args[0] as Filter<TSchema>, args[1], args[2]))
              };
            }
            else if (caller === "findOneAndUpdate") {
              if (args[2]) {
                // fucking typescript bullshit - yeah, it really is this stupid.
                if (args[2].includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: await raceSignal(invocationOptions?.signal, this.#collection.findOneAndUpdate(args[0] as Filter<TSchema>, args[1], { ...args[2], includeResultMetadata: false }))
                  };
                }
                return {
                  // CAREFUL - apparently this defaults to true NOW, but will default to false in a future release... fun
                  type: "ModifyResult",
                  result: await raceSignal(invocationOptions?.signal, this.#collection.findOneAndUpdate(args[0] as Filter<TSchema>, args[1], args[2]))
                };
              }
              return {
                type: "ModifyResult",
                result: await raceSignal(invocationOptions?.signal, this.#collection.findOneAndUpdate(args[0] as Filter<TSchema>, args[1]))
              };
            }
            else if (caller === "findOneAndReplace") {
              if (args[2]) {
                // fucking typescript bullshit - yeah, it really is this stupid.
                if (args[2].includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: await raceSignal(invocationOptions?.signal, this.#collection.findOneAndReplace(args[0] as Filter<TSchema>, args[1], { ...args[2], includeResultMetadata: false }))
                  };
                }
                return {
                  // CAREFUL - apparently this defaults to true NOW, but will default to false in a future release... fun
                  type: "ModifyResult",
                  result: await raceSignal(invocationOptions?.signal, this.#collection.findOneAndReplace(args[0] as Filter<TSchema>, args[1], args[2]))
                };
              }
              return {
                type: "ModifyResult",
                result: await raceSignal(invocationOptions?.signal, this.#collection.findOneAndReplace(args[0] as Filter<TSchema>, args[1]))
              };
            }
            throw new Error("Unrecognized caller");
          },
          invocationOptions,
          beforeEmitArgs.caller === "replaceOne" ? beforeEmitArgs[1] : undefined
        );
        // in the case of updateOne, updateMany or replaceOne, the result should always be an `UpdateResult` (despite replaceOne claiming it can return a Document)
        // in the case of findOneAnd*, it could be ModifyResult, WithId<TSchema> or null
        // but we're duck typing for functionality here - god help us if we ever (for some reason) have a document in the DB with `upsertedId`
        if (upsertResult.type === "UpdateResult") {
          if (upsertResult.result.upsertedId) {
            result.upsertedCount++;
            result.upsertedId = upsertResult.result.upsertedId;
          }
        }
        else {
          result = upsertResult.result;
        }
      }

      if (alwaysAttemptOperation) {
        invocationOptions?.signal?.throwIfAborted();
        return (await noListenersFn()).result;
      }

      // TODO: why is this necessary? They are the same
      return result as Awaited<ReturnType<T1>>["result"];
    }
    const attemptedIds: InferIdType<TSchema>[] = [];
    const beforeDocumentCache = new DocumentCache(this.#collection, beforeProjection as NestedProjectionOfTSchema<TSchema>, isCacheWarmed, invocationOptions?.signal);
    const afterDocumentCache = new DocumentCache(this.#collection, unionOfProjections(afterProjections), false, invocationOptions?.signal);
    const invocationSymbol = Symbol("update");

    const ordered = (beforeEmitArgs.args.slice(-1)[0] as AmendedUpdateOptions | undefined)?.ordered !== false;
    const errors = await maybeParallel(
      async (nextItem) => {
        if (alwaysAttemptOperation) {
          attemptedIds.push(nextItem._id);
        }
        if (isCacheWarmed) {
          beforeDocumentCache.setDocument(nextItem._id, nextItem as unknown as WithId<TSchema>);
        }
        const { _id } = nextItem;
        let chainedArgs: typeof beforeEmitArgs.filterMutator | typeof SkipDocument = beforeEmitArgs.filterMutator;
        try {
          chainedArgs = await this.#ee.callExplicitAwaitableListenersChainWithKey(
            Events.before.update,
            {
              ...beforeEmitArgs,
              invocationSymbol,
              _id,
              getDocument: () => beforeDocumentCache.getDocument(_id),
              thisArg: this
            },
            "filterMutator",
            beforeListenersWithOptions,
            invocationOptions?.signal,
          );
        }
        catch (error) {
          return {
            type: ordered ? "Break" : "Continue",
            error
          }
        }
        let gotResult = false;
        try {
          invocationOptions?.signal?.throwIfAborted();
          // perDocFn decides what to do with SkipDocument since it's shape dependent.
          let partialResult = await perDocFn({ _id, beforeHooksResult: chainedArgs, invocationSymbol });
          gotResult = true;
          if (chainedArgs !== SkipDocument) {
            const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
              Events.afterSuccess.update,
              // I'm not sure how to do this cleanly
              // the goal was to enforce type checking of caller + result between update<one|many>, replaceOne and findOneAnd*
              // since their results are very different shapes. But the goal is for that to work *on the callback* not here.
              // @ts-expect-error
              {
                ...beforeEmitArgs,
                previousDocument: isCacheWarmed ? await beforeDocumentCache.getDocument(_id) : undefined,
                invocationSymbol,
                _id,
                getDocument: () => afterDocumentCache.getDocument(_id),
                thisArg: this,
                result: partialResult.result,
              },
              "result",
              allAfterListenersWithOptions,
              invocationOptions?.signal,
            );
            if (chainedResult !== undefined) {
              partialResult.result = chainedResult;
            }
          }
          // A few interesting facts:
          // 1. All calls in a single request come from one place
          // 1.a. so all the partialResults should be the same type
          // 2. Only updateMany has multiple partialResults - it's result type is UpdateResult
          // 3. So everything else can just reassign
          if (partialResult.type === "UpdateResult") {
            const res = result as UpdateResult<TSchema>;
            if (partialResult.result.acknowledged) {
              res.acknowledged = true;
            }
            if (partialResult.result.matchedCount) {
              res.matchedCount += partialResult.result.matchedCount;
            }
            if (partialResult.result.modifiedCount) {
              res.modifiedCount += partialResult.result.modifiedCount;
            }
          }
          else if (partialResult.type === "ModifyResult" || partialResult.type === "Document") {
            result = partialResult.result;
          }
        }
        catch (e) {
          if (gotResult) {
            return {
              type: ordered ? "Break" : "Continue",
              error: e
            }
          }
          await this.#ee.callAllAwaitableInParallel(
            {
              ...beforeEmitArgs,
              invocationSymbol,
              _id,
              getDocument: () => afterDocumentCache.getDocument(_id),
              previousDocument: isCacheWarmed ? await beforeDocumentCache.getDocument(_id) : undefined,
              thisArg: this,
              error: e,
            },
            invocationOptions,
            Events.afterError.update,
            Events.after.update
          );
          return {
            type: ordered ? "Break" : "Continue",
            error: e
          }
        }
        return {
          type: "Continue"
        };
      },
      cursor,
      ordered,
      (beforeEmitArgs.args?.slice(-1)[0] as AmendedUpdateOptions | undefined)?.hookBatchSize,
      invocationOptions?.signal,
      nextItem
    );
    if (errors.length && limit === 1) {
      throw errors[0];
    }
    if (errors.length) {
      const res = result as UpdateResult<TSchema>;
      throw new BulkWriteError(
        "There were write errors",
        new BulkWriteResult({
          ok: 0,
          insertedCount: 0,
          upsertedCount: res.upsertedCount,
          matchedCount: res.matchedCount,
          modifiedCount: res.modifiedCount,
          deletedCount: 0,
          upsertedIds: res.upsertedId ? { 0: res.upsertedId } : {},
          insertedIds: {}
        }, errors as WriteError[])
      );
    }
    if (alwaysAttemptOperation && (limit !== 1 || attemptedIds.length === 0)) {
      invocationOptions?.signal?.throwIfAborted();
      const partialResult = await noListenersFn(attemptedIds, {
        type: "UpdateResult",
        result: result as UpdateResult
      }) as Awaited<ReturnType<T1>>;
      if (partialResult.type === "UpdateResult") {
        const res = result as UpdateResult<TSchema>;
        res.acknowledged = res.acknowledged || partialResult.result.acknowledged;
        res.matchedCount += partialResult.result.matchedCount;
        res.modifiedCount += partialResult.result.modifiedCount;
        res.upsertedCount += partialResult.result.upsertedCount;
        res.upsertedId = partialResult.result.upsertedId;
      }
      else if (partialResult.type === "ModifyResult") {
        const res = result as unknown as ModifyResult<TSchema>;
        if (!res.value) {
          result = partialResult.result;
        }
      }
      else if (partialResult.type === "Document") {
        if (!result) {
          result = partialResult.result;
        }
      }
    }
    return result as Awaited<ReturnType<T1>>["result"];
  }

  replaceOne(
    filter: MaybeStrictFilter<TSchema>,
    replacement: WithoutId<TSchema>,
    chainedOptions?: AmendedReplaceOptions | undefined
  ): Promise<Document | UpdateResult<TSchema>> {
    const argsOrig = [filter, replacement, chainedOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "replaceOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.replaceOne,
        { args: argsOrig },
        "args",
        async ({
          beforeHooksResult: args,
          invocationSymbol: parentInvocationSymbol
        }) => {
          return this.#tryCatchUpdate(
            {
              caller: "replaceOne",
              argsOrig,
              args,
              signal: chainedOptions?.signal,
              filterMutator: {
                filter: args[0],
                replacement: args[1]
              },
              parentInvocationSymbol
            },
            async ({ beforeHooksResult: chainedFilterMutator, _id }) => {
              if (chainedFilterMutator === SkipDocument) {
                return {
                  type: "UpdateResult",
                  result: {
                    acknowledged: false,
                    matchedCount: 1,
                    modifiedCount: 0,
                    upsertedCount: 0,
                    upsertedId: null
                  }
                };
              }
              const { filter: chainedFilter, replacement: chainedReplacement } = chainedFilterMutator;
              return {
                type: "UpdateResult",
                result: await raceSignal(chainedOptions?.signal, this.#collection.replaceOne(
                  // @ts-expect-error
                  chainedFilter?._id === _id ? chainedFilter as Filter<TSchema> : { $and: [chainedFilter as Filter<TSchema>, { _id }] },
                  chainedReplacement as WithoutId<TSchema>,
                  args[2]
                )) as UpdateResult // it's only a document when explain: true, and I can't see how to make that the case.
              };
            },
            async (attemptedIds) => {
              let selector = args[0] as Filter<TSchema>;
              if (attemptedIds?.length) {
                // @ts-expect-error
                selector = {
                  $and: [{ _id: { $nin: attemptedIds } }, selector]
                };
              }
              return {
                type: "UpdateResult",
                result: await raceSignal(chainedOptions?.signal, this.#collection.replaceOne(selector, args[1], args[2])) as UpdateResult
              }
            },
            1,
            chainedOptions
          );
        },
        chainedOptions
      ),
      chainedOptions
    );
  }

  async #tryCatchUpdateN(
    operation: "updateOne" | "updateMany",
    filter: MaybeStrictFilter<TSchema>,
    mutator: UpdateFilter<TSchema> | Partial<TSchema>,
    chainedOptions?: AmendedUpdateOptions
  ): Promise<UpdateResult<TSchema>>{
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before[operation], chainedOptions)
      .filter(({ chainedOptions: hookOptions }) => hookOptions?.shouldRun ? hookOptions.shouldRun({ argsOrig: [filter, mutator, chainedOptions], thisArg: this }) : true);
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess[operation], chainedOptions)
      .filter(({ chainedOptions: hookOptions }) => hookOptions?.shouldRun ? hookOptions.shouldRun({ argsOrig: [filter, mutator, chainedOptions], thisArg: this }) : true);
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after[operation], chainedOptions)
      .filter(({ chainedOptions: hookOptions }) => hookOptions?.shouldRun ? hookOptions.shouldRun({ argsOrig: [filter, mutator, chainedOptions], thisArg: this }) : true);

    const allAfterListenersWithOptions = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions];
    const wantsIds = [...beforeListenersWithOptions, ...afterListenersWithOptions, ...afterSuccessListenersWithOptions].filter(({ chainedOptions: hookOptions }) => hookOptions?.["includeId"] || hookOptions?.["includeIds"] ).length;
    let ids: InferIdType<TSchema>[] | undefined;
    if (wantsIds) {
      ids = (await raceSignal(chainedOptions?.signal, this.#collection.find(filter as Filter<TSchema>, { projection: { _id: 1 }, ...(operation === "updateOne" ? { limit: 1 } : {}) }).toArray())).map(({ _id }) => _id);
    }
    const argsOrig = [filter, mutator, chainedOptions] as const;
    const invocationSymbol = Symbol(operation);
    let gotResult = false;
    const chainedArgs = await this.#ee.callExplicitAwaitableListenersChainWithKey(
      Events.before[operation],
      {
        args: argsOrig,
        signal: chainedOptions?.signal,
        ...(operation === "updateOne" ? { _id: ids?.[0] } : { _ids: ids }),
        invocationSymbol,
        thisArg: this
      },
      "args",
      beforeListenersWithOptions,
      chainedOptions?.signal,
    );
    try {
      const result = await this.#tryCatchUpdate(
        {
          caller: operation,
          argsOrig,
          signal: chainedOptions?.signal,
          args: chainedArgs,
          parentInvocationSymbol: invocationSymbol,
          filterMutator: {
            filter: chainedArgs[0],
            mutator: chainedArgs[1]
          }
        },
        async ({
          beforeHooksResult: chainedFilterMutator,
          _id,
        }) => {
          if (chainedFilterMutator === SkipDocument) {
            return {
              type: "UpdateResult",
              result: {
                acknowledged: false,
                matchedCount: 1,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
              }
            };
          }
          return {
            type: "UpdateResult",
            result: await raceSignal(chainedOptions?.signal, this.#collection.updateOne(
              // @ts-expect-error
              chainedFilterMutator.filter?._id === _id ? chainedFilterMutator.filter : { $and: [chainedFilterMutator.filter, { _id }] },
              chainedFilterMutator.mutator,
              chainedArgs[2]
            ))
          };
        },
        async (attemptedIds, partialResult) => {
          // this function must take care to not modify the selector in any way where possible - specifically in the case where an _id is provided
          if (operation === "updateOne" && attemptedIds?.length) {
            // this should never happen - the #tryCatchUpdate shouldn't send us here
            return {
              type: "UpdateResult",
              result: {
                acknowledged: false,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
              }
            };
          }
          let selector = chainedArgs[0] as Filter<TSchema>;
          if (attemptedIds?.length) {
            if (selector._id) {
              // TODO: this'll work for primatives only
              if (attemptedIds.includes(selector._id as WithId<TSchema>["_id"])) {
                // we've attempted it, fail out.
                return {
                  type: "UpdateResult",
                  result: partialResult?.result as UpdateResult
                };
              }
            }
            else {
              // @ts-expect-error
              selector = {
                $and: [{ _id: { $nin: attemptedIds } }, selector]
              }
            }
          }
          // TODO: this'll work for primatives only
          if (ids && (!selector._id || !ids.includes(selector._id as WithId<TSchema>["_id"]))) {
            // @ts-expect-error
            selector = {
              $and: [{ _id: { $in: ids } }, selector]
            };
          }
          return {
            type: "UpdateResult",
            result: await this.#collection[operation](
              selector,
              chainedArgs[1],
              chainedArgs[2]
            )
          };
        },
        operation === "updateOne" ? 1 : undefined,
        chainedOptions,
        ids
      );
      gotResult = true;

      const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
        Events.afterSuccess[operation],
        {
          args: chainedArgs,
          argsOrig,
          result,
          signal: chainedOptions?.signal,
          ...(operation === "updateOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this
        },
        "result",
        allAfterListenersWithOptions,
        chainedOptions?.signal,
      );
      return chainedResult || result;
    }
    catch (e) {
      if (gotResult) {
        throw e;
      }
      // TODO: filter the after error operations
      await this.#ee.callAllAwaitableInParallel(
        {
          args: chainedArgs,
          argsOrig,
          signal: chainedOptions?.signal,
          ...(operation === "updateOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this,
          error: e,
        },
        chainedOptions,
        Events.afterError[operation],
        Events.after[operation]
      );
      throw e;
    }
  }

  updateOne(
    filter: MaybeStrictFilter<TSchema>,
    update: UpdateFilter<TSchema> | Partial<TSchema>,
    chainedOptions?: AmendedUpdateOptions
  ): Promise<UpdateResult<TSchema>> {
    return this.#tryCatchUpdateN(
      "updateOne",
      filter,
      update,
      chainedOptions
    );
  }

  updateMany(filter: MaybeStrictFilter<TSchema>, update: UpdateFilter<TSchema>, chainedOptions?: AmendedUpdateOptions | undefined): Promise<UpdateResult<TSchema>> {
    return this.#tryCatchUpdateN(
      "updateMany",
      filter,
      update,
      chainedOptions
    );
  }

  async #tryCatchDeleteN(
    operation: "deleteOne" | "deleteMany",
    filter: MaybeStrictFilter<TSchema>,
    chainedOptions?: AmendedDeleteOptions
  ): Promise<DeleteResult>{
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before[operation], chainedOptions)
      .filter(({ chainedOptions: hookOptions }) => hookOptions?.shouldRun ? hookOptions.shouldRun({ argsOrig: [filter, chainedOptions], thisArg: this }) : true);
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess[operation], chainedOptions)
      .filter(({ chainedOptions: hookOptions }) => hookOptions?.shouldRun ? hookOptions.shouldRun({ argsOrig: [filter, chainedOptions], thisArg: this }) : true);
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after[operation], chainedOptions)
      .filter(({ chainedOptions: hookOptions }) => hookOptions?.shouldRun ? hookOptions.shouldRun({ argsOrig: [filter, chainedOptions], thisArg: this }) : true);

    const allAfterListenersWithOptions = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions];
    const wantsIds = [...beforeListenersWithOptions, ...afterListenersWithOptions, ...afterSuccessListenersWithOptions].filter(({ chainedOptions: hookOptions }) => hookOptions?.["includeId"] || hookOptions?.["includeIds"] ).length;
    let ids: InferIdType<TSchema>[] | undefined;
    if (wantsIds) {
      chainedOptions?.signal?.throwIfAborted();
      ids = (await raceSignal(chainedOptions?.signal, this.#collection.find(filter as Filter<TSchema>, { projection: { _id: 1 }, ...(operation === "deleteOne" ? { limit: 1 } : {}) }).toArray())).map(({ _id }) => _id);
    }
    const argsOrig = [filter, chainedOptions] as const;
    const invocationSymbol = Symbol(operation);
    let gotResult = false;
    const chainedArgs = await this.#ee.callExplicitAwaitableListenersChainWithKey(
      Events.before[operation],
      {
        args: argsOrig,
        ...(operation === "deleteOne" ? { _id: ids?.[0] } : { _ids: ids }),
        invocationSymbol,
        signal: chainedOptions?.signal,
        thisArg: this
      },
      "args",
      beforeListenersWithOptions,
      chainedOptions?.signal,
    );
    try {
      const result = await this.#tryCatchDelete(
        {
          caller: operation,
          argsOrig,
          args: chainedArgs,
          signal: chainedOptions?.signal,
          parentInvocationSymbol: invocationSymbol,
          filter
        },
        async ({
          beforeHooksResult: chainedFilter,
          _id,
        }) => {
          if (chainedFilter === SkipDocument) {
            return {
              type: "DeleteResult",
              result: {
                acknowledged: false,
                deletedCount: 0
              }
            };
          }
          return {
            type: "DeleteResult",
            result: await raceSignal(chainedOptions?.signal, this.#collection.deleteOne(
              // @ts-expect-error
              chainedFilter?._id === _id ? chainedFilter : { $and: [chainedFilter, { _id }] },
              chainedArgs[1]
            ))
          };
        },
        async (attemptedIds) => {
          let selector = chainedArgs[0] as Filter<TSchema>;
          if (operation === "deleteOne" && attemptedIds?.length) {
            return {
              type: "DeleteResult",
              result: {
                acknowledged: false,
                deletedCount: 0
              }
            };
          }
          if (attemptedIds?.length) {
            // @ts-expect-error
            selector = {
              $and: [{ _id: { $nin: attemptedIds } }, selector]
            }
          }
          if (ids) {
            // @ts-expect-error
            selector = {
              $and: [{ _id: { $in: ids } }, selector]
            };
          }
          return {
            type: "DeleteResult",
            result: await this.#collection[operation](
              selector,
              chainedArgs[1]
            )
          };
        },
        operation === "deleteOne" ? 1 : undefined,
        chainedOptions,
        ids
      );
      gotResult = true;

      const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
        Events.afterSuccess[operation],
        {
          args: chainedArgs,
          argsOrig,
          result,
          signal: chainedOptions?.signal,
          ...(operation === "deleteOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this
        },
        "result",
        allAfterListenersWithOptions,
        chainedOptions?.signal
      );
      return chainedResult || result;
    }
    catch (e) {
      if (gotResult) {
        throw e;
      }
      await this.#ee.callAllAwaitableInParallel(
        {
          args: chainedArgs,
          argsOrig,
          signal: chainedOptions?.signal,
          ...(operation === "deleteOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this,
          error: e,
        },
        chainedOptions,
        Events.afterError[operation],
        Events.after[operation]
      );
      throw e;
    }
  }

  deleteOne(filter?: MaybeStrictFilter<TSchema>, chainedOptions?: AmendedDeleteOptions): Promise<DeleteResult> {
    return this.#tryCatchDeleteN(
      'deleteOne',
      filter || {},
      chainedOptions
    );
  }

  deleteMany(filter?: MaybeStrictFilter<TSchema>, chainedOptions?: AmendedDeleteOptions): Promise<DeleteResult> {
    return this.#tryCatchDeleteN(
      'deleteMany',
      filter || {},
      chainedOptions
    );
  }

  hooks<K extends keyof CollectionHookedEventMap<TSchema>>(
    eventName: K
  ): CallbackAndOptionsOfEm<CollectionHookedEventMap<TSchema>, K>[] {
    return this.#ee.awaitableListenersWithOptions(eventName);
  }

  allHooksWithOptions() {
    return this.#ee.allListenersWithOptions().map(({ listener, eventName, chainedOptions }) => ({
      hook: listener,
      eventName,
      chainedOptions
    }));
  }

  on<K extends keyof CollectionHookedEventMap<TSchema>>(
    eventName: K,
    listener: HookedListenerCallback<K, CollectionHookedEventMap<TSchema>>,
    chainedOptions?: CollectionHookedEventMap<TSchema>[K]["chainedOptions"]
  ) {
    this.#ee.awaitableOn(eventName, listener, chainedOptions);
    return this;
  }

  off<
    K extends keyof CollectionHookedEventMap<TSchema> & EventNames
  >(
    eventName: K,
    listener: HookedListenerCallback<K, CollectionHookedEventMap<TSchema>>
  ) {
    this.#ee.awaitableOff(eventName, listener);
    return this;
  }

  count(filter?: MaybeStrictFilter<TSchema> | undefined, chainedOptions?: AmendedCountOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [filter, chainedOptions],
        operation: "count"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents["count"],
        {
          args: [filter, chainedOptions]
        },
        "args",
        ({ beforeHooksResult: [filter, chainedOptions] }) => raceSignal(chainedOptions?.signal, this.#collection.count(filter as Filter<TSchema>, chainedOptions)),
        chainedOptions,
        {
          event: InternalEvents["count*"],
          emitArgs: {
            operation: "count"
          }
        }
      ),
      chainedOptions
    );
  }

  estimatedDocumentCount(chainedOptions?: AmendedEstimatedDocumentCountOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [chainedOptions],
        operation: "estimatedDocumentCount"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents["estimatedDocumentCount"],
        {
          args: [chainedOptions]
        },
        "args",
        ({ beforeHooksResult: [chainedOptions] }) => raceSignal(chainedOptions?.signal, this.#collection.estimatedDocumentCount(chainedOptions as AmendedEstimatedDocumentCountOptions)),
        chainedOptions,
        {
          event: InternalEvents["count*"],
          emitArgs: {
            operation: "estimatedDocumentCount"
          }
        }
      ),
      chainedOptions
    );
  }

  countDocuments(filter?: MaybeStrictFilter<Document> | undefined, chainedOptions?: AmendedCountDocumentsOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [filter, chainedOptions],
        operation: "countDocuments"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents["countDocuments"],
        {
          args: [filter, chainedOptions]
        },
        "args",
        ({ beforeHooksResult: [filter, chainedOptions] }) => raceSignal(chainedOptions?.signal, this.#collection.countDocuments(filter as Filter<TSchema>, chainedOptions)),
        chainedOptions,
        {
          event: InternalEvents["count*"],
          emitArgs: {
            operation: "countDocuments"
          }
        }
      ),
      chainedOptions
    );
  }


  async findOneAndDelete(filter: MaybeStrictFilter<TSchema>, chainedOptions: AmendedFindOneAndDeleteOptions<TSchema> & { includeResultMetadata: true }): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: MaybeStrictFilter<TSchema>, chainedOptions: AmendedFindOneAndDeleteOptions<TSchema> & { includeResultMetadata: false }): Promise<WithId<TSchema> | null>;
  async findOneAndDelete(filter: MaybeStrictFilter<TSchema>, chainedOptions: AmendedFindOneAndDeleteOptions<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: MaybeStrictFilter<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: MaybeStrictFilter<TSchema>, chainedOptions?: AmendedFindOneAndDeleteOptions<TSchema>): Promise<WithId<TSchema> | ModifyResult<TSchema> | null> {
    const argsOrig = [filter, chainedOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "findOneAndDelete"
      },
      undefined,
      () => this.#tryCatchEmit(
        "findOneAndDelete",
        {
          args: [filter, chainedOptions]
        },
        "args",
        ({
          invocationSymbol: parentInvocationSymbol,
          beforeHooksResult: [chainedFilter, chainedOptions ]
        }) => {
          return this.#tryCatchDelete(
            {
              caller: "findOneAndDelete",
              args: [chainedFilter, chainedOptions],
              argsOrig,
              filter: chainedFilter,
              signal: chainedOptions?.signal,
              parentInvocationSymbol
            },
            async ({
              _id,
              beforeHooksResult: filter
            }) => {
              if (filter === SkipDocument) {
                if (chainedOptions?.includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: null
                  };
                }
                return {
                  type: "ModifyResult",
                  result: {
                    value: null,
                    ok: 0
                  }
                };
              }
              if (chainedOptions) {
                const result = await raceSignal(chainedOptions?.signal, this.#collection.findOneAndDelete(
                  // @ts-expect-error
                  filter?._id === _id ? filter as Filter<TSchema> : { $and: [{ _id }, filter as Filter<TSchema>] },
                  chainedOptions
                ));

                return {
                  type: chainedOptions?.includeResultMetadata === false ? "Document" : "ModifyResult",
                  result: result && this.#transform(result)
                } as {
                  type: "ModifyResult",
                  result: ModifyResult<TSchema>
                } | {
                  type: "Document",
                  result: WithId<TSchema> | null
                };
              }
              const result = await this.#collection.findOneAndDelete(
                // @ts-expect-error
                filter?._id === _id ? filter as Filter<TSchema> : { $and: [{ _id }, filter as Filter<TSchema>] }
              );
              result.value = result.value && this.#transform(result.value);
              return {
                type: "ModifyResult",
                result
              };
            },
            async () => {
              let result: ModifyResult<TSchema> | WithId<TSchema> | null;
              if (chainedOptions) {
                result = await raceSignal(chainedOptions?.signal, this.#collection.findOneAndDelete(chainedFilter as Filter<TSchema>, chainedOptions));
                if (chainedOptions.includeResultMetadata === false) {
                  result = result && this.#transform(result);
                }
                else {
                  result.value = result.value && this.#transform(result.value);
                }
              }
              else {
                result = await this.#collection.findOneAndDelete(chainedFilter as Filter<TSchema>);
                result.value = result.value && this.#transform(result.value);
              }
              return {
                type: chainedOptions?.includeResultMetadata === false ? "Document" : "ModifyResult",
                result
              } as {
                type: "ModifyResult",
                result: ModifyResult<TSchema>
              } | {
                type: "Document",
                result: WithId<TSchema> | null
              };
            },
            undefined,
            chainedOptions
          )
        },
        chainedOptions,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOneAndDelete"
          }
        }
      ),
      chainedOptions
    );
  }
  async findOneAndUpdate(filter: MaybeStrictFilter<TSchema>, update: UpdateFilter<TSchema>, chainedOptions: AmendedFindOneAndUpdateOptions<TSchema> & { includeResultMetadata: true; }): Promise<ModifyResult<TSchema>>;
  async findOneAndUpdate(filter: MaybeStrictFilter<TSchema>, update: UpdateFilter<TSchema>, chainedOptions: AmendedFindOneAndUpdateOptions<TSchema> & { includeResultMetadata: false; }): Promise<WithId<TSchema> | null>;
  async findOneAndUpdate(filter: MaybeStrictFilter<TSchema>, update: UpdateFilter<TSchema>, chainedOptions: AmendedFindOneAndUpdateOptions<TSchema>): Promise<WithId<TSchema> | null>;
  async findOneAndUpdate(filter: MaybeStrictFilter<TSchema>, update: UpdateFilter<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndUpdate(filter: MaybeStrictFilter<TSchema>, update: UpdateFilter<TSchema>, chainedOptions?: AmendedFindOneAndUpdateOptions<TSchema>): Promise<ModifyResult<TSchema> | WithId<TSchema> | null> {
    const argsOrig = [filter, update, chainedOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "findOneAndUpdate"
      },
      undefined,
      () => this.#tryCatchEmit(
        "findOneAndUpdate",
        {
          args: argsOrig
        },
        "args",
        ({
          beforeHooksResult: [chainedFilter, chainedUpdate, chainedOptions],
          invocationSymbol
        }) => {
          return this.#tryCatchUpdate(
            {
              args: [chainedFilter, chainedUpdate, chainedOptions],
              argsOrig,
              signal: chainedOptions?.signal,
              caller: "findOneAndUpdate",
              filterMutator: {
                filter: chainedFilter,
                mutator: chainedUpdate
              },
              parentInvocationSymbol: invocationSymbol
            },
            async ({
              _id,
              beforeHooksResult: chainedFilterMutator
            }) => {
              // this isn't likely to be useful - but it is technically valid.
              if (chainedFilterMutator === SkipDocument) {
                if (chainedOptions?.includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: null
                  };
                }
                else {
                  return {
                    type: "ModifyResult",
                    result: {
                      ok: 0,
                      value: null,
                    }
                  };
                }
              }

              if (chainedOptions) {
                const result = await raceSignal(chainedOptions?.signal, this.#collection.findOneAndUpdate(
                  // @ts-expect-error
                  chainedFilterMutator.filter?._id === _id ? chainedFilterMutator.filter as Filter<TSchema> : { $and: [{ _id }, chainedFilterMutator.filter as Filter<TSchema>] },
                  chainedFilterMutator.mutator,
                  chainedOptions
                ));
                return {
                  type: chainedOptions?.includeResultMetadata === false ? "Document" : "ModifyResult",
                  result: result && this.#transform(result)
                } as {
                  type: "ModifyResult",
                  result: ModifyResult<TSchema>
                } | {
                  type: "Document",
                  result: WithId<TSchema> | null
                };
              }
              const result = await this.#collection.findOneAndUpdate(
                // @ts-expect-error
                chainedFilterMutator.filter?._id === _id ? chainedFilterMutator.filter as Filter<TSchema> : { $and: [{ _id }, chainedFilterMutator.filter as Filter<TSchema>] },
                chainedFilterMutator.mutator
              );
              result.value = result.value && this.#transform(result.value);
              return {
                type: "ModifyResult",
                result
              };
            },
            // no hooks...
            async () => {
              let result;
              if (chainedOptions) {
                result = await raceSignal(chainedOptions?.signal, this.#collection.findOneAndUpdate(chainedFilter as Filter<TSchema>, chainedUpdate, chainedOptions));
                if (chainedOptions.includeResultMetadata === false) {
                  result = result && this.#transform(result);
                }
                else {
                  result.value = result.value && this.#transform(result.value);
                }
              }
              else {
                result = await this.#collection.findOneAndUpdate(chainedFilter as Filter<TSchema>, chainedUpdate);
                result.value = result.value && this.#transform(result.value);
              }
              return {
                type: chainedOptions?.includeResultMetadata === false ? "Document" : "ModifyResult",
                result: result
              } as {
                type: "ModifyResult",
                result: ModifyResult<TSchema>
              } | {
                type: "Document",
                result: WithId<TSchema> | null
              };
            },
            1,
            chainedOptions
          )
        },
        chainedOptions,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOneAndUpdate"
          }
        }
      ),
      chainedOptions
    );
  }

  async findOneAndReplace(filter: MaybeStrictFilter<TSchema>, replacement: WithoutId<TSchema>, chainedOptions: AmendedFindOneAndReplaceOptions<TSchema> & { includeResultMetadata: true }): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: MaybeStrictFilter<TSchema>, replacement: WithoutId<TSchema>, chainedOptions: AmendedFindOneAndReplaceOptions<TSchema> & { includeResultMetadata: false }): Promise<WithId<TSchema> | null>;
  async findOneAndReplace(filter: MaybeStrictFilter<TSchema>, replacement: WithoutId<TSchema>, chainedOptions: AmendedFindOneAndReplaceOptions<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: MaybeStrictFilter<TSchema>, replacement: WithoutId<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: MaybeStrictFilter<TSchema>, replacement: WithoutId<TSchema>, chainedOptions?: AmendedFindOneAndReplaceOptions<TSchema>): Promise<WithId<TSchema> | ModifyResult<TSchema> | null> {
    const argsOrig = [filter, replacement, chainedOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "findOneAndReplace"
      },
      undefined,
      () => this.#tryCatchEmit(
        "findOneAndReplace",
        {
          args: [filter, replacement, chainedOptions]
        },
        "args",
        ({
          beforeHooksResult: [filter, replacement, chainedOptions],
          invocationSymbol
        }) => {
          return this.#tryCatchUpdate(
            {
              args: [filter, replacement, chainedOptions],
              argsOrig,
              signal: chainedOptions?.signal,
              caller: "findOneAndReplace",
              filterMutator: {
                filter,
                replacement
              },
              parentInvocationSymbol: invocationSymbol
            },
            async ({
              _id,
              beforeHooksResult: chainedFilterMutator
            }) => {
              // this isn't likely to be useful - but it is technically valid.
              if (chainedFilterMutator === SkipDocument) {
                if (chainedOptions?.includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: null
                  };
                }
                else {
                  return {
                    type: "ModifyResult",
                    result: {
                      ok: 0,
                      value: null,
                    }
                  };
                }
              }
              if (chainedOptions) {
                const result = await raceSignal(chainedOptions?.signal, this.#collection.findOneAndReplace(
                  // @ts-expect-error
                  chainedFilterMutator.filter?._id === _id ? chainedFilterMutator.filter as Filter<TSchema> : { $and: [{ _id }, chainedFilterMutator.filter as Filter<TSchema>] },
                  chainedFilterMutator.replacement,
                  chainedOptions
                ))
                return {
                  type: chainedOptions?.includeResultMetadata === false ? "Document" : "ModifyResult",
                  result: result && this.#transform(result)
                } as {
                  type: "ModifyResult",
                  result: ModifyResult<TSchema>
                } | {
                  type: "Document",
                  result: WithId<TSchema> | null
                };
              }
              const result = await this.#collection.findOneAndReplace(
                // @ts-expect-error
                chainedFilterMutator.filter?._id === _id ? chainedFilterMutator.filter as Filter<TSchema> : { $and: [{ _id }, chainedFilterMutator.filter as Filter<TSchema>] },
                chainedFilterMutator.replacement
              );
              result.value = result.value && this.#transform(result.value);
              return {
                type: "ModifyResult",
                result
              };
            },
            // no hooks...
            async () => {
              let result;
              if (chainedOptions) {
                result = await raceSignal(chainedOptions?.signal, this.#collection.findOneAndReplace(filter as Filter<TSchema>, replacement, chainedOptions));
                if (chainedOptions.includeResultMetadata === false) {
                  result = result && this.#transform(result);
                }
                else {
                  result.value = result.value && this.#transform(result.value);
                }
              }
              else {
                result = await this.#collection.findOneAndReplace(filter as Filter<TSchema>, replacement);
                result.value = result.value && this.#transform(result.value);
              }
              return {
                type: chainedOptions?.includeResultMetadata === false ? "Document" : "ModifyResult",
                result
              } as {
                type: "ModifyResult",
                result: ModifyResult<TSchema>
              } | {
                type: "Document",
                result: WithId<TSchema> | null
              };
            },
            1,
            chainedOptions
          )
        },
        chainedOptions,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOneAndReplace"
          }
        }
      ),
      chainedOptions
    );
  }
}
