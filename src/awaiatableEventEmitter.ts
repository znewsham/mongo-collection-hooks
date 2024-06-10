
/** These apply to all hooks */
export type StandardDefineHookOptions = {
  /** A set of tags for this hook - e.g., "direct" or "raw" - which can be provided as one of the options to all operations to filter which hooks run at a high level*/
  tags?: string[]
}

export type StandardInvokeHookOptions<K extends keyof EM, EM extends ChainedCallbackEventMap> = {
  /** Filter the hooks to only run those which include one of these tags */
  includeTags?: string[],
  /** Filter the hooks to only run those which don't include one of these tags */
  excludeTags?: string[]
  /** A function to run to determine whether a hook should be ran or not */
  includeHook?: <HK extends K>(hookName: HK, hook: ChainedListenerCallback<HK, EM>, options?: EM[K]["options"]) => boolean
}


export type ChainedCallbackEntry<EMITARGS = any, CBARGS extends EMITARGS = any> = {
  callbackArgs: CBARGS,
  returns: any,
  isPromise: boolean,
  emitArgs: EMITARGS,
  options: StandardDefineHookOptions
}

export type ChainedCallbackEventMap = Record<string, ChainedCallbackEntry>
type DefaultChainedCallbackEventMap = ChainedCallbackEventMap;

type CallbackAndOptionsOfEm<EM extends ChainedCallbackEventMap, K extends keyof EM> = {
  options?: EM[K]["options"],
  listener: ChainedListenerCallback<K, EM>
}

type CallbackAndOptionsMap<
  EM extends ChainedCallbackEventMap,
  K extends keyof EM = keyof EM
> = Map<K, CallbackAndOptionsOfEm<EM, K>[]>


export type ChainedListenerCallback<
  K extends keyof T,
  T extends ChainedCallbackEventMap
> = (
  T[K]["callbackArgs"] extends object ? (...args: [T[K]["callbackArgs"]]) => T[K]["isPromise"] extends false ? T[K]["returns"] | void : T[K]["returns"] | Promise<T[K]["returns"]> | void | Promise<void> : never
)

function filterHooksWithOptions<K extends keyof EM, EM extends ChainedCallbackEventMap>(eventName: K, hooksWithOptions: CallbackAndOptionsOfEm<EM, K>[], options: StandardInvokeHookOptions<K, EM>): CallbackAndOptionsOfEm<EM, K>[] {
  const runExclude = !!options?.excludeTags;
  const runInclude = !!options?.includeTags;
  const excludeSet = new Set(options?.excludeTags || []);
  const includeSet = new Set(options?.includeTags || []);

  return hooksWithOptions.filter(({ options: hookOptions, listener }) => {
    if (!options) {
      return true;
    }
    if (options.includeHook && !options.includeHook(eventName, listener, hookOptions)) {
      return false;
    }
    if (!hookOptions?.tags?.length) {
      return !runInclude;
    }
    return hookOptions.tags.every(tag => !runExclude || !excludeSet.has(tag)) && hookOptions.tags.some(tag => !runInclude || includeSet.has(tag));
  });
}

export class ChainedAwaiatableEventEmitter<
  EM extends ChainedCallbackEventMap = DefaultChainedCallbackEventMap,
  SYNCEM extends ChainedCallbackEventMap = {
    [k in keyof EM as (EM[k]["isPromise"] extends false ? k : never)]: EM[k]
  }
> {
  #listenersMap: CallbackAndOptionsMap<EM> = new Map();

  #callSyncChainWithKey<K extends keyof EM & keyof SYNCEM, CK extends string & keyof EM[K]["emitArgs"]>(
    eventName: K,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK,
    origChainedValue: EM[K]["emitArgs"][CK]
  ): EM[K]["returns"] {
    const origKey = `${chainKey}Orig`;
    const {
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

  callSyncChainWithKey<K extends keyof EM & keyof SYNCEM>(
    eventName: K, // weird - but this is what enforces the keyof SYNCEM
    emitArgs: EM[K]["emitArgs"],
    chainKey: string
  ): EM[K]["returns"] {
    return this.#callSyncChainWithKey(eventName, emitArgs, chainKey, emitArgs[chainKey]);
  }

  callSyncChain<K extends keyof EM & keyof SYNCEM>(
    eventName: K, // weird - but this is what enforces the keyof SYNCEM
    emitArgs: EM[K]["emitArgs"]
  ): void {
    const listeners = this.awaitableListeners(eventName);
    listeners.forEach(listener => listener(emitArgs));
  }

  callAllSyncChainWithKey<MK extends keyof EM & keyof SYNCEM, K extends keyof EM & keyof SYNCEM>(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: string,
    masterEventName: MK,
    ...eventNames: K[]
  ) {
    const origKey = `${chainKey}Orig`;
    const origChainedValue = emitArgs[chainKey];
    let chainedValue = origChainedValue;
    for (const eventName of [masterEventName, ...eventNames]) {
      const chainedResult = this.#callSyncChainWithKey(
        eventName,
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

  async #callAwaitableChainWithKey<K extends keyof EM, CK extends keyof EM[K]["emitArgs"] & string> (
    eventName: K,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK,
    origChainedValue: EM[K]["emitArgs"][CK],
    listeners: ChainedListenerCallback<K, EM>[] = this.awaitableListeners(eventName)
  ): Promise<EM[K]["returns"]> {
    const origKey = `${chainKey}Orig`;
    const {
      ...remainderOfEmitArgs
    } = emitArgs;

    let chainedValue = emitArgs[chainKey];

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

  async callAwaitableChainWithKey<K extends keyof EM> (
    eventName: K,
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

  async callAwaitableChainWithArgs<K extends keyof EM> (
    eventName: K,
    emitArgs: EM[K]["emitArgs"]
  ) {
    return this.callAwaitableChainWithKey(
      eventName,
      emitArgs,
      "args"
    )
  }

  async callAwaitableChainWithResult<K extends keyof EM> (
    eventName: K,
    emitArgs: EM[K]["emitArgs"]
  ) {
    return this.callAwaitableChainWithKey(
      eventName,
      emitArgs,
      "result"
    )
  }

  async callAwaitableInParallel<K extends keyof EM> (
    eventName: K,
    emitArgs: EM[K]["emitArgs"],
  ) {
    // TODO: still need to ensure that *Orig
    const listeners = this.awaitableListeners(eventName);
    return Promise.all(listeners.map(listener => listener(emitArgs)));
  }

  async callAllAwaitableInParallel<MK extends keyof EM, K extends keyof EM>(
    emitArgs: EM[MK]["emitArgs"],
    masterEventName: MK,
    ...eventNames: K[]
  ) {
    const allListeners = [masterEventName, ...eventNames].flatMap(eventName => this.awaitableListeners(eventName));
    return Promise.all(allListeners.map(listener => listener(emitArgs)));
  }

  async callAllAwaitableChainWithKey<MK extends keyof EM, K extends keyof EM>(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: string,
    masterEventName: MK,
    ...eventNames: K[]
  ) {
    const origKey = `${chainKey}Orig`;
    let chainedValue = emitArgs[chainKey];
    const origChainedValue = chainedValue;
    for (const eventName of [masterEventName, ...eventNames]) {
      const chainedResult = await this.#callAwaitableChainWithKey(
        eventName,
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
  async callExplicitAwaitableListenersChainWithKey<MK extends keyof EM, CK extends keyof EM[MK]["emitArgs"] & string>(
    masterEventName: MK,
    emitArgs: EM[MK]["emitArgs"],
    chainKey: CK,
    listeners: ChainedListenerCallback<MK, EM>[],
  ) {
    let chainedValue = emitArgs[chainKey];
    const origChainedValue = chainedValue;
    const chainedResult = await this.#callAwaitableChainWithKey(
      masterEventName,
      {
        ...emitArgs,
        [chainKey]: chainedValue,
      },
      chainKey,
      origChainedValue,
      listeners
    );
    if (chainedResult !== undefined) {
      chainedValue = chainedResult;
    }
    return chainedValue;
  }

  relevantAwaitableListenersWithOptions<K extends keyof EM & string>(
    eventName: K,
    options?: StandardInvokeHookOptions<K, EM>
  ): CallbackAndOptionsOfEm<EM, K>[] {
    const array = this.#listenersMap.get(eventName);
    if (!array) {
      return [];
    }
    // @ts-expect-error
    return filterHooksWithOptions(eventName, array, options);
  }

  awaitableListeners<K extends keyof EM>(
    eventName: K
  ): ChainedListenerCallback<K, EM>[] {
    const array = this.#listenersMap.get(eventName);
    if (!array) {
      return [];
    }
    return array.map(({ listener }) => listener);
  }

  addListener<K extends keyof EM>(
    eventName: K,
    listener: ChainedListenerCallback<K, EM>,
    options?: EM[K]["options"]
  ): this {
    if (!this.#listenersMap.has(eventName)) {
      this.#listenersMap.set(eventName, []);
    }
    const array = (this.#listenersMap.get(eventName) || []) as CallbackAndOptionsOfEm<EM, K>[]; // || [] not necessary.
    array.push({ listener, options });

    return this;
  }

  awaitableOn<K extends keyof EM>(
    eventName: K,
    listener: ChainedListenerCallback<K, EM>,
    options?: EM[K]["options"]
  ): this {
    return this.addListener(eventName, listener, options);
  }

  awaitableOff<K extends keyof EM>(
    eventName: K,
    listener: ChainedListenerCallback<K, EM>
  ): this {
    const array = this.#listenersMap.get(eventName) as CallbackAndOptionsOfEm<EM, K>[];
    if (!array) {
      return this;
    }
    const items = array.filter(({ listener: registeredListener }) => listener === registeredListener);
    items.forEach((item) => array.splice(array.indexOf(item), 1));
    return this;
  }

  listenerCount(eventName: keyof EM): number {
    return this.#listenersMap.get(eventName)?.length || 0;
  }

  eventNames(): (keyof EM)[] {
    return Array.from(this.#listenersMap.keys());
  }
}
