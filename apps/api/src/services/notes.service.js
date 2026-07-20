export class NotesService {
  constructor({ applicationRepository, timelineService, logger }) {
    this.applicationRepository = applicationRepository;
    this.timelineService = timelineService;
    this.logger = logger;
  }

  async create({ user, applicationId, body, requestId }) {
    const text = String(body ?? "").trim();
    if (!text) throwValidation("Note body is required");
    this.logger.info("application_note_create_started", { requestId, userId: user.id, applicationId });
    const application = await this.applicationRepository.findApplicationForUser(user.id, applicationId);
    if (!application) throwNotFound("Application not found");
    const note = await this.applicationRepository.createNote({ userId: user.id, applicationId, body: text });
    const event = await this.timelineService.recordNote({ user, application, note, requestId });
    this.logger.info("application_note_create_succeeded", { requestId, userId: user.id, applicationId, noteId: note.id });
    return { note, event };
  }

  async list({ user, applicationId, requestId }) {
    this.logger.info("application_note_list_started", { requestId, userId: user.id, applicationId });
    const application = await this.applicationRepository.findApplicationForUser(user.id, applicationId);
    if (!application) throwNotFound("Application not found");
    const notes = await this.applicationRepository.listNotes(user.id, applicationId);
    this.logger.info("application_note_list_succeeded", { requestId, userId: user.id, applicationId, noteCount: notes.length });
    return notes;
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
