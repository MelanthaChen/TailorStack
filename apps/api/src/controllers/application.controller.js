import {
  publicApplication,
  publicApplicationEvent,
  publicApplicationNote
} from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class ApplicationController {
  constructor({ applicationService, notesService }) {
    this.applicationService = applicationService;
    this.notesService = notesService;
  }

  async create(context) {
    const user = requireAuth(context);
    const input = await readJson(context.req);
    const result = await this.applicationService.create({ user, input, requestId: context.requestId });
    sendSuccess(context.res, 201, serializeWorkspace(result), context.requestId);
  }

  async list(context) {
    const user = requireAuth(context);
    const applications = await this.applicationService.list({ user, requestId: context.requestId });
    sendSuccess(context.res, 200, { applications: applications.map(publicApplication) }, context.requestId);
  }

  async get(context, applicationId) {
    const user = requireAuth(context);
    const result = await this.applicationService.get({ user, applicationId, requestId: context.requestId });
    sendSuccess(context.res, 200, serializeWorkspace(result), context.requestId);
  }

  async updateStatus(context, applicationId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.applicationService.updateStatus({
      user,
      applicationId,
      status: body.status,
      requestId: context.requestId
    });
    sendSuccess(context.res, 200, serializeWorkspace(result), context.requestId);
  }

  async createNote(context, applicationId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.notesService.create({
      user,
      applicationId,
      body: body.body,
      requestId: context.requestId
    });
    sendSuccess(context.res, 201, {
      note: publicApplicationNote(result.note),
      event: publicApplicationEvent(result.event)
    }, context.requestId);
  }
}

function serializeWorkspace(result) {
  return {
    application: publicApplication(result.application),
    events: result.events.map(publicApplicationEvent),
    notes: result.notes.map(publicApplicationNote)
  };
}
