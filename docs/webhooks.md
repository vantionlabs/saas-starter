# Outbound webhooks

Events leave this application the way every other side effect does: through the
transactional outbox. `ContactStore.create` writes the contact and its
`contact.created` event in one `withOrgScope`, the relay moves committed rows
into the queue, and the worker POSTs each one to every active endpoint the
organization has. A subscriber never hears about a row that was rolled back, and
a row that exists always had its event written.

That half has existed since `0007_webhooks.sql`. What arrived later is the half
a customer can reach: `/settings/webhooks`, where somebody says where to deliver
and sees what happened when we tried.

## What a receiver has to do

Verify the signature, and deduplicate on `Webhook-Id`.

```
POST /your/endpoint
Webhook-Id: 0f1c…            the outbox row, stable across retries
Webhook-Signature: t=1758…,v1=3f9a…
Content-Type: application/json
```

The scheme is Stripe's, and deliberately: customers already have code for it and
there is a document to point at. The HMAC is over `${timestamp}.${body}` rather
than the body alone — the timestamp **inside** the signature is what makes a
captured request expire instead of staying valid forever. `Signature.ts` holds
`sign` and `verify` in one file, so the tests verify with the function a customer
writes against; a signer with no verifier beside it is a scheme nobody has
checked from the outside.

Delivery is **at-least-once**. The relay marks a row relayed in the same
transaction as the push, so a crash between the two delivers twice — which is
why `Webhook-Id` is stable across retries and why a handler must be idempotent.
A duplicate a receiver tolerates is a better failure than a job that silently
never ran.

## Rotating, and what it costs

`RotateSecret` replaces the secret and keeps the endpoint, because the attempts
recorded against it are what somebody is looking at when they decide to rotate —
"delete and re-add" throws that history away.

There is **no overlap window**. The next delivery is signed with the new secret,
so a receiver has to be updated now rather than at leisure. Two live secrets, an
old one accepted for an hour, is the kinder design and is a second column plus a
second `v1=` in the header; it is not built here, and the screen says so by
showing the secret once with a warning rather than pretending the change is
gentle.

## Why the URL is checked, and what the check cannot do

This is the sharp edge of the whole feature. A webhook endpoint is a URL a
**customer** chooses and a **server of ours** then fetches, which is the
definition of server-side request forgery. Unchecked,
`http://169.254.169.254/latest/meta-data/iam/` is a perfectly valid endpoint, and
the delivery worker will fetch the instance's own cloud credentials and post them
to whatever endpoint is registered next.

`DeliverableUrl.ts` refuses two things, and `EndpointFields.url` in the contract
is what applies them — so the form and the procedure cannot disagree:

- **`https` only.** The delivery is signed, but a signature protects the body
  from being changed, not from being read, and these events carry a tenant's own
  records.
- **No private, loopback or link-local hosts.** Including the metadata address
  above, the RFC 1918 ranges, and IPv6 unique-local and link-local.

`http://localhost` is the deliberate exception, because the first thing anybody
does with this is point it at a receiver on their own machine. It is a switch
rather than a rule: `NODE_ENV=production` turns it off, since a deployed instance
has no business delivering to its own loopback, where its own unauthenticated
internal services listen.

**What this does not do, said plainly.** The check runs on the string, before
DNS. `evil.example` resolving to `10.0.0.1` passes and is fetched anyway, and a
name that resolves differently on the second lookup defeats any check made on the
first. Closing that means refusing the _connection_ rather than the string —
egress rules on the worker, or an HTTP proxy that will not route into private
space. This is the cheap half; it catches the accident and the casual attempt,
and a deployment holding real customer data should do the other half too.

## Who may

`webhook:read` to see the list, `webhook:manage` to change it — owner and admin,
never a member. The row carries a signing secret, so even looking at the list is
closer to reading a credential than to reading a setting, and a member who could
rotate one could silently stop every integration the organization has.

The **list is never gated on the plan**, and only registering is. An organization
that has downgraded still needs to know why deliveries stopped and still needs to
be able to rotate a secret it believes has leaked; taking that away would make a
lapsed plan a security problem. Same reasoning that leaves a `canceled`
subscription on the free plan rather than on nothing.

The number of endpoints is `limits.webhookEndpoints`, counted before a secret is
generated — the last moment to refuse is before a credential exists — and shown
on `/settings/billing` beside the other three meters.

## The secret is never in a page

`ListEndpoints` names its columns instead of selecting `*`. That is the whole of
keeping the secret out: a screen reads this, hydration serialises what a screen
reads into the document, and `select *` would put every tenant's signing key into
the HTML on every visit. A test asserts the list carries no `whsec_`.

It is returned exactly twice — when an endpoint is created, and when its secret
is rotated — and shown once each time.

## An endpoint that stops answering

Ten consecutive failures switch an endpoint off, which is the part everyone
forgets: a receiver that has been gone for a week otherwise costs an attempt a
minute forever. The screen shows `Switched off` rather than hiding it, because
that is the state somebody is looking for when deliveries stopped and nobody
noticed.

`webhookEndpointsDisabled` is the metric, counted from what the update statement
returned rather than by reading the row back.
