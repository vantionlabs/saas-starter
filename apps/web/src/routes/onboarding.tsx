import { signOut } from "@/atom/session-atoms.js";
import { InviteForm } from "@/components/access/invite-form.js";
import { submitMessage } from "@/lib/form/result.js";
import { getOnboarding } from "@/server/reads/onboarding.js";
import { getSession } from "@/server/session.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AppRpc } from "@vantion/core/AppRpc";
import { finishOnboardingAtom, onboardingAtom } from "@vantion/core/atoms/Onboarding";
import { Keys } from "@vantion/core/Keys";
import { OrganizationFields } from "@vantion/module-iam/organization/OrganizationRpc";
import { textField } from "@vantion/ui/auth/text-field";
import { RevealWhen } from "@vantion/ui/motion/reveal";
import { OnboardingCard } from "@vantion/ui/onboarding/onboarding-card";
import { Alert, AlertDescription } from "@vantion/ui/ui/alert";
import { Button } from "@vantion/ui/ui/button";
import { Effect, Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

/**
 * Setting up a workspace, once, at the beginning.
 *
 * **Outside `_protected` on purpose.** That layout redirects anybody whose
 * workspace is unfinished here, so a wizard nested inside it would redirect to
 * itself — and it would render the application chrome around a page whose whole
 * argument is that the application is not ready yet. The cost is that
 * everything the shell offers has to be offered again, which is exactly one
 * thing: signing out. A gate somebody cannot leave is the failure this note
 * exists to prevent.
 *
 * **Resumable, because the step is on the row and not in this component.**
 * Closing the tab on step two and coming back tomorrow returns to step two.
 * That is the entire reason `SetOnboardingStep` is a write rather than a piece
 * of client state, and it costs one round trip per step to get.
 *
 * `ssr: "data-only"`, the same choice `/auth` makes and for the same reason:
 * the data phase decides the two redirects on the server, and the forms cannot
 * be server-rendered anyway — effect-form sets its ready flag in a `useEffect`,
 * which does not run during SSR, so the fields' subtree is `null` there and
 * rendering the card around that hole gives two paints.
 */
export const Route = createFileRoute("/onboarding")({
  ssr: "data-only",
  beforeLoad: async () => {
    const user = await getSession();

    if (user === null) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  loader: async () => {
    const onboarding = await getOnboarding();

    /**
     * Finished already: this page has nothing left to ask. It is reachable by
     * typing the address or by a stale tab, and both should land in the
     * product rather than on a wizard that can only be skipped.
     */
    if (onboarding.completed) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({ to: "/" });
    }

    return onboarding.hydrate;
  },
  component: Onboarding,
});

/**
 * Naming the workspace, which is the one thing sign-up chose on somebody's
 * behalf. The field is the contract's, so this form refuses exactly what
 * `RenameOrganization` refuses and the sentence is declared once.
 */
const nameForm = FormReact.make(
  FormBuilder.empty.addField("name", OrganizationFields.name),
  {
    runtime: AppRpc.runtime,
    mode: { validation: "onBlur" },
    /**
     * Renaming invalidates `organization` because the shell shows the name,
     * and `onboarding` because the same submit advances the step. Declared
     * with the write rather than at the call site, as every other write here
     * declares it.
     */
    reactivityKeys: [Keys.organization, Keys.onboarding],
    onSubmit: (_, { decoded }) =>
      Effect.gen(function*() {
        const client = yield* AppRpc;

        yield* client("RenameOrganization", { name: decoded.name });

        /**
         * The step advances in the same submit, so the name and the progress
         * land together. Two buttons would let somebody rename their workspace
         * and still be asked to name it on the next visit.
         */
        return yield* client("SetOnboardingStep", { step: "invite" });
      }),
    fields: { name: textField({ label: "Workspace name" }) },
  },
);

const NameStep = () => {
  const submit = useAtomSet(nameForm.submit, { mode: "promiseExit" });
  const result = useAtomValue(nameForm.submit);
  const submitted = useAtomValue(nameForm.submitCount) > 0;

  return (
    <nameForm.Initialize defaultValues={{ name: "" }}>
      <div className="flex flex-col gap-4">
        <nameForm.name submitted={submitted} />
        <Button
          type="button"
          disabled={result.waiting}
          onClick={() => void submit(undefined)}
        >
          {result.waiting ? "Saving…" : "Continue"}
        </Button>
        <RevealWhen show={result._tag === "Failure"}>
          <Alert variant="destructive">
            <AlertDescription>
              {submitMessage(result, "That name could not be saved.")}
            </AlertDescription>
          </Alert>
        </RevealWhen>
      </div>
    </nameForm.Initialize>
  );
};

const InviteStep = (props: { readonly onDone: () => void; }) => (
  <div className="flex flex-col gap-4">
    <InviteForm />
    <Button type="button" onClick={props.onDone}>I'm done</Button>
  </div>
);

const steps = { organization: 1, invite: 2, done: 2 } as const;

function Onboarding() {
  const state = useAtomValue(onboardingAtom);
  const finish = useAtomSet(finishOnboardingAtom, { mode: "promiseExit" });
  const navigate = useNavigate();

  /**
   * Hydrated by the loader, so there is no loading arm. A failure falls back
   * to the first step rather than to an error screen: every step is
   * skippable, so the worst case of guessing wrong is one extra question.
   */
  const step = AsyncResult.isSuccess(state) ? state.value.step : "organization";

  const leave = () => {
    void finish().then((exit) => {
      // A finish that failed leaves them here rather than at a gate that
      // will bounce them straight back.
      if (Exit.isSuccess(exit)) void navigate({ to: "/" });
    });
  };

  return (
    <OnboardingCard
      step={steps[step]}
      of={2}
      title={step === "organization" ? "Name your workspace" : "Invite your team"}
      description={step === "organization"
        ? "This is what your colleagues will see. You can change it later in settings."
        : "Send an invitation now, or do it later from settings — nothing here is final."}
      onSkip={leave}
      onSignOut={() =>
        void Effect.runPromise(signOut).then(() => navigate({ to: "/auth/sign-in" }))}
    >
      {step === "organization" ? <NameStep /> : <InviteStep onDone={leave} />}
    </OnboardingCard>
  );
}
