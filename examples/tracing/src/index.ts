import { NodeSDK } from "@opentelemetry/sdk-node";
import opentelemetry, { trace } from "@opentelemetry/api";
import { MongoClient, Document } from "mongodb";
import { setTimeout } from "timers/promises";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { AsyncLocalStorage } from "async_hooks";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import {
  PeriodicExportingMetricReader,
  InMemoryMetricExporter,
  AggregationTemporality
} from "@opentelemetry/sdk-metrics";
import { HookedCollection } from "mongo-collection-hooks";
import { implementTracing } from "./tracing.js";

const tracer = trace.getTracer("dice-lib");

class Context implements opentelemetry.Context {
  #map: Map<symbol, any>;
  constructor(map?: Map<symbol, any>) {
    this.#map = new Map(map || []);
  }
  deleteValue(key: symbol): opentelemetry.Context {
    const newContext = new Context(this.#map);
    newContext.#map.delete(key);
    return newContext;
  }
  getValue(key: symbol): unknown {
    return this.#map.get(key);
  }
  setValue(key: symbol, value: unknown): opentelemetry.Context {
    const newContext = new Context(this.#map);
    newContext.#map.set(key, value);
    return newContext;
  }

  setOnExisting(key: symbol, value: unknown) {
    this.#map.set(key, value);
  }
}

const BASE_CONTEXT = new Context();

class CustomContextManager implements opentelemetry.ContextManager {
  #asyncLocalStorage = new AsyncLocalStorage<opentelemetry.Context>();
  active(): opentelemetry.Context {
    return this.#asyncLocalStorage.getStore() || BASE_CONTEXT;
  }
  bind<T>(context: opentelemetry.Context, target: T): T {
    debugger;
  }
  disable(): this {
    this.#asyncLocalStorage.disable();
    return this;
  }
  enable(): this {
    return this;
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: opentelemetry.Context,
    fn: F,
    thisArg?: ThisParameterType<F> | undefined,
    ...args: A
  ): ReturnType<F> {
    const cb = thisArg == null ? fn : fn.bind(thisArg);
    return this.#asyncLocalStorage.run(context, cb as never, ...args);
  }
}
globalThis.exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const sdk = new NodeSDK({
  traceExporter: globalThis.exporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: globalThis.exporter
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  contextManager: new CustomContextManager()
});

sdk.start();

async function logDummy(collection: HookedCollection<Document>) {
  tracer.startActiveSpan("logDummy", async (span) => {
    console.log({
      action: "started",
      ...span.spanContext(),
      parentId: span.parentSpanId,
      name: "logDummy"
    });
    const promises: Promise<any>[] = [];
    await collection.find({}, { projection: { _id: 1 } }).forEach(({ _id }) => {
      promises.push((async () => {
        console.log(await collection.findOne({ _id }));
      })());
    });
    await Promise.all(promises);
    span.end();
  });
}

async function run(client: MongoClient) {
  await client.connect();
  const rawCollection = client.db().collection("dummy");
  // await rawCollection.insertMany([{ _id: "hello" }, { _id: "world" }]);
  const collection = new HookedCollection<Document>(rawCollection);

  implementTracing(collection);
  const interval = setInterval(async () => {
    await tracer.startActiveSpan("run", async (span) => {
      console.log({
        action: "started",
        ...span.spanContext(),
        parentId: span.parentSpanId,
        name: "run"
      });
      await setTimeout(Math.random() * 0);
      await logDummy(collection);
      span.end();
    });
  }, 100);
  await setTimeout(1000);
  clearInterval(interval);
}

// if (process.env.MONGO_URL) {
//   const client = new MongoClient(process.env.MONGO_URL);
//   run(client);
// }

const tracer2 = opentelemetry.trace.getTracer("dice-lib");
function asyncIterator() {
  const array = [1, 2, 3];
  let i = 0;
  debugger;
  const span = tracer2.startSpan("asyncIterator");
  const activeContext = opentelemetry.context.active() as Context;
  const activeSpan = opentelemetry.trace.getSpan(activeContext);
  activeContext.setOnExisting(Symbol.for("OpenTelemetry Context Key SPAN"), span);
  return {
    async next() {
      if (i < array.length) {
        try {
          await setTimeout(100);
          return { value: array[i], done: false }
        }
        finally {
          i++;
        }
      }
      span.end();
      opentelemetry.trace.setSpan(activeContext, activeSpan);
      return { value: null, done: true };
    },
    return() {
      console.log("return");
      span.end();
      opentelemetry.trace.setSpan(activeContext, activeSpan);
      return { value: null, done: true };
    },
    throw(e) {
      console.log("throw");
      return { value: null, done: true };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  }
}

function doSomething() {
  const span = tracer2.startSpan("doSomething");
  console.log("doSomething", span.spanContext(), span.parentSpanId);
}


class X {
  [Symbol.asyncIterator] = asyncIterator
}

async function test() {
  const x = new X();
  for await (const a of x) {
    const activeContext = opentelemetry.context.active() as Context;
    console.log(a, activeContext);
    debugger;
    doSomething();
  }
}
function test2() {
  tracer2.startActiveSpan("outer", () => test());
}
test2();
