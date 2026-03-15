class LLMRouter:
    def __init__(self, user_id: str, job_id: str):
        self.user_id = user_id
        self.job_id = job_id
        # load keys and priority providers

    async def complete(self, prompt: str, schema: dict = None) -> dict:
        # unified completion logic
        return {}
