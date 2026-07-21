export class InMemoryQueue {
  #jobs = new Map();

  async submitJob(job) {
    const now = new Date().toISOString();
    const record = {
      id: job.id ?? crypto.randomUUID(),
      userId: job.userId ?? null,
      jobType: job.jobType ?? job.type,
      status: "queued",
      stage: job.stage ?? "queued",
      progress: job.progress ?? 0,
      message: job.message ?? "Queued.",
      priority: job.priority ?? 100,
      payloadRef: job.payloadRef ?? job.payload ?? {},
      resultRef: null,
      errorCode: null,
      errorMessage: null,
      attemptCount: 0,
      maxAttempts: job.maxAttempts ?? 3,
      availableAt: job.availableAt ?? now,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.#jobs.set(record.id, record);
    return record;
  }

  async getJob(id) {
    return this.#jobs.get(id) ?? null;
  }

  async getJobByResume(resumeId, userId) {
    return [...this.#jobs.values()].find((job) =>
      job.userId === userId &&
      job.jobType === "resume_parse" &&
      job.payloadRef?.resumeId === resumeId
    ) ?? null;
  }

  async cancelJob(id) {
    const job = await this.getJob(id);
    if (!job) return null;
    const updated = { ...job, status: "canceled", updatedAt: new Date().toISOString() };
    this.#jobs.set(id, updated);
    return updated;
  }

  async markRunning(id) {
    const job = await this.getJob(id);
    if (!job) return null;
    const now = new Date().toISOString();
    const updated = { ...job, status: "running", stage: "reading_pdf", progress: 10, message: "Reading uploaded PDF...", startedAt: now, updatedAt: now };
    this.#jobs.set(id, updated);
    return updated;
  }

  async updateJobProgress(id, { status, stage, progress, message }) {
    const job = await this.getJob(id);
    if (!job) return null;
    const nextStatus = status ?? job.status;
    const now = new Date().toISOString();
    const updated = {
      ...job,
      status: nextStatus,
      stage: stage ?? job.stage,
      progress: progress ?? job.progress,
      message: message ?? job.message,
      startedAt: nextStatus === "running" && !job.startedAt ? now : job.startedAt,
      completedAt: ["succeeded", "failed", "canceled"].includes(nextStatus) ? now : job.completedAt,
      updatedAt: now
    };
    this.#jobs.set(id, updated);
    return updated;
  }

  async completeJob(id, { resultRef } = {}) {
    const job = await this.getJob(id);
    if (!job) return null;
    const now = new Date().toISOString();
    const updated = { ...job, status: "succeeded", stage: "completed", progress: 100, message: "Parse completed.", resultRef: resultRef ?? {}, completedAt: now, updatedAt: now };
    this.#jobs.set(id, updated);
    return updated;
  }

  async failJob(id, { errorCode, errorMessage } = {}) {
    const job = await this.getJob(id);
    if (!job) return null;
    const now = new Date().toISOString();
    const updated = {
      ...job,
      status: "failed",
      message: errorMessage ?? "Job failed.",
      errorCode,
      errorMessage,
      attemptCount: job.attemptCount + 1,
      completedAt: now,
      updatedAt: now
    };
    this.#jobs.set(id, updated);
    return updated;
  }

  async retryJob(id) {
    const job = await this.getJob(id);
    if (!job) return null;
    const updated = {
      ...job,
      status: "queued",
      stage: "queued",
      progress: 0,
      message: "Queued.",
      errorCode: null,
      errorMessage: null,
      availableAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.#jobs.set(id, updated);
    return updated;
  }

  async list() {
    return [...this.#jobs.values()];
  }
}

export const jobLifecycleStatuses = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled"
});

export class GenericJobFramework {
  constructor({ queue, handlers = {}, logger } = {}) {
    this.queue = queue;
    this.handlers = new Map(Object.entries(handlers));
    this.logger = logger;
  }

  register(jobType, handler) {
    this.handlers.set(jobType, handler);
  }

  async submit({ jobType, userId, payloadRef = {}, priority = 100, maxAttempts = 3, idempotencyKey }) {
    return this.queue.submitJob({
      jobType,
      userId,
      priority,
      maxAttempts,
      idempotencyKey,
      payloadRef: {
        ...payloadRef,
        frameworkVersion: 1
      }
    });
  }

  async run(jobId, context = {}) {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    const handler = this.handlers.get(job.jobType);
    if (!handler) throw new Error(`No handler registered for ${job.jobType}`);
    this.logger?.info?.("job_started", { jobId, jobType: job.jobType, userId: job.userId, requestId: context.requestId });
    await this.queue.markRunning?.(jobId);
    try {
      const resultRef = await handler(job, context);
      const completed = await this.queue.completeJob?.(jobId, { resultRef });
      this.logger?.info?.("job_completed", { jobId, jobType: job.jobType, userId: job.userId, requestId: context.requestId });
      return completed;
    } catch (error) {
      const failed = await this.queue.failJob?.(jobId, { errorCode: error.code ?? "job_failed", errorMessage: error.message });
      this.logger?.error?.("job_failed", { jobId, jobType: job.jobType, userId: job.userId, requestId: context.requestId, error: error.message });
      return failed;
    }
  }
}

export class RepositoryBackedQueue {
  constructor({ jobRepository }) {
    this.jobRepository = jobRepository;
  }

  async submitJob(job) {
    return this.jobRepository.createJob(job);
  }

  async getJob(id) {
    return this.jobRepository.findJobById(id);
  }

  async getJobByResume(resumeId, userId) {
    return this.jobRepository.findJobForResume(resumeId, userId);
  }

  async cancelJob(id) {
    return this.jobRepository.updateJobStatus(id, { status: "canceled" });
  }

  async markRunning(id) {
    return this.jobRepository.updateJobStatus(id, { status: "running" });
  }

  async updateJobProgress(id, fields) {
    return this.jobRepository.updateJobProgress(id, fields);
  }

  async completeJob(id, { resultRef } = {}) {
    return this.jobRepository.completeJob(id, { resultRef });
  }

  async failJob(id, { errorCode, errorMessage } = {}) {
    return this.jobRepository.failJob(id, { errorCode, errorMessage });
  }

  async retryJob(id) {
    return this.jobRepository.retryJob(id);
  }
}
