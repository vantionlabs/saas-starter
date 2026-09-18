import { Text } from "@react-email/components";
import { Action } from "../Action.js";
import { email } from "../Email.js";
import { Layout } from "../Layout.js";
import { theme } from "../Theme.js";

export type ResetPasswordProps = {
  readonly url: string;
  readonly product: string;
};

export const ResetPassword = email<ResetPasswordProps>({
  subject: () => "Reset your password",
  Body: (props) => (
    <Layout preview="Choose a new password" heading="Reset your password">
      <Text style={{ color: theme.text, fontSize: "14px", lineHeight: "22px" }}>
        Somebody asked to reset the password for this {props.product}{" "}
        account. If it was not you, nothing has changed and you can ignore this.
      </Text>

      <Action href={props.url} label="Choose a new password" />
    </Layout>
  ),
});
