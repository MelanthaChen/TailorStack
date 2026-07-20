import { queryJson, sql } from "./sql-utils.js";

export class InMemoryJobDescriptionRepository {
  constructor() {
    this.jobDescriptions = new Map();
  }

  async create({ userId, sourceUrl, model }) {
    const now = new Date().toISOString();
    const jobDescription = {
      id: crypto.randomUUID(),
      userId,
      company: model.company,
      position: model.jobTitle,
      location: model.location,
      employmentType: model.employmentType,
      seniority: model.seniority,
      salary: model.salary,
      rawText: model.rawText,
      rawTextHash: model.rawTextHash,
      sourceUrl,
      parseStatus: "succeeded",
      parseConfidence: model.parseConfidence,
      parsedMetadata: {
        normalizedSkills: model.normalizedSkills,
        inferredSkillGroups: model.inferredSkillGroups,
        yearsExperience: model.yearsExperience,
        education: model.education,
        certifications: model.certifications,
        responsibilities: model.responsibilities,
        benefits: model.benefits,
        technologies: model.technologies,
        programmingLanguages: model.programmingLanguages,
        frameworks: model.frameworks,
        cloudPlatforms: model.cloudPlatforms,
        tools: model.tools,
        softSkills: model.softSkills
      },
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.jobDescriptions.set(jobDescription.id, jobDescription);
    return jobDescription;
  }

  async findByHashForUser(rawTextHash, userId) {
    return [...this.jobDescriptions.values()].find((job) => {
      return job.userId === userId && job.rawTextHash === rawTextHash && !job.deletedAt;
    }) ?? null;
  }

  async findForUser(id, userId) {
    const job = this.jobDescriptions.get(id);
    return job && job.userId === userId && !job.deletedAt ? job : null;
  }

  async listForUser(userId) {
    return [...this.jobDescriptions.values()]
      .filter((job) => job.userId === userId && !job.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class PostgresJobDescriptionRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async create({ userId, sourceUrl, model }) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO job_descriptions (
        id, user_id, company, position, location, employment_type, seniority,
        salary, raw_text, raw_text_hash, source_url, parse_status, parse_confidence,
        parsed_metadata, created_at, updated_at
      )
      VALUES (
        ${sql(id)}, ${sql(userId)}, ${sql(model.company)}, ${sql(model.jobTitle)},
        ${sql(model.location)}, ${sql(model.employmentType)}, ${sql(model.seniority)},
        ${sql(model.salary)}::jsonb, ${sql(model.rawText)}, ${sql(model.rawTextHash)},
        ${sql(sourceUrl)}, 'succeeded', ${model.parseConfidence},
        ${sql({
          normalizedSkills: model.normalizedSkills,
          inferredSkillGroups: model.inferredSkillGroups,
          yearsExperience: model.yearsExperience,
          education: model.education,
          certifications: model.certifications,
          responsibilities: model.responsibilities,
          benefits: model.benefits,
          technologies: model.technologies,
          programmingLanguages: model.programmingLanguages,
          frameworks: model.frameworks,
          cloudPlatforms: model.cloudPlatforms,
          tools: model.tools,
          softSkills: model.softSkills
        })}::jsonb,
        ${sql(now)}, ${sql(now)}
      )
      RETURNING ${jobDescriptionJson()}
    `);
    return rows[0];
  }

  async findByHashForUser(rawTextHash, userId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${jobDescriptionJson()}
      FROM job_descriptions
      WHERE user_id = ${sql(userId)} AND raw_text_hash = ${sql(rawTextHash)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findForUser(id, userId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${jobDescriptionJson()}
      FROM job_descriptions
      WHERE id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async listForUser(userId) {
    return queryJson(this.databaseUrl, `
      SELECT ${jobDescriptionJson()}
      FROM job_descriptions
      WHERE user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY created_at DESC
    `);
  }
}

export function createJobDescriptionRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryJobDescriptionRepository();
  return new PostgresJobDescriptionRepository({ databaseUrl: config.databaseUrl });
}

function jobDescriptionJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'company', company, 'position', position,
    'location', location, 'employmentType', employment_type, 'seniority', seniority,
    'salary', salary, 'rawText', raw_text, 'rawTextHash', raw_text_hash,
    'sourceUrl', source_url, 'parseStatus', parse_status,
    'parseConfidence', parse_confidence, 'parsedMetadata', parsed_metadata,
    'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}
