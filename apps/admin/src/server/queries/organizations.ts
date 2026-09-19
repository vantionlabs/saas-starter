import { requireStaff } from "@/server/auth.js";
import { asStaff } from "@/server/runtime.js";
import { createServerFn } from "@tanstack/react-start";
import { getOrganization, listOrganizations } from "@vantion/module-admin/Organizations";

export const organizations = createServerFn({ method: "POST" })
  .inputValidator((reason: string) => reason)
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    return asStaff(staff, listOrganizations(data));
  });

export const organization = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; reason: string; }) => input)
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    return asStaff(staff, getOrganization(data.id, data.reason));
  });
