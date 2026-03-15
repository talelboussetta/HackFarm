/**
 * Auth hook for JWT cookie state.
 * Placeholder — will be implemented in Phase 2.
 */
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me')
      .then(data => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
