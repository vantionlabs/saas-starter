/**
 * How the product writes.
 *
 * Pairs rather than adjectives. "Be clear and friendly" is advice nobody can
 * apply; a sentence beside the one it replaces is a decision somebody can copy.
 * Every "instead" here is taken from strings the product actually ships.
 */
const rules = [
  {
    rule: "Say what happened, not how sorry you are.",
    no: "Oops! Something went wrong 😢",
    yes: "That upload did not finish. Nothing was saved.",
  },
  {
    rule: "Name the thing somebody has to go and ask for.",
    no: "You do not have permission to do that.",
    yes: "Your role does not allow this. An admin can grant `contact:create`.",
  },
  {
    rule: "Tell them what to try, not what you cannot do.",
    no: "An unexpected error occurred.",
    yes: "Reloading usually fixes it. The full error is in the browser console.",
  },
  {
    rule: "State the consequence before asking for the decision.",
    no: "Are you sure?",
    yes: "This removes the organization and everything in it. Type its name to confirm.",
  },
  {
    rule: "Prefer the plain word.",
    no: "Utilise the provisioning workflow to instantiate a tenant.",
    yes: "Create an organization.",
  },
] as const;

export const Voice = () => (
  <section id="voice" className="flex flex-col gap-6 border-t pt-16">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Voice</h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Plain, specific, and never apologetic about something that is not an apology. The rule is
        easy to agree with and hard to apply, so each one comes with the sentence it replaces.
      </p>
    </div>

    <div className="flex flex-col gap-3">
      {rules.map((entry) => (
        <div key={entry.rule} className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{entry.rule}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm line-through decoration-destructive/60">
              {entry.no}
            </p>
            <p className="rounded-md border p-3 text-sm">{entry.yes}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);
