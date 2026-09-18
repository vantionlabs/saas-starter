import { Button, Text } from "@react-email/components";
import { theme } from "./Theme.js";

/**
 * The one thing the reader is being asked to do.
 *
 * The URL is repeated underneath as text on purpose: a proportion of clients
 * strip or rewrite buttons, and a mail whose only call to action is a styled
 * anchor is a mail those readers cannot act on.
 */
export const Action = (props: { readonly href: string; readonly label: string; }) => (
  <>
    <Button
      href={props.href}
      style={{
        backgroundColor: theme.accent,
        borderRadius: "6px",
        color: theme.accentText,
        display: "inline-block",
        fontSize: "14px",
        fontWeight: 500,
        padding: "10px 18px",
        textDecoration: "none",
      }}
    >
      {props.label}
    </Button>

    <Text style={{ color: theme.muted, fontSize: "12px", lineHeight: "18px", marginTop: "20px" }}>
      Or paste this into your browser:<br />
      <span style={{ color: theme.muted, fontFamily: theme.fontMono, wordBreak: "break-all" }}>
        {props.href}
      </span>
    </Text>
  </>
);
