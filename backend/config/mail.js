import nodemailer from 'nodemailer';
import dns from 'dns';

// FORCE IPv4 BEFORE ANY CONNECTION
dns.setDefaultResultOrder('ipv4first');

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    family: 4,
  },
});

export const getSenderEmail = () => process.env.SMTP_EMAIL || 'dailymartadmin@gmail.com';
