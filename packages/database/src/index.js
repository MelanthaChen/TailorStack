import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

const pools = new Map();

export function requireDatabaseUrl(config) {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return config.databaseUrl;
}

export function getDatabasePool(config) {
  const databaseUrl = requireDatabaseUrl(config);
  const key = `${databaseUrl}:${config.databasePoolMax ?? 10}:${config.databaseStatementTimeoutMs ?? 5000}`;
  if (!pools.has(key)) {
    pools.set(key, new PostgresPool({
      databaseUrl,
      max: config.databasePoolMax ?? 10,
      idleTimeoutMs: config.databaseIdleTimeoutMs ?? 30000,
      connectionTimeoutMs: config.databaseConnectionTimeoutMs ?? 5000,
      statementTimeoutMs: config.databaseStatementTimeoutMs ?? 5000,
      retryCount: config.databaseRetryCount ?? 1
    }));
  }
  return pools.get(key);
}

export async function closeDatabasePools() {
  await Promise.all([...pools.values()].map((pool) => pool.close()));
  pools.clear();
}

export class PostgresPool {
  constructor({ databaseUrl, max = 10, idleTimeoutMs = 30000, connectionTimeoutMs = 5000, statementTimeoutMs = 5000, retryCount = 1 }) {
    this.options = { databaseUrl, max, idleTimeoutMs, connectionTimeoutMs, statementTimeoutMs, retryCount };
    this.idle = [];
    this.active = new Set();
    this.waiters = [];
    this.closed = false;
  }

  async query(text, params = [], options = {}) {
    return this.withRetry(async () => {
      const client = await this.connect();
      try {
        return await client.query(text, params, { timeoutMs: options.timeoutMs ?? this.options.statementTimeoutMs });
      } finally {
        this.release(client);
      }
    });
  }

  async transaction(callback) {
    const client = await this.connect();
    try {
      await client.query("BEGIN", []);
      const result = await callback(client);
      await client.query("COMMIT", []);
      return result;
    } catch (error) {
      await client.query("ROLLBACK", []).catch(() => {});
      throw error;
    } finally {
      this.release(client);
    }
  }

  async healthCheck() {
    const result = await this.query("SELECT 1 AS ok", [], { timeoutMs: Math.min(this.options.statementTimeoutMs, 1000) });
    return result.rows[0]?.ok === 1;
  }

  async close() {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter.reject(new Error("Database pool is closing"));
    await Promise.all([...this.idle, ...this.active].map((client) => client.close()));
    this.idle = [];
    this.active.clear();
  }

  async withRetry(operation) {
    let lastError;
    for (let attempt = 0; attempt <= this.options.retryCount; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.options.retryCount) break;
      }
    }
    throw lastError;
  }

  async connect() {
    if (this.closed) throw new Error("Database pool is closed");
    const client = this.idle.pop();
    if (client) {
      this.active.add(client);
      return client;
    }
    if (this.active.size < this.options.max) {
      const created = new PostgresClient(this.options);
      await created.connect();
      this.active.add(created);
      return created;
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  release(client) {
    this.active.delete(client);
    const waiter = this.waiters.shift();
    if (waiter) {
      this.active.add(client);
      waiter.resolve(client);
      return;
    }
    if (this.closed) {
      client.close();
      return;
    }
    client.idleTimer = setTimeout(() => {
      this.idle = this.idle.filter((item) => item !== client);
      client.close();
    }, this.options.idleTimeoutMs);
    this.idle.push(client);
  }
}

export class PostgresClient {
  constructor({ databaseUrl, connectionTimeoutMs }) {
    this.config = parseDatabaseUrl(databaseUrl);
    this.connectionTimeoutMs = connectionTimeoutMs;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.backendKey = null;
    this.idleTimer = null;
  }

  async connect() {
    clearTimeout(this.idleTimer);
    this.socket = this.config.ssl
      ? tls.connect({ host: this.config.host, port: this.config.port, servername: this.config.host })
      : net.connect({ host: this.config.host, port: this.config.port });
    this.socket.setNoDelay(true);
    await waitForConnect(this.socket, this.connectionTimeoutMs);
    this.socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
    });
    await this.startup();
  }

  async query(text, params = [], { timeoutMs = 5000 } = {}) {
    clearTimeout(this.idleTimer);
    const metadata = queryMetadata(text, params);
    try {
      if (params.length) {
        this.socket.write(Buffer.concat([
          message("P", Buffer.concat([cstring(""), cstring(text), int16(0)])),
          message("B", bindBody(params)),
          message("D", Buffer.concat([Buffer.from("P"), cstring("")])),
          message("E", Buffer.concat([cstring(""), int32(0)])),
          message("S", Buffer.alloc(0))
        ]));
      } else {
        this.socket.write(message("Q", Buffer.from(`${text}\0`, "utf8")));
      }
      const rows = [];
      let fields = [];
      return await withTimeout(new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            for (;;) {
              const packet = this.readPacket();
              if (!packet) break;
              const type = String.fromCharCode(packet.type);
              if (type === "T") fields = parseRowDescription(packet.body);
              else if (type === "D") rows.push(parseDataRow(packet.body, fields));
              else if (type === "E") {
                reject(attachQueryMetadata(parseError(packet.body), metadata));
                return;
              } else if (type === "Z") {
                resolve({ rows, rowCount: rows.length, fields });
                return;
              }
            }
            setImmediate(poll);
          } catch (error) {
            reject(attachQueryMetadata(error, metadata));
          }
        };
        poll();
      }), timeoutMs, "Database query timed out");
    } catch (error) {
      throw attachQueryMetadata(error, metadata);
    }
  }

  async startup() {
    const params = [
      "user", this.config.user,
      "database", this.config.database,
      "client_encoding", "UTF8"
    ];
    const payload = Buffer.concat([
      int32(196608),
      ...params.map((value) => Buffer.from(`${value}\0`, "utf8")),
      Buffer.from([0])
    ]);
    this.socket.write(Buffer.concat([int32(payload.length + 4), payload]));
    await new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          for (;;) {
            const packet = this.readPacket();
            if (!packet) break;
            const type = String.fromCharCode(packet.type);
            if (type === "R") {
              const authType = packet.body.readInt32BE(0);
              if (authType === 0) continue;
              if (authType === 3) this.socket.write(message("p", Buffer.from(`${this.config.password}\0`, "utf8")));
              else if (authType === 10) await this.authenticateScram(packet.body.subarray(4));
              else reject(new Error(`Unsupported PostgreSQL authentication method ${authType}`));
            } else if (type === "K") {
              this.backendKey = packet.body;
            } else if (type === "E") {
              reject(parseError(packet.body));
            } else if (type === "Z") {
              resolve();
              return;
            }
          }
          setImmediate(poll);
        } catch (error) {
          reject(error);
        }
      };
      poll();
    });
  }

  async authenticateScram(body) {
    const mechanisms = body.toString("utf8").split("\0").filter(Boolean);
    if (!mechanisms.includes("SCRAM-SHA-256")) throw new Error(`Unsupported PostgreSQL SASL mechanisms: ${mechanisms.join(", ")}`);
    const nonce = crypto.randomBytes(18).toString("base64");
    const clientFirstBare = `n=${saslName(this.config.user)},r=${nonce}`;
    const clientFirstMessage = `n,,${clientFirstBare}`;
    this.socket.write(message("p", Buffer.concat([
      cstring("SCRAM-SHA-256"),
      int32(Buffer.byteLength(clientFirstMessage)),
      Buffer.from(clientFirstMessage, "utf8")
    ])));
    const serverFirst = await this.readExpectedPacket("R");
    const serverFirstType = serverFirst.body.readInt32BE(0);
    if (serverFirstType !== 11) throw new Error(`Unexpected SASL continuation type ${serverFirstType}`);
    const serverFirstMessage = serverFirst.body.subarray(4).toString("utf8");
    const attrs = parseScramAttributes(serverFirstMessage);
    if (!attrs.r?.startsWith(nonce)) throw new Error("Invalid SCRAM server nonce");
    const salt = Buffer.from(attrs.s, "base64");
    const iterations = Number(attrs.i);
    const clientFinalWithoutProof = `c=${Buffer.from("n,,").toString("base64")},r=${attrs.r}`;
    const saltedPassword = crypto.pbkdf2Sync(this.config.password, salt, iterations, 32, "sha256");
    const clientKey = crypto.createHmac("sha256", saltedPassword).update("Client Key").digest();
    const storedKey = crypto.createHash("sha256").update(clientKey).digest();
    const authMessage = `${clientFirstBare},${serverFirstMessage},${clientFinalWithoutProof}`;
    const clientSignature = crypto.createHmac("sha256", storedKey).update(authMessage).digest();
    const proof = xorBuffers(clientKey, clientSignature).toString("base64");
    const serverKey = crypto.createHmac("sha256", saltedPassword).update("Server Key").digest();
    const expectedServerSignature = crypto.createHmac("sha256", serverKey).update(authMessage).digest("base64");
    this.socket.write(message("p", Buffer.from(`${clientFinalWithoutProof},p=${proof}`, "utf8")));
    const serverFinal = await this.readExpectedPacket("R");
    const serverFinalType = serverFinal.body.readInt32BE(0);
    if (serverFinalType !== 12) throw new Error(`Unexpected SASL final type ${serverFinalType}`);
    const serverFinalAttrs = parseScramAttributes(serverFinal.body.subarray(4).toString("utf8"));
    if (serverFinalAttrs.v !== expectedServerSignature) throw new Error("Invalid SCRAM server signature");
  }

  async close() {
    if (!this.socket) return;
    this.socket.write(message("X", Buffer.alloc(0)));
    this.socket.destroySoon?.();
    this.socket.destroy();
    this.socket = null;
  }

  readPacket() {
    if (this.buffer.length < 5) return null;
    const type = this.buffer[0];
    const length = this.buffer.readInt32BE(1);
    if (this.buffer.length < length + 1) return null;
    const body = this.buffer.subarray(5, length + 1);
    this.buffer = this.buffer.subarray(length + 1);
    return { type, body };
  }

  readExpectedPacket(expectedType) {
    return new Promise((resolve, reject) => {
      const poll = () => {
        try {
          const packet = this.readPacket();
          if (!packet) {
            setImmediate(poll);
            return;
          }
          const type = String.fromCharCode(packet.type);
          if (type === "E") reject(parseError(packet.body));
          else if (type !== expectedType) reject(new Error(`Unexpected PostgreSQL packet ${type}`));
          else resolve(packet);
        } catch (error) {
          reject(error);
        }
      };
      poll();
    });
  }
}

function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: url.searchParams.get("sslmode") === "require"
  };
}

function waitForConnect(socket, timeoutMs) {
  return withTimeout(new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  }), timeoutMs, "Database connection timed out");
}

function message(type, body) {
  return Buffer.concat([Buffer.from(type), int32(body.length + 4), body]);
}

function int32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value, 0);
  return buffer;
}

function int16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeInt16BE(value, 0);
  return buffer;
}

function cstring(value) {
  return Buffer.from(`${value}\0`, "utf8");
}

function bindBody(params) {
  const values = [];
  for (const value of params) {
    if (value === null || value === undefined) {
      values.push(int32(-1));
    } else {
      const encoded = Buffer.from(encodeTextParameter(value), "utf8");
      values.push(int32(encoded.length), encoded);
    }
  }
  return Buffer.concat([
    cstring(""),
    cstring(""),
    int16(0),
    int16(params.length),
    ...values,
    int16(0)
  ]);
}

export function encodeTextParameter(value) {
  if (Buffer.isBuffer(value)) return `\\x${value.toString("hex")}`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(sanitizeSqlValue(value));
  return sanitizeSqlString(String(value));
}

export function queryMetadata(text, params = []) {
  return {
    sqlText: text,
    parameterCount: params.length,
    parameterTypes: params.map((value) => describeParameter(value))
  };
}

export function describeParameter(value) {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "undefined" };
  if (Buffer.isBuffer(value)) return { type: "buffer", byteLength: value.byteLength };
  if (value instanceof Date) return { type: "date" };
  if (Array.isArray(value)) return { type: "array", length: value.length };
  return { type: typeof value };
}

function attachQueryMetadata(error, metadata) {
  if (!error.sqlText) error.sqlText = metadata.sqlText;
  if (error.parameterCount === undefined) error.parameterCount = metadata.parameterCount;
  if (!error.parameterTypes) error.parameterTypes = metadata.parameterTypes;
  return error;
}

function parseScramAttributes(messageText) {
  return Object.fromEntries(messageText.split(",").map((part) => [part[0], part.slice(2)]));
}

function saslName(value) {
  return value.replaceAll("=", "=3D").replaceAll(",", "=2C");
}

function xorBuffers(left, right) {
  return Buffer.from(left.map((value, index) => value ^ right[index]));
}

function parseRowDescription(body) {
  const count = body.readInt16BE(0);
  let offset = 2;
  const fields = [];
  for (let i = 0; i < count; i += 1) {
    const end = body.indexOf(0, offset);
    const name = body.subarray(offset, end).toString("utf8");
    offset = end + 19;
    fields.push(name);
  }
  return fields;
}

function parseDataRow(body, fields) {
  const count = body.readInt16BE(0);
  let offset = 2;
  const row = {};
  for (let i = 0; i < count; i += 1) {
    const length = body.readInt32BE(offset);
    offset += 4;
    if (length === -1) {
      row[fields[i]] = null;
    } else {
      const raw = body.subarray(offset, offset + length).toString("utf8");
      row[fields[i]] = parseValue(raw);
      offset += length;
    }
  }
  return row;
}

function parseValue(raw) {
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function parseError(body) {
  const fields = {};
  let offset = 0;
  while (offset < body.length && body[offset] !== 0) {
    const code = String.fromCharCode(body[offset]);
    const end = body.indexOf(0, offset + 1);
    fields[code] = body.subarray(offset + 1, end).toString("utf8");
    offset = end + 1;
  }
  const error = new Error(fields.M ?? "PostgreSQL error");
  error.code = fields.C;
  return error;
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return `'${JSON.stringify(sanitizeSqlValue(value)).replaceAll("'", "''")}'`;
  return `'${sanitizeSqlString(String(value)).replaceAll("'", "''")}'`;
}

export function sanitizeSqlValue(value) {
  if (typeof value === "string") return sanitizeSqlString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeSqlValue(item));
  if (value && typeof value === "object") {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeSqlValue(item)]));
  }
  return value;
}

function sanitizeSqlString(value) {
  return value.replaceAll("\0", "");
}

function withTimeout(promise, timeoutMs, messageText) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(messageText)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function isRetryable(error) {
  return ["ECONNRESET", "EPIPE", "ETIMEDOUT", "57P01", "57P02", "08006"].includes(error.code);
}
