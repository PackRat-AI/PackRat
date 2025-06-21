import { Env } from "@/types/env";
import { Context } from "hono";
import { env } from "hono/adapter";
import { Resend } from "resend";

type EmailProvider = "nodemailer" | "resend";

// Send an email using the configured provider
export async function sendEmail({
  to,
  subject,
  html,
  c,
}: {
  to: string;
  subject: string;
  html: string;
  c: Context;
}): Promise<void> {
  const { EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM } = env<Env>(c);
  const provider = (EMAIL_PROVIDER as EmailProvider) || "nodemailer";
  const resendClient = new Resend(RESEND_API_KEY);

  const options = {
    from: `PackRat <${EMAIL_FROM}>`,
    to,
    subject,
    html,
  };

  switch (provider) {
    case "resend":
      await resendClient.emails.send(options);
      break;
    case "nodemailer":
    default:
      throw new Error("Nodemailer is not supported in Cloudflare Workers");
  }
}

// Send a verification code email
export async function sendVerificationCodeEmail({
  to,
  code,
  c,
}: {
  to: string;
  code: string;
  c: Context;
}): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify Your Email Address</h2>
      <p>Thank you for signing up for PackRat! Please verify your email address by entering the code below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${code}
        </div>
      </div>
      <p>This code will expire in 24 hours.</p>
      <p>If you didn't create an account with us, you can safely ignore this email.</p>
      <p>Best regards,<br>The PackRat Team</p>
    </div>
  `;

  await sendEmail({ to, subject: "Verify Your PackRat Account", html, c });
}

// Send a password reset email
export async function sendPasswordResetEmail({
  to,
  code,
  c,
}: {
  to: string;
  code: string;
  c: Context;
}): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Your Password</h2>
      <p>You requested to reset your password for your PackRat account. Enter the code below to set a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${code}
        </div>
      </div>
      <p>This code will expire in 1 hour.</p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>Best regards,<br>The PackRat Team</p>
    </div>
  `;

  await sendEmail({ to, subject: "Reset Your PackRat Password", html, c });
}
