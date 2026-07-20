import { errorResponse, successResponse } from "../../../../packages/schemas/src/index.js";

export function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
}

export function sendSuccess(res, statusCode, data, requestId) {
  sendJson(res, statusCode, successResponse(data, requestId));
}

export function sendError(res, statusCode, code, message, requestId, details) {
  sendJson(res, statusCode, errorResponse({ code, message, requestId, details }));
}
