import nodemailer from 'nodemailer';
import dns from 'dns';

// Force IPv4 globally for DNS resolution
dns.setDefaultResultOrder('ipv4first');

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,    // Must be false for 587
  requireTLS: true, // Forces STARTTLS upgrade
  family: 4,        // <-- CRITICAL: Move this to the root level to force IPv4 on the initial socket
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // Safeguard against container certificate drops
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

export const getSenderEmail = () => process.env.SMTP_EMAIL || 'dailymartadmin@gmail.com';
