import { categoryForSkill, normalizeSkillName, relatedSkillsFor } from "../../../../packages/ai/schemas/job-model.js";
import { findKnownSkills } from "./job-normalizer.js";

export function buildResumeMatchProfile(sections) {
  const visibleSections = (sections ?? []).filter((section) => section.visibility !== "hidden");
  const evidenceItems = [];
  const allText = [];

  for (const section of visibleSections) {
    allText.push(section.title, section.sectionType);
    for (const entity of (section.entities ?? []).filter((item) => item.visibility !== "hidden")) {
      allText.push(entity.title, entity.organization, entity.location, entity.entityType);
      for (const bullet of (entity.bullets ?? []).filter((item) => item.visibility !== "hidden")) {
        allText.push(bullet.text, bullet.category);
        evidenceItems.push({
          section,
          entity,
          bullet,
          text: bullet.text,
          normalizedText: normalizeText(bullet.text),
          skills: findKnownSkills(bullet.text)
        });
      }
    }
  }

  const skills = findKnownSkills(allText.filter(Boolean).join("\n"));
  return {
    sections: visibleSections,
    evidenceItems,
    skills,
    skillSet: new Set(skills.map((skill) => skill.toLowerCase())),
    fullText: normalizeText(allText.filter(Boolean).join("\n"))
  };
}

export function normalizeMatchTerm(value) {
  return normalizeSkillName(value);
}

export function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9+#./ ]/g, " ").replace(/\s+/g, " ").trim();
}

export function relatedTermsFor(value) {
  return relatedSkillsFor(value).map(normalizeSkillName);
}

export function categoryForRequirement(requirement) {
  if (requirement.category && requirement.category !== "keyword") return requirement.category;
  return categoryForSkill(requirement.normalizedText ?? requirement.text);
}
