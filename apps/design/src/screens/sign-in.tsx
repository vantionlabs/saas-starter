import { AuthCard } from "@vantion/ui/auth/auth-card";
import { Button } from "@vantion/ui/ui/button";
import { Input } from "@vantion/ui/ui/input";
import { Label } from "@vantion/ui/ui/label";

/**
 * The signed-out surface, laid out as it is in the product.
 *
 * Fields are plain inputs rather than the real form: `apps/web` builds these
 * from effect-form, and a form with validation, submission and error states is
 * the one thing on this screen that has nothing to do with how it looks.
 */
export const SignIn = () => (
  <div className="flex flex-1 items-center justify-center">
    <AuthCard
      title="Sign in"
      description="Use your email and password, or sign in without one."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="design-email">Email</Label>
          <Input id="design-email" type="email" defaultValue="ada@northwind.test" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="design-password">Password</Label>
          <Input id="design-password" type="password" defaultValue="password" />
        </div>
        <Button type="button" className="w-full">Sign in</Button>
      </div>
    </AuthCard>
  </div>
);
