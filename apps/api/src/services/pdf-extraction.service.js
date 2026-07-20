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
  const literalStrings = [...raw.matchAll(/\(([^()]*)\)/g)]
    .map((match) => unescapePdfString(match[1]).trim())
    .filter((value) => value.length > 1 && /[A-Za-z]/.test(value));
  if (literalStrings.length) {
    return literalStrings.join("\n");
  }

  return raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 1 && /[A-Za-z]/.test(line))
    .join("\n");
}

function unescapePdfString(value) {
  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\n")
    .replaceAll("\\t", " ")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\\\", "\\");
}
