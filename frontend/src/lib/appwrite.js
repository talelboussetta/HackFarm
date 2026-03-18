import { Client, Account, Databases, Storage } from 'appwrite'

const REQUIRED_APPWRITE_ENV_VARS = [
  'VITE_APPWRITE_ENDPOINT',
  'VITE_APPWRITE_PROJECT_ID',
  'VITE_APPWRITE_DATABASE_ID',
]

const missingVars = REQUIRED_APPWRITE_ENV_VARS.filter((key) => !import.meta.env[key])
if (missingVars.length > 0) {
  missingVars.forEach((key) => console.error(`[Appwrite init] Missing env var: ${key}`))
  console.error(
    `[Appwrite init] Missing required Appwrite env vars: ${missingVars.join(', ')}. Falling back to defaults.`,
  )
}

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1'
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '69b687b000219c573c47'

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)
export const appwriteClient = client
export { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID }
