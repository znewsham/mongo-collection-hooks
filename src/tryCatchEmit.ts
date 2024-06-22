import { ExtraEvent, StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";
import { HookedEventEmitter, internalEventToBeforeAfterKey, ChainedCallbackEventMapWithCaller, SkipDocument } from "./events/index.js";


export type ExtraBeforeAfterEvent<
  HEM extends ChainedCallbackEventMapWithCaller,
  K extends string & keyof HEM,
> = K | {
  event: K,
  emitArgs?: Partial<HEM[`before.${K}`]["emitArgs"]>
}

// don't hate the player, hate typescript :|. This Horrible function does a relatively good job of enforcing types externally
// I don't love that we're currying types here, but it means the actual tryCatchEmit function has no knowledge of the shape of the data.
export function getTryCatch<
  BEAAD extends {[k in string]: { caller: string }}
>() {
  return async function tryCatchEmit<
    HEM extends ChainedCallbackEventMapWithCaller,
    BE extends `before.${IE}`,
    AE extends `after.${IE}.success`,
    // TODO: weird - we assume that if we give args, we want to chain them, fairly reasonable - but odd not to just check returns
    T extends (callArgs: HEM[BE]["emitArgs"]["args"] extends never ? { invocationSymbol: symbol } : { invocationSymbol: symbol, beforeHooksResult: HEM[BE]["returns"] }) => Promise<any>,
    IE extends string & keyof BEAAD,
    BEA extends HEM[BE]["emitArgs"],
    AEA extends HEM[AE]["emitArgs"],
    AIE extends string & keyof BEAAD,
    BEAO extends Omit<BEA, "args" | "invocationSymbol" | "caller" | "signal">,
    AEAO extends BEA extends { argsOrig: any[] } ? Omit<AEA, "args" | "invocationSymbol" | "caller" | "result" | "signal"> : Omit<AEA, "args" | "argsOrig" | "invocationSymbol" | "caller" | "result" | "signal">,
    CT extends BEAAD[IE]["caller"] | undefined
  >(
    ee: HookedEventEmitter<HEM>,
    fn: T,
    caller: CT,
    args: HEM[BE]["emitArgs"]["args"] extends never ? undefined : HEM[BE]["emitArgs"]["args"],
    beforeAfterEmitArgs: (BEAO | AEAO) & (BEAO & AEAO),
    chainArgs: HEM[BE]["returnEmitName"] extends never ? false : true,
    chainResult: HEM[AE]["returnEmitName"] extends never ? false : true,
    chainArgsKey: ("args" | keyof((BEAO | AEAO) & (BEAO & AEAO)) & string) | undefined,
    invocationOptions: StandardInvokeHookOptions<HEM, BE | AE | `after.${IE}.error`> | undefined,
    internalEvent: IE,
    ...additionalInternalEvents: ExtraBeforeAfterEvent<HEM, AIE>[]
  ): Promise<Awaited<ReturnType<T>>> {
    invocationOptions?.signal?.throwIfAborted();
    if (caller) {
      ee.assertCaller(caller, `before.${internalEvent}`);
    }
    const invocationSymbol = Symbol(internalEvent);
    const argsOrig = beforeAfterEmitArgs["argsOrig"] || args;

    let chainedArgs = args;
    const {
      after: afterEvent,
      before: beforeEvent,
      afterSuccess: successEvent,
      afterError: errorEvent,
    }: { before: `before.${IE}`, after: `after.${IE}`, afterSuccess: `after.${IE}.success`, afterError: `after.${IE}.error` } = internalEventToBeforeAfterKey(internalEvent);
    const additionalBeforeEvents = additionalInternalEvents.map((additionalInternalEvent) => {
      return {
        event: internalEventToBeforeAfterKey(additionalInternalEvent["event"] || additionalInternalEvent).before,
        emitArgs: additionalInternalEvent["emitArgs"] || {}
      };
    });
    const additionalSuccessEvents = additionalInternalEvents.map((additionalInternalEvent) => {
      return {
        event: internalEventToBeforeAfterKey(additionalInternalEvent["event"] || additionalInternalEvent).afterSuccess,
        emitArgs: additionalInternalEvent["emitArgs"] || {}
      };
    });
    const additionalErrorEvents = additionalInternalEvents.map((additionalInternalEvent) => {
      return {
        event: internalEventToBeforeAfterKey(additionalInternalEvent["event"] || additionalInternalEvent).afterError,
        emitArgs: additionalInternalEvent["emitArgs"] || {}
      };
    });
    const additionalAfterEvents = additionalInternalEvents.map((additionalInternalEvent) => {
      return {
        event: internalEventToBeforeAfterKey(additionalInternalEvent["event"] || additionalInternalEvent).after,
        emitArgs: additionalInternalEvent["emitArgs"] || {}
      };
    });
    if (chainArgs && chainArgsKey) {
      chainedArgs = await ee.callAllAwaitableChainWithKey(
        {
          invocationSymbol,
          ...(args && { args }),
          ...(argsOrig && { argsOrig }),
          ...(caller && { caller }),
          ...(invocationOptions?.signal && { signal: invocationOptions?.signal }),
          ...beforeAfterEmitArgs,
        },
        chainArgsKey,
        // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
        invocationOptions,
        beforeEvent,
        ...additionalBeforeEvents
      );
    }
    else {
      await ee.callAllAwaitableInParallel(
        {
          invocationSymbol,
          ...(caller && { caller }),
          ...(args && { args }),
          ...(invocationOptions?.signal && { signal: invocationOptions?.signal }),
          ...beforeAfterEmitArgs
        },
        // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
        invocationOptions,
        beforeEvent,
        ...additionalBeforeEvents
      );
    }
    let gotResult = false;
    try {
      invocationOptions?.signal?.throwIfAborted();
      let result = await fn({ invocationSymbol, ...(chainedArgs && { beforeHooksResult: chainedArgs })});
      gotResult = true;
      // this is super hacky - it's mostly for the insert/delete/update events.
      if (chainedArgs === SkipDocument) {
        return result;
      }
      if (chainResult) {
        const chainedResult = await ee.callAllAwaitableChainWithKey(
          {
            invocationSymbol,
            ...(caller && { caller }),
            ...(args && { args }),
            ...(argsOrig && { argsOrig }),
            ...(result !== undefined && { result }),
            ...(invocationOptions?.signal && { signal: invocationOptions?.signal }),
            ...beforeAfterEmitArgs
          },
          "result",
          // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
          invocationOptions,
          successEvent,
          afterEvent,
          ...additionalSuccessEvents,
          ...additionalAfterEvents,
        );
        if (chainedResult !== undefined) {
          result = chainedResult;
        }
      }
      else {
        await ee.callAllAwaitableInParallel(
          {
            invocationSymbol,
            ...(caller && { caller }),
            ...(args && { args }),
            ...(argsOrig && { argsOrig }),
            ...(result !== undefined && { result }),
            ...(invocationOptions?.signal && { signal: invocationOptions?.signal }),
            ...beforeAfterEmitArgs
          },
          // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
          invocationOptions,
          successEvent,
          afterEvent,
          ...additionalSuccessEvents,
          ...additionalAfterEvents
        );
      }
      return result;
    }
    catch (e) {
      if (!gotResult) {
        await ee.callAllAwaitableInParallel(
          {
            invocationSymbol,
            ...(caller && { caller }),
            ...(args && { args }),
            ...(argsOrig && { argsOrig }),
            ...(invocationOptions?.signal && { signal: invocationOptions?.signal }),
            error: e,
            thisArg: beforeAfterEmitArgs["thisArg"],
            ...beforeAfterEmitArgs
          },
          // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
          invocationOptions,
          errorEvent,
          afterEvent,
          ...additionalErrorEvents,
          ...additionalAfterEvents,
        );
      }
      throw e;
    }
  }
}
