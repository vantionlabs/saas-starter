import { Text } from "@react-email/components";
import { Action } from "../Action.js";
import { email } from "../Email.js";
import { Layout } from "../Layout.js";
import { theme } from "../Theme.js";

export type MagicLinkProps = {
  readonly url: string;
  readonly product: string;
};

export const MagicLink = email<MagicLinkProps>({
  subject: (props) => `Your ${props.product} sign-in link`,
  Body: (props) => (
    <Layout preview={`One click to sign in to ${props.product}`} heading="Sign in">
      <Text style={{ color: theme.text, fontSize: "14px", lineHeight: "22px" }}>
        This link signs you in to {props.product}. It expires shortly and works once.
      </Text>

      <Action href={props.url} label={`Sign in to ${props.product}`} />
    </Layout>
  ),
});
