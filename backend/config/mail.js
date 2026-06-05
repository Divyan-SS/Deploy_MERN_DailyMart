import { google } from 'googleapis';

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

export const getSenderEmail = () => emailUser;

export const transporter = {
  sendMail: async (mailOptions) => {
    const to = Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to;
    const from = mailOptions.from || `"DailyMart" <${emailUser}>`;
    const subject = mailOptions.subject;
    const html = mailOptions.html;

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ];

    if (mailOptions.replyTo) {
      const replyTo = Array.isArray(mailOptions.replyTo) ? mailOptions.replyTo.join(', ') : mailOptions.replyTo;
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

    try {
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      return res.data;
    } catch (error) {
      console.error('[Gmail API Error] Failed to send email via Google REST API:', error);
      throw error;
    }
  }
};
