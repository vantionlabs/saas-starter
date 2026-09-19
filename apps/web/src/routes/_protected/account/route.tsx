import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AccountNav } from "@vantion/ui/settings/settings-nav";
import { Separator } from "@vantion/ui/ui/separator";

/**
 * Your account, which is not the organization's.
 *
 * Its own area rather than a section of `/settings`, because the two answer to
 * different owners: everything under settings belongs to a workspace and is
 * gated on what somebody may do inside it, and everything here belongs to the
 * person and follows them between organizations. A member with no admin rights
 * still changes their own password.
 */
export const Route = createFileRoute("/_protected/account")({
  staticData: { crumb: "Account" },
  component: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Account</h1>
        <p className="text-muted-foreground text-sm">
          Yours, and the same in every organization you belong to
        </p>
      </div>
      <Separator />
      <div className="flex gap-8">
        <AccountNav />
        <div className="min-w-0 max-w-3xl flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  ),
});
