import { staffTrail } from "@/server/queries/trail.js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StaffTrailTable } from "@vantion/ui/admin/staff-trail-table";

/**
 * The staff trail, loaded on the server.
 *
 * It is the one screen here that fetches on arrival — every other one asks for
 * a reason first, because every other one reads a customer's data. This reads
 * what staff have been doing, and a reason box in front of oversight is how
 * oversight stops.
 *
 * Because there is nothing to ask, there is nothing to wait for: the loader
 * runs during the server render, so the table arrives with the document. A
 * `useEffect` and a spinner here would be a skeleton standing in for data the
 * server already had in hand.
 */
const Audit = () => {
  const entries = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <StaffTrailTable
      entries={entries}
      onOpenOrganization={(id) => void navigate({ to: "/organizations/$id", params: { id } })}
    />
  );
};

export const Route = createFileRoute("/audit")({
  /**
   * `beforeLoad` in `__root.tsx` has already resolved the viewer, so a caller
   * who is not staff never reaches this and the trail is not read for them.
   */
  loader: () => staffTrail({ data: 200 }),
  component: Audit,
});
