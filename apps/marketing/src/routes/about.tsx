import { meta, site } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";

const DESCRIPTION = `Who builds ${site.name}, and what it is for.`;

const About = () => (
  <div className="flex max-w-2xl flex-col gap-6 py-16">
    <h1 className="text-3xl font-semibold tracking-tight">About</h1>
    <p className="text-muted-foreground leading-relaxed">
      {site.name}{" "}
      exists because every B2B product spends its first month building the same four things —
      sign-in, organizations, roles and billing — and none of them is the reason anybody buys it.
    </p>
    <p className="text-muted-foreground leading-relaxed">
      Replace this page with your own story. Say who you are, what you did before, and why this
      problem rather than another one. Nobody buying software from a small company is reassured by a
      paragraph about passion; they are reassured by knowing who is on the other end of the email
      address.
    </p>
    <p className="text-muted-foreground leading-relaxed">
      Questions go to{" "}
      <a href={`mailto:${site.contact}`} className="underline underline-offset-2">
        {site.contact}
      </a>.
    </p>
  </div>
);

export const Route = createFileRoute("/about")({
  head: () => meta({ title: "About", description: DESCRIPTION, path: "/about" }),
  component: About,
});
