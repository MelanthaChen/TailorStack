export async function readJson(req, options = {}) {
  const raw = await readBody(req, { maxBytes: options.maxBytes ?? 1024 * 1024 });
  if (!raw.length) return {};
  return JSON.parse(raw.toString("utf8"));
}

export async function readBody(req, { maxBytes } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (maxBytes && size > maxBytes) {
      const error = new Error("Request body exceeds upload size limit");
      error.code = "validation_error";
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function getPathname(req) {
  return new URL(req.url, "http://localhost").pathname;
}

export function parseMultipartForm(buffer, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType ?? "");
  if (!boundaryMatch) {
    const error = new Error("Multipart boundary is required");
    error.code = "validation_error";
    error.statusCode = 400;
    throw error;
  }
  const boundary = `--${boundaryMatch[1]}`;
  const raw = buffer.toString("binary");
  const parts = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separator = trimmed.indexOf("\r\n\r\n");
    if (separator === -1) continue;
    const rawHeaders = trimmed.slice(0, separator);
    let content = trimmed.slice(separator + 4);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);
    const headers = parsePartHeaders(rawHeaders);
    const disposition = headers["content-disposition"] ?? "";
    const name = /name="([^"]+)"/.exec(disposition)?.[1];
    if (!name) continue;
    const filename = /filename="([^"]*)"/.exec(disposition)?.[1];
    if (filename !== undefined) {
      files[name] = {
        filename,
        contentType: headers["content-type"] ?? "application/octet-stream",
        buffer: Buffer.from(content, "binary")
      };
    } else {
      fields[name] = Buffer.from(content, "binary").toString("utf8");
    }
  }

  return { fields, files };
}

function parsePartHeaders(rawHeaders) {
  const headers = {};
  for (const line of rawHeaders.split("\r\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}
