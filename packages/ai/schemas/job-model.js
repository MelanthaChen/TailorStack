export const knownSkillAliases = Object.freeze({
  "amazon web services": "Amazon Web Services",
  aws: "Amazon Web Services",
  ec2: "Amazon EC2",
  gcp: "Google Cloud Platform",
  "google cloud": "Google Cloud Platform",
  azure: "Microsoft Azure",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  reactjs: "React",
  "react.js": "React",
  react: "React",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  cicd: "CI/CD",
  "ci/cd": "CI/CD"
});

export const skillCategories = Object.freeze({
  programming_language: ["JavaScript", "TypeScript", "Python", "Java", "Go", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "SQL"],
  framework: ["React", "Angular", "Vue", "Next.js", "Express", "Django", "Flask", "Spring", "Rails", "Node.js"],
  cloud_platform: ["Amazon Web Services", "Google Cloud Platform", "Microsoft Azure"],
  database: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "SQLite"],
  tool: ["Docker", "Kubernetes", "Git", "Terraform", "Jenkins", "GitHub Actions", "CI/CD", "Linux", "GraphQL", "REST"],
  soft_skill: ["Communication", "Leadership", "Collaboration", "Mentorship", "Ownership", "Problem Solving"]
});

export function normalizeSkillName(value) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const alias = knownSkillAliases[cleaned.toLowerCase().replace(/[.\s-]/g, (match) => (match === "." ? "." : match)).trim()];
  if (alias) return alias;
  const compactAlias = knownSkillAliases[cleaned.toLowerCase().replace(/[^a-z0-9+#/]/g, "")];
  if (compactAlias) return compactAlias;
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\bSql\b/g, "SQL");
}

export function categoryForSkill(skill) {
  const normalized = normalizeSkillName(skill);
  for (const [category, values] of Object.entries(skillCategories)) {
    if (values.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
      return category;
    }
  }
  return "keyword";
}

export function relatedSkillsFor(skill) {
  const category = categoryForSkill(skill);
  if (category === "cloud_platform") return ["Cloud Infrastructure", "Distributed Systems"];
  if (category === "framework") return ["Frontend Architecture", "Backend Architecture"];
  if (category === "programming_language") return ["Software Engineering", "Code Quality"];
  if (category === "database") return ["Data Modeling", "Query Optimization"];
  if (category === "tool") return ["Developer Productivity", "Automation"];
  return [];
}
