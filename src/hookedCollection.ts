import type {
  Collection,
  Document,
  OptionalUnlessRequiredId,
  WithId,
  Filter,
  UpdateFilter,
  InsertManyResult,
  UpdateResult,
  WithoutId,
  CountOptions,
  AggregationCursor,
  FindCursor,
  InferIdType,
  ObjectId,
  DeleteResult,
  InsertOneResult,
  EstimatedDocumentCountOptions,
  CountDocumentsOptions,
  FindOneAndDeleteOptions,
  ModifyResult,
  FindOneAndUpdateOptions,
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
  UpdateCallArgs,
  ReplaceCallArgs,
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
  SkipDocument
} from "./events/index.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";
import { AbstractHookedCollection } from "./abstractCollectionImpl.js";
import { getTryCatch } from "./tryCatchEmit.js";
import { unionOfProjections } from './utils.js';
import { ChainedAwaiatableEventEmitter, ChainedListenerCallback, StandardInvokeHookOptions } from './awaiatableEventEmitter.js';
import { AmendedCountDocumentsOptions, AmendedCountOptions, AmendedEstimatedDocumentCountOptions, AmendedFindOneAndDeleteOptions, AmendedFindOneAndReplaceOptions, AmendedFindOneAndUpdateOptions, CollectionOnlyBeforeAfterErrorEventDefinitions, FindOneAndUpdateCallArgs, UpsertCallArgs } from './events/collectionEvents.js';
import { BeforeAfterErrorSharedEventDefinitions } from './events/sharedEvents.js';

function assertReplacementHasId<TSchema>(replacement: WithoutId<TSchema>): asserts replacement is OptionalUnlessRequiredId<TSchema> {
  if (!(replacement as OptionalUnlessRequiredId<TSchema>)._id) {
    throw new Error("Can't upsert without a _id");
  }
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

class DocumentCache<TSchema extends Document> {
  #map: Map<InferIdType<TSchema>, Promise<WithId<TSchema> | null>> = new Map();
  #collection: Collection<TSchema>;
  #projection: NestedProjectionOfTSchema<TSchema>;
  #dontLoadDocuments: boolean;

  constructor(
    collection: Collection<TSchema>,
    projection: NestedProjectionOfTSchema<TSchema>,
    dontLoadDocuments: boolean
  ) {
    this.#collection = collection;
    this.#projection = projection;
    this.#dontLoadDocuments = dontLoadDocuments;
  }

  getDocument(id: InferIdType<TSchema>): Promise<WithId<TSchema> | null> {
    if (!this.#map.has(id)) {
      if (this.#dontLoadDocuments) {
        return Promise.resolve(null);
      }

      // INTENTIONALLY *NOT* await
      // @ts-expect-error
      this.#map.set(id, this.#collection.findOne({ _id: id }, { projection: this.#projection}));
    }
    return this.#map.get(id) || Promise.resolve(null);
  }

  setDocument(id: InferIdType<TSchema>, doc: WithId<TSchema>): void {
    this.#map.set(id, Promise.resolve(doc));
  }
}

interface HookedFindCursorConstructor<TSchema extends Document> {
  new (filter: Filter<TSchema> | undefined, cursor: FindCursor, options: HookedFindCursorOptions<TSchema>): HookedFindCursor
}

type HookedCollectionOptions<TSchema extends Document> = {
  transform?: (doc: any) => any,
  findCursorImpl?: HookedFindCursorConstructor<TSchema>,
  interceptExecute?: boolean
};

export class HookedCollection<
  //TSchemaOrDocument,
  TSchema extends Document// = TSchemaOrDocument extends Document ? TSchemaOrDocument : Document
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
    options?: HookedCollectionOptions<TSchema>
  ) {
    super(collection);
    this.#collection = collection;
    if (options?.findCursorImpl) {
      this.#findCursorImpl = options.findCursorImpl;
    }
    if (options?.interceptExecute) {
      this.#interceptExecute = options.interceptExecute;
    }
    if (options?.transform) {
      this.#transform = options.transform;
    }
  }

  aggregate<T extends Document>(pipeline: Document[], options?: AmendedAggregateOptions): AggregationCursor<T> {
    const invocationSymbol = Symbol("aggregate");
    const [chainedPipeline, chainedOptions] = this.#ee.callSyncChainWithKey(
      "before.aggregate",
      {
        args: [pipeline, options],
        invocationSymbol,
        thisArg: this
      },
      "args",
      options
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
          argsOrig: [pipeline, options],
          thisArg: this,
          invocationSymbol
        },
        "result",
        options,
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
          argsOrig: [pipeline, options],
          thisArg: this,
          invocationSymbol
        },
        options,
        Events.afterError.aggregate,
        Events.after.aggregate,
      );
      throw e;
    }
  }

  rawCollection() {
    return this.#collection;
  }

  distinct<Key extends keyof WithId<TSchema>>(
    key: Key,
    filter: Filter<TSchema> = {},
    options: AmendedDistinctOptions = {}
  ) {
    return this.#tryCatchEmit(
      InternalEvents.distinct,
      { args: [key, filter, options] },
      "args",
      ({ beforeHooksResult: [key, filter, options] }) => this.#collection.distinct(key, filter, options),
      options
    );
  }

  findOne<T extends Document = TSchema>(filter?: Filter<TSchema>, options?: AmendedFindOptions<TSchema> | undefined): Promise<T | null> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [filter, options],
        operation: "findOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.findOne,
        { args: [filter, options] },
        "args",
        ({ beforeHooksResult: [chainedFilter, chainedOptions] }) => {
          if (chainedFilter && options) {
            return this.#collection.findOne<T>(chainedFilter, chainedOptions);
          }
          if (chainedFilter) {
            return this.#collection.findOne<T>(chainedFilter);
          }
          return this.#collection.findOne<T>();
        },
        options,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOne"
          }
        }
      ),
      options
    );
  }

  #find<T extends Document = TSchema>(filter?: Filter<TSchema>, options?: AmendedFindOptions<TSchema>): FindCursor<T> {
    if (filter && options) {
      return this.#collection.find<T>(filter, options);
    }
    else if (filter) {
      return this.#collection.find<T>(filter);
    }
    return this.#collection.find() as unknown as FindCursor<T>;
  }

  find<T extends Document = TSchema>(filter: Filter<TSchema> = {}, options?: AmendedFindOptions<TSchema, "before.find">): HookedFindCursor<T> {
    const invocationSymbol = Symbol("find");
    const [chainedFilter, chainedOptions] = this.#ee.callSyncChainWithKey(
      Events.before.find,
      {
        args: [filter, options],
        thisArg: this,
        invocationSymbol
      },
      "args",
      options
    );
    try {
      const actualCursor = this.#find<T>(chainedFilter, chainedOptions);
      // we need as X here because it's hard (impossible) to make the args aware of the custom T used by find vs TSchema of the collection
      let cursor = new this.#findCursorImpl(
        chainedFilter,
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
          invocationOptions: options,
          transform: this.#transform
        }
      ) as HookedFindCursorInterface<T>;

      const chainedCursor = this.#ee.callAllSyncChainWithKey(
        {
          args: [chainedFilter, chainedOptions],
          result: cursor,
          argsOrig: [filter, options],
          thisArg: this,
          invocationSymbol
        },
        "result",
        options,
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
          argsOrig: [filter, options],
          thisArg: this,
          invocationSymbol
        },
        undefined,
        options,
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
    OEA extends Omit<EA, "invocationSymbol" | "thisArg">
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

  insertOne(doc: OptionalUnlessRequiredId<TSchema>, options?: AmendedInsertOneOptions<CollectionHookedEventMap<TSchema>>): Promise<InsertOneResult<TSchema>> {
    const argsOrig = [doc, options] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "insertOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.insertOne,
        { args: [doc, options] },
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
            return this.#collection.insertOne(beforeHooksResult, options)
          },
          options
        ),
        options
      ),
      options
    );
  }

  insertMany(docs: OptionalUnlessRequiredId<TSchema>[], options?: AmendedBulkWriteOptions) {
    const argsOrig = [docs, options] as const;
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
          beforeHooksResult: [docs, options]
        }) => {
          const beforeHooks = this.#ee.relevantAwaitableListeners(Events.before.insert, options);
          const afterSuccessHooks = this.#ee.relevantAwaitableListeners(Events.afterSuccess.insert, options);
          const afterErrorHooks = this.#ee.relevantAwaitableListeners(Events.afterError.insert, options);
          const afterHooks = this.#ee.relevantAwaitableListeners(Events.after.insert, options);
          const hasBefore = !!beforeHooks.length;
          const hasAfter = !!afterSuccessHooks.length || !!afterHooks.length;
          const hasAfterError = !!afterErrorHooks.length || !afterHooks.length;
          if (!hasBefore && !hasAfter) {
            return this.#collection.insertMany(docs, options);
          }
          else {
            const docMap = new Map<OptionalUnlessRequiredId<TSchema>, { invocationSymbol: symbol, doc: OptionalUnlessRequiredId<TSchema> | typeof SkipDocument }>();
            let chainedDocs = docs;
            if (hasBefore) {
              chainedDocs = (await Promise.all(docs.map(async (doc, index) => {
                const invocationSymbol = Symbol("insert");
                const ret = await this.#ee.callAwaitableChainWithKey(
                  Events.before.insert,
                  {
                    caller: "insertMany",
                    doc,
                    parentInvocationSymbol,
                    args: [docs, options],
                    argsOrig,
                    invocationSymbol,
                    thisArg: this
                  },
                  "doc",
                  options
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
                ret = this.#collection.insertMany(chainedDocs, options);
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
                await Promise.all(docs.map((docOrig, i) => {
                  const { invocationSymbol, doc } = docMap.get(docOrig) || {};
                  if (!doc || !invocationSymbol) {
                    throw new Error("Impossible!");
                  }
                  if (doc === SkipDocument) {
                    return;
                  }
                  this.#ee.callAllAwaitableInParallel(
                  {
                    args: [docs, options],
                    argsOrig,
                    caller: "insertMany",
                    doc,
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
              await Promise.all(docs.map((docOrig, i) => {
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
                    args: [docs, options],
                    doc,
                    argsOrig: [docs, options],
                    result: {
                      acknowledged: retToUse.acknowledged,
                      insertedId: doc._id // is this right? will the resultant insertId ever be different? Are the indexes in order? I kinda doubt it
                    },
                    parentInvocationSymbol,
                    invocationSymbol,
                    thisArg: this
                  },
                  "result",
                  options,
                  Events.afterSuccess.insert,
                  Events.after.insert
                );
              }));
            }
            return ret;
          }
        },
        options
      ),
      options
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
    options: StandardInvokeHookOptions<any, any> | undefined,// QUESTIONable
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
      options,
    );
    // @ts-expect-error it *HAS* been assigned
    return inner;
  }

  // TODO: rework this entire function - it's henously complicated.
  async #tryCatchDelete<
    RetT extends Promise<DeleteResult | ModifyResult<TSchema> | WithId<TSchema> | null>,
    BEAD extends CollectionBeforeAfterErrorEventDefinitions<TSchema>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: CollectionBeforeAfterErrorEventDefinitions<TSchema>["delete"]["before"]["returns"] }) => Promise<TypedDeleteResult<TSchema>>,
    T1 extends () => RetT,
    BEA extends BEAD["delete"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, "before.delete" | "after.delete.success" | "after.delete.error" | "after.delete">,
    ids?: InferIdType<TSchema>[]
  ): Promise<Awaited<ReturnType<T1>>> {
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before.delete, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(beforeEmitArgs.argsOrig[0], beforeEmitArgs.argsOrig[1]);
    });
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess.delete, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(beforeEmitArgs.argsOrig[0], beforeEmitArgs.argsOrig[1]);
    });
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after.delete, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(beforeEmitArgs.argsOrig[0], beforeEmitArgs.argsOrig[1]);
    });
    const isBeforeGreedy = beforeListenersWithOptions.map(({ options }) => options?.greedyFetch).reduce((a, b) => a || b, false) as boolean;
    const beforeProjections = beforeListenersWithOptions.map(({ options }) => options?.projection).filter(a => a) as NestedProjectionOfTSchema<TSchema>[];
    const beforeListeners = beforeListenersWithOptions.map(({ listener }) => listener);
    const afterListeners = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ listener }) => listener);
    const fetchPrevious = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].some(({ options }) => options?.fetchPrevious);
    const fetchPreviousProjections = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ options }) => options?.fetchPreviousProjection).filter(a => a) as NestedProjectionOfTSchema<TSchema>[];
    const isCacheWarmed = isBeforeGreedy || fetchPrevious;

    const beforeProjection = unionOfProjections([...beforeProjections, ...fetchPreviousProjections]);
    if (beforeListeners.length === 0 && afterListeners.length === 0) {
      return noListenersFn() as Awaited<ReturnType<T1>>;
    }
    if (Object.hasOwnProperty.call(beforeProjection, "_id") && !beforeProjection._id) {
      delete beforeProjection["_id"];
    }
    const sort = beforeEmitArgs.args[1]?.["sort"];
    const cursor = (ids !== undefined && !isCacheWarmed) ? {
      _transform: (doc: any) => doc,
      map(transform: (doc: any) => any) {
        this._transform = transform;
        return this;
      },
      toArray() {
        return ids.map(id => this._transform({ _id: id }))
      }
    } : this.#collection.find<{ _id: any }>(
      beforeEmitArgs.args[0],
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
    const beforeDocumentCache = new DocumentCache(this.#collection, beforeProjection, isBeforeGreedy);
    const invocationSymbol = Symbol("delete");

    // TODO: this isn't right - it wont actually run in order :shrug:
    // ordered isn't present on findOneAndDeleteOptions
    const promiseFn = beforeEmitArgs.args[1]?.["ordered"] ? Promise.all.bind(Promise) : Promise.allSettled.bind(Promise);
    await promiseFn(await cursor.map(async (nextItem) => {
      const { _id } = nextItem;
      if (isBeforeGreedy) {
        beforeDocumentCache.setDocument(nextItem._id, nextItem as unknown as WithId<TSchema>);
      }
      const chainedFilter = await this.#ee.callExplicitAwaitableListenersChainWithKey(
        Events.before.delete,
        {
          ...beforeEmitArgs,
          invocationSymbol,
          _id,
          getDocument: () => beforeDocumentCache.getDocument(_id),
          thisArg: this
        },
        "filter",
        beforeListeners,
      );

      let gotResult = false;
      try {
        let partialResult = await perDocFn({
          _id,
          beforeHooksResult: chainedFilter,
          invocationSymbol
        });
        if (chainedFilter === SkipDocument) {
          return partialResult;
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
          afterListeners
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
        return partialResult;
      }
      catch (e) {
        if (gotResult) {
          throw e;
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
        throw e;
      }
    }).toArray());
    return result as Awaited<Promise<ReturnType<T1>>>;
  }

  async #tryCatchUpdate<
    BEAD extends CollectionBeforeAfterErrorEventDefinitions<TSchema>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: BEAD["update"]["before"]["returns"] }) => Promise<TypedUpdateResult<TSchema>>,
    T1 extends () => Promise<UpdateResult<TSchema> | ModifyResult<TSchema> | Document | WithId<TSchema> | null>,
    BEA extends BEAD["update"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, "before.update" | "after.update.success" | "after.update.error" | "after.update">,
    ids?: InferIdType<TSchema>[]
  ): Promise<Awaited<ReturnType<T1>>> {
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before.update, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(...beforeEmitArgs.argsOrig);
    });
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess.update, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(...beforeEmitArgs.argsOrig);
    });
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after.update, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(...beforeEmitArgs.argsOrig);
    });
    const isBeforeGreedy = beforeListenersWithOptions.map(({ options }) => options?.greedyFetch).reduce((a, b) => a || b, false) as boolean;
    const beforeProjections = beforeListenersWithOptions.map(({ options }) => options?.projection).filter(a => a) as NestedProjectionOfTSchema<TSchema>[];

    const beforeListeners = beforeListenersWithOptions.map(({ listener }) => listener);
    const afterProjections = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ options }) => options?.projection).filter(a => a) as NestedProjectionOfTSchema<TSchema>[];
    const afterListeners = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ listener }) => listener);
    const fetchPrevious = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].some(({ options }) => options?.fetchPrevious);
    const fetchPreviousProjections = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ options }) => options?.fetchPreviousProjection).filter(a => a) as NestedProjectionOfTSchema<TSchema>[];


    const beforeProjection = unionOfProjections([...beforeProjections, ...fetchPreviousProjections]);
    if (beforeListeners.length === 0 && afterListeners.length === 0) {
      return noListenersFn() as Awaited<ReturnType<T1>>;
    }
    if (Object.hasOwnProperty.call(beforeProjection, "_id") && !beforeProjection._id) {
      delete beforeProjection["_id"];
    }
    const isCacheWarmed = isBeforeGreedy || fetchPrevious;
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
      beforeEmitArgs.args[0],
      {
        projection: isCacheWarmed ? beforeProjection : { _id: 1 },
        limit
      }
    );
    let nextItem = await cursor.next();
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
            // for whatever reason, destructuring arrays means you lose type inferrence of those items
            // const [chainedFilter, chainedModifier, chainedOptions] = args;
            if (caller === "replaceOne") {
              return {
                type: "UpdateResult",
                result: await this.#collection.replaceOne(args[0], args[1], args[2]) as UpdateResult<TSchema>
              };
            }
            else if (caller === "updateOne") {
              return {
                type: "UpdateResult",
                result: await this.#collection.updateOne(args[0], args[1], args[2])
              };
            }
            else if (caller === "updateMany") {
              return {
                type: "UpdateResult",
                result: await this.#collection.updateMany(args[0], args[1], args[2])
              };
            }
            else if (caller === "findOneAndUpdate") {
              if (args[2]) {
                // fucking typescript bullshit - yeah, it really is this stupid.
                if (args[2].includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: await this.#collection.findOneAndUpdate(args[0], args[1], { ...args[2], includeResultMetadata: false })
                  };
                }
                return {
                  // CAREFUL - apparently this defaults to true NOW, but will default to false in a future release... fun
                  type: "ModifyResult",
                  result: await this.#collection.findOneAndUpdate(args[0], args[1], args[2])
                };
              }
              return {
                type: "ModifyResult",
                result: await this.#collection.findOneAndUpdate(args[0], args[1])
              };
            }
            else if (caller === "findOneAndReplace") {
              if (args[2]) {
                // fucking typescript bullshit - yeah, it really is this stupid.
                if (args[2].includeResultMetadata === false) {
                  return {
                    type: "Document",
                    result: await this.#collection.findOneAndReplace(args[0], args[1], { ...args[2], includeResultMetadata: false })
                  };
                }
                return {
                  // CAREFUL - apparently this defaults to true NOW, but will default to false in a future release... fun
                  type: "ModifyResult",
                  result: await this.#collection.findOneAndReplace(args[0], args[1], args[2])
                };
              }
              return {
                type: "ModifyResult",
                result: await this.#collection.findOneAndReplace(args[0], args[1])
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

      // TODO: why is this necessary? They are the same
      return result as Awaited<ReturnType<T1>>;
    }
    const beforeDocumentCache = new DocumentCache(this.#collection, beforeProjection, isCacheWarmed);
    const afterDocumentCache = new DocumentCache(this.#collection, unionOfProjections(afterProjections), false);
    const invocationSymbol = Symbol("update");
    const promises: any[] = [];
    do {
      if (isCacheWarmed) {
        beforeDocumentCache.setDocument(nextItem._id, nextItem as unknown as WithId<TSchema>);
      }
      promises.push((async ({ _id }) => {
        const chainedArgs = await this.#ee.callExplicitAwaitableListenersChainWithKey(
          Events.before.update,
          {
            ...beforeEmitArgs,
            invocationSymbol,
            _id,
            getDocument: () => beforeDocumentCache.getDocument(_id),
            thisArg: this
          },
          "filterMutator",
          beforeListeners,
        );
        let gotResult = false;
        try {
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
              afterListeners,
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
            if (partialResult.result.acknowledged) {
              result.acknowledged = true;
            }
            if (partialResult.result.matchedCount) {
              result.matchedCount += partialResult.result.matchedCount;
            }
            if (partialResult.result.modifiedCount) {
              result.modifiedCount += partialResult.result.modifiedCount;
            }
          }
          else if (partialResult.type === "ModifyResult" || partialResult.type === "Document") {
            result = partialResult.result;
          }
        }
        catch (e) {
          if (gotResult) {
            throw e;
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
          throw e;
        }
      })(nextItem));
      nextItem = await cursor.next();
    } while (nextItem);
    await Promise.all(promises);
    return result as Awaited<ReturnType<T1>>;
  }

  replaceOne(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options?: AmendedReplaceOptions | undefined): Promise<Document | UpdateResult<TSchema>> {
    const argsOrig = [filter, replacement, options] as const;
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
                result: await this.#collection.replaceOne(
                  // @ts-expect-error
                  { $and: [chainedFilter, { _id }] },
                  chainedReplacement as WithoutId<TSchema>,
                  args[2]
                ) as UpdateResult // it's only a document when explain: true, and I can't see how to make that the case.
              };
            },
            () => this.#collection.replaceOne(...args) as Promise<UpdateResult>,
            1,
            options
          );
        },
        options
      ),
      options
    );
  }

  async #tryCatchUpdateN(
    operation: "updateOne" | "updateMany",
    filter: Filter<TSchema>,
    mutator: UpdateFilter<TSchema> | Partial<TSchema>,
    options?: AmendedUpdateOptions
  ): Promise<UpdateResult<TSchema>>{
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before[operation], options);
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess[operation], options);
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after[operation], options);
    const beforeListeners = beforeListenersWithOptions.map(({ listener }) => listener);

    const afterSuccessListeners = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ listener }) => listener);
    const wantsIds = [...beforeListenersWithOptions, ...afterListenersWithOptions, ...afterSuccessListenersWithOptions].filter(({ options: hookOptions }) => hookOptions?.["includeId"] || hookOptions?.["includeIds"] ).length;
    let ids: InferIdType<TSchema>[] | undefined;
    if (wantsIds) {
      ids = (await this.#collection.find(filter, { projection: { _id: 1 }, ...(operation === "updateOne" ? { limit: 1 } : {}) }).toArray()).map(({ _id }) => _id);
    }
    const argsOrig = [filter, mutator, options] as const;
    const invocationSymbol = Symbol(operation);
    let gotResult = false;
    const chainedArgs = await this.#ee.callExplicitAwaitableListenersChainWithKey(
      Events.before[operation],
      {
        args: argsOrig,
        ...(operation === "updateOne" ? { _id: ids?.[0] } : { _ids: ids }),
        invocationSymbol,
        thisArg: this
      },
      "args",
      beforeListeners,
    );
    try {
      const result = await this.#tryCatchUpdate(
        {
          caller: operation,
          argsOrig,
          args: chainedArgs,
          parentInvocationSymbol: invocationSymbol,
          filterMutator: {
            filter,
            mutator
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
            result: await this.#collection.updateOne(
              // @ts-expect-error
              { $and: [chainedFilterMutator.filter, { _id }] },
              chainedFilterMutator.mutator,
              chainedArgs[2]
            )
          };
        },
        () => {
          if (ids) {
            return this.#collection[operation](
              // @ts-expect-error
              { $and: [{ _id: { $in: ids } }, chainedArgs[0]] },
              chainedArgs[1],
              chainedArgs[2]
            );
          }
          return this.#collection[operation](chainedArgs[0], chainedArgs[1], chainedArgs[2]);
        },
        operation === "updateOne" ? 1 : undefined,
        options,
        ids
      );
      gotResult = true;

      const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
        Events.afterSuccess[operation],
        {
          args: argsOrig,
          argsOrig,
          result,
          ...(operation === "updateOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this
        },
        "result",
        afterSuccessListeners,
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
          ...(operation === "updateOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this,
          error: e,
        },
        options,
        Events.afterError[operation],
        Events.after[operation]
      );
      throw e;
    }
  }

  updateOne(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema> | Partial<TSchema>,
    options?: AmendedUpdateOptions
  ): Promise<UpdateResult<TSchema>> {
    return this.#tryCatchUpdateN(
      "updateOne",
      filter,
      update,
      options
    );
  }

  updateMany(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: AmendedUpdateOptions | undefined): Promise<UpdateResult<TSchema>> {
    return this.#tryCatchUpdateN(
      "updateMany",
      filter,
      update,
      options
    );
  }

  async #tryCatchDeleteN(
    operation: "deleteOne" | "deleteMany",
    filter: Filter<TSchema>,
    options?: AmendedDeleteOptions
  ): Promise<DeleteResult>{
    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before[operation], options);
    const afterSuccessListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess[operation], options);
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.after[operation], options);
    const beforeListeners = beforeListenersWithOptions.map(({ listener }) => listener);

    const afterSuccessListeners = [...afterSuccessListenersWithOptions, ...afterListenersWithOptions].map(({ listener }) => listener);
    const wantsIds = [...beforeListenersWithOptions, ...afterListenersWithOptions, ...afterSuccessListenersWithOptions].filter(({ options: hookOptions }) => hookOptions?.["includeId"] || hookOptions?.["includeIds"] ).length;
    let ids: InferIdType<TSchema>[] | undefined;
    if (wantsIds) {
      ids = (await this.#collection.find(filter, { projection: { _id: 1 }, ...(operation === "deleteOne" ? { limit: 1 } : {}) }).toArray()).map(({ _id }) => _id);
    }
    const argsOrig = [filter, options] as const;
    const invocationSymbol = Symbol(operation);
    let gotResult = false;
    const chainedArgs = await this.#ee.callExplicitAwaitableListenersChainWithKey(
      Events.before[operation],
      {
        args: argsOrig,
        ...(operation === "deleteOne" ? { _id: ids?.[0] } : { _ids: ids }),
        invocationSymbol,
        thisArg: this
      },
      "args",
      beforeListeners,
    );
    try {
      const result = await this.#tryCatchDelete(
        {
          caller: operation,
          argsOrig,
          args: chainedArgs,
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
            result: await this.#collection.deleteOne(
              // @ts-expect-error
              { $and: [chainedFilter, { _id }] },
              chainedArgs[1]
            )
          };
        },
        () => {
          if (ids) {
            return this.#collection[operation](
              // @ts-expect-error
              { $and: [{ _id: { $in: ids } }, chainedArgs[0]] },
              chainedArgs[1]
            );
          }
          return this.#collection[operation](chainedArgs[0], chainedArgs[1]);
        },
        operation === "deleteOne" ? 1 : undefined,
        options,
        ids
      );
      gotResult = true;

      const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
        Events.afterSuccess[operation],
        {
          args: argsOrig,
          argsOrig,
          result,
          ...(operation === "deleteOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this
        },
        "result",
        afterSuccessListeners,
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
          ...(operation === "deleteOne" ? { _id: ids?.[0] } : { _ids: ids }),
          invocationSymbol,
          thisArg: this,
          error: e,
        },
        options,
        Events.afterError[operation],
        Events.after[operation]
      );
      throw e;
    }
  }

  deleteOne(filter: Filter<TSchema>, options?: AmendedDeleteOptions): Promise<DeleteResult> {
    return this.#tryCatchDeleteN(
      'deleteOne',
      filter,
      options
    );
  }

  deleteMany(filter: Filter<TSchema>, options?: AmendedDeleteOptions): Promise<DeleteResult> {
    return this.#tryCatchDeleteN(
      'deleteMany',
      filter,
      options
    );
  }

  on<K extends keyof CollectionHookedEventMap<TSchema>>(
    eventName: K,
    listener: HookedListenerCallback<K, CollectionHookedEventMap<TSchema>>,
    options?: CollectionHookedEventMap<TSchema>[K]["options"]
  ) {
    return this.#ee.awaitableOn(eventName, listener, options);
  }

  off<
    K extends keyof CollectionHookedEventMap<TSchema> & EventNames
  >(
    eventName: K,
    listener: HookedListenerCallback<K, CollectionHookedEventMap<TSchema>>
  ) {
    return this.#ee.awaitableOff(eventName, listener);
  }

  count(filter?: Filter<TSchema> | undefined, options?: AmendedCountOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [filter, options],
        operation: "count"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents["count"],
        {
          args: [filter, options]
        },
        "args",
        ({ beforeHooksResult: [options] }) => this.#collection.count(options),
        options,
        {
          event: InternalEvents["count*"],
          emitArgs: {
            operation: "count"
          }
        }
      ),
      options
    );
  }

  estimatedDocumentCount(options?: AmendedEstimatedDocumentCountOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [options],
        operation: "estimatedDocumentCount"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents["estimatedDocumentCount"],
        {
          args: [options]
        },
        "args",
        ({ beforeHooksResult: [options] }) => this.#collection.estimatedDocumentCount(options as AmendedEstimatedDocumentCountOptions),
        options,
        {
          event: InternalEvents["count*"],
          emitArgs: {
            operation: "estimatedDocumentCount"
          }
        }
      ),
      options
    );
  }

  countDocuments(filter?: Document | undefined, options?: AmendedCountDocumentsOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [filter, options],
        operation: "countDocuments"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents["countDocuments"],
        {
          args: [filter, options]
        },
        "args",
        ({ beforeHooksResult: [options] }) => this.#collection.countDocuments(options),
        options,
        {
          event: InternalEvents["count*"],
          emitArgs: {
            operation: "countDocuments"
          }
        }
      ),
      options
    );
  }


  async findOneAndDelete(filter: Filter<TSchema>, options: AmendedFindOneAndDeleteOptions & { includeResultMetadata: true }): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: Filter<TSchema>, options: AmendedFindOneAndDeleteOptions & { includeResultMetadata: false }): Promise<WithId<TSchema> | null>;
  async findOneAndDelete(filter: Filter<TSchema>, options: AmendedFindOneAndDeleteOptions): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: Filter<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: Filter<TSchema>, options?: AmendedFindOneAndDeleteOptions): Promise<WithId<TSchema> | ModifyResult<TSchema> | null> {
    const argsOrig = [filter, options] as const;
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
          args: [filter, options]
        },
        "args",
        ({
          invocationSymbol: parentInvocationSymbol,
          beforeHooksResult: [filter, options ]
        }) => {
          return this.#tryCatchDelete(
            {
              caller: "findOneAndDelete",
              args: [filter, options],
              argsOrig,
              filter,
              parentInvocationSymbol
            },
            async ({
              _id,
              beforeHooksResult: filter
            }) => {
              if (filter === SkipDocument) {
                if (options?.includeResultMetadata === false) {
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
              if (options) {
                return {
                  type: options?.includeResultMetadata === false ? "Document" : "ModifyResult",
                  result: await this.#collection.findOneAndDelete(
                    // @ts-expect-error
                    { $and: [{ _id }, filter] },
                    options
                  )
                };
              }
              return {
                type: "ModifyResult",
                result: await this.#collection.findOneAndDelete(
                  // @ts-expect-error
                  { $and: [{ _id }, filter] }
                )
              };
            },
            () => {
              if (options) {
                return this.#collection.findOneAndDelete(filter, options);
              }
              return this.#collection.findOneAndDelete(filter);
            },
            undefined,
            options
          )
        },
        options,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOneAndDelete"
          }
        }
      ),
      options
    );
  }
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options: AmendedFindOneAndUpdateOptions & { includeResultMetadata: true; }): Promise<ModifyResult<TSchema>>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options: AmendedFindOneAndUpdateOptions & { includeResultMetadata: false; }): Promise<WithId<TSchema> | null>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options: AmendedFindOneAndUpdateOptions): Promise<WithId<TSchema> | null>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: AmendedFindOneAndUpdateOptions): Promise<ModifyResult<TSchema> | WithId<TSchema> | null> {
    const argsOrig = [filter, update, options] as const;
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
          beforeHooksResult: [filter, update, options],
          invocationSymbol
        }) => {
          return this.#tryCatchUpdate(
            {
              args: [filter, update, options],
              argsOrig,
              caller: "findOneAndUpdate",
              filterMutator: {
                filter,
                mutator: update
              },
              parentInvocationSymbol: invocationSymbol
            },
            async ({
              _id,
              beforeHooksResult: chainedFilterMutator
            }) => {
              // this isn't likely to be useful - but it is technically valid.
              if (chainedFilterMutator === SkipDocument) {
                if (options?.includeResultMetadata === false) {
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

              if (options) {
                return {
                  type: options?.includeResultMetadata === false ? "Document" : "ModifyResult",
                  result: await this.#collection.findOneAndUpdate(
                    // @ts-expect-error
                    { $and: [{ _id }, chainedFilterMutator.filter] },
                    chainedFilterMutator.mutator,
                    options
                  )
                };
              }
              return {
                type: "ModifyResult",
                result: await this.#collection.findOneAndUpdate(
                  // @ts-expect-error
                  { $and: [{ _id }, chainedFilterMutator.filter] },
                  chainedFilterMutator.mutator
                )
              };
            },
            // no hooks...
            () => {
              if (options) {
                return this.#collection.findOneAndUpdate(filter, update, options);
              }
              return this.#collection.findOneAndUpdate(filter, update);
            },
            1,
            options
          )
        },
        options,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOneAndUpdate"
          }
        }
      ),
      options
    );
  }

  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options: AmendedFindOneAndReplaceOptions & { includeResultMetadata: true }): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options: AmendedFindOneAndReplaceOptions & { includeResultMetadata: false }): Promise<WithId<TSchema> | null>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options: AmendedFindOneAndReplaceOptions): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options?: AmendedFindOneAndReplaceOptions): Promise<WithId<TSchema> | ModifyResult<TSchema> | null> {
    const argsOrig = [filter, replacement, options] as const;
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
          args: [filter, replacement, options]
        },
        "args",
        ({
          beforeHooksResult: [filter, replacement, options],
          invocationSymbol
        }) => {
          return this.#tryCatchUpdate(
            {
              args: [filter, replacement, options],
              argsOrig,
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
                if (options?.includeResultMetadata === false) {
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
              if (options) {
                return {
                  type: options?.includeResultMetadata === false ? "Document" : "ModifyResult",
                  result: await this.#collection.findOneAndReplace(
                    // @ts-expect-error
                    { $and: [{ _id }, chainedFilterMutator.filter] },
                    chainedFilterMutator.replacement,
                    options
                  )
                };
              }
              return {
                type: "ModifyResult",
                result: await this.#collection.findOneAndReplace(
                  // @ts-expect-error
                  { $and: [{ _id }, chainedFilterMutator.filter] },
                  chainedFilterMutator.replacement
                )
              };
            },
            // no hooks...
            () => {
              if (options) {
                return this.#collection.findOneAndReplace(filter, replacement, options);
              }
              return this.#collection.findOneAndReplace(filter, replacement);
            },
            1,
            options
          )
        },
        options,
        {
          event: "findOne*",
          emitArgs: {
            operation: "findOneAndReplace"
          }
        }
      ),
      options
    );
  }
}
