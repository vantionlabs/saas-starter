import { Text } from "@react-email/components";
import { Action } from "../Action.js";
import { email } from "../Email.js";
import { Layout } from "../Layout.js";
import { theme } from "../Theme.js";

export type InvitationProps = {
  readonly url: string;
  readonly organization: string;
  readonly role: string;
  readonly product: string;
};

export const Invitation = email<InvitationProps>({
  // The organization, not the product, because that is what the reader
  // recognises — they have usually never heard of the product.
  subject: (props) => `You have been invited to ${props.organization}`,
  Body: (props) => (
    <Layout
      preview={`Join ${props.organization} on ${props.product}`}
      heading={`Join ${props.organization}`}
    >
      <Text style={{ color: theme.text, fontSize: "14px", lineHeight: "22px" }}>
        You have been invited to {props.organization} on {props.product} as{" "}
        <strong>{props.role}</strong>. Accepting creates your account if you do not have one.
      </Text>

      <Action href={props.url} label="Accept the invitation" />
    </Layout>
  ),
});
