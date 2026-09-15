/**
 * E2E Test Report – Email Sender
 *
 * Sends the corporate HTML report via email using Nodemailer.
 * Can be run standalone or integrated into CI/CD pipelines.
 *
 * Required environment variables (in .env.test or CI environment):
 *   REPORT_SMTP_HOST      – SMTP server host (e.g. smtp.gmail.com)
 *   REPORT_SMTP_PORT      – SMTP server port (default: 587)
 *   REPORT_SMTP_USER      – SMTP authentication user
 *   REPORT_SMTP_PASS      – SMTP authentication password
 *   REPORT_EMAIL_FROM     – Sender email address
 *   REPORT_EMAIL_TO       – Comma-separated list of recipient email addresses
 *
 * Optional environment variables:
 *   REPORT_EMAIL_SUBJECT  – Custom email subject
 *   REPORT_EMAIL_CC       – Comma-separated CC addresses
 *   REPORT_FILE           – Path to the HTML report (default: playwright-report/corporate-report.html)
 *
 * Usage:
 *   npx tsx tests/e2e/reporters/send-report.ts
 *   npm run test:e2e:send-report
 */

import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CidAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
}

// Load environment variables from .env.test
dotenvConfig({ path: path.resolve(__dirname, '..', '.env.test') });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  reportFile: string;
}

function loadConfig(): EmailConfig {
  const host = process.env.REPORT_SMTP_HOST;
  const user = process.env.REPORT_SMTP_USER;
  const pass = process.env.REPORT_SMTP_PASS;
  const from = process.env.REPORT_EMAIL_FROM;
  const to = process.env.REPORT_EMAIL_TO;

  // Validate required variables
  const missing: string[] = [];
  if (!host) missing.push('REPORT_SMTP_HOST');
  if (!user) missing.push('REPORT_SMTP_USER');
  if (!pass) missing.push('REPORT_SMTP_PASS');
  if (!from) missing.push('REPORT_EMAIL_FROM');
  if (!to) missing.push('REPORT_EMAIL_TO');

  if (missing.length > 0) {
    console.error(
      `\n❌ Missing required environment variables:\n   ${missing.join(', ')}\n`,
    );
    console.error(
      'Add them to tests/e2e/.env.test or export them in your CI environment.\n',
    );
    process.exit(1);
  }

  const port = parseInt(process.env.REPORT_SMTP_PORT || '587', 10);

  return {
    smtp: {
      host: host!,
      port,
      secure: port === 465,
      user: user!,
      pass: pass!,
    },
    from: from!,
    to: to!.split(',').map((e) => e.trim()),
    cc: process.env.REPORT_EMAIL_CC
      ? process.env.REPORT_EMAIL_CC.split(',').map((e) => e.trim())
      : [],
    subject:
      process.env.REPORT_EMAIL_SUBJECT ||
      `E2E Test Report – Cornflow UI – ${new Date().toLocaleDateString('es-ES')}`,
    reportFile:
      process.env.REPORT_FILE ||
      path.resolve(__dirname, '../../../playwright-report/corporate-report.html'),
  };
}

// ---------------------------------------------------------------------------
// HTML processing for email compatibility
// ---------------------------------------------------------------------------

/**
 * Processes the HTML report to make it compatible with email clients.
 *
 * Email clients like Gmail strip:
 * - `data:` URI images (for security)
 * - `<svg>` elements
 *
 * This function:
 * 1. Extracts all `data:` URI images → converts them to CID inline attachments
 * 2. Replaces inline SVGs with Unicode text fallbacks
 */
function processHtmlForEmail(html: string): {
  html: string;
  cidAttachments: CidAttachment[];
} {
  const cidAttachments: CidAttachment[] = [];
  let counter = 0;

  // 1. Replace data: URI images with CID references
  let processed = html.replace(
    /(<img\b[^>]*?)src="data:([^;]+);base64,([^"]+)"([^>]*?>)/g,
    (_match, before: string, mimeType: string, base64Data: string, after: string) => {
      counter++;
      const ext = mimeType.split('/')[1]?.replace('+xml', '') || 'png';
      const cid = `image-${counter}@report.local`;

      cidAttachments.push({
        filename: `image-${counter}.${ext}`,
        content: Buffer.from(base64Data, 'base64'),
        contentType: mimeType,
        cid,
      });

      return `${before}src="cid:${cid}"${after}`;
    },
  );

  // 2. Replace inline SVGs with Unicode text fallbacks for email clients
  //    Identify the icon type by the SVG path data
  processed = processed.replace(
    /<svg\b[^>]*>[\s\S]*?<\/svg>/g,
    (match) => {
      if (match.includes('M21,7L9,19')) return '&#10003;';    // mdi-check  → ✓
      if (match.includes('M19,6.41'))   return '&#10007;';    // mdi-close  → ✗
      if (match.includes('M12,20A8'))   return '&#9202;';     // mdi-clock  → ⏲
      if (match.includes('M19,13H5'))   return '&#8211;';     // mdi-minus  → –
      return '';
    },
  );

  return { html: processed, cidAttachments };
}

// ---------------------------------------------------------------------------
// Email sending
// ---------------------------------------------------------------------------

async function sendReport(): Promise<void> {
  const config = loadConfig();

  // Verify the report file exists
  if (!fs.existsSync(config.reportFile)) {
    console.error(`\n❌ Report file not found: ${config.reportFile}`);
    console.error(
      'Run the E2E tests first with the corporate reporter enabled:\n  npm run test:e2e\n',
    );
    process.exit(1);
  }

  const rawHtmlContent = fs.readFileSync(config.reportFile, 'utf-8');
  const reportFileName = path.basename(config.reportFile);

  // Process HTML for email compatibility (CID images, SVG → text fallbacks)
  const { html: emailHtml, cidAttachments } = processHtmlForEmail(rawHtmlContent);

  console.log('📧 Preparing to send E2E test report...');
  console.log(`   From:    ${config.from}`);
  console.log(`   To:      ${config.to.join(', ')}`);
  if (config.cc.length > 0) {
    console.log(`   CC:      ${config.cc.join(', ')}`);
  }
  console.log(`   Subject: ${config.subject}`);
  console.log(`   Report:  ${config.reportFile}`);
  if (cidAttachments.length > 0) {
    console.log(`   Images:  ${cidAttachments.length} embedded as CID attachments`);
  }
  console.log();

  // Create transport
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  } as SMTPTransport.Options);

  // Verify SMTP connection
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
  } catch (err) {
    console.error('❌ SMTP connection failed:', err);
    process.exit(1);
  }

  // Build email with CID inline attachments + original HTML as file attachment
  const mailOptions: nodemailer.SendMailOptions = {
    from: config.from,
    to: config.to,
    cc: config.cc.length > 0 ? config.cc : undefined,
    subject: config.subject,
    html: emailHtml,
    attachments: [
      // The original unprocessed HTML report as a downloadable file (with full data: URIs + SVGs)
      {
        filename: reportFileName,
        content: rawHtmlContent,
        contentType: 'text/html',
      },
      // CID inline image attachments (logo, screenshots) referenced from the email body
      ...cidAttachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        cid: att.cid,
      })),
    ],
  };

  // Send
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`\n✅ Report sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    if (info.accepted && info.accepted.length > 0) {
      console.log(`   Accepted:   ${(info.accepted as string[]).join(', ')}`);
    }
  } catch (err) {
    console.error('\n❌ Failed to send report:', err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

sendReport().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
