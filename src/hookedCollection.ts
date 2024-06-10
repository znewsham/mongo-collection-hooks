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
} from 'mongodb';
import { HookedFindCursor } from "./hookedFindCursor.js";

import {
  BeforeAfterErrorEventDefinitions,
  HookedEventMap,
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
  RecursiveKeyOf,
  NestedProjectionOfTSchema,
  BeforeAfterAggregateCursorNames,
  BeforeAferFindCursorNames,
} from "./events.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";
import { AbstractHookedCollection } from "./abstractCollectionImpl.js";
import { tryCatchEmit } from "./tryCatchEmit.js";
import { unionOfProjections } from './utils.js';
import { ChainedListenerCallback, StandardInvokeHookOptions } from './awaiatableEventEmitter.js';

function assertReplacementHasId<TSchema>(replacement: WithoutId<TSchema>): asserts replacement is OptionalUnlessRequiredId<TSchema> {
  if (!(replacement as OptionalUnlessRequiredId<TSchema>)._id) {
    throw new Error("Can't upsert without a _id");
  }
}

class DocumentCache<TSchema extends Document> {
  #map: Map<InferIdType<TSchema>, Promise<WithId<TSchema> | null>>;
  #collection: Collection<TSchema>;
  #projection: NestedProjectionOfTSchema<TSchema>;

  constructor(collection: Collection<TSchema>, projection: NestedProjectionOfTSchema<TSchema>) {
    this.#collection = collection;
    this.#projection = projection;
  }

  getDocument(id: InferIdType<TSchema>): Promise<WithId<TSchema> | null> {
    if (!this.#map.has(id)) {
      // @ts-expect-error
      this.#map.set(id, this.#collection.findOne({ _id: id }, { projection: this.#projection}));
    }
    return this.#map.get(id) || Promise.resolve(null);
  }
}


export class HookedCollection<TSchema extends Document> extends AbstractHookedCollection<TSchema> {
  #collection: Collection<TSchema>;
  static Events = Events;
  // #transform?: (doc: TSchema) => any;
  #ee = new HookedEventEmitter<HookedEventMap<TSchema, typeof this>>();
  #interceptExecute: boolean = false;

  constructor(collection: Collection<TSchema>) {
    super(collection);
    this.#collection = collection;
  }

  aggregate<T extends Document>(pipeline: Document[], options?: AmendedAggregateOptions): AggregationCursor<T> {
    const invocationSymbol = Symbol();
    const [chainedPipeline, chainedOptions] = this.#ee.callSyncChainWithKey("before.aggregate", {
      args: [pipeline, options],
      invocationSymbol,
      thisArg: this
    }, "args");

    try {
      const actualCursor = this.#collection.aggregate(chainedPipeline, chainedOptions);
      let cursor = new HookedAggregationCursor(
        actualCursor,
        {
          invocationSymbol,
          events: Object.fromEntries(
            this.#ee.eventNames()
            .filter(name => AggregateCursorEventsSet.has(name as BeforeAfterAggregateCursorNames))
            .map(name => [name, this.#ee.awaitableListeners(name)])
          ),
        }
      ) as unknown as HookedAggregationCursor<T>;

      const chainedCursor = this.#ee.callSyncChainWithKey(Events.afterSuccess["aggregate"], {
        args: [chainedPipeline, chainedOptions],
        result: cursor,
        argsOrig: [pipeline, options],
        thisArg: this,
        invocationSymbol
      }, "result");
      if (chainedCursor !== undefined) {
        cursor = chainedCursor;
      }

      return chainedCursor as unknown as HookedAggregationCursor<T>;
    }
    catch (e) {
      this.#ee.callSyncChain(Events.afterError["aggregate"], {
        args: [chainedPipeline, chainedOptions],
        error: e,
        argsOrig: [pipeline, options],
        thisArg: this,
        invocationSymbol
      });
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

  find<T extends Document = TSchema>(filter: Filter<TSchema> = {}, options?: AmendedFindOptions<TSchema>): HookedFindCursor<T> {
    const invocationSymbol = Symbol();
    const [chainedFilter, chainedOptions] = this.#ee.callSyncChainWithKey(Events.before.find, {
      args: [filter, options],
      thisArg: this,
      invocationSymbol
    }, "args");
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
            .filter(name => FindCursorEventsSet.has(name as BeforeAferFindCursorNames))
            .map(name => [name, this.#ee.awaitableListeners(name)])
          ) as Record<string, HookedListenerCallback<EventNames & typeof FindCursorEventsSet, TSchema, typeof this>>,
          invocationOptions: options
        }
      ) as HookedFindCursor<T>;

      const chainedCursor = this.#ee.callSyncChainWithKey(Events.afterSuccess.find, {
        args: [chainedFilter, chainedOptions],
        result: cursor,
        argsOrig: [filter, options],
        thisArg: this,
        invocationSymbol
      }, "result");
      if (chainedCursor !== undefined) {
        cursor = chainedCursor;
      }
      return cursor as unknown as HookedFindCursor<T>;
    }
    catch (e) {
      this.#ee.callSyncChainWithKey(Events.afterError.find, {
        args: [chainedFilter, chainedOptions],
        error: e,
        argsOrig: [filter, options],
        thisArg: this,
        invocationSymbol
      }, "result");
      throw e;
    }
  }

  hasEvents(eventName: EventNames) {
    return this.#ee.listenerCount(eventName) !== 0;
  }

  async #tryCatchEmit<
    BEAD extends BeforeAfterErrorEventDefinitions<TSchema, typeof this>,
    T extends (callArgs: BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["args"] extends never ? { invocationSymbol: symbol } : { invocationSymbol: symbol, beforeHooksResult: BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["returns"] }) => Promise<any>,
    IE extends keyof BEAD & ("insertOne" | "insertMany" | "insert" | "replaceOne" | "updateOne" | "updateMany" | "update" | "deleteOne" | "deleteMany" | "delete" | "distinct" | "aggregate" | "findOne"),
    EA extends BEAD[IE]["before"]["emitArgs"],
    OEA extends Omit<EA, "invocationSymbol" | "thisArg">
  >(
    internalEvent: IE,
    emitArgs: OEA,
    beforeChainKey: keyof OEA,
    fn: T,
    invocationOptions: StandardInvokeHookOptions<`before.${IE}` | `after.${IE}.success`, HookedEventMap<TSchema, typeof this>> | undefined
  ): Promise<Awaited<ReturnType<T>>> {
    let {
      args,
      caller,
      ...remainingEmitArgs
    } = emitArgs as OEA & {
      args: EA["args"] extends never ? undefined : EA["args"],
      caller: BEAD[IE]["caller"] extends never ? undefined : BEAD[IE]["caller"]
    };

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
      undefined,
      undefined,
      internalEvent
    )
  }

  insertOne(doc: OptionalUnlessRequiredId<TSchema>, options?: AmendedInsertOneOptions) {
    const argsOrig = [doc, options] as const;
    return this.#tryCatchEmit(
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
        ({
          beforeHooksResult,
        }) => this.#collection.insertOne(beforeHooksResult, options),
        options
      ),
      options
    );
  }

  insertMany(docs: OptionalUnlessRequiredId<TSchema>[], options?: AmendedBulkWriteOptions) {
    return this.#tryCatchEmit(
      InternalEvents.insertMany,
      { args: [docs, options] },
      "args",
      async ({
        invocationSymbol: parentInvocationSymbol
      }) => {
        const hasBefore = this.hasEvents(Events.before.insert);
        const hasAfter = this.hasEvents(Events.afterSuccess.insert);
        if (!hasBefore && !hasAfter) {
          return this.#collection.insertMany(docs, options);
        }
        else {
          const invocationSymbols = new Map<string, symbol>();
          const docMap = new Map<symbol, OptionalUnlessRequiredId<TSchema>>();
          if (hasBefore) {
            docs = await Promise.all(docs.map(async (doc, index) => {
              const invocationSymbol = Symbol();
              docMap.set(invocationSymbol, doc);
              invocationSymbols.set(`${index}`, invocationSymbol);
              const ret = await this.#ee.callAwaitableChainWithKey(
                Events.before.insert,
                {
                  caller: "insertMany",
                  doc,
                  parentInvocationSymbol,
                  args: [docs, options],
                  argsOrig: [docs, options],
                  invocationSymbol,
                  thisArg: this
                },
                "doc"
              );
              return ret;
            }));
          }
          let ret: InsertManyResult<TSchema> | Promise<InsertManyResult<TSchema>> = this.#collection.insertMany(docs, options);
          if (hasAfter) {
            const retToUse = await ret;
            ret = retToUse;
            await Promise.all(Object.entries(ret.insertedIds).map(([indexString, insertedId]) => {
              const invocationSymbol = invocationSymbols.get(indexString) || Symbol();
              const doc = docMap.get(invocationSymbol);
              if (doc === undefined) {
                throw new Error("Impossible - we got an afterhook for a doc that wasn't inserted");
              }
              // TODO: afterError
              return this.#ee.callAwaitableChainWithArgs(
                Events.afterSuccess.insert,
                {
                  caller: "insertMany",
                  args: [docs, options],
                  doc,
                  argsOrig: [docs, options],
                  result: {
                    acknowledged: retToUse.acknowledged,
                    insertedId
                  },
                  parentInvocationSymbol,
                  invocationSymbol,
                  thisArg: this
                }
              );
            }));
          }
          return ret;
        }
      },
      options
    );
  }

  #upsert<ARGS extends UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>>(
    caller: BeforeAfterErrorEventDefinitions<TSchema, typeof this>["insert"]["caller"],
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

  async #tryCatchUpdate<
    BEAD extends BeforeAfterErrorEventDefinitions<TSchema, typeof this>,
    T extends (callArgs: { invocationSymbol: symbol, _id: InferIdType<TSchema>, beforeHooksResult: BeforeAfterErrorEventDefinitions<TSchema>["update"]["before"]["returns"] }) => Promise<any>,
    T1 extends () => Promise<any>,
    BEA extends BEAD["update"]["before"]["emitArgs"],
    OBEA extends Omit<BEA, "invocationSymbol" | "thisArg" | "getDocument" | "_id">
  >(
    beforeEmitArgs: OBEA,
    perDocFn: T,
    noListenersFn: T1,
    limit: number | undefined,
    invocationOptions?: StandardInvokeHookOptions<"before.update" | "after.update.success", HookedEventMap<TSchema, typeof this>>
  ): Promise<UpdateResult> {

    const beforeListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.before.update, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(...beforeEmitArgs.argsOrig);
    });
    const afterListenersWithOptions = this.#ee.relevantAwaitableListenersWithOptions(Events.afterSuccess.update, invocationOptions)
    .filter(({ options: hookOptions }) => {
      return !hookOptions?.shouldRun || hookOptions.shouldRun(...beforeEmitArgs.argsOrig);
    });
    const beforeProjections = beforeListenersWithOptions.map(({ options }) => options?.projection || {});
    const beforeListeners = beforeListenersWithOptions.map(({ listener }) => listener);
    const afterProjections = afterListenersWithOptions.map(({ options }) => options?.projection || {});
    const afterListeners = afterListenersWithOptions.map(({ listener }) => listener);
    if (beforeListeners.length === 0 && afterListeners.length === 0) {
      return noListenersFn();
    }
    const cursor = this.#collection.find<{ _id: any }>(
      beforeEmitArgs.args[0],
      {
        projection: { _id: 1 },
        limit
      }
    );
    let nextItem = await cursor.next();
    const result = {
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null
    }
    if (!nextItem) {
      // TODO: upsert
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
    const beforeDocumentCache = new DocumentCache(this.#collection, unionOfProjections(beforeProjections));
    const afterDocumentCache = new DocumentCache(this.#collection, unionOfProjections(afterProjections));
    const invocationSymbol = Symbol();
    const promises: any[] = [];
    do {
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
          const chainedResult = await this.#ee.callExplicitAwaitableListenersChainWithKey(
            Events.afterSuccess.update,
            {
              ...beforeEmitArgs,
              invocationSymbol,
              _id,
              getDocument: () => afterDocumentCache.getDocument(_id),
              thisArg: this,
              result,
            },
            "result",
            afterListeners,
          );
          if (chainedResult !== undefined) {
            partialResult = chainedResult;
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
              thisArg: this,
              error: e
            },
            Events.afterError.update,
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
          ({ beforeHooksResult: { filter: chainedFilter, replacement: chainedReplacement }, _id }) => this.#collection.replaceOne(
            // @ts-expect-error
            { $and: [chainedFilter, { _id }] },
            chainedReplacement as WithoutId<TSchema>,
            args[2]
          ),
          () => this.#collection.replaceOne(...args),
          1,
          options
        );
      },
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
          ({ beforeHooksResult: { filter: chainedFilter, mutator: chainedModifier }, _id }) => this.#collection.updateOne(
            // @ts-expect-error
            { $and: [chainedFilter, { _id }]},
            chainedModifier as UpdateFilter<TSchema>,
            args[2]
          ),
          // no hooks...
          () => this.#collection.updateOne(...args),
          1,
          options
        )
      },
      options
    );
  }

  updateMany(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: AmendedUpdateOptions | undefined): Promise<UpdateResult<TSchema>> {
    const argsOrig = [filter, update, options] as const;
    return this.#tryCatchEmit(
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
          ({
            beforeHooksResult: {
              filter,
              mutator
            },
            _id
          }) => {
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
    );
  }

  deleteOne(filter: Filter<TSchema>, options?: AmendedDeleteOptions) {
    const argsOrig = [filter, options] as const;
    return this.#tryCatchEmit(
      InternalEvents.deleteOne,
      { args: argsOrig },
      "args",
      async ({
        beforeHooksResult: args,
        invocationSymbol
      }) => {
        const docId = (await this.#collection.findOne(args[0], { projection: { _id: 1 } }))?._id;
        if (docId) {
          return this.#tryCatchEmit(
            InternalEvents.delete,
            {
              caller: "deleteOne",
              argsOrig,
              args,
              _id: docId,
              parentInvocationSymbol: invocationSymbol,
              filter
            },
            "filter",
            ({ beforeHooksResult: filter }) => super.deleteOne(filter, options),
            options
          );
        }
        else {
          return {
            acknowledged: true,
            deletedCount: 0
          };
        }
      },
      options
    );
  }

  deleteMany(origFilter: Filter<TSchema>, origOptions?: AmendedDeleteOptions) {
    const argsOrig = [origFilter, origOptions] as const;
    return this.#tryCatchEmit(
      InternalEvents.deleteMany,
      { args: argsOrig },
      "args",
      async ({
        beforeHooksResult: [filter, options],
        invocationSymbol
      }) => {
        const hasBefore = this.hasEvents(Events.before.delete);
        const hasAfter = this.hasEvents(Events.afterSuccess.delete) || this.hasEvents(Events.afterError.delete);
        if (!hasBefore && !hasAfter) {
          return super.deleteMany(filter, options);
        }
        const promiseFn = options?.ordered ? Promise.all : Promise.allSettled;
        const result = {
          acknowledged: true,
          deletedCount: 0
        };
        const cursor = this.#collection.find(filter).project({ _id: 1 });
        const promises = await cursor.map(async ({ _id }) => {
          const partialResult = await this.#tryCatchEmit(
            InternalEvents.delete,
            {
              caller: "deleteMany",
              argsOrig,
              _id,
              filter,
              args: [filter, options],
              parentInvocationSymbol: invocationSymbol
            },
            "filter",
            // QUESTION: why is this `as` necessary?
            ({
              beforeHooksResult: filter
            }) => super.deleteOne(
              { $and: [filter as { [P in keyof WithId<WithId<TSchema>>]}, { _id }] },
              options
            ),
            origOptions
          );
          if (partialResult.acknowledged) {
            result.deletedCount += partialResult.deletedCount;
          }
        }).toArray();

        await promiseFn(promises);
        return result;
      },
      origOptions);
  }

  on<K extends keyof HookedEventMap<TSchema, typeof this>>(
    eventName: K,
    listener: HookedListenerCallback<K, TSchema, typeof this>,
    options?: HookedEventMap<TSchema, typeof this>[K]["options"]
  ) {
    return this.#ee.awaitableOn(eventName, listener);
  }

  off<
    K extends keyof HookedEventMap<TSchema, typeof this> & EventNames
  >(
    eventName: K,
    listener: HookedListenerCallback<K, TSchema, typeof this>
  ) {
    return this.#ee.awaitableOff(eventName, listener);
  }

  count(filter?: Filter<TSchema> | undefined, options?: CountOptions | undefined): Promise<number> {
    return this.#collection.count(filter, options);
  }
}
