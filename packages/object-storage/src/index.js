import crypto from "node:crypto";
import { mkdir, readFile, rm, stat as fsStat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export class FileSystemObjectStorage {
  constructor({ rootPath, bucket }) {
    this.rootPath = rootPath;
    this.bucket = bucket;
  }

  async putObject(key, body, metadata = {}) {
    const path = this.#path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, bucket: this.bucket, metadata };
  }

  async getObject(key) {
    return readFile(this.#path(key));
  }

  async deleteObject(key) {
    await rm(this.#path(key), { force: true });
  }

  async exists(key) {
    try {
      await fsStat(this.#path(key));
      return true;
    } catch {
      return false;
    }
  }

  async stat(key) {
    const result = await fsStat(this.#path(key));
    return {
      key,
      bucket: this.bucket,
      byteSize: result.size,
      updatedAt: result.mtime.toISOString()
    };
  }

  async createSignedUrl(key) {
    return `file://${this.#path(key)}`;
  }

  #path(key) {
    return join(this.rootPath, this.bucket, key);
  }
}

export class MinioObjectStorage {
  constructor({ endpoint, region, bucket, accessKeyId, secretAccessKey }) {
    this.endpoint = endpoint.replace(/\/$/, "");
    this.region = region;
    this.bucket = bucket;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async putObject(key, body, metadata = {}) {
    const response = await this.#signedFetch("PUT", key, {
      body,
      headers: {
        "content-type": metadata.contentType ?? "application/octet-stream"
      }
    });
    await assertStorageResponse(response);
    return { key, bucket: this.bucket, metadata };
  }

  async getObject(key) {
    const response = await this.#signedFetch("GET", key);
    await assertStorageResponse(response);
    return Buffer.from(await response.arrayBuffer());
  }

  async deleteObject(key) {
    const response = await this.#signedFetch("DELETE", key);
    await assertStorageResponse(response);
  }

  async exists(key) {
    const response = await this.#signedFetch("HEAD", key);
    if (response.status === 404) return false;
    await assertStorageResponse(response);
    return true;
  }

  async stat(key) {
    const response = await this.#signedFetch("HEAD", key);
    await assertStorageResponse(response);
    return {
      key,
      bucket: this.bucket,
      byteSize: Number(response.headers.get("content-length") ?? 0),
      updatedAt: response.headers.get("last-modified")
    };
  }

  async createSignedUrl(key, { expiresSeconds = 300 } = {}) {
    const request = this.#createSignedRequest("GET", key, {
      query: {
        "X-Amz-Expires": String(expiresSeconds)
      },
      unsignedPayload: true
    });
    return request.url;
  }

  async #signedFetch(method, key, options = {}) {
    const request = this.#createSignedRequest(method, key, {
      headers: options.headers,
      body: options.body
    });
    return fetch(request.url, {
      method,
      headers: request.headers,
      body: options.body
    });
  }

  #createSignedRequest(method, key, options = {}) {
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const url = new URL(`${this.endpoint}/${this.bucket}/${encodedKey}`);
    const query = new URLSearchParams(options.query ?? {});
    query.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    query.set("X-Amz-Credential", `${this.accessKeyId}/${credentialScope}`);
    query.set("X-Amz-Date", amzDate);
    query.set("X-Amz-Expires", query.get("X-Amz-Expires") ?? "300");
    query.set("X-Amz-SignedHeaders", "host");
    url.search = query.toString();

    const payloadHash = "UNSIGNED-PAYLOAD";
    const canonicalRequest = [
      method,
      `/${this.bucket}/${encodedKey}`,
      canonicalQuery(url.searchParams),
      `host:${url.host}\n`,
      "host",
      payloadHash
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join("\n");
    const signingKey = getSignatureKey(this.secretAccessKey, dateStamp, this.region, "s3");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    url.searchParams.set("X-Amz-Signature", signature);
    return {
      url: url.toString(),
      headers: options.headers ?? {}
    };
  }
}

export function createObjectStorage(config) {
  if (config.objectStorageDriver === "minio") {
    return new MinioObjectStorage({
      endpoint: config.objectStorageEndpoint,
      region: config.objectStorageRegion,
      bucket: config.objectStorageBucket,
      accessKeyId: config.objectStorageAccessKeyId,
      secretAccessKey: config.objectStorageSecretAccessKey
    });
  }
  return new FileSystemObjectStorage({
    rootPath: config.objectStorageLocalPath,
    bucket: config.objectStorageBucket
  });
}

async function assertStorageResponse(response) {
  if (response.ok) return;
  throw new Error(`Object storage request failed with status ${response.status}`);
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function getSignatureKey(secret, dateStamp, region, service) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}
