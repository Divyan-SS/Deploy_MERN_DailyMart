import nodemailer from 'nodemailer';
import dns from 'dns';

// Force Node.js DNS resolver to prioritize IPv4 (prevents IPv6 ENETUNREACH/ETIMEDOUT issues on Render)
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const emailUser = process.env.SMTP_EMAIL || 'your_gmail@gmail.com';
const emailPass = process.env.SMTP_PASSWORD || 'your_gmail_app_password';

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Must be false for port 587 (upgrades via STARTTLS)
  requireTLS: true, // Forces secure connection using STARTTLS
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  tls: {
    // Ensure connection is not blocked by local certificate issues
    rejectUnauthorized: false,
  },
  debug: true,
  logger: true,
});

export const getSenderEmail = () => emailUser;
