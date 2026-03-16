"""
HackFarmer — GitHub REST API client.
Creates repos and pushes files via the Git Trees API (atomic commit).
"""

import asyncio
import base64
import logging

import httpx

logger = logging.getLogger(__name__)

API = "https://api.github.com"


class GitHubClient:
    def __init__(self, token: str, username: str):
        self.token = token
        self.username = username
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def create_repo(self, name: str, description: str, private: bool) -> str:
        """Create a new GitHub repo (auto-initialized). Returns full_name (owner/name)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Validate token first
            user_resp = await client.get(
                f"{API}/user",
                headers=self.headers,
            )
            if user_resp.status_code == 401:
                raise ValueError(
                    "GitHub token is invalid or expired — user must re-authenticate "
                    "with GitHub OAuth."
                )
            if user_resp.status_code == 403:
                raise ValueError(
                    "GitHub token lacks required permissions — ensure the OAuth app "
                    "requests the 'repo' scope."
                )
            user_resp.raise_for_status()

            resp = await client.post(
                f"{API}/user/repos",
                headers=self.headers,
                json={
                    "name": name,
                    "description": description,
                    "private": private,
                    "auto_init": True,
                },
            )
            if resp.status_code == 404:
                raise ValueError(
                    "Cannot create repo — GitHub token lacks 'repo' scope. "
                    "Re-authenticate with GitHub to grant repository access."
                )
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"[GitHub] Created repo: {data['full_name']}")
            return data["full_name"]

    async def push_files(self, repo: str, files: dict[str, str], message: str) -> str:
        """
        Push all files in a single atomic commit using the Git Trees API.
        1. Get the current HEAD commit SHA (from auto_init)
        2. Create blobs for each file
        3. Create a tree referencing all blobs
        4. Create a commit with the HEAD as parent
        5. Update refs/heads/main to the new commit
        Returns: commit SHA
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            # 0. Wait briefly for GitHub to finish initializing the repo
            parent_sha = None
            for attempt in range(5):
                ref_resp = await client.get(
                    f"{API}/repos/{repo}/git/ref/heads/main",
                    headers=self.headers,
                )
                if ref_resp.status_code == 200:
                    parent_sha = ref_resp.json()["object"]["sha"]
                    break
                await asyncio.sleep(1)

            # 1. Create blobs
            tree_items = []
            for path, content in files.items():
                blob_resp = await client.post(
                    f"{API}/repos/{repo}/git/blobs",
                    headers=self.headers,
                    json={
                        "content": base64.b64encode(content.encode()).decode(),
                        "encoding": "base64",
                    },
                )
                blob_resp.raise_for_status()
                blob_sha = blob_resp.json()["sha"]
                tree_items.append({
                    "path": path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_sha,
                })

            # 2. Create tree
            tree_resp = await client.post(
                f"{API}/repos/{repo}/git/trees",
                headers=self.headers,
                json={"tree": tree_items},
            )
            tree_resp.raise_for_status()
            tree_sha = tree_resp.json()["sha"]

            # 3. Create commit (with parent if repo was initialized)
            commit_payload = {
                "message": message,
                "tree": tree_sha,
            }
            if parent_sha:
                commit_payload["parents"] = [parent_sha]

            commit_resp = await client.post(
                f"{API}/repos/{repo}/git/commits",
                headers=self.headers,
                json=commit_payload,
            )
            commit_resp.raise_for_status()
            commit_sha = commit_resp.json()["sha"]

            # 4. Update refs/heads/main (update existing ref from auto_init)
            if parent_sha:
                ref_resp = await client.patch(
                    f"{API}/repos/{repo}/git/refs/heads/main",
                    headers=self.headers,
                    json={"sha": commit_sha, "force": True},
                )
            else:
                ref_resp = await client.post(
                    f"{API}/repos/{repo}/git/refs",
                    headers=self.headers,
                    json={"ref": "refs/heads/main", "sha": commit_sha},
                )
            ref_resp.raise_for_status()

            logger.info(f"[GitHub] Pushed {len(files)} files to {repo} ({commit_sha[:8]})")
            return commit_sha
