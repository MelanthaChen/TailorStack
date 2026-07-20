import { createSessionToken, hashPassword, verifyPassword } from "../../../../packages/auth/src/index.js";
import { ValidationError } from "../../../../packages/auth/src/errors.js";

export class AuthService {
  constructor({ authRepository, config, logger }) {
    this.authRepository = authRepository;
    this.config = config;
    this.logger = logger;
  }

  async signup({ email, password, displayName }, context) {
    validateEmail(email);
    validatePassword(password);

    const normalizedEmail = normalizeEmail(email);
    const existing = await this.authRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new ValidationError("An account already exists for this email", { email: "already_exists" });
    }

    const user = await this.authRepository.createUser({ email: normalizedEmail, displayName });
    const passwordHash = await hashPassword(password);
    await this.authRepository.createAuthIdentity({
      userId: user.id,
      provider: "email",
      providerSubject: normalizedEmail,
      passwordHash,
      email: normalizedEmail
    });

    const session = await this.createSession(user.id);
    this.logger.info("auth_signup_succeeded", { requestId: context.requestId, userId: user.id });
    return { user, session };
  }

  async login({ email, password }, context) {
    validateEmail(email);
    if (!password) {
      throw new ValidationError("Password is required", { password: "required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const identity = await this.authRepository.findAuthIdentity("email", normalizedEmail);
    if (!identity || !await verifyPassword(password, identity.passwordHash)) {
      const error = new Error("Invalid email or password");
      error.code = "invalid_credentials";
      error.statusCode = 401;
      throw error;
    }

    const user = await this.authRepository.findUserById(identity.userId);
    if (!user || user.status !== "active") {
      const error = new Error("Invalid email or password");
      error.code = "invalid_credentials";
      error.statusCode = 401;
      throw error;
    }

    const session = await this.createSession(user.id);
    this.logger.info("auth_login_succeeded", { requestId: context.requestId, userId: user.id });
    return { user, session };
  }

  async logout(context) {
    if (context.currentSession) {
      await this.authRepository.revokeSession(context.currentSession.id);
      this.logger.info("auth_logout_succeeded", {
        requestId: context.requestId,
        userId: context.currentSession.userId
      });
    }
  }

  async createSession(userId) {
    const { sessionId, token } = createSessionToken(this.config.sessionSecret);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlHours * 60 * 60 * 1000).toISOString();
    const record = await this.authRepository.createSession({ id: sessionId, userId, expiresAt });
    return { ...record, token };
  }
}

function validateEmail(email) {
  if (!String(email ?? "").includes("@")) {
    throw new ValidationError("A valid email is required", { email: "invalid" });
  }
}

function validatePassword(password) {
  if (String(password ?? "").length < 8) {
    throw new ValidationError("Password must be at least 8 characters", { password: "too_short" });
  }
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}
