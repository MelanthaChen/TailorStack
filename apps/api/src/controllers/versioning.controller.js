import {
  publicRenderedResume,
  publicRenderJob,
  publicResumeDiff,
  publicResumeVersion,
  publicVersionSnapshot
} from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class VersioningController {
  constructor({ versionBuilderService }) {
    this.versionBuilderService = versionBuilderService;
  }

  async create(context) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.versionBuilderService.createVersionFromPatchSet({
      user,
      patchSetId: body.patchSetId,
      requestId: context.requestId
    });
    sendSuccess(context.res, 201, serializeVersionBuild(result), context.requestId);
  }

  async list(context, resumeId) {
    const user = requireAuth(context);
    const versions = await this.versionBuilderService.listVersions({ user, resumeId });
    sendSuccess(context.res, 200, { versions: versions.map(publicResumeVersion) }, context.requestId);
  }

  async get(context, versionId) {
    const user = requireAuth(context);
    const result = await this.versionBuilderService.getVersion({ user, versionId });
    sendSuccess(context.res, 200, serializeVersion(result), context.requestId);
  }

  async artifact(context, renderedResumeId) {
    const user = requireAuth(context);
    const artifact = await this.versionBuilderService.getRenderedArtifact({ user, renderedResumeId });
    sendSuccess(context.res, 200, { renderedResume: publicRenderedResume(artifact), content: artifact.content }, context.requestId);
  }
}

function serializeVersionBuild(result) {
  return {
    version: publicResumeVersion(result.version),
    diff: publicResumeDiff(result.diff),
    snapshot: publicVersionSnapshot(result.snapshot),
    renderJobs: result.renderJobs.map(publicRenderJob),
    renderedResumes: result.renderedResumes.map(publicRenderedResume)
  };
}

function serializeVersion(result) {
  return {
    version: publicResumeVersion(result.version),
    diff: publicResumeDiff(result.diff),
    snapshot: publicVersionSnapshot(result.snapshot),
    renderedResumes: result.renderedResumes.map(publicRenderedResume)
  };
}
