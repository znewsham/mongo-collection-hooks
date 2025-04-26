
/** These apply to all hooks */
/**
 * @external
 */
export type StandardDefineHookOptions = {
  /** A set of tags for this hook - e.g., "direct" or "raw" - which can be provided as one of the options to all operations to filter which hooks run at a high level*/
  tags?: string[],

  /** The name - only useful for debugging purposes, e.g., with instrumentation */
  name?: string
}

/**
 * @external
 */
export type StandardInvokeHookOptions<
  EM extends ChainedCallbackEventMap,
  K extends keyof EM = keyof EM
> = {
  /** Filter the hooks to only run those which include one of these tags */
  includeTags?: string[],
  /** Filter the hooks to only run those which don't include one of these tags */
  excludeTags?: string[],
  /** A function to run to determine whether a hook should be ran or not */
  includeHook?: <HK extends K>(hookName: HK, hook: ChainedListenerCallback<EM, HK>, options?: EM[K]["options"]) => boolean,
  /** An abort signal to allow interuption of long running operations - particularly useful in the case of *Many operations with individual hooks */
  signal?: AbortSignal
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

export type CallbackAndOptionsOfEm<
  EM extends ChainedCallbackEventMap,
  K extends keyof EM
> = {
  options?: EM[K]["options"],
  listener: ChainedListenerCallback<EM, K>
}

type CallbackAndOptionsMap<
  EM extends ChainedCallbackEventMap,
  K extends keyof EM = keyof EM
> = Map<K, CallbackAndOptionsOfEm<EM, K>[]>


export type ChainedListenerCallback<
  EM extends ChainedCallbackEventMap,
  K extends keyof EM,
> = (
  EM[K]["callbackArgs"] extends object
  ? (...args: [EM[K]["callbackArgs"]]) => EM[K]["isPromise"] extends /* not */ true /* false */
    // extends true is important - if we switch it to false anywhere we take a generic collection with unknown extended events
    // (e.g., observe-mongo/redis/publish) the return type of the functions are all wrong - for whatever reason, swapping it fixes
    // and doesn't cause the same issue with the handful of events that are sync
    ? EM[K]["returns"] | void | Promise<void | EM[K]["returns"]>
    : EM[K]["returns"] | void
  : never
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

export type ExtraEvent<
  EM extends ChainedCallbackEventMap,
  K extends keyof EM = keyof EM
> = K | {
  event: K,
  emitArgs?: Partial<EM[K]["emitArgs"]>
}

export class ChainedAwaiatableEventEmitter<
  EM extends ChainedCallbackEventMap = DefaultChainedCallbackEventMap,
  SYNCEM extends ChainedCallbackEventMap = {
    [k in keyof EM as (EM[k]["isPromise"] extends false ? k : never)]: EM[k]
  }
> {
  #listenersMap: CallbackAndOptionsMap<EM> = new Map();

  #callSyncChainWithKey<K extends keyof EM & keyof SYNCEM, CK extends string & keyof EM[K]["emitArgs"] & EM[K]["returnEmitName"]>(
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK | undefined,
    origChainedValue: CK extends undefined ? undefined : EM[K]["emitArgs"][CK],
    listenersWithOptions: CallbackAndOptionsOfEm<EM, K>[],
    signal: AbortSignal | undefined
  ): EM[K]["returns"] {
    const origKey = `${chainKey}Orig`;
    const {
      ...remainderOfEmitArgs
    } = emitArgs;
    let chainedValue = origChainedValue;

    for (const { listener, options } of listenersWithOptions) {
      if (signal?.aborted) {
        throw signal.reason;
      }
      const perListenerArgs: EM[K]["callbackArgs"] = {
        ...remainderOfEmitArgs,
        ...(chainKey && { [chainKey]: chainedValue }),
        [origKey]: origChainedValue,
        hookOptions: options
      };
      const listenerResult = listener(perListenerArgs);
      if (listenerResult instanceof Promise) {
        throw new Error("Hook returned a Promise. This is a mistake");
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
      emitArgs,
      chainKey,
      // @ts-expect-error
      chainKey === undefined ? undefined : emitArgs[chainKey],
      this.relevantAwaitableListenersWithOptions(eventName, options),
      options?.signal
    );
  }

  callAllSyncChainWithKey<K extends keyof EM & keyof SYNCEM, MK extends keyof EM & keyof SYNCEM, CK extends string & keyof EM[MK]["emitArgs"] & EM[MK]["returnEmitName"]>(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: CK | undefined,
    options: StandardInvokeHookOptions<EM, K | MK> | undefined,
    masterEventName: MK,
    ...otherEventNames: K[]
  ): void {
    const listenersWithOptions = [masterEventName, ...otherEventNames].flatMap(eventName => this.relevantAwaitableListenersWithOptions(eventName, options));
    return this.#callSyncChainWithKey(
      emitArgs,
      chainKey,
      // @ts-expect-error
      chainKey === undefined ? undefined : emitArgs[chainKey],
      listenersWithOptions,
      options?.signal
    );
  }

  callAllSync<
    K extends keyof EM & keyof SYNCEM,
    MK extends keyof EM & keyof SYNCEM
  >(
    emitArgs: EM[MK]["emitArgs"],
    options: StandardInvokeHookOptions<EM, K | MK> | undefined,
    masterEventName: MK,
    ...additionalEvents: ExtraEvent<SYNCEM | EM, K>[]
  ): void {
    [masterEventName, ...additionalEvents].flatMap(eventNameOrObject => {
      const eventName = (eventNameOrObject["event"] || eventNameOrObject) as K;
      const listenersWithOptions = this.relevantAwaitableListenersWithOptions(eventName, options);
      const extraEmitArgs = eventNameOrObject["emitArgs"] || {};
      listenersWithOptions.forEach(({ listener, options: hookOptions }) => {
        if (options?.signal?.aborted) {
          throw options.signal.reason;
        }
        listener({
          ...emitArgs,
          ...extraEmitArgs,
          hookOptions
        });
      });
    });
  }

  async #callAwaitableChainWithKey<K extends keyof EM, CK extends keyof EM[K]["emitArgs"] & EM[K]["returnEmitName"]> (
    _eventName: K,
    emitArgs: EM[K]["emitArgs"],
    chainKey: CK,
    origChainedValue: EM[K]["emitArgs"][CK],
    listenersWithOptions: CallbackAndOptionsOfEm<EM, K>[],
    signal: AbortSignal | undefined
  ): Promise<EM[K]["returns"]> {
    const origKey = `${chainKey}Orig`;
    const {
      ...remainderOfEmitArgs
    } = emitArgs;

    let chainedValue = emitArgs[chainKey];

    for (const { listener, options: hookOptions } of listenersWithOptions) {
      if (signal?.aborted) {
        throw signal.reason;
      }
      const perListenerArgs: EM[K]["callbackArgs"] = {
        ...remainderOfEmitArgs,
        [chainKey]: chainedValue,
        [origKey]: origChainedValue,
        hookOptions
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
      this.relevantAwaitableListenersWithOptions(eventName, options),
      options?.signal
    );
  }

  async callAllAwaitableInParallel<
    MK extends keyof EM,
    K extends keyof EM,
  >(
    emitArgs: EM[MK]["emitArgs"],
    options: StandardInvokeHookOptions<EM, MK | K> | undefined,
    masterEventName: MK,
    ...additionalEvents: ExtraEvent<EM, K>[]
  ) {
    return Promise.all([masterEventName, ...additionalEvents].flatMap(eventNameOrObject => {
      const eventName = (eventNameOrObject["event"] || eventNameOrObject) as K;
      const listenersWithOptions = this.relevantAwaitableListenersWithOptions(eventName, options);
      const extraEmitArgs = eventNameOrObject["emitArgs"] || {};
      return listenersWithOptions.map(({ listener, options: hookOptions }) => {
        if (options?.signal?.aborted) {
          throw options.signal.reason;
        }
        return listener({
          ...emitArgs,
          ...extraEmitArgs,
          hookOptions
        });
      });
    }));
  }

  async callAllAwaitableChainWithKey<
    MK extends keyof EM,
    K extends keyof EM & string,
    CK extends string & keyof EM[MK]["emitArgs"] & EM[MK]["returnEmitName"],
  >(
    emitArgs: EM[MK]["emitArgs"],
    chainKey: CK,
    options: StandardInvokeHookOptions<EM, MK | K> | undefined,
    masterEventName: MK,
    ...additionalEvents: ExtraEvent<EM, K>[]
  ): Promise<EM[K]["returns"]> {
    let chainedValue = emitArgs[chainKey];
    const origChainedValue = chainedValue;
    for (const eventNameOrObject of [masterEventName, ...additionalEvents]) {
      const eventName = (eventNameOrObject["event"] || eventNameOrObject) as K;
      const extraEmitArgs = eventNameOrObject["emitArgs"] || {};
      const chainedResult = await this.#callAwaitableChainWithKey(
        eventName,
        {
          ...emitArgs,
          ...extraEmitArgs,
          [chainKey]: chainedValue,
        },
        chainKey,
        origChainedValue,
        this.relevantAwaitableListenersWithOptions(eventName, options),
        options?.signal
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
    listenersWithOptions: CallbackAndOptionsOfEm<EM, MK>[],
    signal: AbortSignal | undefined
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
      listenersWithOptions,
      signal
    );
    if (chainedResult !== undefined) {
      chainedValue = chainedResult;
    }
    return chainedValue;
  }

  allListenersWithOptions() {
    return [...this.#listenersMap.keys()].flatMap(key => this.#listenersMap.get(key)?.map(({ listener, options }) => ({
      listener,
      options,
      eventName: key
    })) || []);
  }

  relevantAwaitableListeners<K extends keyof EM>(
    eventName: K,
    options?: StandardInvokeHookOptions<EM, K>
  ): ChainedListenerCallback<EM, K>[] {
    const array = this.#listenersMap.get(eventName);
    if (!array) {
      return [];
    }
    // @ts-expect-error
    return filterHooksWithOptions(eventName, array, options).map(({ listener }) => listener);
  }

  relevantAwaitableListenersWithOptions<K extends keyof EM>(
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

  awaitableListenersWithOptions<K extends keyof EM>(
    eventName: K
  ): CallbackAndOptionsOfEm<EM, K>[] {
    const array = this.#listenersMap.get(eventName);
    if (!array) {
      return [];
    }
    // @ts-expect-error
    return [...array];
  }

  awaitableListeners<K extends keyof EM>(
    eventName: K
  ): ChainedListenerCallback<EM, K>[] {
    const array = this.#listenersMap.get(eventName);
    if (!array) {
      return [];
    }
    return array.map(({ listener }) => listener);
  }

  addListener<K extends keyof EM>(
    eventName: K,
    listener: ChainedListenerCallback<EM, K>,
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
    listener: ChainedListenerCallback<EM, K>,
    options?: EM[K]["options"]
  ): this {
    return this.addListener(eventName, listener, options);
  }

  awaitableOff<K extends keyof EM>(
    eventName: K,
    listener: ChainedListenerCallback<EM, K>
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
