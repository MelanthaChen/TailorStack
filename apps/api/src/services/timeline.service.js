export class TimelineService {
  constructor({ applicationRepository, logger }) {
    this.applicationRepository = applicationRepository;
    this.logger = logger;
  }

  async list({ user, applicationId, requestId }) {
    this.logger.info("application_timeline_list_started", { requestId, userId: user.id, applicationId });
    const events = await this.applicationRepository.listEvents(user.id, applicationId);
    this.logger.info("application_timeline_list_succeeded", { requestId, userId: user.id, applicationId, eventCount: events.length });
    return events;
  }

  async recordStatusChange({ user, application, fromStatus, toStatus, requestId }) {
    this.logger.info("application_status_event_started", { requestId, userId: user.id, applicationId: application.id, fromStatus, toStatus });
    const event = await this.applicationRepository.createEvent({
      userId: user.id,
      applicationId: application.id,
      eventType: eventTypeForStatus(toStatus),
      title: titleForStatus(toStatus),
      fromStatus,
      toStatus,
      artifactRefs: { resumeVersionId: application.resumeVersionId },
      metadata: {}
    });
    this.logger.info("application_status_event_succeeded", { requestId, userId: user.id, applicationId: application.id, eventId: event.id });
    return event;
  }

  async recordNote({ user, application, note, requestId }) {
    this.logger.info("application_note_event_started", { requestId, userId: user.id, applicationId: application.id, noteId: note.id });
    const event = await this.applicationRepository.createEvent({
      userId: user.id,
      applicationId: application.id,
      eventType: "manual_note",
      title: "Manual note",
      body: note.body,
      artifactRefs: {},
      metadata: { noteId: note.id }
    });
    this.logger.info("application_note_event_succeeded", { requestId, userId: user.id, applicationId: application.id, eventId: event.id });
    return event;
  }
}

function eventTypeForStatus(status) {
  return {
    preparing: "application_preparing",
    applied: "application_applied",
    interview: "interview_scheduled",
    offer: "offer_received",
    rejected: "application_rejected",
    withdrawn: "application_withdrawn",
    archived: "application_archived",
    draft: "application_draft"
  }[status] ?? "status_updated";
}

function titleForStatus(status) {
  return {
    draft: "Moved to draft",
    preparing: "Preparation started",
    applied: "Applied",
    interview: "Interview scheduled",
    offer: "Offer received",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    archived: "Archived"
  }[status] ?? "Status updated";
}
