export function validateDisplayOrders(items, label) {
  const orders = items.map((item) => item.displayOrder);
  const unique = new Set(orders);
  if (unique.size !== orders.length) {
    throwValidation(`${label} contains duplicate display_order values`);
  }
  if (orders.some((order) => !Number.isInteger(order) || order < 0)) {
    throwValidation(`${label} contains invalid display_order values`);
  }
}

export function validateOrderedIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throwValidation("Ordered IDs must be a non-empty array");
  }
  if (new Set(ids).size !== ids.length) {
    throwValidation("Ordered IDs must not contain duplicates");
  }
}

export function validateVisibility(visibility) {
  if (!["visible", "hidden"].includes(visibility)) {
    throwValidation("Visibility must be visible or hidden");
  }
}

export function validateCanonicalResume(resume) {
  if (!resume) throwNotFound("Resume not found");
  if (resume.status !== "active" || !resume.canonicalVersionId) {
    throwValidation("Resume must be active and canonical before editing");
  }
}

export function throwValidation(message, details = undefined) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  error.details = details;
  throw error;
}

export function throwNotFound(message) {
  const error = new Error(message);
  error.code = "not_found";
  error.statusCode = 404;
  throw error;
}
