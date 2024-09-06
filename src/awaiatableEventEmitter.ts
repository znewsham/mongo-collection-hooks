import { EventEmitter } from "node:events";

type PickArgs<O extends Record<string, { args: any[] }>> = {
  [k in keyof O]: O[k]["args"]
}

type Key<K, T> = T extends [never] ? string | symbol : K | keyof T;

export type ListenerCallback<
  K extends keyof T,
  T extends Record<string, { args?: any[], returns?: any, isPromise?: boolean }>
> = (
  T[K]["args"] extends unknown[] ? (...args: T[K]["args"]) => T[K]["isPromise"] extends false ? T[K]["returns"] | void : T[K]["returns"] | Promise<T[K]["returns"]> | void | Promise<void> : never
)

export type AwaitableEventMap = Record<string, {
  args: any[],
  returns?: any,
  isPromise?: boolean
}>
type DefaultAwaitableEventMap = AwaitableEventMap;

export class AwaiatableEventEmitter<
  EM extends AwaitableEventMap = DefaultAwaitableEventMap,
> extends EventEmitter<PickArgs<EM>> {
  awaitableListeners<K extends keyof EM>(eventName: Key<K, EM>): ListenerCallback<K, EM>[] {
    // @ts-expect-error
    return super.listeners(eventName);
  }

  awaitableOn<K extends keyof EM>(eventName: Key<K, EM>, listener: ListenerCallback<K, EM>): this {
    // @ts-expect-error
    return super.on(eventName, listener);
  }

  awaitableOff<K extends keyof EM>(eventName: Key<K, EM>, listener: ListenerCallback<K, EM>): this {
    // @ts-expect-error
    return super.off(eventName, listener);
  }
}

export type ConvertCallbackArgsToArgs<O extends Record<string, { callbackArgs: Record<string, any>, returns: any, isPromise: boolean }>> = {
  [k in keyof O]: {
    args: [O[k]["callbackArgs"]],
    returns: O[k]["returns"],
    isPromise: O[k]["isPromise"]
  }
}

export type ChainedCallbackEventMap = Record<string, {
  callbackArgs: any,
  returns: any,
  isPromise: boolean,
  emitArgs: any
}>
type DefaultChainedCallbackEventMap = ChainedCallbackEventMap;

export class ChainedAwaiatableEventEmitter<
  EM extends ChainedCallbackEventMap = DefaultChainedCallbackEventMap,
  SUPEM extends AwaitableEventMap = ConvertCallbackArgsToArgs<EM>,
  SYNCEM extends ChainedCallbackEventMap = {
    [k in keyof EM as (EM[k]["isPromise"] extends false ? k : never)]: EM[k]
  }
> extends AwaiatableEventEmitter<SUPEM> {

  #callSyncChainWithKey<K extends keyof SUPEM & keyof EM & keyof SYNCEM, CK extends string & keyof EM[K]["emitArgs"]>(
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK,
    origChainedValue: EM[K]["emitArgs"][CK]
  ): EM[K]["returns"] {
    const origKey = `${chainKey}Orig`;
    const {
      ...remainderOfEmitArgs
    } = emitArgs;
    let chainedValue = origChainedValue;

    const listeners = this.awaitableListeners(eventName as Key<K, SUPEM>);
    for (const listener of listeners) {
      const perListenerArgs: EM[K]["callbackArgs"] = {
        ...remainderOfEmitArgs,
        [chainKey]: chainedValue,
        [origKey]: origChainedValue
      };
      const listenerResult = listener(perListenerArgs);
      if (listenerResult instanceof Promise) {
        throw new Error(`${eventName as string} Hook returned a Promise. This is a mistake`);
      }
      if (listenerResult !== undefined) {
        chainedValue = listenerResult;
      }
    }
    return chainedValue;
  }

  callSyncChainWithKey<K extends keyof SUPEM & keyof EM & keyof SYNCEM>(
    eventName: Key<K, SUPEM> & K, // weird - but this is what enforces the keyof SYNCEM
    emitArgs: EM[K]["emitArgs"],
    chainKey: string
  ): EM[K]["returns"] {
    return this.#callSyncChainWithKey(eventName, emitArgs, chainKey, emitArgs[chainKey]);
  }

  callSyncChain<K extends keyof SUPEM & keyof EM & keyof SYNCEM>(
    eventName: Key<K, SUPEM> & K, // weird - but this is what enforces the keyof SYNCEM
    emitArgs: EM[K]["emitArgs"]
  ): void {
    const listeners = this.awaitableListeners(eventName as Key<K, SUPEM>);
    listeners.forEach(listener => listener(emitArgs));
  }

  callAllSyncChainWithKey<MK extends keyof SUPEM & keyof EM & keyof SYNCEM, K extends keyof SUPEM & keyof EM & keyof SYNCEM>(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: string,
    masterEventName: Key<MK, SUPEM> & K,
    ...eventNames: (Key<K, SUPEM> & K)[]
  ) {
    const origKey = `${chainKey}Orig`;
    const origChainedValue = emitArgs[chainKey];
    let chainedValue = origChainedValue;
    for (const eventName of [masterEventName, ...eventNames]) {
      const chainedResult = this.#callSyncChainWithKey(
        eventName as Key<K, SUPEM>,
        {
          [chainKey]: chainedValue,
          ...emitArgs
        },
        chainKey,
        origChainedValue
      );
      if (chainedResult !== undefined) {
        chainedValue = chainedResult;
      }
    }
    return chainedValue;
  }

  async #callAwaitableChainWithKey<K extends keyof SUPEM & keyof EM> (
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"],
    chainKey: string,
    origChainedValue
  ): Promise<EM[K]["returns"]> {
    const origKey = `${chainKey}Orig`;
    const {
      ...remainderOfEmitArgs
    } = emitArgs;

    let chainedValue = emitArgs[chainKey];

    const listeners = this.awaitableListeners(eventName);
    for (const listener of listeners) {
      const perListenerArgs: EM[K]["callbackArgs"] = {
        ...remainderOfEmitArgs,
        [chainKey]: chainedValue,
        [origKey]: origChainedValue
      };
      const listenerResult = await listener(perListenerArgs);
      if (listenerResult !== undefined) {
        chainedValue = listenerResult;
      }
    }
    return chainedValue;
  }

  async callAwaitableChainWithKey<K extends keyof SUPEM & keyof EM> (
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"],
    chainKey: string
  ): Promise<EM[K]["returns"]> {
    const origChainedValue = emitArgs[chainKey];
    return this.#callAwaitableChainWithKey(
      eventName,
      emitArgs,
      chainKey,
      origChainedValue
    );
  }

  async callAwaitableChainWithArgs<K extends keyof SUPEM & keyof EM> (
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"]
  ) {
    return this.callAwaitableChainWithKey(
      eventName,
      emitArgs,
      "args"
    )
  }

  async callAwaitableChainWithResult<K extends keyof SUPEM & keyof EM> (
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"]
  ) {
    return this.callAwaitableChainWithKey(
      eventName,
      emitArgs,
      "result"
    )
  }

  async callAwaitableInParallel<K extends keyof SUPEM & keyof EM> (
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"],
  ) {
    // TODO: still need to ensure that *Orig
    const listeners = this.awaitableListeners(eventName);
    return Promise.all(listeners.map(listener => listener(emitArgs)));
  }

  async callAllAwaitableInParallel<MK extends keyof SUPEM & keyof EM, K extends keyof SUPEM & keyof EM>(
    emitArgs: EM[MK]["emitArgs"],
    masterEventName: Key<MK, SUPEM>,
    ...eventNames: Key<K, SUPEM>[]
  ) {
    const allListeners = [masterEventName, ...eventNames].flatMap(eventName => this.awaitableListeners(eventName as Key<K, SUPEM>));
    return Promise.all(allListeners.map(listener => listener(emitArgs)));
  }

  async callAllAwaitableChainWithKey<MK extends keyof SUPEM & keyof EM, K extends keyof SUPEM & keyof EM>(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: string,
    masterEventName: Key<MK, SUPEM>,
    ...eventNames: Key<K, SUPEM>[]
  ) {
    const origKey = `${chainKey}Orig`;
    let chainedValue = emitArgs[chainKey];
    const origChainedValue = chainedValue;
    for (const eventName of [masterEventName, ...eventNames]) {
      const chainedResult = await this.#callAwaitableChainWithKey(
        eventName as Key<K, SUPEM>,
        {
          ...emitArgs,
          [chainKey]: chainedValue,
        },
        chainKey,
        origChainedValue
      );
      if (chainedResult !== undefined) {
        chainedValue = chainedResult;
      }
    }
    return chainedValue;
  }
}
