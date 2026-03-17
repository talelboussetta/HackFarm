/**
 * Fetch wrapper that sends Appwrite JWT for backend auth.
 * Throws a clear error on 401 so callers can redirect to login.
 */

const BASE_URL = "";

export async function api(path, options = {}, jwt = null) {
  if (!jwt && !options._noAuth) {
    // Caller got null/undefined JWT (session expired) — don't bother hitting the backend
    throw new Error("Session expired — please log in again");
  }

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (jwt) {
    headers["X-Appwrite-Session"] = jwt;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });

  if (res.status === 401) {
    throw new Error("Session expired — please log in again");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }

  return res.json();
}
