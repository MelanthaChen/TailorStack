import crypto from "node:crypto";

export function createSessionToken(secret) {
  const sessionId = crypto.randomUUID();
  return {
    sessionId,
    token: signSessionId(sessionId, secret)
  };
}

export function signSessionId(sessionId, secret) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

export function verifySessionToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const [sessionId, signature] = token.split(".");
  if (!sessionId || !signature) return null;
  const expected = signSessionId(sessionId, secret);
  const expectedSignature = expected.split(".")[1];
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expectedSignature);
  if (actual.length !== wanted.length) return null;
  if (!crypto.timingSafeEqual(actual, wanted)) return null;
  return sessionId;
}
