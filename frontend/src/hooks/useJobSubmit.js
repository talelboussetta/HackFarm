import { useState, useCallback } from "react";

export function useJobSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(
    async ({ file, prompt, repoName, repoPrivate, retentionDays }) => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        if (file) formData.append("file", file);
        if (prompt) formData.append("prompt", prompt);
        formData.append("repo_name", repoName);
        formData.append("repo_private", String(repoPrivate));
        formData.append("retention_days", String(retentionDays));

        const res = await fetch("/api/jobs", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ detail: res.statusText }));
          throw new Error(data.detail || "Failed to create job");
        }

        return await res.json();
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { submit, loading, error };
}
