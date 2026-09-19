import { usePersona } from "@/screens/persona.js";
import { StaffTrailTable } from "@vantion/ui/admin/staff-trail-table";

/**
 * The staff trail, from `apps/admin` — a fourth surface on the same canvas.
 *
 * It is here because it was the one surface `packages/ui` had components for
 * and nothing rendered: `admin/` shipped a table and a reason prompt that only
 * the admin app could show, so a designer could not see the screen whose
 * mistakes are least visible and most expensive.
 */
export const Admin = () => {
  const persona = usePersona();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Staff trail</h2>
        <p className="text-sm text-muted-foreground">
          Every cross-tenant read, who made it and why
        </p>
      </div>

      <StaffTrailTable entries={persona.staffTrail} onOpenOrganization={() => {}} />
    </section>
  );
};
