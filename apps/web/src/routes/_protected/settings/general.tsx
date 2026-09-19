import { listMyOrganizations } from "@/server/reads/organization.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import {
  deleteOrganizationAtom,
  organizationsAtom,
  renameOrganizationAtom,
} from "@vantion/core/atoms/Organization";
import { DangerZone } from "@vantion/ui/settings/danger-zone";
import { Button } from "@vantion/ui/ui/button";
import { Input } from "@vantion/ui/ui/input";
import { Label } from "@vantion/ui/ui/label";
import { Separator } from "@vantion/ui/ui/separator";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";
import { toast } from "sonner";

const General = () => {
  const organizations = useAtomValue(organizationsAtom);
  const rename = useAtomSet(renameOrganizationAtom);
  const remove = useAtomSet(deleteOrganizationAtom, { mode: "promiseExit" });
  const removing = useAtomValue(deleteOrganizationAtom);

  const active = AsyncResult.isSuccess(organizations)
    ? organizations.value.find((membership) => membership.isActive)
    : undefined;

  const [name, setName] = React.useState("");
  // The saved name wins whenever it changes underneath the field — another tab,
  // or a switch of organization.
  const [lastActive, setLastActive] = React.useState(active?.name ?? "");
  if ((active?.name ?? "") !== lastActive) {
    setLastActive(active?.name ?? "");
    setName(active?.name ?? "");
  }

  /**
   * Hydrated before first paint, and a caller always belongs to at least their
   * personal organization — so this should not happen. It says so rather than
   * rendering nothing: a blank settings page is the one outcome that leaves
   * somebody with no idea whether it is broken or empty.
   */
  if (active === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        No organization is active. Pick one from the switcher above.
      </p>
    );
  }

  const current = name === "" ? active.name : name;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">General</h2>
          <p className="text-muted-foreground text-sm">
            Name and identifiers for this organization.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="org-name">Name</Label>
          <div className="flex items-center gap-2">
            <Input
              id="org-name"
              className="max-w-sm"
              value={current}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              disabled={current.trim() === "" || current === active.name}
              onClick={() => {
                rename(current.trim());
                toast.success("Renamed");
              }}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            className="max-w-sm font-mono"
            value={active.slug}
            readOnly
            disabled
          />
          <p className="text-muted-foreground text-xs">
            Generated when the organization was created. Changing it would break any link that
            already uses it.
          </p>
        </div>
      </div>

      <Separator />

      <DangerZone
        organizationName={active.name}
        isOnlyOrganization={AsyncResult.isSuccess(organizations)
          && organizations.value.length === 1}
        pending={removing.waiting}
        onDelete={(confirmName) => {
          void remove(confirmName).then((exit) => {
            if (Exit.isSuccess(exit)) toast.success(`Deleted ${confirmName}`);
            else toast.error("Could not delete that organization");
          });
        }}
      />
    </section>
  );
};

export const Route = createFileRoute("/_protected/settings/general")({
  staticData: { crumb: "General" },
  loader: () => listMyOrganizations(),
  component: General,
});
