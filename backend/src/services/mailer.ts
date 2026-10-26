/**
 * mailer.ts - Alert email delivery.
 *
 * Modes (MAIL_MODE env var):
 *   log      (default) - prints the message to the server log, never sends.
 *   ethereal          - creates a Nodemailer Ethereal test account and logs
 *                       the preview URL.
 *   live              - sends via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS.
 *
 * Privacy: the message body contains ONLY the application id, a one-line
 * reason and a portal link. No document contents or personal data.
 *
 * Credentials are NEVER logged.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { AlertEventType, MailStatus } from '../types.js';
import { getMailMode, getPortalUrl } from '../config/alerts.js';

export interface AlertEmail {
  to: string;
  subject: string;
  text: string;
}

export interface AlertEmailResult {
  status: MailStatus;
  error?: string;
}

type EmailSender = (email: AlertEmail) => Promise<AlertEmailResult>;

let testSender: EmailSender | null = null;

/**
 * Test hook: replaces the transport with an injectable sender so unit tests can
 * simulate successful and failing deliveries without touching the network.
 */
export function setAlertEmailSenderForTests(sender: EmailSender | null): void {
  testSender = sender;
}

/** Human-readable one-line reason used in the email body. */
export function describeAlertReason(eventType: AlertEventType): string {
  switch (eventType) {
    case 'PENDENCY':
      return 'Application review is past its SLA due date.';
    case 'EVC_SCHEDULING':
      return 'Expert Visit Committee inspection is not scheduled yet.';
    case 'REPORT_SUBMISSION':
      return 'EVC inspection report has not been submitted.';
    case 'UNDERTAKING':
      return 'Institutional undertaking is pending.';
    case 'DOCUMENT_EXPIRY':
      return 'A compliance document has expired or is about to expire.';
    case 'DOCUMENT_AUTHENTICITY':
      return 'Document authenticity verification is overdue.';
    default:
      return 'An approval deadline requires attention.';
  }
}

export function buildAlertEmail(params: {
  to: string;
  applicationId: string;
  eventType: AlertEventType;
  escalationLevel?: number;
  kind: 'Reminder' | 'Escalation';
  reason?: string;
}): AlertEmail {
  const reason = params.reason || describeAlertReason(params.eventType);
  const levelSuffix =
    params.kind === 'Escalation' && params.escalationLevel
      ? ` (Level ${params.escalationLevel})`
      : '';
  const portalUrl = `${getPortalUrl()}/alerts`;
  return {
    to: params.to,
    subject: `[Vishwas] ${params.kind}${levelSuffix}: ${params.applicationId}`,
    text: [
      `Application: ${params.applicationId}`,
      `Reason: ${reason}`,
      `Open in portal: ${portalUrl}`,
    ].join('\n'),
  };
}

/** Builds the SMTP transport for live mode from environment variables. */
function createLiveTransport(): Transporter {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

async function sendOnce(email: AlertEmail): Promise<AlertEmailResult> {
  const mode = getMailMode();
  const from = process.env.MAIL_FROM || 'no-reply@vishwas.local';

  if (!email.to) {
    return { status: 'SKIPPED', error: 'No recipient configured' };
  }

  if (mode === 'log') {
    // Log mode prints the full message. This is the safe default for dev/demo.
    console.info(
      `[mail:log] to=${email.to} subject="${email.subject}"\n${email.text}`
    );
    return { status: 'SENT' };
  }

  if (mode === 'ethereal') {
    try {
      const account = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
      const info = await transporter.sendMail({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) {
        console.info(`[mail:ethereal] preview: ${preview}`);
      }
      return { status: 'SENT' };
    } catch (err: unknown) {
      return { status: 'FAILED', error: sanitizeError(err) };
    }
  }

  // live mode
  try {
    const transporter = createLiveTransport();
    await transporter.sendMail({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
    });
    return { status: 'SENT' };
  } catch (err: unknown) {
    return { status: 'FAILED', error: sanitizeError(err) };
  }
}

function sanitizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Never allow credentials in logs/ledger entries.
  return message
    .replace(/pass(word)?[=:]\s*\S+/gi, 'password=***')
    .replace(/auth[=:]\s*\S+/gi, 'auth=***');
}

/**
 * Sends one alert email, retrying a single time on failure.
 * Never throws: delivery problems are reported as FAILED.
 */
export async function sendAlertEmail(email: AlertEmail): Promise<AlertEmailResult> {
  const sender: EmailSender = testSender || sendOnce;

  let result = await sender(email);
  if (result.status === 'FAILED') {
    // Small backoff keeps the retry cheap while still avoiding hammering.
    await new Promise((resolve) => setTimeout(resolve, 50));
    result = await sender(email);
  }
  return result;
}

/** Exposed for /health so operators can see which mode is active. */
export function getMailHealth(): { mode: string; from: string } {
  return {
    mode: getMailMode(),
    from: process.env.MAIL_FROM || 'no-reply@vishwas.local',
  };
}
