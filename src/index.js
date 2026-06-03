require("dotenv").config();

const express = require("express");
const {
  createTransporter,
  sendEmail,
  getDelayMs,
  delay,
} = require("./mailer");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 5001;
const API_KEY = process.env.API_KEY;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return next();
  }

  const key = req.get("x-api-key");
  if (key !== API_KEY) {
    return res.status(401).json({ error: "API key inválida ou ausente" });
  }

  return next();
}

function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  const normalized = list
    .map((email) => (typeof email === "string" ? email.trim() : ""))
    .filter(Boolean);

  const invalid = normalized.filter((email) => !EMAIL_REGEX.test(email));
  if (invalid.length > 0) {
    return { error: `E-mails inválidos: ${invalid.join(", ")}` };
  }

  const unique = [...new Set(normalized)];
  if (unique.length === 0) {
    return { error: "Informe ao menos um destinatário em 'to'" };
  }

  return { recipients: unique };
}

function validateSendBody(body) {
  const { to, subject, fromName, body: emailBody, isHtml } = body;

  if (!to) {
    return { error: "Campo 'to' é obrigatório (string ou array de strings)" };
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return { error: "Campo 'subject' é obrigatório" };
  }
  if (typeof fromName !== "string" || !fromName.trim()) {
    return { error: "Campo 'fromName' é obrigatório (nome exibido do remetente)" };
  }
  if (typeof emailBody !== "string" || !emailBody.trim()) {
    return { error: "Campo 'body' é obrigatório" };
  }
  if (isHtml !== undefined && typeof isHtml !== "boolean") {
    return { error: "Campo 'isHtml' deve ser booleano quando informado" };
  }

  const recipientsResult = normalizeRecipients(to);
  if (recipientsResult.error) {
    return recipientsResult;
  }

  return {
    recipients: recipientsResult.recipients,
    subject: subject.trim(),
    fromName: fromName.trim(),
    body: emailBody,
    isHtml,
  };
}

function requireSmtpEnv() {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Variáveis SMTP ausentes: ${missing.join(", ")}`);
  }
}

let transporter;

try {
  requireSmtpEnv();
  transporter = createTransporter();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-emails" });
});

app.post("/send", requireApiKey, async (req, res) => {
  const parsed = validateSendBody(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const { recipients, subject, fromName, body, isHtml } = parsed;
  const delayMs = getDelayMs();
  const results = [];
  const errors = [];

  for (let i = 0; i < recipients.length; i += 1) {
    const to = recipients[i];

    try {
      const info = await sendEmail(transporter, {
        to,
        subject,
        fromName,
        body,
        isHtml,
      });

      results.push({
        to,
        messageId: info.messageId,
        accepted: info.accepted,
      });
    } catch (err) {
      errors.push({
        to,
        error: err.message,
      });
    }

    if (i < recipients.length - 1) {
      await delay(delayMs);
    }
  }

  const sent = results.length;
  const failed = errors.length;
  const success = failed === 0;

  return res.status(success ? 200 : 207).json({
    success,
    sent,
    failed,
    total: recipients.length,
    results,
    ...(errors.length > 0 ? { errors } : {}),
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.listen(PORT, () => {
  console.log(`api-emails ouvindo na porta ${PORT}`);
  if (!API_KEY) {
    console.warn("AVISO: API_KEY não definida — POST /send está sem autenticação");
  }
});
