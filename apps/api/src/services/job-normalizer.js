import { categoryForSkill, normalizeSkillName } from "../../../../packages/ai/schemas/job-model.js";

export const knownSkills = Object.freeze([
  "JavaScript",
  "JS",
  "TypeScript",
  "TS",
  "Python",
  "Java",
  "Go",
  "C++",
  "C#",
  "SQL",
  "React",
  "Angular",
  "Vue",
  "Next.js",
  "Node.js",
  "Node",
  "Express",
  "Django",
  "Flask",
  "Spring",
  "Amazon Web Services",
  "AWS",
  "Google Cloud Platform",
  "GCP",
  "Azure",
  "Microsoft Azure",
  "PostgreSQL",
  "Postgres",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "K8s",
  "Terraform",
  "Git",
  "GraphQL",
  "REST",
  "CI/CD",
  "Linux",
  "Communication",
  "Leadership",
  "Collaboration",
  "Mentorship",
  "Ownership",
  "Problem Solving"
]);

export function normalizeJobSkill(value) {
  return normalizeSkillName(value);
}

export function normalizeRequirementText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function classifySkill(value) {
  return categoryForSkill(normalizeJobSkill(value));
}

export function dedupeNormalized(values) {
  return [...new Map((values ?? [])
    .map((value) => normalizeJobSkill(value))
    .filter(Boolean)
    .map((value) => [value.toLowerCase(), value])).values()];
}

export function findKnownSkills(text) {
  const found = [];
  const source = ` ${String(text ?? "").toLowerCase()} `;
  for (const skill of knownSkills) {
    const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(skill.toLowerCase())}(?=$|[^a-z0-9+#.])`, "i");
    if (pattern.test(source)) found.push(normalizeJobSkill(skill));
  }
  return dedupeNormalized(found);
}

export function skillBuckets(skills) {
  const buckets = {
    technologies: [],
    programmingLanguages: [],
    frameworks: [],
    cloudPlatforms: [],
    tools: [],
    softSkills: []
  };
  for (const skill of dedupeNormalized(skills)) {
    const category = classifySkill(skill);
    if (category === "programming_language") buckets.programmingLanguages.push(skill);
    else if (category === "framework") buckets.frameworks.push(skill);
    else if (category === "cloud_platform") buckets.cloudPlatforms.push(skill);
    else if (category === "tool" || category === "database") buckets.tools.push(skill);
    else if (category === "soft_skill") buckets.softSkills.push(skill);
    else buckets.technologies.push(skill);
  }
  buckets.technologies = dedupeNormalized([
    ...buckets.technologies,
    ...buckets.programmingLanguages,
    ...buckets.frameworks,
    ...buckets.cloudPlatforms,
    ...buckets.tools
  ]);
  return buckets;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
