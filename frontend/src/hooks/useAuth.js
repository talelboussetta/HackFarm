import { account } from "../lib/appwrite";
import { log } from "../lib/logger";
import { useState, useEffect, useCallback } from "react";
import { OAuthProvider } from "appwrite";

// ── Module-level JWT cache (shared across ALL useAuth() instances) ──
// Prevents simultaneous createJWT() calls from hitting Appwrite rate limits.
let _cachedJWT = null;
let _jwtCreatedAt = 0;
let _jwtInflight = null; // deduplicate concurrent createJWT() calls
const JWT_TTL_MS = 10 * 60 * 1000; // reuse for 10 min (JWT expires at 15 min)

async function _getOrCreateJWT() {
  const now = Date.now();
  if (_cachedJWT && now - _jwtCreatedAt < JWT_TTL_MS) return _cachedJWT;
  // Deduplicate: if a createJWT call is already in flight, await it
  if (_jwtInflight) return _jwtInflight;
  _jwtInflight = account
    .createJWT()
    .then((r) => {
      _cachedJWT = r.jwt;
      _jwtCreatedAt = Date.now();
      _jwtInflight = null;
      return _cachedJWT;
    })
    .catch((e) => {
      _cachedJWT = null;
      _jwtCreatedAt = 0;
      _jwtInflight = null;
      throw e;
    });
  return _jwtInflight;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const u = await account.get();
      setUser(u);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const loginWithGitHub = () => {
    account.createOAuth2Session(
      OAuthProvider.Github,
      window.location.origin + "/app",
      window.location.origin + "/?auth=error",
      ["repo", "read:user", "user:email"],
    );
  };

  const loginWithEmail = async (email, password) => {
    setError(null);
    try {
      await account.createEmailPasswordSession(email, password);
      await fetchUser();
    } catch (e) {
      setError(e.message || "Login failed");
      throw e;
    }
  };

  const signupWithEmail = async (email, password, name) => {
    setError(null);
    try {
      await account.create("unique()", email, password, name);
      await account.createEmailPasswordSession(email, password);
      await fetchUser();
    } catch (e) {
      setError(e.message || "Signup failed");
      throw e;
    }
  };

  const logout = async () => {
    _cachedJWT = null;
    _jwtCreatedAt = 0;
    try {
      await account.deleteSession("current");
    } catch {
      // Session may already be expired
    }
    setUser(null);
  };

  /**
   * Get a cached Appwrite JWT for backend API calls.
   * Reuses the same JWT for up to 10 minutes to avoid rate limits.
   * Returns null if session is invalid — caller should redirect to login.
   */
  const getJWT = useCallback(async () => {
    try {
      return await _getOrCreateJWT();
    } catch (e) {
      log.warn("getJWT failed:", e?.message);
      setUser(null);
      return null;
    }
  }, []);

  return {
    user,
    loading,
    error,
    loginWithGitHub,
    loginWithEmail,
    signupWithEmail,
    logout,
    getJWT,
  };
}
