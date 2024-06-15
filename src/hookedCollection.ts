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
} from 'mongodb';
import { HookedFindCursor } from "./hookedFindCursor.js";

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
import { ChainedListenerCallback, StandardInvokeHookOptions } from './awaiatableEventEmitter.js';
import { AmendedCountDocumentsOptions, AmendedCountOptions, AmendedEstimatedDocumentCountOptions, CollectionOnlyBeforeAfterErrorEventDefinitions } from './events/collectionEvents.js';
import { BeforeAfterErrorSharedEventDefinitions } from './events/sharedEvents.js';

function assertReplacementHasId<TSchema>(replacement: WithoutId<TSchema>): asserts replacement is OptionalUnlessRequiredId<TSchema> {
  if (!(replacement as OptionalUnlessRequiredId<TSchema>)._id) {
    throw new Error("Can't upsert without a _id");
  }
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
      // @ts-expect-error
      this.#map.set(id, this.#collection.findOne({ _id: id }, { projection: this.#projection}));
    }
    return this.#map.get(id) || Promise.resolve(null);
  }

  setDocument(id: InferIdType<TSchema>, doc: WithId<TSchema>): void {
    this.#map.set(id, Promise.resolve(doc));
  }
}

export class HookedCollection<
  //TSchemaOrDocument,
  TSchema extends Document// = TSchemaOrDocument extends Document ? TSchemaOrDocument : Document
> extends AbstractHookedCollection<TSchema> implements HookedCollectionInterface<TSchema> {
  #collection: Collection<TSchema>;
  static Events = Events;
  // #transform?: (doc: TSchema) => any;
  #ee: HookedEventEmitter<CollectionHookedEventMap<TSchema>> = new HookedEventEmitter<CollectionHookedEventMap<TSchema>>();
  #interceptExecute: boolean = false;

  constructor(collection: Collection<TSchema>) {
    super(collection);
    this.#collection = collection;
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
      this.#ee.callAllSyncChain(
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

  findOne<T = TSchema>(filter?: Filter<TSchema>, options?: AmendedFindOptions<TSchema> | undefined): Promise<T | null> {
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
            return this.#collection.findOne(chainedFilter, chainedOptions) as Promise<T | null>;
          }
          if (chainedFilter) {
            return this.#collection.findOne(chainedFilter) as Promise<T | null>;
          }
          return this.#collection.findOne() as Promise<T | null>;
        },
        options
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
      let cursor = new HookedFindCursor(
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
          invocationOptions: options
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
      ) => Promise<any>,
    BE extends `before.${IE}` & keyof HEM,
    IE extends keyof CollectionOnlyBeforeAfterErrorEventDefinitions<TSchema> | keyof BeforeAfterErrorSharedEventDefinitions<TSchema>,
    EA extends HEM[BE]["emitArgs"],
    OEA extends Omit<EA, "invocationSymbol" | "thisArg">
  >(
    internalEvent: IE,
    emitArgs: OEA,
    beforeChainKey: keyof OEA | undefined,
    fn: T,
    invocationOptions: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, `before.${IE}` | `after.${IE}.success`> | undefined
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
      internalEvent
    )
  }

  insertOne(doc: OptionalUnlessRequiredId<TSchema>, options?: AmendedInsertOneOptions<CollectionHookedEventMap<TSchema>>) {
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
                insertedId: null
              } as unknown as InsertOneResult<TSchema>;
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

  #upsert<ARGS extends UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>>(
    caller: CollectionBeforeAfterErrorEventDefinitions<TSchema>["insert"]["caller"],
    parentInvocationSymbol: symbol,
    argsOrig: ARGS,
    args: ARGS,
    fn: (args: ARGS) => Promise<UpdateResult | Document>,
    options: StandardInvokeHookOptions<any, any> | undefined,// QUESTIONable
    doc: OptionalUnlessRequiredId<TSchema> = {} as OptionalUnlessRequiredId<TSchema>,
  ): Promise<UpdateResult | Document> {
    return this.#tryCatchEmit(
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
        beforeHooksResult: doc // TODO - can we apply the doc?
      }) => fn(args),
      options,
    );
  }

  async #tryCatchDelete<
    BEAD extends CollectionBeforeAfterErrorEventDefinitions<TSchema>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: CollectionBeforeAfterErrorEventDefinitions<TSchema>["delete"]["before"]["returns"] }) => Promise<any>,
    T1 extends () => Promise<any>,
    BEA extends BEAD["delete"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, "before.delete" | "after.delete.success" | "after.delete.error" | "after.delete">
  ): Promise<DeleteResult> {
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
    const beforeProjection = unionOfProjections(beforeProjections);
    if (beforeListeners.length === 0 && afterListeners.length === 0) {
      return noListenersFn();
    }
    const cursor = this.#collection.find<{ _id: any }>(
      beforeEmitArgs.args[0],
      {
        projection: { _id: 1, ...(isBeforeGreedy ? beforeProjection : {}) },
        limit
      }
    );
    const result = {
      acknowledged: false,
      deletedCount: 0
    };
    const beforeDocumentCache = new DocumentCache(this.#collection, beforeProjection, isBeforeGreedy);
    const invocationSymbol = Symbol("delete");

    // TODO: this isn't right - it wont actually run in order :shrug:
    const promiseFn = beforeEmitArgs.args[1]?.ordered ? Promise.all.bind(Promise) : Promise.allSettled.bind(Promise);
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
        result.acknowledged = true;
        gotResult = true;
        const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
          Events.afterSuccess.delete,
          {
            ...beforeEmitArgs,
            invocationSymbol,
            _id,
            thisArg: this,
            result: partialResult,
          },
          "result",
          afterListeners
        );
        if (chainedResult !== undefined) {
          partialResult = chainedResult;
        }
        if (partialResult.deletedCount) {
          result.deletedCount++;
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
    return result;
  }

  async #tryCatchUpdate<
    BEAD extends CollectionBeforeAfterErrorEventDefinitions<TSchema>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: BEAD["update"]["before"]["returns"] }) => Promise<any>,
    T1 extends () => Promise<any>,
    BEA extends BEAD["update"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<CollectionHookedEventMap<TSchema>, "before.update" | "after.update.success" | "after.update.error" | "after.update">
  ): Promise<UpdateResult> {
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

    const beforeProjection = unionOfProjections(beforeProjections);
    if (beforeListeners.length === 0 && afterListeners.length === 0) {
      return noListenersFn();
    }
    const cursor = this.#collection.find<{ _id: any }>(
      beforeEmitArgs.args[0],
      {
        projection: { _id: 1, ...(isBeforeGreedy ? beforeProjection : {}) },
        limit
      }
    );
    let nextItem = await cursor.next();
    const result = {
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null
    }
    if (!nextItem) {
      if (beforeEmitArgs.args[2]?.upsert) {
        const upsertResult = await this.#upsert(
          "updateOne",
          beforeEmitArgs.parentInvocationSymbol,
          beforeEmitArgs.argsOrig,
          beforeEmitArgs.args,
          ([chainedFilter, chainedModifier, chainedOptions]) => {
            if (beforeEmitArgs.caller === "replaceOne") {
              assertReplacementHasId(chainedModifier as WithoutId<TSchema>);
              return this.#collection.replaceOne(chainedFilter, chainedModifier as WithoutId<TSchema>, chainedOptions);
            }
            else if (beforeEmitArgs.caller === "updateOne") {
              return this.#collection.updateOne(chainedFilter, chainedModifier, chainedOptions);
            }
            else if (beforeEmitArgs.caller === "updateMany") {
              return this.#collection.updateMany(chainedFilter, chainedModifier, chainedOptions);
            }
            throw new Error("Unrecognized caller");
          },
          invocationOptions,
          beforeEmitArgs.caller === "replaceOne" ? beforeEmitArgs[1] : undefined
        );
        if (upsertResult.upsertedId) {
          result.upsertedCount++;
          result.upsertedId = upsertResult.upsertedId;
        }
      }
      return result;
    }
    const beforeDocumentCache = new DocumentCache(this.#collection, beforeProjection, isBeforeGreedy);
    const afterDocumentCache = new DocumentCache(this.#collection, unionOfProjections(afterProjections), false);
    const invocationSymbol = Symbol("update");
    const promises: any[] = [];
    do {
      if (isBeforeGreedy) {
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
              {
                ...beforeEmitArgs,
                invocationSymbol,
                _id,
                getDocument: () => afterDocumentCache.getDocument(_id),
                thisArg: this,
                result: partialResult,
              },
              "result",
              afterListeners,
            );
            if (chainedResult !== undefined) {
              partialResult = chainedResult;
            }
          }
          if (partialResult.acknowledged) {
            result.acknowledged = true;
          }
          if (partialResult.matchedCount) {
            result.matchedCount++;
          }
          if (partialResult.modifiedCount) {
            result.modifiedCount++;
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
              _id,
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
    return result;
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
                  acknowledged: false,
                  matchedCount: 1,
                  modifiedCount: 0,
                  upsertedCount: 0,
                  upsertedId: null
                };
              }
              const { filter: chainedFilter, replacement: chainedReplacement } = chainedFilterMutator;
              return this.#collection.replaceOne(
                // @ts-expect-error
                { $and: [chainedFilter, { _id }] },
                chainedReplacement as WithoutId<TSchema>,
                args[2]
              );
            },
            () => this.#collection.replaceOne(...args),
            1,
            options
          );
        },
        options
      ),
      options
    );
  }

  updateOne(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema> | Partial<TSchema>,
    options?: AmendedUpdateOptions
  ) {
    const argsOrig = [filter, update, options] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "updateOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.updateOne,
        { args: argsOrig },
        "args",
        async ({
          beforeHooksResult: args,
          invocationSymbol
        }) => {
          return this.#tryCatchUpdate(
            {
              args,
              argsOrig,
              caller: "updateOne",
              filterMutator: {
                filter: args[0],
                mutator: args[1]
              },
              parentInvocationSymbol: invocationSymbol
            },
            // per document...
            async ({ beforeHooksResult: chainedFilterMutator, _id }) => {
              if (chainedFilterMutator === SkipDocument) {
                return {
                  acknowledged: false,
                  matchedCount: 1,
                  modifiedCount: 0,
                  upsertedCount: 0,
                  upsertedId: null
                };
              }
              const { filter: chainedFilter, mutator: chainedModifier } = chainedFilterMutator;
              return this.#collection.updateOne(
                // @ts-expect-error
                { $and: [chainedFilter, { _id }]},
                chainedModifier as UpdateFilter<TSchema>,
                args[2]
              );
            },
            // no hooks...
            () => this.#collection.updateOne(...args),
            1,
            options
          )
        },
        options
      ),
      options
    );
  }

  updateMany(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: AmendedUpdateOptions | undefined): Promise<UpdateResult<TSchema>> {
    const argsOrig = [filter, update, options] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "updateMany"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.updateMany,
        {
          args: argsOrig
        },
        'args',
        async ({
          invocationSymbol: parentInvocationSymbol,
          beforeHooksResult: args
        }) => {
          return this.#tryCatchUpdate(
            {
              args,
              argsOrig,
              caller: "updateMany",
              filterMutator: {
                filter: args[0],
                mutator: args[1]
              },
              parentInvocationSymbol
            },
            async ({
              beforeHooksResult: chainedFilterMutator,
              _id
            }) => {
              if (chainedFilterMutator === SkipDocument) {
                return {
                  acknowledged: false,
                  matchedCount: 1,
                  modifiedCount: 0,
                  upsertedCount: 0,
                  upsertedId: null
                };
              }
              const {
                filter,
                mutator
              } = chainedFilterMutator;
              // pull out upsert - we'll handle that separately if we detect no document matches.
              // we don't want a removal between the find above and this update to cause an upsert.
              const { upsert: _upsert, ...remainingChainedOptions } = args[2] || {};
              return this.#collection.updateOne(
                // @ts-expect-error _id could be anything :shrug:
                { $and: [{ _id }, filter] },
                mutator,
                remainingChainedOptions
              );
            },
            () => this.#collection.updateMany(...args),
            undefined,
            options
          );
        },
        options
      ),
      options
    );
  }

  deleteOne(filter: Filter<TSchema>, options?: AmendedDeleteOptions) {
    const argsOrig = [filter, options] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "deleteOne"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.deleteOne,
        { args: argsOrig },
        "args",
        async ({
          beforeHooksResult: args,
          invocationSymbol: parentInvocationSymbol
        }) => {
          return this.#tryCatchDelete(
            {
              caller: "deleteOne",
              argsOrig,
              args,
              parentInvocationSymbol,
              filter
            },
            async ({
              beforeHooksResult: chainedFilter,
              _id,
            }) => {
              if (chainedFilter === SkipDocument) {
                return {
                  acknowledged: false,
                  deletedCount: 0
                };
              }
              return this.#collection.deleteOne(
                // @ts-expect-error
                { $and: [chainedFilter, { _id }] },
                args[1]
              );
            },
            () => this.#collection.deleteOne(args[0], args[1]),
            1,
            options
          );
        },
        options
      ),
      options
    );
  }

  deleteMany(origFilter: Filter<TSchema>, origOptions?: AmendedDeleteOptions) {
    const argsOrig = [origFilter, origOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: argsOrig,
        operation: "deleteMany"
      },
      undefined,
      () => this.#tryCatchEmit(
        InternalEvents.deleteMany,
        { args: argsOrig },
        "args",
        async ({
          beforeHooksResult: [filter, options],
          invocationSymbol: parentInvocationSymbol
        }) => {
          return this.#tryCatchDelete(
            {
              caller: "deleteMany",
              argsOrig,
              filter,
              args: [filter, options],
              parentInvocationSymbol
            },
            async ({
              beforeHooksResult: chainedFilter,
              _id,
            }) => {
              if (chainedFilter === SkipDocument) {
                return {
                  deletedCount: 0
                };
              }
              return this.#collection.deleteOne(
                // @ts-expect-error
                { $and: [chainedFilter, { _id }] },
                options
              );
            },
            () => this.#collection.deleteMany(filter, options),
            undefined,
            options
          );
        },
        origOptions
      ),
      origOptions
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
        args: [options],
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
        options
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
        ({ beforeHooksResult: [options] }) => this.#collection.estimatedDocumentCount(options),
        options
      ),
      options
    );
  }

  countDocuments(filter?: Document | undefined, options?: AmendedCountDocumentsOptions | undefined): Promise<number> {
    return this.#tryCatchEmit(
      InternalEvents["*"],
      {
        args: [options],
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
        options
      ),
      options
    );
  }
}
