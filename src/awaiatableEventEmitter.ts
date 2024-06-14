
/** These apply to all hooks */
/**
 * @external
 */
export type StandardDefineHookOptions = {
  /** A set of tags for this hook - e.g., "direct" or "raw" - which can be provided as one of the options to all operations to filter which hooks run at a high level*/
  tags?: string[]
}

/**
 * @external
 */
export type StandardInvokeHookOptions<EM extends ChainedCallbackEventMap, K extends keyof EM = keyof EM> = {
  /** Filter the hooks to only run those which include one of these tags */
  includeTags?: string[],
  /** Filter the hooks to only run those which don't include one of these tags */
  excludeTags?: string[]
  /** A function to run to determine whether a hook should be ran or not */
  includeHook?: <HK extends K>(hookName: HK, hook: ChainedListenerCallback<HK, EM>, options?: EM[K]["options"]) => boolean
}


export type ChainedCallbackEntry<EMITARGS = any, CBARGS extends EMITARGS = EMITARGS> = {
  callbackArgs: CBARGS,
  returns: any,
  isPromise: boolean,
  emitArgs: EMITARGS,
  options: StandardDefineHookOptions,
  returnEmitName?: string | undefined
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

function filterHooksWithOptions<K extends keyof EM, EM extends ChainedCallbackEventMap>(eventName: K, hooksWithOptions: CallbackAndOptionsOfEm<EM, K>[], options: StandardInvokeHookOptions<EM, K>): CallbackAndOptionsOfEm<EM, K>[] {
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

  #callSyncChainWithKey<K extends keyof EM & keyof SYNCEM, CK extends string & keyof EM[K]["emitArgs"] & EM[K]["returnEmitName"]>(
    eventName: K,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK | undefined,
    origChainedValue: CK extends undefined ? undefined : EM[K]["emitArgs"][CK],
    options: StandardInvokeHookOptions<EM, K> | undefined,
  ): EM[K]["returns"] {
    const origKey = `${chainKey}Orig`;
    const {
      ...remainderOfEmitArgs
    } = emitArgs;
    let chainedValue = origChainedValue;

    const listeners = this.relevantAwaitableListeners(eventName, options);
    for (const listener of listeners) {
      const perListenerArgs: EM[K]["callbackArgs"] = {
        ...remainderOfEmitArgs,
        ...(chainKey && { [chainKey]: chainedValue }),
        [origKey]: origChainedValue
      };
      const listenerResult = listener(perListenerArgs);
      if (listenerResult instanceof Promise) {
        throw new Error(`${eventName as string} Hook returned a Promise. This is a mistake`);
      }
      if (chainKey && listenerResult !== undefined) {
        // @ts-expect-error if no key is provided, we won't do this anyway.
        chainedValue = listenerResult;
      }
    }
    return chainedValue;
  }

  callSyncChainWithKey<K extends keyof EM & keyof SYNCEM, CK extends string & keyof EM[K]["emitArgs"] & EM[K]["returnEmitName"]>(
    eventName: K, // weird - but this is what enforces the keyof SYNCEM
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK | undefined,
    options: StandardInvokeHookOptions<EM, K> | undefined,
  ): EM[K]["returns"] {
    return this.#callSyncChainWithKey(
      eventName,
      emitArgs,
      chainKey,
      // @ts-expect-error
      chainKey === undefined ? undefined : emitArgs[chainKey],
      options
    );
  }

  callSyncChain<K extends keyof EM & keyof SYNCEM>(
    eventName: K, // weird - but this is what enforces the keyof SYNCEM
    emitArgs: EM[K]["emitArgs"],
    options: StandardInvokeHookOptions<EM, K> | undefined,
  ): void {
    const listeners = this.relevantAwaitableListeners(eventName, options);
    listeners.forEach(listener => listener(emitArgs));
  }

  async #callAwaitableChainWithKey<K extends keyof EM, CK extends keyof EM[K]["emitArgs"] & EM[K]["returnEmitName"]> (
    _eventName: K,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK,
    origChainedValue: EM[K]["emitArgs"][CK],
    listeners: ChainedListenerCallback<K, EM>[]
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

  async callAwaitableChainWithKey<K extends keyof EM, CK extends string & keyof EM[K]["emitArgs"] & EM[K]["returnEmitName"]> (
    eventName: K,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK,
    options: StandardInvokeHookOptions<EM, K> | undefined,
  ): Promise<EM[K]["returns"]> {
    const origChainedValue = emitArgs[chainKey];
    return this.#callAwaitableChainWithKey(
      eventName,
      emitArgs,
      chainKey,
      origChainedValue,
      this.relevantAwaitableListeners(eventName, options)
    );
  }

  async callAllAwaitableInParallel<MK extends keyof EM, K extends keyof EM>(
    emitArgs: EM[MK]["emitArgs"],
    options: StandardInvokeHookOptions<EM, MK | K> | undefined,
    masterEventName: MK,
    ...eventNames: K[]
  ) {
    const allListeners = [masterEventName, ...eventNames].flatMap(eventName => this.relevantAwaitableListeners(eventName, options));
    return Promise.all(allListeners.map(listener => listener(emitArgs)));
  }

  async callAllAwaitableChainWithKey<MK extends keyof EM, K extends keyof EM, CK extends string & keyof EM[MK]["emitArgs"] & EM[MK]["returnEmitName"]>(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: CK,
    options: StandardInvokeHookOptions<EM, MK | K> | undefined,
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
        origChainedValue,
        this.relevantAwaitableListeners(eventName, options)
      );
      if (chainedResult !== undefined) {
        chainedValue = chainedResult;
      }
    }
    return chainedValue;
  }
  async callExplicitAwaitableListenersChainWithKey<MK extends keyof EM, CK extends keyof EM[MK]["emitArgs"] & string & EM[MK]["returnEmitName"]>(
    masterEventName: MK,
    emitArgs: EM[MK]["emitArgs"],
    chainKey: CK,
    listeners: ChainedListenerCallback<MK, EM>[],
  ) : Promise<EM[MK]["returns"]> {
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

  relevantAwaitableListeners<K extends keyof EM>(
    eventName: K,
    options?: StandardInvokeHookOptions<EM, K>
  ): ChainedListenerCallback<K, EM>[] {
    const array = this.#listenersMap.get(eventName);
    if (!array) {
      return [];
    }
    // @ts-expect-error
    return filterHooksWithOptions(eventName, array, options).map(({ listener }) => listener);
  }

  relevantAwaitableListenersWithOptions<K extends keyof EM & string>(
    eventName: K,
    options?: StandardInvokeHookOptions<EM, K>
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
