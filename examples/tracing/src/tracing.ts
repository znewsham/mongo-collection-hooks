import opentelemetry from "@opentelemetry/api";
import { HookedCollection } from "mongo-collection-hooks";
import { Document } from "mongodb";
import { setTimeout } from "timers/promises";

const spans = new Map<symbol, opentelemetry.Span>();

export function implementTracing(collection: HookedCollection<Document>): any {
  const tracer = opentelemetry.trace.getTracer(collection.namespace);
  collection.on("before.findOne", ({
    invocationSymbol,
  }) => {
    const span = tracer.startSpan("findOne", {});
    console.log({
      action: "started",
      ...span.spanContext(),
      parentId: span.parentSpanId,
      name: "findOne"
    });
    spans.set(invocationSymbol, span);
  });

  collection.on("after.findOne", ({
    invocationSymbol,
  }) => {
    const span = spans.get(invocationSymbol);
    if (!span) {
      return;
    }
    span.end();
  });

  collection.on("before.find.cursor.forEach", ({
    args: [iteratee],
    invocationSymbol
  }) => {
    let context;
    let span;
    tracer.startActiveSpan("forEach", (_span) => {
      span = _span;
      context = opentelemetry.context.active();
    });
    spans.set(invocationSymbol, span);
    return [(...args) => opentelemetry.context.with(context, () => iteratee(...args))];
  });

  collection.on("after.find.cursor.forEach", ({
    invocationSymbol
  }) => {
    const span = spans.get(invocationSymbol);
    if (!span) {
      return;
    }
    span.end();
  });
}

