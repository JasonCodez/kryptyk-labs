const nodemailer = require("nodemailer");

// Transporter uses your Gmail, Outlook, or SMTP provider.
const transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER, // kryptyklabs@outlook.com
    pass: process.env.EMAIL_PASS  // the actual mailbox password
  }
});


// --- MAIN SEND FUNCTION ---
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Kryptyk Labs" <${process.env.MAIL_USER}>`,
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
  sendResetKeyEmail
};

