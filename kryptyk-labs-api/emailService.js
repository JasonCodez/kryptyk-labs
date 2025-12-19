const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  // Transporter uses your SMTP provider (Outlook by default).
  // You can override with EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE.
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp-mail.outlook.com",
    port: Number(process.env.EMAIL_PORT || 587),
    secure: String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}


// --- MAIN SEND FUNCTION ---
async function sendEmail(to, subject, html) {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email not configured: set EMAIL_USER and EMAIL_PASS (and optionally EMAIL_HOST/EMAIL_PORT)."
    );
  }

  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Kryptyk Labs" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log(`[EMAIL] sent to ${to}`);
  } catch (err) {
    console.error("Email send error:", err);
    throw err;
  }
}

// --- ACCESS KEY EMAIL ---
async function sendAccessKeyEmail(email, key) {
  const html = `
    <div style="font-family: monospace; padding: 20px;">
      <h2>Kryptyk Labs // Access Key</h2>
      <p>Your verification key is:</p>
      <div style="
          font-size: 28px;
          letter-spacing: 4px;
          font-weight: bold;
          margin: 20px 0;
      ">${key}</div>
      <p>This key expires in 15 minutes.</p>
    </div>
  `;

  await sendEmail(email, "Kryptyk Labs Access Key", html);
}

// --- RESET KEY EMAIL ---
async function sendResetKeyEmail(email, key) {
  const html = `
    <div style="font-family: monospace; padding: 20px;">
      <h2>Kryptyk Labs // Reset Protocol</h2>
      <p>Your clearance reset key is:</p>
      <div style="
          font-size: 28px;
          letter-spacing: 4px;
          font-weight: bold;
          margin: 20px 0;
      ">${key}</div>
      <p>This key expires in 15 minutes.</p>
    </div>
  `;

  await sendEmail(email, "Kryptyk Labs Reset Key", html);
}

module.exports = {
  sendAccessKeyEmail,
  sendResetKeyEmail,
  isEmailConfigured
};

