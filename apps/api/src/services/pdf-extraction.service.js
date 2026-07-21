import { performance } from "node:perf_hooks";
import zlib from "node:zlib";

const maxExtractionMs = 30_000;
const longStepMs = 5_000;
const maxStreams = 1000;
const maxStreamBytes = 10 * 1024 * 1024;
const maxTextOperators = 50_000;

export class PdfExtractionService {
  extract(buffer, context = {}) {
    const tracer = new ExtractionTracer(context);
    return tracer.measure("Finished extraction", () => {
      tracer.log("Opening PDF", { byteSize: buffer.byteLength });
      const text = extractPdfText(buffer, tracer);
      const lines = text.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      tracer.summary.charactersExtracted = text.length;
      tracer.logSummary();
      return {
        text: lines.join("\n"),
        pages: [{
          pageNumber: 1,
          blocks: [{
            blockNumber: 0,
            lines: lines.map((line, index) => ({
              lineNumber: index,
              text: line
            }))
          }]
        }],
        metadata: {
          extractor: "native-basic",
          lineCount: lines.length,
          extractionSummary: tracer.summary
        }
      };
    });
  }
}

function extractPdfText(buffer, tracer) {
  const raw = tracer.measure("Reading PDF bytes", () => buffer.toString("latin1"));
  const streamText = extractTextFromContentStreams(buffer, raw, tracer);
  if (streamText) return streamText;

  const literalStrings = tracer.measure("Extracting text operators from raw PDF", () => extractTextOperators(raw, tracer, { source: "raw_pdf" }));
  if (literalStrings) return literalStrings;

  const looseLiteralStrings = tracer.measure("Extracting loose literal strings", () => extractLooseLiteralStrings(raw, tracer));
  if (looseLiteralStrings) return looseLiteralStrings;

  return tracer.measure("Fallback ASCII extraction", () => raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 1 && /[A-Za-z]/.test(line))
    .join("\n"));
}

function extractLooseLiteralStrings(raw, tracer) {
  const values = [];
  const pattern = /\(([^()]*)\)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    tracer.assertWithinLimits("Extracting loose literal strings");
    values.push(unescapePdfString(match[1]).trim());
  }
  return normalizeExtractedText(values.join("\n"));
}

function extractTextFromContentStreams(buffer, raw, tracer) {
  const chunks = [];
  const streams = tracer.measure("Finding objects", () => findPdfStreams(buffer, raw, tracer));
  tracer.summary.objectsProcessed = streams.length;
  for (const [index, stream] of streams.entries()) {
    tracer.assertWithinLimits(`Processing object ${index + 1}/${streams.length}`);
    tracer.log(`Processing object ${index + 1}/${streams.length}`, {
      streamIndex: index + 1,
      streamCount: streams.length,
      byteSize: stream.buffer.byteLength
    });
    if (shouldSkipStream(stream.dictionary)) {
      tracer.log(`Skipping non-content stream ${index + 1}`, {
        streamIndex: index + 1,
        dictionary: stream.dictionary.slice(0, 200)
      });
      continue;
    }
    const content = decodePdfStream(stream, tracer, index + 1);
    const text = tracer.measure("Extracting text operators", () => extractTextOperators(content, tracer, { source: "stream", streamIndex: index + 1 }));
    if (text) chunks.push(text);
  }
  return tracer.measure("Normalizing extracted stream text", () => normalizeExtractedText(chunks.join("\n")));
}

function findPdfStreams(buffer, raw, tracer) {
  const streams = [];
  let searchFrom = 0;
  for (;;) {
    tracer.assertWithinLimits("Finding objects");
    const streamKeyword = raw.indexOf("stream", searchFrom);
    if (streamKeyword === -1) break;
    if (streams.length >= maxStreams) throw extractionError(`Malformed PDF: exceeded ${maxStreams} content streams`);

    const dictionaryStart = raw.lastIndexOf("<<", streamKeyword);
    const dictionaryEnd = raw.lastIndexOf(">>", streamKeyword);
    if (dictionaryStart === -1 || dictionaryEnd === -1 || dictionaryEnd < dictionaryStart) {
      searchFrom = streamKeyword + "stream".length;
      continue;
    }
    const streamDataStart = streamStartOffset(raw, streamKeyword);
    const endMarker = buffer.indexOf(Buffer.from("endstream", "latin1"), streamDataStart);
    if (endMarker === -1) throw extractionError(`Malformed PDF: stream ${streams.length + 1} has no endstream marker`);

    const streamBuffer = trimStreamBoundaries(buffer.subarray(streamDataStart, endMarker));
    if (streamBuffer.byteLength > maxStreamBytes) {
      throw extractionError(`Malformed PDF: stream ${streams.length + 1} is too large (${streamBuffer.byteLength} bytes)`);
    }
    streams.push({
      dictionary: raw.slice(dictionaryStart + 2, dictionaryEnd),
      buffer: streamBuffer
    });
    searchFrom = endMarker + "endstream".length;
  }
  return streams;
}

function shouldSkipStream(dictionary) {
  return /\/Type\s*\/ObjStm\b/.test(dictionary) ||
    /\/FontFile(?:2|3)?\b/.test(dictionary) ||
    /\/Subtype\s*\/Image\b/.test(dictionary);
}

function streamStartOffset(raw, streamKeyword) {
  let offset = Buffer.byteLength(raw.slice(0, streamKeyword + "stream".length), "latin1");
  const next = raw.charCodeAt(streamKeyword + "stream".length);
  const afterNext = raw.charCodeAt(streamKeyword + "stream".length + 1);
  if (next === 13 && afterNext === 10) offset += 2;
  else if (next === 10 || next === 13) offset += 1;
  return offset;
}

function trimStreamBoundaries(streamBuffer) {
  let result = streamBuffer;
  if (result[0] === 0x0d && result[1] === 0x0a) result = result.subarray(2);
  else if (result[0] === 0x0a) result = result.subarray(1);
  if (result.at(-2) === 0x0d && result.at(-1) === 0x0a) result = result.subarray(0, -2);
  else if (result.at(-1) === 0x0a || result.at(-1) === 0x0d) result = result.subarray(0, -1);
  return result;
}

function decodePdfStream(stream, tracer, streamNumber) {
  if (/\/FlateDecode\b/.test(stream.dictionary)) {
    tracer.log(`Inflating stream ${streamNumber} (${Math.round(stream.buffer.byteLength / 1024)} KB)`, {
      streamNumber,
      byteSize: stream.buffer.byteLength
    });
    tracer.summary.streamsInflated += 1;
    return tracer.measure(`Finished stream ${streamNumber}`, () => {
      try {
        return zlib.inflateSync(stream.buffer).toString("latin1");
      } catch (error) {
        throw extractionError(`Malformed PDF: could not inflate stream ${streamNumber}: ${error.message}`);
      }
    }, { streamNumber, byteSize: stream.buffer.byteLength });
  }
  return tracer.measure(`Decoding uncompressed stream ${streamNumber}`, () => stream.buffer.toString("latin1"), {
    streamNumber,
    byteSize: stream.buffer.byteLength
  });
}

function extractTextOperators(content, tracer, fields = {}) {
  const values = [];
  for (let index = 0; index < content.length; index += 1) {
    tracer.assertWithinLimits("Extracting text operators");
    const operator = readTextOperator(content, index);
    if (!operator) continue;
    const token = readPreviousTextToken(content, index);
    if (!token) continue;
    recordTextOperator(tracer);
    const text = decodeTextToken(token, tracer);
    if (text) values.push(text);
    index += operator.length - 1;
  }
  tracer.log("Extracting text operators complete", {
    ...fields,
    operatorsFound: tracer.summary.textOperatorsFound,
    contentLength: content.length
  });
  return normalizeExtractedText(values.join("\n"));
}

function readTextOperator(content, index) {
  if (content.startsWith("TJ", index) && isOperatorBoundary(content, index, 2)) return "TJ";
  if (content.startsWith("Tj", index) && isOperatorBoundary(content, index, 2)) return "Tj";
  if (content[index] === "'" && isOperatorBoundary(content, index, 1)) return "'";
  if (content[index] === "\"" && isOperatorBoundary(content, index, 1)) return "\"";
  return null;
}

function isOperatorBoundary(content, index, length) {
  const before = content[index - 1] ?? " ";
  const after = content[index + length] ?? " ";
  return isPdfWhitespace(before) && isPdfDelimiter(after);
}

function readPreviousTextToken(content, operatorIndex) {
  let index = skipWhitespaceBackward(content, operatorIndex - 1);
  if (index < 0) return "";
  if (content[index] === ")") return readLiteralTokenBackward(content, index);
  if (content[index] === ">") return readHexTokenBackward(content, index);
  if (content[index] === "]") return readArrayTokenBackward(content, index);
  return "";
}

function readLiteralTokenBackward(content, endIndex) {
  let escaped = false;
  let depth = 0;
  for (let index = endIndex; index >= 0; index -= 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === ")") depth += 1;
    if (char === "(") {
      depth -= 1;
      if (depth === 0) return content.slice(index, endIndex + 1);
    }
  }
  return "";
}

function readHexTokenBackward(content, endIndex) {
  const startIndex = content.lastIndexOf("<", endIndex);
  if (startIndex === -1) return "";
  return content.slice(startIndex, endIndex + 1);
}

function readArrayTokenBackward(content, endIndex) {
  let depth = 0;
  for (let index = endIndex; index >= 0; index -= 1) {
    const char = content[index];
    if (char === "]") depth += 1;
    if (char === "[") {
      depth -= 1;
      if (depth === 0) return content.slice(index, endIndex + 1);
    }
  }
  return "";
}

function recordTextOperator(tracer) {
  if (tracer.summary.textOperatorsFound >= maxTextOperators) {
    throw extractionError(`Malformed PDF: exceeded ${maxTextOperators} text operators`);
  }
  tracer.summary.textOperatorsFound += 1;
}

function decodeTextToken(token, tracer) {
  if (token.startsWith("[")) {
    return decodeArrayToken(token, tracer);
  }
  if (token.startsWith("<")) return decodeHexString(token, tracer);
  if (token.startsWith("(")) return unescapePdfString(token.slice(1, -1));
  return "";
}

function decodeArrayToken(token, tracer) {
  const pieces = [];
  for (let index = 1; index < token.length - 1; index += 1) {
    tracer.assertWithinLimits("Decoding text array");
    const char = token[index];
    if (char === "(") {
      const literal = readLiteralTokenForward(token, index);
      if (literal.value) pieces.push(decodeTextToken(literal.value, tracer));
      index = literal.endIndex;
    } else if (char === "<") {
      const endIndex = token.indexOf(">", index + 1);
      if (endIndex === -1) break;
      pieces.push(decodeTextToken(token.slice(index, endIndex + 1), tracer));
      index = endIndex;
    }
  }
  return pieces.join("");
}

function readLiteralTokenForward(content, startIndex) {
  let escaped = false;
  let depth = 0;
  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return { value: content.slice(startIndex, index + 1), endIndex: index };
    }
  }
  return { value: "", endIndex: startIndex };
}

function decodeHexString(token, tracer) {
  const hex = token.slice(1, -1).replace(/\s+/g, "");
  if (!hex || hex.length % 2 !== 0) return "";
  const buffer = Buffer.from(hex, "hex");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return tracer.measure("Decoding UTF-16", () => decodeUtf16Be(buffer.subarray(2)), { byteSize: buffer.byteLength });
  }
  return buffer.toString("latin1");
}

function decodeUtf16Be(buffer) {
  const chunks = [];
  for (let offset = 0; offset + 1 < buffer.length; offset += 2) {
    chunks.push(String.fromCharCode(buffer.readUInt16BE(offset)));
  }
  return chunks.join("");
}

function unescapePdfString(value) {
  return value
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\n")
    .replaceAll("\\t", " ")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\\\", "\\");
}

function normalizeExtractedText(value) {
  return value
    .replace(/\0/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1 && /[A-Za-z]/.test(line))
    .join("\n");
}

function skipWhitespaceBackward(content, index) {
  let cursor = index;
  while (cursor >= 0 && isPdfWhitespace(content[cursor])) cursor -= 1;
  return cursor;
}

function isPdfWhitespace(char) {
  return char === " " || char === "\n" || char === "\r" || char === "\t" || char === "\f" || char === "\0";
}

function isPdfDelimiter(char) {
  return isPdfWhitespace(char) || "()<>[]{}/%".includes(char);
}

class ExtractionTracer {
  constructor({ logger, requestId, jobId } = {}) {
    this.logger = logger;
    this.requestId = requestId;
    this.jobId = jobId;
    this.startedAtMs = performance.now();
    this.summary = {
      objectsProcessed: 0,
      streamsInflated: 0,
      textOperatorsFound: 0,
      charactersExtracted: 0,
      elapsedMs: 0
    };
  }

  measure(operation, callback, fields = {}) {
    const startTime = new Date();
    const startMs = performance.now();
    this.emit("pdf_extraction_step_started", {
      operation,
      startTime: startTime.toISOString(),
      ...fields
    });
    try {
      const result = callback();
      this.emitFinished(operation, startTime, startMs, fields);
      return result;
    } catch (error) {
      this.emitFinished(operation, startTime, startMs, { ...fields, error: error.message });
      throw error;
    }
  }

  log(operation, fields = {}) {
    this.emit("pdf_extraction_trace", {
      operation,
      time: new Date().toISOString(),
      ...fields
    });
  }

  logSummary() {
    this.summary.elapsedMs = Math.round(performance.now() - this.startedAtMs);
    this.emit("pdf_extraction_summary", this.summary);
  }

  assertWithinLimits(operation) {
    const elapsedMs = performance.now() - this.startedAtMs;
    if (elapsedMs > maxExtractionMs) {
      throw extractionError(`PDF extraction exceeded ${maxExtractionMs}ms while ${operation}`);
    }
  }

  emitFinished(operation, startTime, startMs, fields) {
    const endTime = new Date();
    const elapsedMs = Math.round(performance.now() - startMs);
    this.emit("pdf_extraction_step_finished", {
      operation,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      elapsedMs,
      ...fields
    });
    if (elapsedMs > longStepMs) {
      this.emit("pdf_extraction_long_step", {
        operation,
        message: "Long-running extraction step...",
        elapsedMs
      });
    }
  }

  emit(event, fields) {
    this.logger?.info?.(event, {
      requestId: this.requestId,
      jobId: this.jobId,
      ...fields
    });
  }
}

function extractionError(message) {
  const error = new Error(message);
  error.code = "pdf_extraction_failed";
  error.statusCode = 422;
  return error;
}
