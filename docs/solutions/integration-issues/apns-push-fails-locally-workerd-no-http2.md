---
title: "APNs push fails under wrangler dev with 'Network connection lost': workerd has no HTTP/2, production does"
date: 2026-09-24
category: docs/solutions/integration-issues/
module: "packages/api (services/push/apnsClient.ts)"
problem_type: integration_issue
component: push-notifications
symptoms:
  - "sendApnsPush throws 'Error: Network connection lost' under wrangler dev"
  - "The same request via curl --http2 to api.sandbox.push.apple.com returns 200"
  - "JWT, key id, team id and device token are all verified correct"
tags:
  - apns
  - cloudflare-workers
  - workerd
  - http2
  - wrangler-dev
---

## Symptom

A push sent from a Worker running locally fails at the `fetch` call:

```
[sentry][weatherMonitoring.notifyWatchers] Error: Network connection lost.
  at async sendApnsPush (services/push/apnsClient.ts)
```

Everything upstream is correct — the ES256 JWT is well-formed, the APNs key is
valid, and the identical request replayed with `curl --http2` returns HTTP 200.

## Root cause

APNs only accepts HTTP/2 and drops the connection on HTTP/1.1. `workerd` — the
runtime behind `wrangler dev` — has no HTTP/2 client, so the connection is torn
down before APNs ever replies.

**Deployed Workers are not affected.** In production, `fetch` egresses through
Cloudflare's proxy stack, which upgrades to HTTP/2 before it reaches the origin.
Confirmed by the workerd lead in
[cloudflare/workerd#4841](https://github.com/cloudflare/workerd/issues/4841):

> `workerd` doesn't have HTTP/2 support, but in production it sends requests
> through Cloudflare's proxy stack which (apparently) upgrades to HTTP/2 before
> talking to the origin. In theory we'd like to make `workerd` understand HTTP/2
> directly but there are no active plans to implement this.

This is a local-development limitation only, not a defect in the client code and
not a reason to change transport.

## Resolution

Keep native `fetch` in `apnsClient.ts`. A persistent-socket APNs library, a proxy
service, or a queue + external sender are all unnecessary and would add a
dependency to work around a problem that does not exist in production. Other
Workers-native APNs projects (e.g. `jonesphillip/paje`) call
`https://api.push.apple.com/3/device/<token>` with plain `fetch` for the same
reason.

To verify a send locally, either:

- replay the request with `curl --http2`, which exercises the JWT and payload
  while bypassing the runtime's transport gap, or
- run a local HTTP/2-upgrading proxy in front of APNs and point the Worker at it.

Do not read a local `Network connection lost` as a production failure.

## Related

- `InvalidProviderToken` (403) from APNs is the *other* failure mode and is about
  the key's provenance — the key must be created under the correct team with the
  APNs service enabled — not about the signing code.
