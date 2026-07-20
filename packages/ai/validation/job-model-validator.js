export function validateJobModel(model) {
  const errors = [];
  if (!model || typeof model !== "object") {
    throwInvalid(["Job model must be an object"]);
  }
  if (typeof model.rawText !== "string" || model.rawText.trim().length < 80) {
    errors.push("rawText must contain at least 80 characters");
  }
  validateArray(model.requirements, "requirements", errors, validateRequirement);
  validateArray(model.keywords, "keywords", errors, validateKeyword);
  rejectDuplicateNormalized(model.requirements ?? [], "requirements", "normalizedText", errors);
  rejectDuplicateNormalized(model.keywords ?? [], "keywords", "normalizedKeyword", errors);
  if (errors.length) throwInvalid(errors);
  return model;
}

function validateArray(value, path, errors, validator) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  value.forEach((item, index) => validator(item, `${path}[${index}]`, errors));
}

function validateRequirement(requirement, path, errors) {
  requireString(requirement.type, `${path}.type`, errors);
  requireString(requirement.text, `${path}.text`, errors);
  requireString(requirement.normalizedText, `${path}.normalizedText`, errors);
  requireString(requirement.category, `${path}.category`, errors);
  requireConfidence(requirement.confidence, `${path}.confidence`, errors);
}

function validateKeyword(keyword, path, errors) {
  requireString(keyword.keyword, `${path}.keyword`, errors);
  requireString(keyword.normalizedKeyword, `${path}.normalizedKeyword`, errors);
  requireString(keyword.source, `${path}.source`, errors);
  requireConfidence(keyword.confidence, `${path}.confidence`, errors);
}

function rejectDuplicateNormalized(items, path, field, errors) {
  const seen = new Set();
  for (const item of items) {
    const key = String(item?.[field] ?? "").trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) errors.push(`${path} contains duplicate normalized value: ${item[field]}`);
    seen.add(key);
  }
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
}

function requireConfidence(value, path, errors) {
  if (typeof value !== "number" || value < 0 || value > 1) {
    errors.push(`${path} must be a number between 0 and 1`);
  }
}

function throwInvalid(errors) {
  const error = new Error(`Job model failed schema validation: ${errors.join("; ")}`);
  error.code = "validation_error";
  error.statusCode = 422;
  error.details = { errors };
  throw error;
}
