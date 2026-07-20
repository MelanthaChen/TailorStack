export class ResumeUploadService {
  constructor({
    uploadedFileRepository,
    resumeRepository,
    queue,
    objectStorage,
    config,
    logger,
    validateUpload
  }) {
    this.uploadedFileRepository = uploadedFileRepository;
    this.resumeRepository = resumeRepository;
    this.queue = queue;
    this.objectStorage = objectStorage;
    this.config = config;
    this.logger = logger;
    this.validateUpload = validateUpload;
  }

  async uploadMasterResume({ user, file, title }, context) {
    const validation = this.validateUpload(file, { maxUploadBytes: this.config.maxUploadBytes });
    const duplicate = await this.uploadedFileRepository.findByChecksumForUser(user.id, validation.checksumSha256);
    if (duplicate) {
      const error = new Error("This resume PDF has already been uploaded");
      error.code = "conflict";
      error.statusCode = 409;
      error.details = { checksumSha256: validation.checksumSha256 };
      throw error;
    }

    const objectStorageKey = [
      "users",
      user.id,
      "uploads",
      `${validation.checksumSha256}.pdf`
    ].join("/");

    await this.objectStorage.putObject(objectStorageKey, file.buffer, {
      contentType: validation.contentType,
      originalFilename: validation.filename
    });

    const uploadedFile = await this.uploadedFileRepository.createUploadedFile({
      userId: user.id,
      fileType: "resume_pdf",
      originalFilename: validation.filename,
      contentType: validation.contentType,
      byteSize: validation.byteSize,
      objectStorageKey,
      checksumSha256: validation.checksumSha256,
      status: "uploaded",
      metadata: {
        originalTitle: title ?? null
      }
    });

    const resume = await this.resumeRepository.createResume({
      userId: user.id,
      title: title || filenameToTitle(validation.filename),
      resumeType: "master",
      status: "parsing",
      sourceFileId: uploadedFile.id,
      metadata: {
        uploadChecksumSha256: validation.checksumSha256
      }
    });

    const parseJob = await this.queue.submitJob({
      userId: user.id,
      jobType: "resume_parse",
      priority: 100,
      payloadRef: {
        resumeId: resume.id,
        uploadedFileId: uploadedFile.id,
        objectStorageKey
      },
      maxAttempts: 3
    });

    this.logger.info("resume_upload_succeeded", {
      requestId: context.requestId,
      userId: user.id,
      resumeId: resume.id,
      uploadedFileId: uploadedFile.id,
      parseJobId: parseJob.id
    });

    return { resume, uploadedFile, parseJob };
  }

  async listResumes(user) {
    return this.resumeRepository.listResumesForUser(user.id);
  }

  async getUploadStatus({ user, resumeId }) {
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    if (!resume) {
      const error = new Error("Resume not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    const uploadedFile = await this.uploadedFileRepository.findById(resume.sourceFileId);
    const parseJob = await this.queue.getJobByResume
      ? await this.queue.getJobByResume(resume.id, user.id)
      : null;
    return { resume, uploadedFile, parseJob };
  }
}

function filenameToTitle(filename) {
  return filename.replace(/\.pdf$/i, "").trim() || "Master Resume";
}
