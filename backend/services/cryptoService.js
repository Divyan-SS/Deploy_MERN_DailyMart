import crypto from 'crypto';

export const generateLinkSignature = (orderId, action, extraParams = {}) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_key';
  const sortedKeys = Object.keys(extraParams).filter(k => extraParams[k] !== undefined).sort();
  const extraString = sortedKeys.map(key => `${key}=${extraParams[key]}`).join('&');
  const message = `${orderId}:${action}:${extraString}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
};

export const verifyLinkSignature = (orderId, action, querySignature, extraParams = {}) => {
  if (!querySignature) return false;
  const calculated = generateLinkSignature(orderId, action, extraParams);
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(querySignature, 'hex'));
  } catch (e) {
    return false;
  }
};
