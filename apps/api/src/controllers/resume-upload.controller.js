import { publicJob, publicResume, publicUpload } from "../../../../packages/schemas/src/index.js";
import { parseMultipartForm, readBody } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class ResumeUploadController {
  constructor({ resumeUploadService, config }) {
    this.resumeUploadService = resumeUploadService;
    this.config = config;
  }

  async upload(context) {
    const user = requireAuth(context);
    const body = await readBody(context.req, { maxBytes: this.config.maxUploadBytes + 1024 * 1024 });
    const form = parseMultipartForm(body, context.req.headers["content-type"]);
    const result = await this.resumeUploadService.uploadMasterResume({
      user,
      file: form.files.file,
      title: form.fields.title
    }, context);

    sendSuccess(context.res, 201, {
      resume: publicResume(result.resume),
      uploadedFile: publicUpload(result.uploadedFile),
      parseJob: publicJob(result.parseJob)
    }, context.requestId);
  }

  async list(context) {
    const user = requireAuth(context);
    const resumes = await this.resumeUploadService.listResumes(user);
    sendSuccess(context.res, 200, {
      resumes: resumes.map(publicResume)
    }, context.requestId);
  }

  async status(context, resumeId) {
    const user = requireAuth(context);
    const result = await this.resumeUploadService.getUploadStatus({ user, resumeId });
    sendSuccess(context.res, 200, {
      resume: publicResume(result.resume),
      uploadedFile: publicUpload(result.uploadedFile),
      parseJob: publicJob(result.parseJob)
    }, context.requestId);
  }
}
