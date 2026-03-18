import { Client, Account, Databases, Storage } from 'appwrite'

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
