import { verifySessionToken } from "../../../../packages/auth/src/index.js";
import { parseCookies } from "../http/cookies.js";

export async function attachCurrentUser(context) {
  const cookies = parseCookies(context.req.headers.cookie);
  const token = cookies[context.config.sessionCookieName];
  const sessionId = verifySessionToken(token, context.config.sessionSecret);
  if (!sessionId) return context;

  const session = await context.repositories.auth.findSessionById(sessionId);
  if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
    return context;
  }

  const user = await context.repositories.auth.findUserById(session.userId);
  if (!user || user.status !== "active") return context;

  context.currentSession = session;
  context.currentUser = user;
  return context;
}

export function requireAuth(context) {
  if (!context.currentUser) {
    const error = new Error("Authentication is required");
    error.code = "unauthenticated";
    error.statusCode = 401;
    throw error;
  }
  return context.currentUser;
}

export function requireOwnership(context, resource) {
  const user = requireAuth(context);
  if (!resource || resource.userId !== user.id) {
    const error = new Error("You do not have access to this resource");
    error.code = "unauthorized";
    error.statusCode = 403;
    throw error;
  }
  return true;
}
