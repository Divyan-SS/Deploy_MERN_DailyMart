import nodemailer from 'nodemailer';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const emailUser = process.env.SMTP_EMAIL || 'your_gmail@gmail.com';
const emailPass = process.env.SMTP_PASSWORD || 'your_gmail_app_password';

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

export const getSenderEmail = () => emailUser;
