import {
  Collection,
  Document
} from "mongodb";

import { resolveOptions, MongoDBCollectionNamespace } from "mongodb/lib/utils.js";

import type {
  CollectionOptions,
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
  MongoClient,
  InferIdType,
  AggregateOptions,
  AggregationCursor,
} from 'mongodb';
import { HookedFindCursor } from "./hookedFindCursor.js";

import {
  AfterEventNames,
  BeforeAfterEventDefinitions,
  BeforeEventNames,
  EventDefinitions,
  HookedEventMap,
  EventNames,
  Events,
  FindCursorEventsSet,
  HookedEventEmitter,
  InternalEvents,
  internalSymbolToBeforeAfterKey,
  AggregateCursorEventsSet,
  HookedListenerCallback,
} from "./events.js";
import { ConvertCallbackArgsToArgs, ListenerCallback } from "./awaiatableEventEmitter.js";
import { HookedAggregationCursor } from "./hookedAggregationCursor.js";

interface HookedCollectionOptions<T> extends CollectionOptions {
  transform?(doc: T): any
}

type TryCatchEmitArgs<TSchema, This> = {
  insertOne: {
    args: EventDefinitions<TSchema, This>["before.insertOne"]["args"]
  }
  insertMany: {
    args: EventDefinitions<TSchema, This>["before.insertMany"]["args"]
  }
  insert: {
    argsOrig: EventDefinitions<TSchema, This>["before.insertOne"]["args"] | EventDefinitions<TSchema, This>["before.insertMany"]["args"]
    args: EventDefinitions<TSchema, This>["before.insert"]["args"],
    caller: EventDefinitions<TSchema, This>["before.insert"]["caller"],
    invocationSymbol: symbol
    doc: any
  }
  updateOne: {
    args: EventDefinitions<TSchema, This>["before.updateOne"]["args"]
  }
  updateMany: {
    args: EventDefinitions<TSchema, This>["before.updateMany"]["args"]
  }
  update: {
    argsOrig: EventDefinitions<TSchema, This>["before.updateOne"]["args"] | EventDefinitions<TSchema, This>["before.deleteMany"]["args"]
    args: EventDefinitions<TSchema, This>["before.updateOne"]["args"],
    caller: EventDefinitions<TSchema, This>["before.update"]["caller"],
    invocationSymbol: symbol
    docId: InferIdType<TSchema>
  }
  deleteOne: {
    args: EventDefinitions<TSchema, This>["before.deleteOne"]["args"]
  }
  deleteMany: {
    args: EventDefinitions<TSchema, This>["before.deleteMany"]["args"]
  }
  delete: {
    argsOrig: EventDefinitions<TSchema, This>["before.deleteOne"]["args"] | EventDefinitions<TSchema, This>["before.deleteMany"]["args"]
    args: EventDefinitions<TSchema, This>["before.delete"]["args"],
    caller: EventDefinitions<TSchema, This>["before.delete"]["caller"],
    invocationSymbol: symbol
    docId: InferIdType<TSchema>
  },
  distinct: {
    args: EventDefinitions<TSchema, This>["before.distinct"]["args"]
  }
}


export class HookedCollection<TSchema extends Document, U = any> extends Collection<TSchema> {
  static Events = Events;
  // #transform?: (doc: TSchema) => any;
  #ee = new HookedEventEmitter<HookedEventMap<TSchema, typeof this>>();
  #client: MongoClient;

  constructor(client: MongoClient, collectionName: string, {
    transform,
    ...options
  }: HookedCollectionOptions<TSchema> = {}) {
    // @ts-expect-error
    super(client.db(), collectionName, options);
    // this.#transform = transform;
    this.#client = client;
  }

  getNamespace(): MongoDBCollectionNamespace {
    return new MongoDBCollectionNamespace(this.dbName, this.collectionName);
  }

  aggregate<T extends Document>(pipeline: Document[], options?: AggregateOptions): AggregationCursor<T> {
    const invocationSymbol = Symbol();
    const [chainedPipeline, chainedOptions] = this.#ee.callSyncChainWithKey("before.aggregate", {
      args: [pipeline, options],
      invocationSymbol,
      thisArg: this
    }, "args");

    try {
      let cursor = new HookedAggregationCursor(
        this.#client,
        this.getNamespace(),
        chainedPipeline,
        {
          invocationSymbol,
          events: Object.fromEntries(
            this.#ee.eventNames()
            .filter(name => AggregateCursorEventsSet.has(name))
            .map(name => [name, this.#ee.listeners(name)])
          ),
          ...resolveOptions(this, chainedOptions)
        }
      ) as HookedAggregationCursor<TSchema>;

      const chainedCursor = this.#ee.callSyncChainWithKey("after.aggregate", {
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
      this.#ee.callSyncChainWithKey("after.aggregate", {
        args: [chainedPipeline, chainedOptions],
        error: e,
        argsOrig: [pipeline, options],
        thisArg: this,
        invocationSymbol
      }, "result");
      throw e;
    }
  }

  find<T extends Document = TSchema>(filter: Filter<TSchema> = {}, options?: FindOptions): HookedFindCursor<T> {
    const invocationSymbol = Symbol();
    const [chainedFilter, chainedOptions] = this.#ee.callSyncChainWithKey("before.find", {
      args: [filter, options],
      thisArg: this,
      invocationSymbol
    }, "args");
    try {
      const actualCursor = super.find<T>(chainedFilter, chainedOptions);

      // we need as X here because it's hard (impossible) to make the args aware of the custom T used by find vs TSchema of the collection
      let cursor = new HookedFindCursor(
        chainedFilter,
        actualCursor,
        {
          // transform: this.#transform,
          invocationSymbol,
          events: Object.fromEntries(
            this.#ee.eventNames()
            .filter(name => FindCursorEventsSet.has(name))
            .map(name => [name, this.#ee.awaitableListeners(name)])
          ) as Record<string, HookedListenerCallback<EventNames & typeof FindCursorEventsSet, TSchema, typeof this>>
        }
      ) as HookedFindCursor<T>;

      const chainedCursor = this.#ee.callSyncChainWithKey("after.find", {
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
      this.#ee.callSyncChainWithKey("after.find", {
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
    T extends (callArgs: { beforeHooksResult: BeforeAfterEventDefinitions<TSchema>[IE]["before"]["returns"], invocationSymbol: symbol }) => Promise<any>,
    IE extends keyof BeforeAfterEventDefinitions<TSchema> & keyof TryCatchEmitArgs<TSchema, typeof this>,
    EA extends TryCatchEmitArgs<TSchema, typeof this>[IE]
  >(
    internalEvent: IE,
    fn: T,
    emitArgs: EA,
  ): Promise<Awaited<ReturnType<T>>> {

    const invocationSymbol = Symbol();
    const parentInvocationSymbol = emitArgs["invocationSymbol"];
    const {
      before: beforeEvent,
      after: afterEvent
    }: { before: BeforeEventNames, after: AfterEventNames } = internalSymbolToBeforeAfterKey(internalEvent);
    const argsOrig = emitArgs.args;
    let argsToUse = emitArgs.args;
    if (this.#ee.listenerCount(beforeEvent)) {
      argsToUse = await this.#ee.callAwaitableChainWithArgs(beforeEvent, {
        ...emitArgs,
        invocationSymbol,
        thisArg: this,
        ...(parentInvocationSymbol && { parentInvocationSymbol }),
        ...(argsOrig && { args: argsOrig, argsOrig }),
      }) as BeforeAfterEventDefinitions<TSchema>[IE]["before"]["args"];
    }
    const afterCount = this.#ee.listenerCount(afterEvent);
    if (!afterCount) {
      return fn({
        beforeHooksResult: argsToUse,
        invocationSymbol
      });
    }
    let gotResult = false;
    try {
      let result = await fn({
        beforeHooksResult: argsToUse,
        invocationSymbol
      });
      gotResult = true;
      result = await this.#ee.callAwaitableChainWithResult(afterEvent, {
        ...(parentInvocationSymbol && { parentInvocationSymbol }),
        argsOrig,
        result,
        invocationSymbol,
        args: argsToUse,
        thisArg: this
      } as BeforeAfterEventDefinitions<TSchema>[IE]["after"]["emitArgs"]);
      return result;
    }
    catch (e) {
      if (!gotResult) {
        await this.#ee.callAwaitableInParallel(afterEvent, {
          error: e,
          parentInvocationSymbol,
          invocationSymbol,
          args: argsToUse,
          argsOrig,
          thisArg: this
        } as BeforeAfterEventDefinitions<TSchema>[IE]["after"]["emitArgs"]);
      }
      throw e;
    }
  }

  insertOne(doc: OptionalUnlessRequiredId<TSchema>, options?: InsertOneOptions) {
    const argsOrig = [doc, options] as const;
    return this.#tryCatchEmit(
      InternalEvents.insertOne,
      ({
        beforeHooksResult: args,
        invocationSymbol
      }) => this.#tryCatchEmit(
        InternalEvents.insert,
        ({
          beforeHooksResult,
        }) => super.insertOne(beforeHooksResult, args[1]),
        {
          caller: "insertOne",
          argsOrig,
          args,
          doc,
          invocationSymbol
        }
      ),
      { args: argsOrig }
    );
  }

  insertMany(docs: OptionalUnlessRequiredId<TSchema>[], options?: BulkWriteOptions) {
    return this.#tryCatchEmit(InternalEvents.insertMany, async ({
      invocationSymbol: parentInvocationSymbol
    }) => {
      const hasBefore = this.hasEvents(Events.before.insert);
      const hasAfter = this.hasEvents(Events.after.insert);
      if (!hasBefore && !hasAfter) {
        return super.insertMany(docs, options);
      }
      else {
        const invocationSymbols = new Map<string, symbol>();
        const docMap = new Map<symbol, OptionalUnlessRequiredId<TSchema>>();
        if (hasBefore) {
          docs = await Promise.all(docs.map(async (doc, index) => {
            const invocationSymbol = Symbol();
            docMap.set(invocationSymbol, doc);
            invocationSymbols.set(`${index}`, invocationSymbol);
            const ret = await this.#ee.callAwaitableChainWithArgs(
              Events.before.insert,
              {
                caller: "insertMany",
                doc,
                parentInvocationSymbol,
                args: [docs, options],
                argsOrig: [docs, options],
                invocationSymbol,
                thisArg: this
              }
            );
            return ret;
          }));
        }
        let ret: InsertManyResult<TSchema> | Promise<InsertManyResult<TSchema>> = super.insertMany(docs, options);
        if (hasAfter) {
          const retToUse = await ret;
          ret = retToUse;
          await Promise.all(Object.entries(ret.insertedIds).map(([indexString, insertedId]) => {
            const invocationSymbol = invocationSymbols.get(indexString) || Symbol();
            const doc = docMap.get(invocationSymbol);
            if (doc === undefined) {
              throw new Error("Impossible - we got an afterhook for a doc that wasn't inserted");
            }
            return this.#ee.callAwaitableChainWithArgs(
              Events.after.insert,
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
    }, { args: [docs, options] });
  }

  updateOne(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema> | Partial<TSchema>,
    options?: UpdateOptions
  ) {
    const argsOrig = [filter, update, options] as const;
    return this.#tryCatchEmit(
      InternalEvents.updateOne,
      async ({
        beforeHooksResult: args,
        invocationSymbol
      }) => {
        const docId = (await this.findOne(args[0], { projection: { _id: 1 } }))?._id;
        if (!docId) {
          return {
            acknowledged: true,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 0,
            upsertedId: null
          };
        }
        return this.#tryCatchEmit(
          InternalEvents.update,
          ({
            beforeHooksResult: [filter, update, options]
          }) => super.updateOne(filter, update, options),
          {
            caller: "updateOne",
            argsOrig,
            args,
            docId,
            invocationSymbol
          }
        );
      },
      { args: argsOrig }
    );
  }

  deleteOne(filter: Filter<TSchema>, options?: DeleteOptions) {
    const argsOrig = [filter, options] as const;
    return this.#tryCatchEmit(
      InternalEvents.deleteOne,
      async ({
        beforeHooksResult: args,
        invocationSymbol
      }) => {
        const docId = (await super.findOne(args[0], { projection: { _id: 1 } }))?._id;
        if (docId) {
          return this.#tryCatchEmit(
            InternalEvents.delete,
            ({ beforeHooksResult: filter }) => super.deleteOne(filter, options),
            {
              caller: "deleteOne",
              argsOrig,
              args,
              docId,
              invocationSymbol
            }
          );
        }
        else {
          return {
            acknowledged: true,
            deletedCount: 0
          };
        }
      },
      { args: argsOrig }
    );
  }

  deleteMany(origFilter: Filter<TSchema>, origOptions?: DeleteOptions) {
    const argsOrig = [origFilter, origOptions] as const;
    return this.#tryCatchEmit(InternalEvents.deleteMany, async ({
      beforeHooksResult: [filter, options],
      invocationSymbol
    }) => {
      const hasBefore = this.hasEvents(Events.before.delete);
      const hasAfter = this.hasEvents(Events.after.delete);
      if (!hasBefore && !hasAfter) {
        return super.deleteMany(filter, options);
      }
      const promiseFn = options?.ordered ? Promise.all : Promise.allSettled;
      const result = {
        acknowledged: true,
        deletedCount: 0
      };
      const cursor = super.find(filter).project({ _id: 1 });
      const promises = await cursor.map(async ({ _id }) => {
        const partialResult = await this.#tryCatchEmit(
          InternalEvents.delete,
          // QUESTION: why is this `as` necessary?
          ({
            beforeHooksResult: filter
          }) => super.deleteOne(
            { $and: [filter as { [P in keyof WithId<WithId<TSchema>>]}, { _id }] },
            options
          ),
          {
            caller: "deleteMany",
            argsOrig,
            docId: _id,
            args: [filter, options],
            invocationSymbol
          }
        );
        if (partialResult.acknowledged) {
          result.deletedCount += partialResult.deletedCount;
        }
      }).toArray();

      await promiseFn(promises);
      return result;
    }, { args: argsOrig });
  }

  distinct<Key extends keyof WithId<TSchema>>(
    key: Key,
    filter: Filter<TSchema> = {},
    options: DistinctOptions = {}
  ) {
    return this.#tryCatchEmit(
      InternalEvents.distinct,
      ({ beforeHooksResult: [key, filter, options] }) => super.distinct(key, filter, options),
      { args: [key, filter, options] }
    );
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
}
