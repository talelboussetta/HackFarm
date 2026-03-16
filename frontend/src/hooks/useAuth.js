import { account } from "../lib/appwrite";
import { log } from "../lib/logger";
import { useState, useEffect, useCallback } from "react";
import { OAuthProvider } from "appwrite";

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
      window.location.origin + "/",
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
    try {
      await account.deleteSession("current");
    } catch {
      // Session may already be expired
    }
    setUser(null);
  };

  /**
   * Get a fresh Appwrite JWT for backend API calls.
   * Throws if the session has expired — caller should handle and redirect to login.
   */
  const getJWT = useCallback(async () => {
    try {
      const jwt = await account.createJWT();
      return jwt.jwt;
    } catch (e) {
      // Session expired or createJWT failed — clear local user state
      log.warn("createJWT failed, session likely expired:", e?.message);
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
