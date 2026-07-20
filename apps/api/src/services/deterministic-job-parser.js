import { createHash } from "node:crypto";
import {
  dedupeNormalized,
  findKnownSkills,
  normalizeJobSkill,
  normalizeRequirementText,
  skillBuckets
} from "./job-normalizer.js";

const sectionAliases = new Map([
  ["requirements", "required"],
  ["required qualifications", "required"],
  ["minimum qualifications", "required"],
  ["what you need", "required"],
  ["preferred qualifications", "preferred"],
  ["nice to have", "preferred"],
  ["responsibilities", "responsibilities"],
  ["what you will do", "responsibilities"],
  ["about the role", "responsibilities"],
  ["benefits", "benefits"],
  ["perks", "benefits"],
  ["compensation", "benefits"],
  ["education", "education"],
  ["certifications", "certifications"]
]);

export class DeterministicJobParser {
  parse(rawText) {
    const text = String(rawText ?? "").replace(/\r\n/g, "\n").trim();
    if (!text) throwValidation("Job description cannot be empty");
    if (text.length < 80) throwValidation("Job description is too short to parse");

    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const sections = collectSections(lines);
    const allSkills = findKnownSkills(text);
    const requiredSkills = dedupeNormalized([
      ...findKnownSkills(sectionText(sections.required)),
      ...skillsNear(text, ["required", "must have", "minimum", "need"])
    ]);
    const preferredSkills = dedupeNormalized([
      ...findKnownSkills(sectionText(sections.preferred)),
      ...skillsNear(text, ["preferred", "nice to have", "bonus"])
    ]).filter((skill) => !requiredSkills.some((required) => required.toLowerCase() === skill.toLowerCase()));
    const buckets = skillBuckets(allSkills);

    return {
      rawText: text,
      rawTextHash: sha256(text),
      company: extractField(lines, ["company", "organization"]) ?? inferCompany(lines),
      jobTitle: extractField(lines, ["job title", "title", "role", "position"]) ?? inferTitle(lines),
      employmentType: extractEmploymentType(text),
      location: extractField(lines, ["location"]) ?? extractLocation(text),
      salary: extractSalary(text),
      seniority: extractSeniority(text),
      requiredSkills,
      preferredSkills,
      yearsExperience: extractYearsExperience(text),
      education: extractEducation(text, sections),
      certifications: extractCertifications(text, sections),
      responsibilities: extractBullets(sections.responsibilities),
      benefits: extractBullets(sections.benefits),
      keywords: extractKeywords(text, allSkills),
      ...buckets,
      parseConfidence: calculateConfidence({ text, requiredSkills, lines })
    };
  }
}

function collectSections(lines) {
  const sections = {};
  let current = "summary";
  for (const line of lines) {
    const header = normalizeHeader(line);
    if (sectionAliases.has(header)) {
      current = sectionAliases.get(header);
      sections[current] = sections[current] ?? [];
      continue;
    }
    sections[current] = sections[current] ?? [];
    sections[current].push(stripBullet(line));
  }
  return sections;
}

function extractField(lines, labels) {
  for (const line of lines.slice(0, 12)) {
    for (const label of labels) {
      const match = new RegExp(`^${label}\\s*:\\s*(.+)$`, "i").exec(line);
      if (match) return match[1].trim();
    }
  }
  return null;
}

function inferCompany(lines) {
  const first = lines[0] ?? "";
  if (/engineer|developer|intern|manager|architect/i.test(first)) return null;
  return first.length <= 80 ? first : null;
}

function inferTitle(lines) {
  return lines.find((line) => /engineer|developer|intern|architect|manager|programmer/i.test(line) && line.length <= 120) ?? null;
}

function extractEmploymentType(text) {
  if (/\bintern(ship)?\b/i.test(text)) return "internship";
  if (/\bcontract(or)?\b/i.test(text)) return "contract";
  if (/\bpart[- ]time\b/i.test(text)) return "part_time";
  if (/\bfull[- ]time\b/i.test(text)) return "full_time";
  return null;
}

function extractLocation(text) {
  const match = /\b(remote|hybrid|onsite|on-site)\b(?:\s+in\s+([A-Z][A-Za-z .,-]+))?/i.exec(text);
  if (!match) return null;
  return match[2] ? `${match[1]} - ${match[2].trim()}` : match[1];
}

function extractSalary(text) {
  const match = /\$([0-9][0-9,]{1,})(?:\s?-\s?\$?([0-9][0-9,]{1,}))?/i.exec(text);
  if (!match) return null;
  return {
    min: Number(match[1].replace(/,/g, "")),
    max: match[2] ? Number(match[2].replace(/,/g, "")) : null,
    currency: "USD",
    raw: match[0]
  };
}

function extractSeniority(text) {
  if (/\bstaff\b/i.test(text)) return "staff";
  if (/\bsenior|sr\.\b/i.test(text)) return "senior";
  if (/\bnew grad|entry[- ]level|junior\b/i.test(text)) return "junior";
  if (/\bintern(ship)?\b/i.test(text)) return "intern";
  return null;
}

function extractYearsExperience(text) {
  const match = /(\d+)\+?\s*(?:years|yrs)(?:\s+of)?\s+experience/i.exec(text);
  return match ? Number(match[1]) : null;
}

function extractEducation(text, sections) {
  const values = [
    ...extractBullets(sections.education),
    ...Array.from(text.matchAll(/(?:Bachelor|Master|PhD|B\.S\.|M\.S\.|degree)[^.。\n]*/gi)).map((match) => match[0].trim())
  ];
  return dedupeText(values);
}

function extractCertifications(text, sections) {
  const values = [
    ...extractBullets(sections.certifications),
    ...Array.from(text.matchAll(/(?:AWS Certified|certification|certified)[^.。\n]*/gi)).map((match) => match[0].trim())
  ];
  return dedupeText(values);
}

function extractKeywords(text, skills) {
  const keywordMatches = Array.from(text.matchAll(/\b(api|backend|frontend|distributed systems|microservices|scalability|testing|agile|security)\b/gi))
    .map((match) => normalizeRequirementText(match[0]));
  return dedupeText([...skills, ...keywordMatches].map(normalizeJobSkill));
}

function skillsNear(text, hints) {
  const sentences = text.split(/[.\n]/).filter((line) => hints.some((hint) => line.toLowerCase().includes(hint)));
  return dedupeNormalized(sentences.flatMap(findKnownSkills));
}

function extractBullets(lines = []) {
  return dedupeText(lines.map(stripBullet).filter((line) => line.length > 8));
}

function sectionText(lines = []) {
  return lines.join("\n");
}

function normalizeHeader(line) {
  return line.toLowerCase().replace(/[:：]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}

function stripBullet(line) {
  return String(line ?? "").replace(/^[-*•]\s*/, "").trim();
}

function dedupeText(values) {
  return [...new Map(values.filter(Boolean).map((value) => [normalizeRequirementText(value).toLowerCase(), normalizeRequirementText(value)])).values()];
}

function calculateConfidence({ text, requiredSkills, lines }) {
  let confidence = 0.45;
  if (lines.length >= 8) confidence += 0.15;
  if (requiredSkills.length > 0) confidence += 0.2;
  if (/requirements|responsibilities|qualifications/i.test(text)) confidence += 0.12;
  return Math.min(0.92, confidence);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function throwValidation(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}
