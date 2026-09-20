import { AssistantRpcs } from "@vantion/module-assistant/AssistantRpc";
import { BillingRpcs } from "@vantion/module-billing/BillingRpc";
import { ContactRpcs } from "@vantion/module-contact/ContactRpc";
import { FilesRpcs } from "@vantion/module-files/FilesRpc";
import { HealthRpcs } from "@vantion/module-health/HealthRpc";
import { AccessRpcs } from "@vantion/module-iam/access/AccessRpc";
import { OnboardingRpcs } from "@vantion/module-iam/onboarding/OnboardingRpc";
import { OrganizationRpcs } from "@vantion/module-iam/organization/OrganizationRpc";
import { IamRpcs } from "@vantion/module-iam/session/IamRpc";
import { WebhooksRpcs } from "@vantion/module-webhooks/WebhooksRpc";

/**
 * Every RPC the application serves, as one group.
 *
 * Both ends need the same list — the server to mount handlers, the client to
 * build a request. Keeping the merge here rather than in each of them is what
 * stops the two drifting: a group added to one and not the other becomes a
 * compile error rather than a call that fails at runtime.
 *
 * It also lets the client hold a single RPC client. Each group previously meant
 * its own client, protocol layer and atom runtime, all pointed at the same
 * endpoint.
 */
export const AppRpcs = HealthRpcs
  .merge(IamRpcs)
  .merge(OrganizationRpcs)
  .merge(OnboardingRpcs)
  .merge(AccessRpcs)
  .merge(ContactRpcs)
  .merge(BillingRpcs)
  .merge(FilesRpcs)
  .merge(AssistantRpcs)
  .merge(WebhooksRpcs);
