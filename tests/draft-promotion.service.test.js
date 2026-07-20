import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAsyncJobRepository } from "../apps/api/src/repositories/async-job.repository.js";
import { InMemoryPromotionRepository } from "../apps/api/src/repositories/promotion.repository.js";
import { InMemoryResumeParserRepository } from "../apps/api/src/repositories/resume-parser.repository.js";
import { InMemoryResumeRepository } from "../apps/api/src/repositories/resume.repository.js";
import { CanonicalResumeResolver } from "../apps/api/src/services/canonical-resume-resolver.js";
import { DraftPromotionService } from "../apps/api/src/services/draft-promotion.service.js";

async function createPromotableFixture({ failAfterVersion = false } = {}) {
  const resumes = new InMemoryResumeRepository();
  const parser = new InMemoryResumeParserRepository();
  const jobs = new InMemoryAsyncJobRepository();
  const promotion = new InMemoryPromotionRepository({ resumeRepository: resumes, failAfterVersion });
  const resolver = new CanonicalResumeResolver({
    resumeRepository: resumes,
    promotionRepository: promotion,
    resumeParserRepository: parser
  });
  const service = new DraftPromotionService({
    resumeRepository: resumes,
    resumeParserRepository: parser,
    asyncJobRepository: jobs,
    promotionRepository: promotion,
    canonicalResumeResolver: resolver,
    logger: { info() {} }
  });
  const resume = await resumes.createResume({
    userId: "user_1",
    title: "Master Resume",
    sourceFileId: "file_1"
  });
  await parser.replaceParsedDraft({
    userId: "user_1",
    resumeId: resume.id,
    sections: [{
      sectionType: "experience",
      title: "Experience",
      confidence: 0.8,
      entities: [{
        entityType: "experience",
        title: "Backend Engineer",
        confidence: 0.8,
        bullets: [{ text: "Built APIs", confidence: 0.8 }]
      }]
    }]
  });
  await resumes.updateResumeStatus(resume.id, "user_1", "review_required");
  await jobs.createJob({
    userId: "user_1",
    jobType: "resume_parse",
    status: "succeeded",
    payloadRef: { resumeId: resume.id }
  });
  return { service, resumes, promotion, resume };
}

test("DraftPromotionService promotes valid draft into canonical resume", async () => {
  const { service, resumes, promotion, resume } = await createPromotableFixture();

  const result = await service.promote({
    user: { id: "user_1" },
    resumeId: resume.id,
    requestId: "req_1"
  });

  const updatedResume = await resumes.findResumeForUser(resume.id, "user_1");
  assert.equal(updatedResume.status, "active");
  assert.equal(Boolean(updatedResume.canonicalVersionId), true);
  assert.equal(result.version.versionType, "master");
  assert.equal(result.diff.operationCount, 0);
  assert.equal(promotion.auditEvents.size, 1);
});

test("DraftPromotionService rejects invalid drafts", async () => {
  const { service, resume } = await createPromotableFixture();
  await assert.rejects(() => service.promote({
    user: { id: "user_2" },
    resumeId: resume.id,
    requestId: "req_1"
  }), /Resume not found/);
});

test("DraftPromotionService rolls back promotion on failure", async () => {
  const { service, resumes, promotion, resume } = await createPromotableFixture({ failAfterVersion: true });

  await assert.rejects(() => service.promote({
    user: { id: "user_1" },
    resumeId: resume.id,
    requestId: "req_1"
  }), /Injected promotion failure/);

  const updatedResume = await resumes.findResumeForUser(resume.id, "user_1");
  assert.equal(updatedResume.status, "review_required");
  assert.equal(updatedResume.canonicalVersionId, null);
  assert.equal(promotion.versions.size, 0);
  assert.equal(promotion.diffs.size, 0);
  assert.equal(promotion.auditEvents.size, 0);
});
