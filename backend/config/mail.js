import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const emailUser = process.env.SMTP_EMAIL || 'onboarding@resend.dev';
const apiKey = process.env.RESEND_API_KEY;

export const getSenderEmail = () => emailUser;

export const transporter = {
  sendMail: async (mailOptions) => {
    const fromStr = mailOptions.from || `"DailyMart" <${emailUser}>`;
    // Clean up display name quotes for Resend API compatibility (Resend does not permit double quotes in the display name)
    const cleanFrom = fromStr.replace(/"/g, '');

    const to = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
    const subject = mailOptions.subject;
    const html = mailOptions.html;

    let reply_to;
    if (mailOptions.replyTo) {
      reply_to = Array.isArray(mailOptions.replyTo) ? mailOptions.replyTo : [mailOptions.replyTo];
    }

    if (!apiKey) {
      console.warn('⚠️ [Resend Alert]: RESEND_API_KEY is not defined in environment variables. Falling back to console logging.');
      console.log(`\n📬 [Mock Email Send]:\nFrom: ${cleanFrom}\nTo: ${to.join(', ')}\nSubject: ${subject}\nHTML Length: ${html?.length || 0} characters\n`);
      return { mock: true, messageId: 'mock-id-' + Date.now() };
    }

    const payload = {
      from: cleanFrom,
      to,
      subject,
      html,
    };

    if (reply_to) {
      payload.reply_to = reply_to;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Resend API Error: ${res.status} ${res.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('[Resend SDK Error] Failed to send email via Resend API:', error);
      throw error;
    }
  }
};
