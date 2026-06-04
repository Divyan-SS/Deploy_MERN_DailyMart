import nodemailer from 'nodemailer';

const emailUser = process.env.SMTP_EMAIL || 'your_gmail@gmail.com';
const emailPass = process.env.SMTP_PASSWORD || 'your_gmail_app_password';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  debug: true,
  logger: true,
});

export const getSenderEmail = () => emailUser;
