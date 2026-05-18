# OpenClaims Collector v0.1

Lightweight ingestion gateway for OpenClaims events. It uses only Node built-ins and appends accepted events to a JSONL store unless `OPENCLAIMS_MEMORY=1` is set.

The collector is a reference ingestion gateway, not the authoritative source of truth.

## API

- `GET /health`
- `POST /v0/events` with one event, `{ "events": [...] }`, or a raw event array
- `POST /v0/cloudevents` with a CloudEvents envelope whose `data` is an OpenClaims event
- `GET /v0/events?claim_id=&type=&since=`
- `GET /v0/events/:event_id`
- `GET /v0/claims`
- `GET /v0/claims/:claim_id`
- `GET /v0/claims/:claim_id/events`
- `POST /v0/replay` validates and projects supplied events without persisting them

Events are append-only. `claim.retracted` is terminal for the reference collector.
