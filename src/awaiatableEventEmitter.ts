import { EventEmitter } from "node:events";

type PickArgs<O extends Record<string, { args: any[] }>> = {
  [k in keyof O]: O[k]["args"]
}

type Key<K, T> = T extends [never] ? string | symbol : K | keyof T;

export type ListenerCallback<
  K extends keyof T,
  T extends Record<string, { args?: any[], returns?: any }>
> = (
  T[K]["args"] extends unknown[] ? (...args: T[K]["args"]) => Promise<T[K]["returns"]> | void | Promise<void> : never
)

export type AwaitableEventMap = Record<string, {
  args: any[],
  returns?: any
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

export type ConvertCallbackArgsToArgs<O extends Record<string, { callbackArgs: Record<string, any>, returns: any }>> = {
  [k in keyof O]: {
    args: [O[k]["callbackArgs"]],
    returns: O[k]["returns"]
  }
}

export type ChainedCallbackEventMap = Record<string, any>
type DefaultChainedCallbackEventMap = ChainedCallbackEventMap;

export class ChainedAwaiatableEventEmitter<
  EM extends ChainedCallbackEventMap = DefaultChainedCallbackEventMap,
  SUPEM extends AwaitableEventMap = ConvertCallbackArgsToArgs<EM>
> extends AwaiatableEventEmitter<SUPEM> {

  async callAwaitableChainWithKey<K extends keyof SUPEM & keyof EM> (
    eventName: Key<K, SUPEM>,
    emitArgs: EM[K]["emitArgs"],
    chainKey: string
  ): Promise<EM[K]["returns"]> {
    const origKey = `${chainKey}Orig`;
    const {
      [chainKey]: origChainedValue,
      ...remainderOfEmitArgs
    } = emitArgs;

    let chainedValue = origChainedValue;

    const listeners = this.awaitableListeners(eventName);
    for (const listener of listeners) {
      const perListenerArgs: EM[K]["callbackArgs"] = {
        ...remainderOfEmitArgs,
        [chainKey]: chainedValue,
        [origKey]: origChainedValue
      };
      const listenerResult = await listener(perListenerArgs);
      if (listenerResult) {
        chainedValue = listenerResult;
      }
    }
    return chainedValue;
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
}
