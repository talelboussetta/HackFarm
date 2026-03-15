import { account } from '../lib/appwrite'
import { useState, useEffect } from 'react'
import { OAuthProvider } from 'appwrite'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    account.get()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const loginWithGitHub = () => {
    account.createOAuth2Session(
      OAuthProvider.Github,
      window.location.origin + '/',
      window.location.origin + '/login-error'
    )
  }

  const logout = async () => {
    await account.deleteSession('current')
    setUser(null)
  }

  return { user, loading, loginWithGitHub, logout }
}
