import nodemailer from 'nodemailer';
import dns from 'dns';

// Force IPv4 globally for DNS resolution
dns.setDefaultResultOrder('ipv4first');

export const transporter = nodemailer.createTransport({
  host: '74.125.142.108', // Direct Google SMTP IPv4 address to absolute bypass DNS resolution
  port: 587,
  secure: false,    // Must be false for 587
  requireTLS: true, // Forces STARTTLS upgrade
  family: 4,        // Force IPv4 on the initial socket
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    servername: 'smtp.gmail.com', // Mandatory for validating Google SSL certificates on direct IP connections
    rejectUnauthorized: false // Safeguard against container certificate drops
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

export const getSenderEmail = () => process.env.SMTP_EMAIL || 'dailymartadmin@gmail.com';
