import { OnboardingCard } from "@vantion/ui/onboarding/onboarding-card";
import { Button } from "@vantion/ui/ui/button";
import { Input } from "@vantion/ui/ui/input";
import { Label } from "@vantion/ui/ui/label";

/**
 * The first screen a new workspace sees, laid out as it is in the product.
 *
 * No persona, for the same reason the sign-in screen has none: this is the
 * state *before* there is a tenant's worth of data to be in. The fields are
 * plain inputs rather than the real form, because `apps/web` builds these from
 * effect-form and validation is the one part of a form that has nothing to do
 * with how it looks.
 */
export const Onboarding = () => (
  <OnboardingCard
    step={1}
    of={2}
    title="Name your workspace"
    description="This is what your colleagues will see. You can change it later in settings."
    onSkip={() => {}}
    onSignOut={() => {}}
  >
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="design-workspace">Workspace name</Label>
        <Input id="design-workspace" defaultValue="Northwind" />
      </div>
      <Button type="button">Continue</Button>
    </div>
  </OnboardingCard>
);
