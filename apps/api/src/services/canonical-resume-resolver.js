export class CanonicalResumeResolver {
  constructor({ resumeRepository, promotionRepository, resumeParserRepository }) {
    this.resumeRepository = resumeRepository;
    this.promotionRepository = promotionRepository;
    this.resumeParserRepository = resumeParserRepository;
  }

  async resolve({ user, resumeId }) {
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    if (!resume) {
      const error = new Error("Resume not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    const version = resume.canonicalVersionId
      ? await this.promotionRepository.findMasterVersionForResume(user.id, resumeId)
      : null;
    const diff = version?.diffId ? await this.promotionRepository.findDiffById(version.diffId) : null;
    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resumeId);
    return { resume, version, diff, sections };
  }
}
