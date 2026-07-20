import { publicParsedSection, publicResume } from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class ResumeEditorController {
  constructor({ resumeEditorService }) {
    this.resumeEditorService = resumeEditorService;
  }

  async get(context, resumeId) {
    const user = requireAuth(context);
    const result = await this.resumeEditorService.getCanonicalResume({ user, resumeId });
    sendResume(context, result);
  }

  async createSection(context, resumeId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.createSection({ user, resumeId, input: await readJson(context.req), requestId: context.requestId }));
  }

  async updateSection(context, sectionId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.updateSection({ user, sectionId, input: await readJson(context.req), requestId: context.requestId }));
  }

  async deleteSection(context, sectionId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.deleteSection({ user, sectionId, requestId: context.requestId }));
  }

  async sectionVisibility(context, sectionId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    sendResume(context, await this.resumeEditorService.setSectionVisibility({ user, sectionId, visibility: body.visibility, requestId: context.requestId }));
  }

  async reorderSections(context, resumeId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    sendResume(context, await this.resumeEditorService.reorderSections({ user, resumeId, orderedIds: body.orderedIds, requestId: context.requestId }));
  }

  async createEntity(context, sectionId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.createEntity({ user, sectionId, input: await readJson(context.req), requestId: context.requestId }));
  }

  async updateEntity(context, entityId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.updateEntity({ user, entityId, input: await readJson(context.req), requestId: context.requestId }));
  }

  async deleteEntity(context, entityId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.deleteEntity({ user, entityId, requestId: context.requestId }));
  }

  async reorderEntities(context, sectionId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    sendResume(context, await this.resumeEditorService.reorderEntities({ user, sectionId, orderedIds: body.orderedIds, requestId: context.requestId }));
  }

  async createBullet(context, entityId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.createBullet({ user, entityId, input: await readJson(context.req), requestId: context.requestId }));
  }

  async updateBullet(context, bulletId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.updateBullet({ user, bulletId, input: await readJson(context.req), requestId: context.requestId }));
  }

  async deleteBullet(context, bulletId) {
    const user = requireAuth(context);
    sendResume(context, await this.resumeEditorService.deleteBullet({ user, bulletId, requestId: context.requestId }));
  }

  async bulletVisibility(context, bulletId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    sendResume(context, await this.resumeEditorService.setBulletVisibility({ user, bulletId, visibility: body.visibility, requestId: context.requestId }));
  }

  async reorderBullets(context, entityId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    sendResume(context, await this.resumeEditorService.reorderBullets({ user, entityId, orderedIds: body.orderedIds, requestId: context.requestId }));
  }
}

function sendResume(context, result) {
  sendSuccess(context.res, 200, {
    resume: publicResume(result.resume),
    sections: result.sections.map(publicParsedSection)
  }, context.requestId);
}
