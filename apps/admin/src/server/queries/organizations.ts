import { requireStaff } from "@/server/auth.js";
import { asStaff } from "@/server/runtime.js";
import { createServerFn } from "@tanstack/react-start";
import { getOrganization, listOrganizations } from "@vantion/module-admin/Organizations";

/**
 * Reads, so `GET`, even though both carry a payload.
 *
 * A server function here is only ever a read — a write is a form on the client,
 * and there is nothing this surface writes. The reason travels in the request
 * rather than in a body for the same reason the method says `GET`: it describes
 * *what is being asked for*, and it is recorded in `adminAudit` regardless.
 *
 * Worth knowing rather than hiding: a `GET` payload ends up in the URL, so a
 * reason and an email address will appear in whatever access log sits in front
 * of this app. That is acceptable for an internal surface that is already
 * expected to sit behind a VPN or an allowlist, and it is a reason not to put
 * this app on a shared ingress with third-party logging.
 */
export const organizations = createServerFn({ method: "GET" })
  .inputValidator((reason: string) => reason)
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    return asStaff(staff, listOrganizations(data));
  });

export const organization = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string; reason: string; }) => input)
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    return asStaff(staff, getOrganization(data.id, data.reason));
  });
