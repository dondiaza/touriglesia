import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_VALUE,
  DEMO_PASSWORD,
  DEMO_SESSION_MAX_AGE,
  DEMO_USERNAME
} from "./constants";

export function isValidCredentials(username: string, password: string) {
  return username.trim() === DEMO_USERNAME && password.trim() === DEMO_PASSWORD;
}

export function setAuthCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}; path=/; max-age=${DEMO_SESSION_MAX_AGE}; samesite=lax`;
}

export function clearAuthCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
}
