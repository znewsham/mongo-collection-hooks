import { AfterEventErrorNames, AfterEventSuccessNames, BeforeAfterErrorEventDefinitions, BeforeAfterEventNames, BeforeEventNames, CallerType, HookedEventEmitter, HookedEventMap, assertArgs, assertCaller, internalSymbolToBeforeAfterKey } from "./events.js";

// don't hate the player, hate typescript :|. This Horrible function does a relatively good job of enforcing types externally

/**
 *
 * @param ee
 * @param fn
 * @param caller
 * @param args
 * @param beforeAfterEmitArgs
 * @param chainArgs
 * @param chainResult
 * @param internalEvent
 * @param additionalInternalEvents
 * @returns
 */
export async function tryCatchEmit<
  TSchema,
  T extends (callArgs: BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["args"] extends never ? { invocationSymbol: symbol } : { invocationSymbol: symbol, beforeHooksResult: BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["returns"] }) => Promise<any>,
  IE extends BeforeAfterEventNames,
  BEA extends BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["emitArgs"],
  AEA extends BeforeAfterErrorEventDefinitions<TSchema>[IE]["after"]["emitArgs"],
  BEAO extends Omit<BEA, "args" | "invocationSymbol" | "caller">,
  AEAO extends BEA extends { argsOrig: any[] } ? Omit<AEA, "args" | "invocationSymbol" | "caller" | "result"> : Omit<AEA, "args" | "argsOrig" | "invocationSymbol" | "caller" | "result">,
  CT extends BeforeAfterErrorEventDefinitions<TSchema>[IE]["caller"] extends never ? undefined : CallerType & BeforeAfterErrorEventDefinitions<TSchema>[IE]["caller"]
>(
  ee: HookedEventEmitter<HookedEventMap<TSchema, any>>,
  fn: T,
  caller: CT,
  args: BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["args"] extends never ? undefined : BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["args"],
  beforeAfterEmitArgs: (BEAO | AEAO) & (BEAO & AEAO),
  chainArgs: BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["returnEmitName"] extends never ? false : true,
  chainResult: BeforeAfterErrorEventDefinitions<TSchema>[IE]["after"]["returnEmitName"] extends never ? false : true,
  chainArgsKey: ((keyof (BEAO | AEAO) & (BEAO & AEAO) | "args") & string) | undefined,
  internalEvent: IE,
  ...additionalInternalEvents: (keyof BeforeAfterErrorEventDefinitions<TSchema>)[]
): Promise<Awaited<ReturnType<T>>> {
  if (caller) {
    assertCaller(caller, internalEvent);
  }
  const invocationSymbol = Symbol();
  const argsOrig = beforeAfterEmitArgs["argsOrig"] || args;

  let chainedArgs = args;
  const {
    before: beforeEvent,
    afterSuccess: afterEvent,
    afterError: errorEvent
  }: { before: BeforeEventNames, afterSuccess: AfterEventSuccessNames, afterError: AfterEventErrorNames } = internalSymbolToBeforeAfterKey(internalEvent);
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
      } as BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["emitArgs"],
      chainArgsKey,
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
      } as BeforeAfterErrorEventDefinitions<TSchema>[IE]["before"]["emitArgs"],
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
        } as BeforeAfterErrorEventDefinitions<TSchema>[IE]["after"]["emitArgs"],
        "result",
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
        } as BeforeAfterErrorEventDefinitions<TSchema>[IE]["after"]["emitArgs"],
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
          ...beforeAfterEmitArgs
        } as BeforeAfterErrorEventDefinitions<TSchema>[IE]["error"]["emitArgs"],
        errorEvent,
        ...additionalErrorEvents
      );
    }
    throw e;
  }
}
