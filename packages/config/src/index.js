const production = "production";

function readString(name, fallback, { required = false } = {}) {
  const raw = process.env[name];
  if ((raw === undefined || raw === "") && required) throw new Error(`${name} is required`);
  return raw === undefined || raw === "" ? fallback : raw;
}

function readInt(name, fallback, options = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`Invalid integer environment value for ${name}`);
  if (options.min !== undefined && value < options.min) throw new Error(`${name} must be >= ${options.min}`);
  if (options.max !== undefined && value > options.max) throw new Error(`${name} must be <= ${options.max}`);
  return value;
}

export function loadConfig() {
  const nodeEnv = readString("NODE_ENV", "development");
  const appEnv = readString("APP_ENV", "local");
  const config = {
    nodeEnv,
    appEnv,
    serviceName: readString("SERVICE_NAME", "tailorstack-api"),
    logLevel: readString("LOG_LEVEL", "info"),
    apiHost: readString("API_HOST", "127.0.0.1"),
    apiPort: readInt("API_PORT", 4000, { min: 1, max: 65535 }),
    webHost: readString("WEB_HOST", "127.0.0.1"),
    webPort: readInt("WEB_PORT", 3000, { min: 1, max: 65535 }),
    webOrigin: readString("WEB_ORIGIN", "http://127.0.0.1:3000"),
    sessionSecret: readString("SESSION_SECRET", "change-me-in-local-development"),
    sessionCookieName: readString("SESSION_COOKIE_NAME", "tailorstack_session"),
    sessionTtlHours: readInt("SESSION_TTL_HOURS", 168, { min: 1 }),
    authRepositoryDriver: readString("AUTH_REPOSITORY_DRIVER", "postgres"),
    maxRequestBytes: readInt("MAX_REQUEST_BYTES", 1024 * 1024, { min: 1024 }),
    maxUploadBytes: readInt("MAX_UPLOAD_BYTES", 5 * 1024 * 1024, { min: 1 }),
    rateLimitWindowMs: readInt("RATE_LIMIT_WINDOW_MS", 60_000, { min: 1000 }),
    rateLimitMaxRequests: readInt("RATE_LIMIT_MAX_REQUESTS", 120, { min: 1 }),
    databaseUrl: readString("DATABASE_URL", "postgres://tailorstack:tailorstack@127.0.0.1:5432/tailorstack"),
    databasePoolMax: readInt("DATABASE_POOL_MAX", 10, { min: 1 }),
    databaseIdleTimeoutMs: readInt("DATABASE_IDLE_TIMEOUT_MS", 30_000, { min: 1000 }),
    databaseConnectionTimeoutMs: readInt("DATABASE_CONNECTION_TIMEOUT_MS", 5000, { min: 100 }),
    databaseStatementTimeoutMs: readInt("DATABASE_STATEMENT_TIMEOUT_MS", 5000, { min: 100 }),
    databaseRetryCount: readInt("DATABASE_RETRY_COUNT", 1, { min: 0 }),
    queueUrl: readString("QUEUE_URL", "redis://127.0.0.1:6379"),
    objectStorageDriver: readString("OBJECT_STORAGE_DRIVER", "filesystem"),
    objectStorageBucket: readString("OBJECT_STORAGE_BUCKET", "tailorstack-local"),
    objectStorageLocalPath: readString("OBJECT_STORAGE_LOCAL_PATH", ".local/object-storage"),
    objectStorageEndpoint: readString("OBJECT_STORAGE_ENDPOINT", "http://127.0.0.1:9000"),
    objectStorageRegion: readString("OBJECT_STORAGE_REGION", "us-east-1"),
    objectStorageAccessKeyId: readString("OBJECT_STORAGE_ACCESS_KEY_ID", "tailorstack"),
    objectStorageSecretAccessKey: readString("OBJECT_STORAGE_SECRET_ACCESS_KEY", "tailorstack-dev")
  };
  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  if (!["debug", "info", "warn", "error"].includes(config.logLevel)) throw new Error("LOG_LEVEL is invalid");
  if (!["memory", "postgres"].includes(config.authRepositoryDriver)) throw new Error("AUTH_REPOSITORY_DRIVER is invalid");
  if (!["filesystem"].includes(config.objectStorageDriver)) throw new Error("OBJECT_STORAGE_DRIVER is invalid");
  validateUrl("WEB_ORIGIN", config.webOrigin);
  if (config.authRepositoryDriver === "postgres") validateUrl("DATABASE_URL", config.databaseUrl);
  if (config.appEnv === production || config.nodeEnv === production) validateProductionSecrets(config);
  return config;
}

function validateProductionSecrets(config) {
  if (config.sessionSecret === "change-me-in-local-development" || config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a strong value in production");
  }
  if (config.objectStorageSecretAccessKey === "tailorstack-dev") {
    throw new Error("OBJECT_STORAGE_SECRET_ACCESS_KEY must be set in production");
  }
}

function validateUrl(name, value) {
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}
