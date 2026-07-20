export function aiTelemetryEvent(name, metadata = {}) {
  return {
    name,
    metadata,
    createdAt: new Date().toISOString()
  };
}
