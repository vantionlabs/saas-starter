import { theme } from "@vantion/emails/Theme";
import { oklchToHex } from "@vantion/tokens/color";
import { colors } from "@vantion/tokens/tokens";

/**
 * The places the brand leaves the product.
 *
 * An email footer, a social card and a business card, each rendered from the
 * same tokens rather than drawn in a design tool and exported. The email footer
 * is the real one: `@vantion/emails` converts the palette to hex because no
 * mail client reads `oklch`, and this shows exactly what it sends.
 */
export const Assets = () => (
  <section id="assets" className="flex flex-col gap-6 border-t pt-16">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Assets</h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Where the brand shows up outside the application. Each of these is generated from the same
        values the product uses, so none of them can quietly diverge from it.
      </p>
    </div>

    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Email footer</h3>
      <p className="text-muted-foreground text-xs">
        Light, deliberately: the product is dark, and a dark email lands in a white inbox looking
        like a mistake.
      </p>
      <div
        className="rounded-lg border p-6 text-[13px]"
        style={{ background: theme.background, color: theme.muted, fontFamily: theme.fontSans }}
      >
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
          <p style={{ color: theme.text, margin: 0, fontWeight: 500 }}>Acme</p>
          <p style={{ margin: "4px 0 0" }}>
            You are receiving this because somebody invited you to an organization.
          </p>
          <p style={{ margin: "8px 0 0" }}>
            <span style={{ color: theme.accent }}>acme.example</span>
          </p>
        </div>
      </div>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Social card</h3>
        <div
          className="flex aspect-[1200/630] flex-col justify-between rounded-lg border p-8"
          style={{ background: colors.background, color: colors.foreground }}
        >
          <p className="text-sm font-medium">Acme</p>
          <p className="max-w-md text-2xl font-semibold tracking-tight text-balance">
            The boring parts of your B2B product, already done.
          </p>
          <p className="text-xs" style={{ color: colors["muted-foreground"] }}>acme.example</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Card</h3>
        <div
          className="flex aspect-[85/55] flex-col justify-between rounded-lg border p-6"
          style={{ background: colors.card, color: colors.foreground }}
        >
          <p className="text-sm font-medium">Acme</p>
          <div className="text-xs" style={{ color: colors["muted-foreground"] }}>
            <p>Someone Specific</p>
            <p>someone@acme.example</p>
          </div>
        </div>
      </div>
    </div>

    <p className="text-muted-foreground text-xs">
      Accent, as mail sees it: <code>{oklchToHex(colors.primary)}</code>
    </p>
  </section>
);
