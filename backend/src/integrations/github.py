"""
HackFarmer — GitHub REST API client.
Creates repos and pushes files via the Git Trees API (atomic commit).
"""

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
        """Create a new GitHub repo. Returns full_name (owner/name)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{API}/user/repos",
                headers=self.headers,
                json={
                    "name": name,
                    "description": description,
                    "private": private,
                    "auto_init": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"[GitHub] Created repo: {data['full_name']}")
            return data["full_name"]

    async def push_files(self, repo: str, files: dict[str, str], message: str) -> str:
        """
        Push all files in a single atomic commit using the Git Trees API.
        1. Create blobs for each file
        2. Create a tree referencing all blobs
        3. Create a commit pointing to the tree
        4. Create/update refs/heads/main to the commit
        Returns: commit SHA
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
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

            # 3. Create commit
            commit_resp = await client.post(
                f"{API}/repos/{repo}/git/commits",
                headers=self.headers,
                json={
                    "message": message,
                    "tree": tree_sha,
                },
            )
            commit_resp.raise_for_status()
            commit_sha = commit_resp.json()["sha"]

            # 4. Create refs/heads/main
            ref_resp = await client.post(
                f"{API}/repos/{repo}/git/refs",
                headers=self.headers,
                json={
                    "ref": "refs/heads/main",
                    "sha": commit_sha,
                },
            )
            ref_resp.raise_for_status()

            logger.info(f"[GitHub] Pushed {len(files)} files to {repo} ({commit_sha[:8]})")
            return commit_sha
