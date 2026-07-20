import { resumeParsingPrompt } from "../prompts/resume-parsing.js";
import { validateParserOutput } from "../validation/resume-parser-output.js";

const sectionHeaders = new Map([
  ["experience", "experience"],
  ["work experience", "experience"],
  ["professional experience", "experience"],
  ["projects", "projects"],
  ["education", "education"],
  ["skills", "skills"],
  ["certifications", "certifications"],
  ["awards", "awards"]
]);

export class ResumeParserPipeline {
  constructor({ prompt = resumeParsingPrompt } = {}) {
    this.prompt = prompt;
  }

  async run({ extraction }) {
    return validateParserOutput(parseResumeText(extraction.text, extraction, this.prompt));
  }
}

export function createResumeParserPipeline(options = {}) {
  return new ResumeParserPipeline(options);
}

export function parseResumeText(text, extraction, prompt = resumeParsingPrompt) {
  const lines = normalizeResumeTextForParsing(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const groups = [];
  let current = null;

  for (const [index, line] of lines.entries()) {
    const type = sectionHeaders.get(normalizeHeader(line));
    if (type) {
      current = {
        sectionType: type,
        title: titleCase(type),
        sourceLine: index,
        lines: []
      };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = {
        sectionType: "summary",
        title: "Summary",
        sourceLine: index,
        lines: []
      };
      groups.push(current);
    }
    current.lines.push({ text: stripBullet(line), sourceLine: index });
  }

  const sections = groups
    .map((group) => groupToSection(group, extraction))
    .filter((section) => section.entities.length > 0);

  return {
    schemaVersion: 1,
    promptVersion: "resume-parse-v1",
    promptHash: String(prompt.length),
    sections,
    metadata: {
      parser: "local-structured-parser",
      source: "pdf_text_extraction"
    }
  };
}

export function normalizeResumeTextForParsing(text) {
  return String(text ?? "")
    .replace(/\0/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function groupToSection(group, extraction) {
  const bulletLines = group.lines.filter((line) => line.text);
  const confidence = confidenceForGroup(group, bulletLines);
  const entity = {
    entityType: entityTypeForSection(group.sectionType),
    title: inferEntityTitle(group, bulletLines),
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    datePrecision: null,
    isCurrent: false,
    url: null,
    confidence,
    metadata: {
      sourceLines: bulletLines.map((line) => line.sourceLine),
      extractionMetadata: extraction.metadata
    },
    bullets: bulletLines.map((line) => ({
      text: line.text,
      confidence: startsLikeBullet(line.text) ? Math.min(0.92, confidence + 0.08) : confidence,
      category: group.sectionType,
      priority: null,
      metadata: {
        sourceLine: line.sourceLine
      },
      truthConstraints: {
        mayRewrite: true,
        mayReorder: true,
        mayHide: true,
        mayAddTechnology: false,
        mayAddMetric: false,
        mayInferSeniority: false
      }
    }))
  };

  return {
    sectionType: group.sectionType,
    title: group.title,
    confidence,
    metadata: {
      sourceLine: group.sourceLine
    },
    entities: [entity]
  };
}

function confidenceForGroup(group, lines) {
  if (lines.length === 0) return 0.2;
  if (group.sectionType === "summary") return 0.55;
  return 0.82;
}

function inferEntityTitle(group, lines) {
  if (["skills", "education", "certifications", "awards", "summary"].includes(group.sectionType)) {
    return group.title;
  }
  const first = lines[0]?.text ?? null;
  return first && !startsLikeBullet(first) ? first : null;
}

function entityTypeForSection(sectionType) {
  if (sectionType === "projects") return "project";
  if (sectionType === "education") return "education";
  if (sectionType === "certifications") return "certification";
  if (sectionType === "awards") return "award";
  if (sectionType === "skills") return "skill_group";
  return "experience";
}

function stripBullet(line) {
  return line.replace(/^[-*•]\s*/, "").trim();
}

function startsLikeBullet(line) {
  return /^[-*•]/.test(line) || /^[A-Z][a-z]+ed\b/.test(line);
}

function normalizeHeader(line) {
  return line.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return value.split("_").join(" ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
