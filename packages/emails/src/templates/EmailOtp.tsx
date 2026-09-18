import { Text } from "@react-email/components";
import { email } from "../Email.js";
import { Layout } from "../Layout.js";
import { theme } from "../Theme.js";

export type EmailOtpProps = {
  readonly code: string;
  readonly product: string;
};

export const EmailOtp = email<EmailOtpProps>({
  // The code goes in the subject so it is readable from a notification without
  // opening anything, which is most of why people prefer codes to links.
  subject: (props) => `${props.code} is your ${props.product} code`,
  Body: (props) => (
    <Layout preview={`Your ${props.product} sign-in code`} heading="Your sign-in code">
      <Text
        style={{
          color: theme.text,
          fontFamily: theme.fontMono,
          fontSize: "28px",
          letterSpacing: "6px",
          margin: "8px 0 16px",
        }}
      >
        {props.code}
      </Text>

      <Text style={{ color: theme.muted, fontSize: "13px", lineHeight: "20px" }}>
        Enter it on the sign-in page. It expires shortly and works once.
      </Text>
    </Layout>
  ),
});
