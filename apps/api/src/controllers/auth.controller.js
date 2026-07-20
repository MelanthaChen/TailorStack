import { publicUser } from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { serializeCookie } from "../http/cookies.js";
import { requireAuth } from "../middleware/auth.js";

export class AuthController {
  constructor({ authService, config }) {
    this.authService = authService;
    this.config = config;
  }

  async signup(context) {
    const body = await readJson(context.req);
    const { user, session } = await this.authService.signup(body, context);
    setSessionCookie(context.res, this.config, session.token);
    sendSuccess(context.res, 201, { user: publicUser(user) }, context.requestId);
  }

  async login(context) {
    const body = await readJson(context.req);
    const { user, session } = await this.authService.login(body, context);
    setSessionCookie(context.res, this.config, session.token);
    sendSuccess(context.res, 200, { user: publicUser(user) }, context.requestId);
  }

  async logout(context) {
    await this.authService.logout(context);
    clearSessionCookie(context.res, this.config);
    sendSuccess(context.res, 200, { ok: true }, context.requestId);
  }

  async currentUser(context) {
    const user = requireAuth(context);
    sendSuccess(context.res, 200, { user: publicUser(user) }, context.requestId);
  }

  async protectedStatus(context) {
    const user = requireAuth(context);
    sendSuccess(context.res, 200, { userId: user.id, protected: true }, context.requestId);
  }
}

function setSessionCookie(res, config, token) {
  res.setHeader("set-cookie", serializeCookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.nodeEnv === "production",
    maxAge: config.sessionTtlHours * 60 * 60
  }));
}

function clearSessionCookie(res, config) {
  res.setHeader("set-cookie", serializeCookie(config.sessionCookieName, "", {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.nodeEnv === "production",
    maxAge: 0
  }));
}
