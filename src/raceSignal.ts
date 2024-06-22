export function raceSignal<T>(signal: AbortSignal | undefined, fnOrPromise: Promise<T> | (() => Promise<T>)): Promise<T> {
  if (!signal) {
    return typeof fnOrPromise === "function" ? fnOrPromise() : fnOrPromise;
  }

  let onAbort: ((this: AbortSignal, ev: Event) => any) | undefined;

  return Promise.race([
    new Promise<T>((_resolve, reject) => {
      onAbort = (reason: any) => {
        reject(reason);
      };
      signal.addEventListener("abort", onAbort);
    }),
    (async () => {
      try {
        if (typeof fnOrPromise === "function") {
          return await fnOrPromise();
        }
        return fnOrPromise;
      }
      finally {
        if (onAbort) {
          signal.removeEventListener("abort", onAbort);
        }
      }
    })()
  ]);
}
