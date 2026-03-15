import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Layout, History, Settings, LogOut, Github } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Button from './Button'

export default function Navbar() {
  const { user, loginWithGitHub, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Layout },
    { name: 'History', path: '/history', icon: History },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                <span className="text-white font-bold">HF</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">HackFarmer</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                      isActive 
                        ? 'text-white bg-white/5' 
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-white/80 font-medium">{user.name}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Button 
                onClick={loginWithGitHub}
                variant="secondary" 
                size="sm"
                className="gap-2"
              >
                <Github size={18} />
                Sign in with GitHub
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
