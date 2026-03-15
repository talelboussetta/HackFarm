/**
 * Zustand global store.
 * Placeholder — will be implemented in Phase 2.
 */
import { create } from 'zustand';

const useAppStore = create((set) => ({
  user: null,
  currentJob: null,
  setUser: (user) => set({ user }),
  setCurrentJob: (job) => set({ currentJob: job }),
}));

export default useAppStore;
