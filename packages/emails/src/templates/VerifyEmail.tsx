import { Text } from "@react-email/components";
import { Action } from "../Action.js";
import { email } from "../Email.js";
import { Layout } from "../Layout.js";
import { theme } from "../Theme.js";

export type VerifyEmailProps = {
  readonly url: string;
  readonly product: string;
};

export const VerifyEmail = email<VerifyEmailProps>({
  subject: () => "Verify your email",
  Body: (props) => (
    <Layout preview="Confirm your email address" heading="Verify your email">
      <Text style={{ color: theme.text, fontSize: "14px", lineHeight: "22px" }}>
        Confirming this address lets {props.product}{" "}
        send you the things that matter — an invitation, a receipt, a password reset.
      </Text>

      <Action href={props.url} label="Confirm this address" />
    </Layout>
  ),
});
