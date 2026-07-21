import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const requiredPaths = [
  "apps/api/src/app.js",
  "apps/api/src/controllers/auth.controller.js",
  "apps/api/src/controllers/draft-review.controller.js",
  "apps/api/src/controllers/job-description.controller.js",
  "apps/api/src/controllers/match.controller.js",
  "apps/api/src/controllers/readiness.controller.js",
  "apps/api/src/controllers/optimization.controller.js",
  "apps/api/src/controllers/versioning.controller.js",
  "apps/api/src/controllers/application.controller.js",
  "apps/api/src/controllers/resume-editor.controller.js",
  "apps/api/src/controllers/resume-upload.controller.js",
  "apps/api/src/controllers/resume-parser.controller.js",
  "apps/api/src/services/auth.service.js",
  "apps/api/src/services/draft-promotion.service.js",
  "apps/api/src/services/resume-editor.service.js",
  "apps/api/src/services/resume-editor-validator.js",
  "apps/api/src/services/promotion-validator.js",
  "apps/api/src/services/canonical-resume-resolver.js",
  "apps/api/src/services/resume-upload.service.js",
  "apps/api/src/services/resume-parser.service.js",
  "apps/api/src/services/job-description.service.js",
  "apps/api/src/services/deterministic-job-parser.js",
  "apps/api/src/services/job-normalizer.js",
  "apps/api/src/services/job-requirement-validator.js",
  "apps/api/src/services/matching.service.js",
  "apps/api/src/services/matching-normalizer.js",
  "apps/api/src/services/evidence-generator.js",
  "apps/api/src/services/gap-analyzer.js",
  "apps/api/src/services/weighted-scorer.js",
  "apps/api/src/services/readiness.service.js",
  "apps/api/src/services/readiness-finding-generator.js",
  "apps/api/src/services/readiness-recommendation-generator.js",
  "apps/api/src/services/optimization.service.js",
  "apps/api/src/services/patch-generator.js",
  "apps/api/src/services/patch-validator.js",
  "apps/api/src/services/review-state.service.js",
  "apps/api/src/services/version-builder.service.js",
  "apps/api/src/services/patch-applier.js",
  "apps/api/src/services/conflict-detector.js",
  "apps/api/src/services/snapshot-generator.js",
  "apps/api/src/services/diff-generator.js",
  "apps/api/src/services/renderer.service.js",
  "apps/api/src/services/application.service.js",
  "apps/api/src/services/timeline.service.js",
  "apps/api/src/services/notes.service.js",
  "apps/api/src/services/pdf-extraction.service.js",
  "apps/api/src/services/ai-resume-parser.service.js",
  "apps/api/src/services/parser-output-validator.js",
  "apps/api/src/services/upload-validation.js",
  "apps/api/src/repositories/auth.repository.js",
  "apps/api/src/repositories/promotion.repository.js",
  "apps/api/src/repositories/audit.repository.js",
  "apps/api/src/repositories/resume-editor.repository.js",
  "apps/api/src/repositories/uploaded-file.repository.js",
  "apps/api/src/repositories/resume.repository.js",
  "apps/api/src/repositories/resume-parser.repository.js",
  "apps/api/src/repositories/job-description.repository.js",
  "apps/api/src/repositories/job-requirement.repository.js",
  "apps/api/src/repositories/job-keyword.repository.js",
  "apps/api/src/repositories/match.repository.js",
  "apps/api/src/repositories/readiness.repository.js",
  "apps/api/src/repositories/patch.repository.js",
  "apps/api/src/repositories/versioning.repository.js",
  "apps/api/src/repositories/application.repository.js",
  "apps/api/src/repositories/async-job.repository.js",
  "apps/api/src/middleware/auth.js",
  "apps/web/public/index.html",
  "apps/web/public/app.js",
  "packages/config/src/index.js",
  "packages/logger/src/index.js",
  "packages/schemas/src/index.js",
  "packages/auth/src/index.js",
  "packages/ai/src/index.js",
  "packages/ai/prompts/resume-parsing.js",
  "packages/ai/prompts/job-enhancement.js",
  "packages/ai/pipeline/resume-parser-pipeline.js",
  "packages/ai/pipeline/job-enhancement-pipeline.js",
  "packages/ai/pipeline/readiness-explanation-pipeline.js",
  "packages/ai/prompts/readiness-explanation.js",
  "packages/ai/pipeline/optimization-wording-pipeline.js",
  "packages/ai/prompts/optimization-wording.js",
  "packages/ai/validation/resume-parser-output.js",
  "packages/ai/validation/job-model-validator.js",
  "packages/database/src/index.js",
  "packages/queue/src/index.js",
  "packages/object-storage/src/index.js",
  "infra/docker/docker-compose.yml",
  "infra/migrations/0003_resume_upload_pipeline.sql",
  "infra/migrations/0004_resume_parser_drafts.sql",
  "infra/migrations/0005_canonical_resume_promotion.sql",
  "infra/migrations/0006_job_intelligence.sql",
  "infra/migrations/0007_resume_matching.sql",
  "infra/migrations/0008_application_readiness.sql",
  "infra/migrations/0009_resume_optimization.sql",
  "infra/migrations/0010_resume_versioning.sql",
  "infra/migrations/0011_application_workspace.sql",
  "infra/migrations/0012_async_job_progress.sql",
  "infra/migrations",
  "scripts/dev/dev.mjs",
  "scripts/dev/stop.mjs",
  ".github/workflows/ci.yml"
];

for (const path of requiredPaths) {
  await access(path);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const workspaceRoots = rootPackage.workspaces ?? [];
if (!workspaceRoots.includes("apps/*") || !workspaceRoots.includes("packages/*") || !workspaceRoots.includes("workers/*")) {
  throw new Error("Root package.json must define apps, packages, and workers workspaces");
}

if (rootPackage.scripts?.dev !== "node scripts/dev/dev.mjs" || rootPackage.scripts?.stop !== "node scripts/dev/stop.mjs") {
  throw new Error("Root package.json must define dev and stop scripts");
}

for (const dir of ["apps", "packages", "workers"]) {
  const entries = await readdir(dir);
  if (entries.length === 0) {
    throw new Error(`${dir} must not be empty`);
  }
}

console.log("Workspace foundation check passed.");
