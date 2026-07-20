import { createApp } from "../../apps/api/src/app.js";
import { InMemoryAuthRepository } from "../../apps/api/src/repositories/auth.repository.js";
import { InMemoryUploadedFileRepository } from "../../apps/api/src/repositories/uploaded-file.repository.js";
import { InMemoryResumeRepository } from "../../apps/api/src/repositories/resume.repository.js";
import { InMemoryAsyncJobRepository } from "../../apps/api/src/repositories/async-job.repository.js";
import { InMemoryResumeParserRepository } from "../../apps/api/src/repositories/resume-parser.repository.js";
import { InMemoryPromotionRepository } from "../../apps/api/src/repositories/promotion.repository.js";
import { InMemoryAuditRepository } from "../../apps/api/src/repositories/audit.repository.js";
import { InMemoryResumeEditorRepository } from "../../apps/api/src/repositories/resume-editor.repository.js";
import { InMemoryJobDescriptionRepository } from "../../apps/api/src/repositories/job-description.repository.js";
import { InMemoryJobKeywordRepository } from "../../apps/api/src/repositories/job-keyword.repository.js";
import { InMemoryJobRequirementRepository } from "../../apps/api/src/repositories/job-requirement.repository.js";
import { InMemoryMatchRepository } from "../../apps/api/src/repositories/match.repository.js";
import { InMemoryReadinessRepository } from "../../apps/api/src/repositories/readiness.repository.js";
import { InMemoryPatchRepository } from "../../apps/api/src/repositories/patch.repository.js";
import { InMemoryVersioningRepository } from "../../apps/api/src/repositories/versioning.repository.js";
import { InMemoryApplicationRepository } from "../../apps/api/src/repositories/application.repository.js";
import { RepositoryBackedQueue } from "../../packages/queue/src/index.js";
import { FileSystemObjectStorage } from "../../packages/object-storage/src/index.js";

export function createTestApi(options = {}) {
  const authRepository = new InMemoryAuthRepository();
  const asyncJobs = new InMemoryAsyncJobRepository();
  const resumes = new InMemoryResumeRepository();
  const resumeParser = new InMemoryResumeParserRepository();
  const promotion = new InMemoryPromotionRepository({ resumeRepository: resumes });
  const repositories = {
    auth: authRepository,
    uploadedFiles: new InMemoryUploadedFileRepository(),
    resumes,
    asyncJobs,
    resumeParser,
    promotion,
    audit: new InMemoryAuditRepository({ promotionRepository: promotion }),
    resumeEditor: new InMemoryResumeEditorRepository({ resumeParserRepository: resumeParser }),
    jobDescriptions: new InMemoryJobDescriptionRepository(),
    jobRequirements: new InMemoryJobRequirementRepository(),
    jobKeywords: new InMemoryJobKeywordRepository(),
    matches: new InMemoryMatchRepository(),
    readiness: new InMemoryReadinessRepository(),
    patches: new InMemoryPatchRepository(),
    versioning: new InMemoryVersioningRepository({ promotionRepository: promotion }),
    applications: new InMemoryApplicationRepository()
  };
  const app = createApp({
    config: {
      nodeEnv: "test",
      appEnv: "test",
      logLevel: "error",
      webOrigin: "http://127.0.0.1:3000",
      sessionSecret: "test-secret",
      sessionCookieName: "tailorstack_session",
      sessionTtlHours: 168,
      authRepositoryDriver: "memory",
      maxUploadBytes: options.maxUploadBytes ?? 1024 * 1024,
      objectStorageDriver: "filesystem",
      objectStorageBucket: "test-bucket",
      objectStorageLocalPath: options.objectStorageLocalPath ?? ".local/test-object-storage"
    },
    logger: {
      info() {},
      error() {}
    },
    repositories,
    queue: new RepositoryBackedQueue({ jobRepository: asyncJobs }),
    objectStorage: options.objectStorage ?? new FileSystemObjectStorage({
      rootPath: options.objectStorageLocalPath ?? ".local/test-object-storage",
      bucket: "test-bucket"
    }),
    ...(options.aiResumeParserService ? { aiResumeParserService: options.aiResumeParserService } : {})
  });
  return { app, repositories };
}

export async function callApi(app, { method = "GET", url, body, cookie, headers = {} } = {}) {
  const response = createMockResponse();
  await app(createMockRequest({ method, url, body, cookie, headers }), response);
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body ? JSON.parse(response.body) : null,
    rawBody: response.body
  };
}

export async function callMultipartApi(app, { url, fields = {}, file, cookie } = {}) {
  const boundary = `----tailorstack-test-${crypto.randomUUID()}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(file.buffer);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const buffer = Buffer.concat(chunks);
  const response = createMockResponse();
  await app(createMockRequest({
    method: "POST",
    url,
    rawBody: buffer,
    cookie,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    }
  }), response);
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body ? JSON.parse(response.body) : null,
    rawBody: response.body
  };
}

export function getSetCookie(response) {
  return response.headers["set-cookie"];
}

function createMockRequest({ method, url, body, rawBody, cookie, headers = {} }) {
  const raw = rawBody ?? (body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body)));
  return {
    method,
    url,
    headers: {
      ...(cookie ? { cookie } : {}),
      "content-type": "application/json",
      ...headers
    },
    async *[Symbol.asyncIterator]() {
      if (raw.length) yield raw;
    }
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    }
  };
}
