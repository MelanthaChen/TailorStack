export function validateParserOutput(output) {
  const errors = [];
  if (!output || typeof output !== "object") {
    throwInvalid(["Parser output must be an object"]);
  }
  if (!Array.isArray(output.sections)) {
    errors.push("sections must be an array");
  } else {
    output.sections.forEach((section, sectionIndex) => validateSection(section, sectionIndex, errors));
  }
  if (errors.length) throwInvalid(errors);
  return output;
}

function validateSection(section, sectionIndex, errors) {
  requireString(section.sectionType, `sections[${sectionIndex}].sectionType`, errors);
  requireString(section.title, `sections[${sectionIndex}].title`, errors);
  requireConfidence(section.confidence, `sections[${sectionIndex}].confidence`, errors);
  if (!Array.isArray(section.entities)) {
    errors.push(`sections[${sectionIndex}].entities must be an array`);
    return;
  }
  section.entities.forEach((entity, entityIndex) => {
    validateEntity(entity, sectionIndex, entityIndex, errors);
  });
}

function validateEntity(entity, sectionIndex, entityIndex, errors) {
  const path = `sections[${sectionIndex}].entities[${entityIndex}]`;
  requireString(entity.entityType, `${path}.entityType`, errors);
  requireConfidence(entity.confidence, `${path}.confidence`, errors);
  if (entity.title !== null && entity.title !== undefined && typeof entity.title !== "string") {
    errors.push(`${path}.title must be string or null`);
  }
  if (!Array.isArray(entity.bullets)) {
    errors.push(`${path}.bullets must be an array`);
    return;
  }
  entity.bullets.forEach((bullet, bulletIndex) => {
    validateBullet(bullet, `${path}.bullets[${bulletIndex}]`, errors);
  });
}

function validateBullet(bullet, path, errors) {
  requireString(bullet.text, `${path}.text`, errors);
  requireConfidence(bullet.confidence, `${path}.confidence`, errors);
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireConfidence(value, path, errors) {
  if (typeof value !== "number" || value < 0 || value > 1) {
    errors.push(`${path} must be a number between 0 and 1`);
  }
}

function throwInvalid(errors) {
  const error = new Error("Parser output failed schema validation");
  error.code = "validation_error";
  error.statusCode = 422;
  error.details = { errors };
  throw error;
}
