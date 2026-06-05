import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const emailUser = process.env.SMTP_EMAIL || 'dailymartadmin@gmail.com';

// Configure Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Custom Nodemailer Transport that sends email via Gmail REST API
const gmailRestTransport = {
  name: 'gmail-rest',
  version: '1.0.0',
  send: async (mail, callback) => {
    try {
      const envelope = mail.data;
      const to = Array.isArray(envelope.to) ? envelope.to.join(', ') : envelope.to;
      const from = envelope.from || `"DailyMart" <${emailUser}>`;
      const subject = envelope.subject;
      const html = envelope.html;

      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
      ];

      if (envelope.replyTo) {
        const replyTo = Array.isArray(envelope.replyTo) ? envelope.replyTo.join(', ') : envelope.replyTo;
        messageParts.push(`Reply-To: ${replyTo}`);
      }

      messageParts.push('');
      messageParts.push(html);

      const message = messageParts.join('\r\n');

      // Base64url encode the message (compliant with Gmail send API requirements)
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      callback(null, {
        messageId: res.data.id,
        envelope: mail.envelope,
      });
    } catch (error) {
      console.error('[Gmail API Error] Failed to send email via Google REST API:', error);
      callback(error);
    }
  }
};

export const transporter = nodemailer.createTransport(gmailRestTransport);

// Implement verify method to check OAuth2 credentials status over HTTPS
transporter.verify = async (callback) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      throw new Error("Missing Google OAuth2 credentials in environment variables.");
    }
    // Check credentials by fetching an access token
    await oauth2Client.getAccessToken();
    console.log("🚀 Email server is ready to securely send messages via OAuth2!");
    if (callback) {
      if (typeof callback === 'function') {
        callback(null, true);
      }
    }
  } catch (error) {
    console.error("❌ Email configuration error:", error.message);
    if (callback) {
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }
};

// Auto-run verification on load
transporter.verify();

export const getSenderEmail = () => emailUser;
