const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createLogger({ level = "info" } = {}) {
  const threshold = levels[level] ?? levels.info;

  function write(logLevel, event, fields) {
    if ((levels[logLevel] ?? levels.info) < threshold) return;
    const entry = {
      level: logLevel,
      event,
      timestamp: new Date().toISOString(),
      ...fields
    };
    const line = JSON.stringify(entry);
    if (logLevel === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (event, fields = {}) => write("debug", event, fields),
    info: (event, fields = {}) => write("info", event, fields),
    warn: (event, fields = {}) => write("warn", event, fields),
    error: (event, fields = {}) => write("error", event, fields)
  };
}
