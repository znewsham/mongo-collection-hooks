import type {
  Collection,
  Document,
  InsertOneOptions,
  OptionalUnlessRequiredId,
  WithId,
  Filter,
  DistinctOptions,
  UpdateFilter,
  UpdateOptions,
  InsertManyResult,
  BulkWriteOptions,
  DeleteOptions,
  FindOptions,
  UpdateResult,
  ReplaceOptions,
  WithoutId,
  CountOptions,
  AggregateOptions,
  AggregationCursor,
  InferIdType,
  InsertOneResult,
  FindCursor,
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
} from "./events.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";
import { AbstractHookedCollection } from "./abstractCollectionImpl.js";
import { tryCatchEmit } from "./tryCatchEmit.js";

function assertReplacementHasId<TSchema>(replacement: WithoutId<TSchema>): asserts replacement is OptionalUnlessRequiredId<TSchema> {
  if (!(replacement as OptionalUnlessRequiredId<TSchema>)._id) {
    throw new Error("Can't upsert without a _id");
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

  aggregate<T extends Document>(pipeline: Document[], options?: AggregateOptions): AggregationCursor<T> {
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
            .filter(name => AggregateCursorEventsSet.has(name))
            .map(name => [name, this.#ee.listeners(name)])
          ) as Record<string, HookedListenerCallback<EventNames & typeof AggregateCursorEventsSet, TSchema, typeof this>>,
        }
      ) as HookedAggregationCursor<T>;

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
    options: DistinctOptions = {}
  ) {
    return this.#tryCatchEmit(
      InternalEvents.distinct,
      { args: [key, filter, options] },
      "args",
      ({ beforeHooksResult: [key, filter, options] }) => this.#collection.distinct(key, filter, options),
    );
  }

  findOne<T = TSchema>(filter?: Filter<TSchema>, options?: FindOptions<Document> | undefined): Promise<T | null> {
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
      }
    );
  }

  #find<T extends Document = TSchema>(filter?: Filter<TSchema>, options?: FindOptions): FindCursor<T> {
    if (filter && options) {
      return this.#collection.find<T>(filter, options);
    }
    else if (filter) {
      return this.#collection.find<T>(filter);
    }
    return this.#collection.find() as unknown as FindCursor<T>;
  }

  find<T extends Document = TSchema>(filter: Filter<TSchema> = {}, options?: FindOptions): HookedFindCursor<T> {
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
            .filter(name => FindCursorEventsSet.has(name))
            .map(name => [name, this.#ee.awaitableListeners(name)])
          ) as Record<string, HookedListenerCallback<EventNames & typeof FindCursorEventsSet, TSchema, typeof this>>
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
      internalEvent
    )
  }

  insertOne(doc: OptionalUnlessRequiredId<TSchema>, options?: InsertOneOptions) {
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
        }) => this.#collection.insertOne(beforeHooksResult, options)
      )
    );
  }

  insertMany(docs: OptionalUnlessRequiredId<TSchema>[], options?: BulkWriteOptions) {
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
      }
    );
  }

  #upsert<ARGS extends UpdateCallArgs<TSchema> | ReplaceCallArgs<TSchema>>(
    caller: BeforeAfterErrorEventDefinitions<TSchema, typeof this>["insert"]["caller"],
    parentInvocationSymbol: symbol,
    argsOrig: ARGS,
    args: ARGS,
    fn: (args: ARGS) => Promise<UpdateResult | Document>,
    doc: OptionalUnlessRequiredId<TSchema> = {} as OptionalUnlessRequiredId<TSchema>,// QUESTIONable
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
      }) => fn(args)
    );
  }

  replaceOne(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options?: ReplaceOptions | undefined): Promise<Document | UpdateResult<TSchema>> {
    const argsOrig = [filter, replacement, options] as const;
    return this.#tryCatchEmit(
      InternalEvents.replaceOne,
      { args: argsOrig },
      "args",
      async ({
        beforeHooksResult: args,
        invocationSymbol
      }) => {
        const docId = (await this.#collection.findOne(args[0], { projection: { _id: 1 } }))?._id;
        if (!docId) {
          const result = {
            acknowledged: true,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 0,
            upsertedId: null
          };
          if (options?.upsert) {
            assertReplacementHasId(replacement);
            const upsertResult = await this.#upsert(
              "replaceOne",
              invocationSymbol,
              argsOrig,
              args,
              ([chainedFilter, chainedReplacement, chainedOptions]) => this.#collection.replaceOne(chainedFilter, chainedReplacement, chainedOptions),
              replacement as OptionalUnlessRequiredId<TSchema>
            );
            if (!upsertResult.upsertedId) {
              result.upsertedCount = 1;
              result.upsertedId = upsertResult.upsertedId;
            }
          }
          return result;
        }
        return this.#tryCatchEmit(
          InternalEvents.update,
          {
            caller: "replaceOne",
            argsOrig,
            args,
            _id: docId,
            filterMutator: {
              filter: args[0],
              replacement: args[1]
            },
            parentInvocationSymbol: invocationSymbol
          },
          "filterMutator",
          ({
            beforeHooksResult: {
              filter,
              replacement
            }
          }) => this.#collection.replaceOne(filter, replacement as WithoutId<TSchema>, args[2]), // TODO: field wont be undefined here
        );
      }
    );
  }

  updateOne(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema> | Partial<TSchema>,
    options?: UpdateOptions
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
        const docId = (await this.#collection.findOne(args[0], { projection: { _id: 1 } }))?._id;
        if (!docId) {
          const result = {
            acknowledged: true,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 0,
            upsertedId: null
          };
          if (options?.upsert) {
            const upsertResult = await this.#upsert(
              "updateOne",
              invocationSymbol,
              argsOrig,
              args,
              ([chainedFilter, chainedModifier, chainedOptions]) => this.#collection.updateOne(chainedFilter, chainedModifier, chainedOptions)
            );
            if (!upsertResult.upsertedId) {
              result.upsertedCount = 1;
              result.upsertedId = upsertResult.upsertedId;
            }
          }
          return result;
        }
        return this.#tryCatchEmit(
          InternalEvents.update,
          {
            caller: "updateOne",
            argsOrig,
            args,
            _id: docId,
            filterMutator: {
              filter: args[0],
              mutator: args[1]
            },
            parentInvocationSymbol: invocationSymbol
          },
          "filterMutator",
          ({
            beforeHooksResult: {
              filter,
              mutator
            }
          }) => this.#collection.updateOne(filter, mutator as UpdateFilter<TSchema>, args[2]), // TODO: field wont be undefined here
        );
      }
    );
  }

  updateMany(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: UpdateOptions | undefined): Promise<UpdateResult<TSchema>> {
    const argsOrig = [filter, update, options] as const;
    return this.#tryCatchEmit(
      InternalEvents.updateMany,
      {
        args: argsOrig
      },
      'args',
      async ({
        invocationSymbol,
        beforeHooksResult: chainedArgs
      }) => {
        const [chainedFilter, chainedUpdate, chainedOptions] = chainedArgs;
        const result = {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
          upsertedId: null
        } as UpdateResult<TSchema>;
        if (options?.upsert) {
          const needsUpsert = (await this.countDocuments(chainedFilter)) === 0;
          if (needsUpsert) {
            const upsertResult = await this.#upsert(
              "updateMany",
              invocationSymbol,
              argsOrig,
              chainedArgs,
              ([chainedFilter, chainedModifer, chainedOptions]) => this.#collection.updateOne(chainedFilter, chainedModifer, chainedOptions)
            );
            if (upsertResult.upsertedId) {
              result.upsertedCount ++;
              result.upsertedId = upsertResult.upsertedId;
            }
          }
        }
        const cursor = this.#collection.find(chainedFilter).project({ _id: 1 });
        await Promise.all(await cursor.map(async ({ _id }) => {
          const partialResult = await this.#tryCatchEmit(
            InternalEvents.update,
            {
              args: chainedArgs,
              argsOrig,
              caller: "updateMany",
              _id,
              filterMutator: {
                filter: chainedFilter,
                mutator: chainedUpdate
              },
              parentInvocationSymbol: invocationSymbol
            },
            "filterMutator",
            ({
              beforeHooksResult: {
                filter,
                mutator
              }
            }) => {
              // pull out upsert - we'll handle that separately if we detect no document matches.
              // we don't want a removal between the find above and this update to cause an upsert.
              const { upsert: _upsert, ...remainingChainedOptions } = chainedOptions || {};
              return this.#collection.updateOne(
                // @ts-expect-error _id could be anything :shrug:
                { $and: [{ _id }, filter] },
                mutator,
                remainingChainedOptions
              );
            }
          );
          result.matchedCount += partialResult.matchedCount;
          result.modifiedCount += partialResult.modifiedCount;
        }).toArray());
        return result;
      }
    );
  }

  deleteOne(filter: Filter<TSchema>, options?: DeleteOptions) {
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
            ({ beforeHooksResult: filter }) => super.deleteOne(filter, options)
          );
        }
        else {
          return {
            acknowledged: true,
            deletedCount: 0
          };
        }
      }
    );
  }

  deleteMany(origFilter: Filter<TSchema>, origOptions?: DeleteOptions) {
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
            )
          );
          if (partialResult.acknowledged) {
            result.deletedCount += partialResult.deletedCount;
          }
        }).toArray();

        await promiseFn(promises);
        return result;
      });
  }

  on<K extends keyof HookedEventMap<TSchema, typeof this>>(
    eventName: K,
    listener: HookedListenerCallback<K, TSchema, typeof this>
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
