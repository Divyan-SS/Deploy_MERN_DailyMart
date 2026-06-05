import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  family: 4, // Force connection over IPv4 to prevent ENETUNREACH on IPv6 routing
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const getSenderEmail = () => process.env.SMTP_EMAIL || 'dailymartadmin@gmail.com';
