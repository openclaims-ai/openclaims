import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { projectClaim, projectClaims } from "./projection.js";
import { JsonlEventStore, MemoryEventStore, SQLiteEventStore } from "./store.js";
import { ConflictError, ValidationError, claimKey, eventKey, validateEventAgainstHistory, validateReplay } from "./validation.js";

function normalizeEventBody(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.events)) return body.events;
  return [body];
}

function requestId(request) {
  return request.headers["x-request-id"] || randomUUID();
}

function filterEvents(events, query) {
  const { claim_id: claimId, type, since } = query;
  return events.filter((event) => {
    if (claimId && claimKey(event) !== claimId) return false;
    if (type && event.event_type !== type) return false;
    if (since && Date.parse(event.event_time) <= Date.parse(since)) return false;
    return true;
  });
}

async function ingestEvents(store, incomingEvents, request) {
  const history = await store.readAll();
  const accepted = [];
  const workingHistory = [...history];

  for (const event of incomingEvents) {
    validateEventAgainstHistory(event, workingHistory);
    workingHistory.push(event);
    accepted.push(event);
  }

  await store.append(accepted);
  return {
    accepted: accepted.length,
    event_ids: accepted.map((event) => eventKey(event)),
    request_id: requestId(request)
  };
}

function makeStore(options) {
  if (options.store) return options.store;
  if (options.memory) return new MemoryEventStore(options.seed || []);
  if (options.jsonl) return new JsonlEventStore(options.storePath || process.env.OPENCLAIMS_STORE || "data/openclaims-events.jsonl");
  return new SQLiteEventStore(options.storePath || process.env.OPENCLAIMS_STORE || "data/openclaims-events.sqlite");
}

export function createCollectorServer(options = {}) {
  const store = makeStore(options);
  const app = Fastify({ logger: options.logger ?? false });
  app.store = store;

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error instanceof ValidationError || error instanceof ConflictError ? error.statusCode : 500;
    reply.status(statusCode).send({
      error: {
        type: error.name || "Error",
        message: error.message,
        details: error.details || []
      }
    });
  });

  app.get("/health", async () => ({
    ok: true,
    version: "0.1.0",
    service: "openclaims-collector",
    time: new Date().toISOString()
  }));
  app.get("/healthz", async () => app.inject({ method: "GET", url: "/health" }).then((res) => JSON.parse(res.body)));
  app.get("/v0/health", async () => app.inject({ method: "GET", url: "/health" }).then((res) => JSON.parse(res.body)));

  app.post("/v0/events", async (request, reply) => {
    reply.code(202);
    return ingestEvents(store, normalizeEventBody(request.body), request);
  });

  app.post("/v0/cloudevents", async (request, reply) => {
    reply.code(202);
    return ingestEvents(store, normalizeEventBody(request.body?.data), request);
  });

  app.get("/v0/events", async (request) => {
    const events = filterEvents(await store.readAll(), request.query ?? {});
    return { events, count: events.length };
  });

  app.get("/v0/events/:event_id", async (request, reply) => {
    const event = (await store.readAll()).find((item) => eventKey(item) === request.params.event_id);
    if (!event) return reply.code(404).send({ error: { type: "NotFound", message: "event not found", details: [] } });
    return event;
  });

  app.get("/v0/claims", async () => {
    const events = await store.readAll();
    return {
      claims: projectClaims(events),
      count: new Set(events.map((event) => claimKey(event))).size
    };
  });

  app.get("/v0/claims/:claim_id", async (request, reply) => {
    const projection = projectClaim(request.params.claim_id, await store.readAll());
    if (!projection.emitted) return reply.code(404).send({ error: { type: "NotFound", message: "claim not found", details: [] } });
    return projection;
  });

  app.get("/v0/claims/:claim_id/events", async (request) => {
    const events = (await store.readAll())
      .filter((event) => claimKey(event) === request.params.claim_id)
      .sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));
    return { claim_id: request.params.claim_id, count: events.length, events };
  });

  app.post("/v0/replay", async (request) => {
    const events = normalizeEventBody(request.body);
    const initialHistory = request.body?.include_existing === true ? await store.readAll() : [];
    const accepted = validateReplay(events, initialHistory);
    return {
      accepted: accepted.length,
      persisted: false,
      projections: projectClaims([...initialHistory, ...accepted]),
      event_ids: accepted.map((event) => eventKey(event))
    };
  });

  return app;
}
