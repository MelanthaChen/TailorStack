import { createResumeParserWorker } from "./index.js";

const jobId = process.argv[2];
if (!jobId) {
  throw new Error("Usage: node workers/resume-parser/src/run-job.js <job-id>");
}

const worker = createResumeParserWorker();
await worker.execute(jobId);
