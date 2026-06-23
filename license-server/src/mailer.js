const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.spaceweb.ru";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "soft@eventhunt.ru";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured");
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
}

function makeLicenseEmail(appName, key, instructionsUrl) {
  const subject = `Ваш лицензионный ключ ${appName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #f59e0b;">Спасибо за покупку!</h2>
      <p>Ваш лицензионный ключ для <strong>${appName}</strong>:</p>
      <div style="font-size: 20px; font-family: monospace; background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; word-break: break-all;">
        ${key}
      </div>
      <p>Ключ привязан к вашему email и может быть активирован на одном компьютере.</p>
      <p>Инструкции по установке и активации: <a href="${instructionsUrl}" style="color: #f59e0b;">${instructionsUrl}</a></p>
      <p>По любым вопросам пишите: <a href="https://vk.com/berezovskyoleg" style="color: #f59e0b;">vk.com/berezovskyoleg</a></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">EventSoft / soft@eventhunt.ru</p>
    </div>
  `;
  const text = `Спасибо за покупку!\n\nВаш лицензионный ключ для ${appName}:\n${key}\n\nКлюч привязан к вашему email и может быть активирован на одном компьютере.\nИнструкции: ${instructionsUrl}\n\nПо вопросам: https://vk.com/berezovskyoleg`;
  return { subject, html, text };
}

async function sendLicenseKey(email, appName, key, instructionsUrl) {
  const t = getTransporter();
  const { subject, html, text } = makeLicenseEmail(appName, key, instructionsUrl);
  const info = await t.sendMail({
    from: `"EventSoft" <${SMTP_FROM}>`,
    to: email,
    subject,
    text,
    html,
  });
  return info;
}

module.exports = { sendLicenseKey, getTransporter };
