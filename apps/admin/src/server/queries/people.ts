import { requireStaff } from "@/server/auth.js";
import { asStaff } from "@/server/runtime.js";
import { createServerFn } from "@tanstack/react-start";
import { findPerson } from "@vantion/module-admin/People";

/** One account, found by its exact address. Recorded like every other read. */
export const person = createServerFn({ method: "GET" })
  .inputValidator((input: { email: string; reason: string; }) => input)
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    return asStaff(staff, findPerson(data.email, data.reason));
  });
