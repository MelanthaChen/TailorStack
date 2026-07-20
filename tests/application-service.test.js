import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryApplicationRepository } from "../apps/api/src/repositories/application.repository.js";
import { ApplicationService } from "../apps/api/src/services/application.service.js";
import { TimelineService } from "../apps/api/src/services/timeline.service.js";
import { NotesService } from "../apps/api/src/services/notes.service.js";

const user = { id: "user-1" };
const logger = { info() {}, error() {} };

test("ApplicationService creates workspace with immutable artifact references", async () => {
  const applicationRepository = new InMemoryApplicationRepository();
  const timelineService = new TimelineService({ applicationRepository, logger });
  const service = createService({ applicationRepository, timelineService });

  const result = await service.create({
    user,
    requestId: "req-1",
    input: {
      company: "Stripe",
      position: "Software Engineer",
      resumeVersionId: "version-1",
      renderedResumeId: "rendered-1",
      status: "preparing"
    }
  });

  assert.equal(result.application.company, "Stripe");
  assert.equal(result.application.resumeVersionId, "version-1");
  assert.equal(result.application.status, "preparing");
  assert.equal(result.events.some((event) => event.eventType === "application_created"), true);
  assert.equal(result.events.some((event) => event.eventType === "resume_version_attached"), true);
  assert.equal(result.events.some((event) => event.eventType === "version_created"), true);
});

test("ApplicationService rejects missing resume version reference", async () => {
  const applicationRepository = new InMemoryApplicationRepository();
  const timelineService = new TimelineService({ applicationRepository, logger });
  const service = createService({
    applicationRepository,
    timelineService,
    versioningRepository: { findVersionForUser: async () => null }
  });

  await assert.rejects(
    () => service.create({
      user,
      requestId: "req-1",
      input: { company: "Google", resumeVersionId: "missing-version" }
    }),
    /Resume version is required/
  );
});

test("status updates and notes append timeline events", async () => {
  const applicationRepository = new InMemoryApplicationRepository();
  const timelineService = new TimelineService({ applicationRepository, logger });
  const service = createService({ applicationRepository, timelineService });
  const notesService = new NotesService({ applicationRepository, timelineService, logger });
  const created = await service.create({
    user,
    requestId: "req-1",
    input: { company: "Amazon", resumeVersionId: "version-1" }
  });

  const updated = await service.updateStatus({
    user,
    applicationId: created.application.id,
    status: "applied",
    requestId: "req-2"
  });
  const noteResult = await notesService.create({
    user,
    applicationId: created.application.id,
    body: "Submitted through careers portal.",
    requestId: "req-3"
  });

  assert.equal(updated.application.status, "applied");
  assert.equal(noteResult.note.body, "Submitted through careers portal.");
  const timeline = await timelineService.list({ user, applicationId: created.application.id, requestId: "req-4" });
  assert.equal(timeline.some((event) => event.eventType === "application_applied"), true);
  assert.equal(timeline.some((event) => event.eventType === "manual_note"), true);
});

function createService(overrides = {}) {
  return new ApplicationService({
    applicationRepository: overrides.applicationRepository,
    versioningRepository: overrides.versioningRepository ?? {
      findVersionForUser: async () => ({ id: "version-1" }),
      findRenderedForUser: async () => ({ id: "rendered-1", versionId: "version-1" })
    },
    jobDescriptionRepository: { findForUser: async () => ({ id: "job-1" }) },
    matchRepository: { findReportForUser: async () => ({ report: { id: "match-1" } }) },
    readinessRepository: { findReportForUser: async () => ({ report: { id: "readiness-1" } }) },
    patchRepository: { findPatchSetForUser: async () => ({ patchSet: { id: "patch-set-1" } }) },
    timelineService: overrides.timelineService,
    logger
  });
}
