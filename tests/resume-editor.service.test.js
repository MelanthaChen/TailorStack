import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAuditRepository } from "../apps/api/src/repositories/audit.repository.js";
import { InMemoryPromotionRepository } from "../apps/api/src/repositories/promotion.repository.js";
import { InMemoryResumeEditorRepository } from "../apps/api/src/repositories/resume-editor.repository.js";
import { InMemoryResumeParserRepository } from "../apps/api/src/repositories/resume-parser.repository.js";
import { InMemoryResumeRepository } from "../apps/api/src/repositories/resume.repository.js";
import { ResumeEditorService } from "../apps/api/src/services/resume-editor.service.js";

async function createEditorFixture() {
  const resumes = new InMemoryResumeRepository();
  const parser = new InMemoryResumeParserRepository();
  const promotion = new InMemoryPromotionRepository({ resumeRepository: resumes });
  const audit = new InMemoryAuditRepository({ promotionRepository: promotion });
  const editor = new InMemoryResumeEditorRepository({ resumeParserRepository: parser });
  const service = new ResumeEditorService({
    resumeRepository: resumes,
    resumeParserRepository: parser,
    resumeEditorRepository: editor,
    auditRepository: audit,
    logger: { info() {} }
  });
  const resume = await resumes.createResume({ userId: "user_1", title: "Master", sourceFileId: "file_1" });
  await parser.replaceParsedDraft({
    userId: "user_1",
    resumeId: resume.id,
    sections: [{
      sectionType: "experience",
      title: "Experience",
      confidence: 0.9,
      entities: [{
        entityType: "experience",
        title: "Engineer",
        confidence: 0.9,
        bullets: [{ text: "Built APIs", confidence: 0.9 }]
      }]
    }]
  });
  const promoted = await promotion.promoteDraft({
    userId: "user_1",
    resumeId: resume.id,
    resumeTitle: "Master",
    requestId: "req_promote"
  });
  return { service, resumes, parser, promotion, audit, resume: promoted.resume };
}

test("ResumeEditorService edits canonical sections, entities, and bullets", async () => {
  const { service, audit, resume } = await createEditorFixture();
  const user = { id: "user_1" };
  const initial = await service.getCanonicalResume({ user, resumeId: resume.id });
  const section = initial.sections[0];
  const entity = section.entities[0];
  const bullet = entity.bullets[0];

  let result = await service.updateSection({
    user,
    sectionId: section.id,
    input: { title: "Work Experience" },
    requestId: "req_1"
  });
  assert.equal(result.sections[0].title, "Work Experience");

  result = await service.updateEntity({
    user,
    entityId: entity.id,
    input: { organization: "Stripe", title: "Backend Engineer" },
    requestId: "req_2"
  });
  assert.equal(result.sections[0].entities[0].organization, "Stripe");

  result = await service.updateBullet({
    user,
    bulletId: bullet.id,
    input: { text: "Built reliable APIs" },
    requestId: "req_3"
  });
  assert.equal(result.sections[0].entities[0].bullets[0].text, "Built reliable APIs");
  assert.equal(audit.auditEvents.size, 4);
});

test("ResumeEditorService supports add hide show delete and ordering", async () => {
  const { service, resume } = await createEditorFixture();
  const user = { id: "user_1" };

  let result = await service.createSection({
    user,
    resumeId: resume.id,
    input: { title: "Projects", sectionType: "projects" },
    requestId: "req_1"
  });
  assert.equal(result.sections.length, 2);

  const projects = result.sections[1];
  result = await service.setSectionVisibility({
    user,
    sectionId: projects.id,
    visibility: "hidden",
    requestId: "req_2"
  });
  assert.equal(result.sections[1].visibility, "hidden");

  result = await service.reorderSections({
    user,
    resumeId: resume.id,
    orderedIds: [result.sections[1].id, result.sections[0].id],
    requestId: "req_3"
  });
  assert.equal(result.sections[0].title, "Projects");

  result = await service.deleteSection({
    user,
    sectionId: result.sections[0].id,
    requestId: "req_4"
  });
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].displayOrder, 0);
});

test("ResumeEditorService rejects invalid ordering and non-canonical resumes", async () => {
  const { service, resume } = await createEditorFixture();
  const user = { id: "user_1" };
  await assert.rejects(() => service.reorderSections({
    user,
    resumeId: resume.id,
    orderedIds: ["missing"],
    requestId: "req_1"
  }), /must match/);

  const inactive = await service.resumeRepository.createResume({
    userId: "user_1",
    title: "Draft",
    sourceFileId: "file_2"
  });
  await assert.rejects(() => service.getCanonicalResume({ user, resumeId: inactive.id }), /active and canonical/);
});
