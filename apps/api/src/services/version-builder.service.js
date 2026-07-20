import { ConflictDetector } from "./conflict-detector.js";
import { DiffGenerator } from "./diff-generator.js";
import { PatchApplier } from "./patch-applier.js";
import { RendererService } from "./renderer.service.js";
import { SnapshotGenerator } from "./snapshot-generator.js";

export class VersionBuilderService {
  constructor({
    resumeRepository,
    resumeParserRepository,
    patchRepository,
    versioningRepository,
    conflictDetector = new ConflictDetector(),
    patchApplier = new PatchApplier(),
    snapshotGenerator = new SnapshotGenerator(),
    diffGenerator = new DiffGenerator(),
    rendererService = new RendererService(),
    logger
  }) {
    this.resumeRepository = resumeRepository;
    this.resumeParserRepository = resumeParserRepository;
    this.patchRepository = patchRepository;
    this.versioningRepository = versioningRepository;
    this.conflictDetector = conflictDetector;
    this.patchApplier = patchApplier;
    this.snapshotGenerator = snapshotGenerator;
    this.diffGenerator = diffGenerator;
    this.rendererService = rendererService;
    this.logger = logger;
  }

  async createVersionFromPatchSet({ user, patchSetId, requestId }) {
    this.logger.info("resume_version_build_started", { requestId, userId: user.id, patchSetId });
    const patchResult = await this.patchRepository.findPatchSetForUser(patchSetId, user.id);
    if (!patchResult) throwNotFound("Optimization patch set not found");
    const acceptedPatchIds = new Set(patchResult.reviewStates.filter((state) => state.state === "accepted").map((state) => state.patchId));
    const acceptedPatches = patchResult.patches.filter((patch) => acceptedPatchIds.has(patch.id));
    if (!acceptedPatches.length) throwValidation("At least one accepted patch is required to create a version");

    const resume = await this.resumeRepository.findResumeForUser(patchResult.patchSet.resumeId, user.id);
    if (!resume || resume.status !== "active") throwValidation("A canonical active resume is required for versioning");
    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resume.id);
    const canonicalResume = { resume, sections };
    this.conflictDetector.detect({ canonicalResume, acceptedPatches });

    const applied = this.patchApplier.apply({ canonicalResume, acceptedPatches });
    const parentVersion = await this.latestVersion(user.id, resume.id);
    const placeholderVersion = { id: "pending", metadata: { versionNumber: (parentVersion?.metadata?.versionNumber ?? 1) + 1 } };
    const generatedSnapshot = this.snapshotGenerator.generate({
      resume,
      version: placeholderVersion,
      sections: applied.snapshot.sections
    });
    const operations = this.diffGenerator.generate({ operations: applied.operations });
    const created = await this.versioningRepository.createVersionWithSnapshot({
      userId: user.id,
      resumeId: resume.id,
      parentVersionId: parentVersion?.id ?? resume.canonicalVersionId,
      patchSetId,
      matchReportId: patchResult.patchSet.matchReportId,
      snapshot: generatedSnapshot.snapshot,
      snapshotHash: generatedSnapshot.snapshotHash,
      operations
    });
    const renderOutputs = [];
    for (const render of this.rendererService.renderAll({ snapshot: created.snapshot.snapshot })) {
      const renderJob = await this.versioningRepository.createRenderJob({
        userId: user.id,
        resumeId: resume.id,
        versionId: created.version.id,
        format: render.format
      });
      renderOutputs.push(await this.versioningRepository.completeRenderJob({
        userId: user.id,
        resumeId: resume.id,
        versionId: created.version.id,
        renderJobId: renderJob.id,
        format: render.format,
        contentType: render.contentType,
        content: render.content
      }));
    }
    const artifacts = renderOutputs.map((item) => item.artifact);
    const renderJobs = renderOutputs.map((item) => item.job);
    this.logger.info("resume_version_build_succeeded", {
      requestId,
      userId: user.id,
      versionId: created.version.id,
      patchSetId,
      acceptedPatchCount: acceptedPatches.length
    });
    return { ...created, renderJobs, renderedResumes: artifacts };
  }

  async listVersions({ user, resumeId }) {
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    if (!resume) throwNotFound("Resume not found");
    return this.versioningRepository.listVersionsForResume(user.id, resumeId);
  }

  async getVersion({ user, versionId }) {
    const version = await this.versioningRepository.findVersionForUser(user.id, versionId);
    if (!version) throwNotFound("Resume version not found");
    const snapshot = await this.versioningRepository.findSnapshotForVersion(user.id, versionId);
    const diff = await this.versioningRepository.findDiffForVersion(user.id, versionId);
    const renderedResumes = await this.versioningRepository.listRenderedForVersion(user.id, versionId);
    return { version, snapshot, diff, renderedResumes };
  }

  async getRenderedArtifact({ user, renderedResumeId }) {
    const artifact = await this.versioningRepository.findRenderedForUser(user.id, renderedResumeId);
    if (!artifact) throwNotFound("Rendered resume not found");
    return artifact;
  }

  async latestVersion(userId, resumeId) {
    const versions = await this.versioningRepository.listVersionsForResume(userId, resumeId);
    return versions[versions.length - 1] ?? null;
  }
}

function throwNotFound(message) {
  const error = new Error(message);
  error.code = "not_found";
  error.statusCode = 404;
  throw error;
}

function throwValidation(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}
