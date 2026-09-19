import { requireStaff } from "@/server/auth.js";
import { asStaff } from "@/server/runtime.js";
import { createServerFn } from "@tanstack/react-start";
import { listStaffTrail } from "@vantion/module-admin/StaffTrail";

/**
 * The trail, and the only staff procedure here that takes no reason.
 *
 * Oversight rather than access: it reads what staff have done, not what a
 * customer owns. `StaffTrail.ts` carries the argument — charging a ticket
 * number for checking on colleagues is how the checking stops, and routing it
 * through `crossTenant` would make every review append to the thing being
 * reviewed.
 *
 * It is still behind `requireStaff`, which is the part that matters.
 */
export const staffTrail = createServerFn({ method: "POST" })
  .inputValidator((limit: number) => limit)
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    return asStaff(staff, listStaffTrail(data));
  });
