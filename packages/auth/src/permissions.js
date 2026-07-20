import { AuthError } from "./errors.js";

export function assertAuthenticated(context) {
  if (!context?.currentUser) {
    throw new AuthError("unauthenticated", "Authentication is required", 401);
  }
  return context.currentUser;
}

export function assertUserOwnsResource(currentUser, resource) {
  if (!currentUser) {
    throw new AuthError("unauthenticated", "Authentication is required", 401);
  }
  if (!resource || resource.userId !== currentUser.id) {
    throw new AuthError("unauthorized", "You do not have access to this resource", 403);
  }
  return true;
}
