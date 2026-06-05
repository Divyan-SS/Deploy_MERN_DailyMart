import nodemailer from 'nodemailer';
import dns from 'dns';

// FORCE IPv4 BEFORE ANY CONNECTION
dns.setDefaultResultOrder('ipv4first');

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Must be false for port 587 (upgrades via STARTTLS)
  requireTLS: true, // Forces secure connection using STARTTLS
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    family: 4, // Force connection over IPv4
  },
  connectionTimeout: 10000, // Extended connection timeout to 10000ms
  greetingTimeout: 10000,   // Extended greeting timeout to 10000ms
  socketTimeout: 10000,     // Extended socket timeout to 10000ms
});

export const getSenderEmail = () => process.env.SMTP_EMAIL || 'dailymartadmin@gmail.com';
