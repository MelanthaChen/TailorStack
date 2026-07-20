import zlib from "node:zlib";

export class PdfExtractionService {
  extract(buffer) {
    const text = extractPdfText(buffer);
    const lines = text.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
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
        lineCount: lines.length
      }
    };
  }
}

function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const streamText = extractTextFromContentStreams(buffer, raw);
  if (streamText) return streamText;

  const literalStrings = extractTextOperators(raw);
  if (literalStrings) return literalStrings;

  const looseLiteralStrings = extractLooseLiteralStrings(raw);
  if (looseLiteralStrings) return looseLiteralStrings;

  return raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 1 && /[A-Za-z]/.test(line))
    .join("\n");
}

function extractLooseLiteralStrings(raw) {
  return normalizeExtractedText([...raw.matchAll(/\(([^()]*)\)/g)]
    .map((match) => unescapePdfString(match[1]).trim())
    .join("\n"));
}

function extractTextFromContentStreams(buffer, raw) {
  const chunks = [];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?/gs;
  let match;
  while ((match = streamPattern.exec(raw))) {
    const streamStart = Buffer.byteLength(raw.slice(0, streamPattern.lastIndex), "latin1");
    const endMarker = buffer.indexOf(Buffer.from("endstream", "latin1"), streamStart);
    if (endMarker === -1) continue;

    let streamBuffer = buffer.subarray(streamStart, endMarker);
    if (streamBuffer[0] === 0x0d && streamBuffer[1] === 0x0a) streamBuffer = streamBuffer.subarray(2);
    else if (streamBuffer[0] === 0x0a) streamBuffer = streamBuffer.subarray(1);
    if (streamBuffer.at(-2) === 0x0d && streamBuffer.at(-1) === 0x0a) streamBuffer = streamBuffer.subarray(0, -2);
    else if (streamBuffer.at(-1) === 0x0a || streamBuffer.at(-1) === 0x0d) streamBuffer = streamBuffer.subarray(0, -1);

    const dictionary = match[1];
    const content = decodePdfStream(streamBuffer, dictionary);
    const text = extractTextOperators(content);
    if (text) chunks.push(text);
  }
  return normalizeExtractedText(chunks.join("\n"));
}

function decodePdfStream(streamBuffer, dictionary) {
  if (/\/FlateDecode\b/.test(dictionary)) {
    try {
      return zlib.inflateSync(streamBuffer).toString("latin1");
    } catch {
      return "";
    }
  }
  return streamBuffer.toString("latin1");
}

function extractTextOperators(content) {
  const values = [];
  const tokenPattern = /(\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>|\[(?:\s*(?:\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>|-?\d+(?:\.\d+)?)\s*)+\])\s*(?:Tj|TJ|')|(\((?:\\.|[^\\()])*\))\s*"/g;
  for (const match of content.matchAll(tokenPattern)) {
    const token = match[1] ?? match[2];
    const text = decodeTextToken(token);
    if (text) values.push(text);
  }
  return normalizeExtractedText(values.join("\n"));
}

function decodeTextToken(token) {
  if (token.startsWith("[")) {
    return [...token.matchAll(/\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>/g)]
      .map((match) => decodeTextToken(match[0]))
      .join("");
  }
  if (token.startsWith("<")) return decodeHexString(token);
  if (token.startsWith("(")) return unescapePdfString(token.slice(1, -1));
  return "";
}

function decodeHexString(token) {
  const hex = token.slice(1, -1).replace(/\s+/g, "");
  if (!hex || hex.length % 2 !== 0) return "";
  const buffer = Buffer.from(hex, "hex");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return decodeUtf16Be(buffer.subarray(2));
  return buffer.toString("latin1");
}

function decodeUtf16Be(buffer) {
  const codeUnits = [];
  for (let offset = 0; offset + 1 < buffer.length; offset += 2) {
    codeUnits.push(buffer.readUInt16BE(offset));
  }
  return String.fromCharCode(...codeUnits);
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
