import { ChainedCallbackEventMap, ChainedListenerCallback, StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";
import { CollectionBeforeAfterErrorEventDefinitions, CallerType, HookedEventEmitter, assertCaller, internalSymbolToBeforeAfterKey } from "./events/index.js";

// don't hate the player, hate typescript :|. This Horrible function does a relatively good job of enforcing types externally

export async function tryCatchEmit<
  BEAAD extends CollectionBeforeAfterErrorEventDefinitions<Document>,
  HEM extends ChainedCallbackEventMap,
  BE extends `before.${IE}`,
  AE extends `after.${IE}.success`,
  T extends (callArgs: HEM[BE]["emitArgs"]["args"] extends never ? { invocationSymbol: symbol } : { invocationSymbol: symbol, beforeHooksResult: HEM[BE]["returns"] }) => Promise<any>,
  IE extends keyof CollectionBeforeAfterErrorEventDefinitions<Document>,
  BEA extends HEM[BE]["emitArgs"],
  AEA extends HEM[AE]["emitArgs"],
  BEAO extends Omit<BEA, "args" | "invocationSymbol" | "caller">,
  AEAO extends BEA extends { argsOrig: any[] } ? Omit<AEA, "args" | "invocationSymbol" | "caller" | "result"> : Omit<AEA, "args" | "argsOrig" | "invocationSymbol" | "caller" | "result">,
  CT extends BEAAD[IE]["caller"] extends never ? undefined : CallerType & BEAAD[IE]["caller"]
>(
  ee: HookedEventEmitter<HEM>,
  fn: T,
  caller: CT,
  args: HEM[`before.${IE}`]["emitArgs"]["args"] extends never ? undefined : HEM[`before.${IE}`]["emitArgs"]["args"],
  beforeAfterEmitArgs: (BEAO | AEAO) & (BEAO & AEAO),
  chainArgs: BEAAD[IE]["before"]["returnEmitName"] extends never ? false : true,
  chainResult: BEAAD[IE]["after"]["returnEmitName"] extends never ? false : true,
  chainArgsKey: ((keyof (BEAO | AEAO) & (BEAO & AEAO) | "args") & string) | undefined,
  invocationOptions: StandardInvokeHookOptions<HEM, BE | AE | `after.${IE}.error`> | undefined,
  specificBeforeCallbacks: ChainedListenerCallback<BE | AE, HEM>[] | undefined,
  specificAfterCallbacks: ChainedListenerCallback<BE | AE, HEM>[] | undefined,
  internalEvent: IE,
  ...additionalInternalEvents: (keyof CollectionBeforeAfterErrorEventDefinitions<Document>)[]
): Promise<Awaited<ReturnType<T>>> {
  if (caller) {
    assertCaller(caller, internalEvent);
  }
  const invocationSymbol = Symbol(internalEvent);
  const argsOrig = beforeAfterEmitArgs["argsOrig"] || args;

  let chainedArgs = args;
  const {
    before: beforeEvent,
    afterSuccess: afterEvent,
    afterError: errorEvent
  }: { before: `before.${IE}`, afterSuccess: `after.${IE}.success`, afterError: `after.${IE}.error` } = internalSymbolToBeforeAfterKey(internalEvent);
  const additionalBeforeEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).before);
  const additionalAfterEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).afterSuccess);
  const additionalErrorEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).afterError);
  if (chainArgs && chainArgsKey) {
    chainedArgs = await ee.callAllAwaitableChainWithKey(
      {
        invocationSymbol,
        ...(args && { args }),
        ...(argsOrig && { argsOrig }),
        ...(caller && { caller }),
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
    let result = await fn({ invocationSymbol, ...(chainedArgs && { beforeHooksResult: chainedArgs })});
    gotResult = true;
    if (chainResult) {
      const chainedResult = await ee.callAllAwaitableChainWithKey(
        {
          invocationSymbol,
          ...(caller && { caller }),
          ...(args && { args }),
          ...(argsOrig && { argsOrig }),
          ...(result !== undefined && { result }),
          ...beforeAfterEmitArgs
        },
        "result",
        // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
        invocationOptions,
        afterEvent,
        ...additionalAfterEvents
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
          ...beforeAfterEmitArgs
        },
        // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
        invocationOptions,
        afterEvent,
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
          error: e,
          thisArg: beforeAfterEmitArgs["thisArg"],
          ...beforeAfterEmitArgs
        },
        // @ts-expect-error there's an underlying assumption that the invocationOptions provided will work for the event and the additional events (e.g., before.cursor.execute and before.find.cursor.execute)
        invocationOptions,
        errorEvent,
        ...additionalErrorEvents
      );
    }
    throw e;
  }
}
