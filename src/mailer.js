const nodemailer = require("nodemailer");

/**
 * @returns {import('nodemailer').Transporter}
 */
function createTransporter() {
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * @param {import('nodemailer').Transporter} transporter
 * @param {{ to: string, subject: string, fromName: string, body: string, isHtml?: boolean }} options
 */
async function sendEmail(transporter, { to, subject, fromName, body, isHtml }) {
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const safeName = fromName.replace(/"/g, '\\"');
  const from = `"${safeName}" <${fromAddress}>`;

  const useHtml =
    isHtml === true || (isHtml !== false && /<\/?[a-z][\s\S]*>/i.test(body));

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    ...(useHtml ? { html: body } : { text: body }),
  });

  return info;
}

function getDelayMs() {
  const perMinute = Math.max(1, Number(process.env.EMAILS_PER_MINUTE) || 5);
  return Math.ceil(60_000 / perMinute);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createTransporter, sendEmail, getDelayMs, delay };
