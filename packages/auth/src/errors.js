export class AuthError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "ValidationError";
    this.code = "validation_error";
    this.statusCode = 400;
    this.details = details;
  }
}
