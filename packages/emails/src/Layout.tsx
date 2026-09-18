import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";
import { theme } from "./Theme.js";

/**
 * The shell every message shares.
 *
 * `Preview` is the line a client shows beside the subject in the list. Left
 * unset it shows whatever the first words of the body happen to be, which is
 * usually "View this email in your browser".
 */
export const Layout = (props: {
  readonly preview: string;
  readonly heading: string;
  readonly children: React.ReactNode;
}) => (
  <Html lang="en">
    <Head />
    <Preview>{props.preview}</Preview>
    <Body
      style={{
        backgroundColor: theme.surface,
        fontFamily: theme.fontSans,
        margin: 0,
        padding: "24px 0",
      }}
    >
      <Container
        style={{
          backgroundColor: theme.background,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          margin: "0 auto",
          maxWidth: "520px",
          padding: "32px",
        }}
      >
        <Heading
          as="h1"
          style={{ color: theme.text, fontSize: "18px", fontWeight: 600, margin: "0 0 16px" }}
        >
          {props.heading}
        </Heading>

        <Section>{props.children}</Section>

        <Hr style={{ borderColor: theme.border, margin: "28px 0 16px" }} />

        <Text style={{ color: theme.muted, fontSize: "12px", lineHeight: "18px", margin: 0 }}>
          If you did not expect this email you can ignore it. Nothing happens until you act on it.
        </Text>
      </Container>
    </Body>
  </Html>
);
