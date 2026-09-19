import { signInWithSso } from "@/atom/sso-atoms.js";
import { Email } from "@/lib/auth/schemas.js";
import { submitMessage } from "@/lib/form/result.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@vantion/ui/auth/auth-card";
import { textField } from "@vantion/ui/auth/text-field";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";

/**
 * An address, never a list.
 *
 * The domain is what routes to an organization's identity provider, so asking
 * for it is enough. A picker would be the alternative, and a picker on a
 * multi-tenant product shows every customer who the other customers are.
 */
const form = FormReact.make(
  FormBuilder.empty.addField("email", Email),
  {
    mode: { validation: "onBlur" },
    fields: {
      email: textField({ label: "Work email", type: "email", autoComplete: "email" }),
    },
    onSubmit: (_, { decoded }) => signInWithSso(decoded.email),
  },
);

const Sso = () => {
  const submit = useAtomSet(form.submit);
  const result = useAtomValue(form.submit);
  const submitted = useAtomValue(form.submitCount) > 0;

  return (
    <AuthCard
      title="Sign in with your company"
      description="If your organization uses single sign-on, we'll send you there."
      footer={
        <div className="flex flex-col gap-1">
          <AuthLink to="/auth/sign-in">Back to sign in</AuthLink>
        </div>
      }
    >
      <form.Initialize defaultValues={{ email: "" }}>
        <div className="flex flex-col gap-4">
          <form.email submitted={submitted} />
          {
            /* A success here is a redirect that is already happening, so there
              is nothing to announce — only a failure needs words. */
          }
          {result._tag === "Failure" && (
            <Alert variant="destructive">
              <AlertDescription>
                {submitMessage(
                  result,
                  "We could not find a provider for that domain. Ask whoever administers your organization, or sign in with a password.",
                )}
              </AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={result.waiting}
            onClick={() => submit()}
          >
            Continue
          </Button>
        </div>
      </form.Initialize>
    </AuthCard>
  );
};

export const Route = createFileRoute("/auth/sso")({ component: Sso });
