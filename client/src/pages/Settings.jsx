import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { Users, Plus, Trash2, Save, Database, Download, Upload, Moon, Sun, Settings as SettingsIcon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const Settings = () => {
  const { user } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [users, setUsers] = useState([])
  const [backups, setBackups] = useState([])
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'staff' })
  const [plateSizes, setPlateSizes] = useState([])
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers()
      fetchBackups()
    }
    fetchPlateSizes()
  }, [user])

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users')
      setUsers(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchBackups = async () => {
    try {
      const res = await axios.get('/api/backups')
      setBackups(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchPlateSizes = async () => {
    try {
      const res = await axios.get('/api/plate-sizes')
      setPlateSizes(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/users', newUser)
      setMessage('User created successfully')
      setNewUser({ username: '', password: '', role: 'staff' })
      fetchUsers()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to create user')
    }
  }

  const handleBackup = async () => {
    try {
      const res = await axios.post('/api/backup')
      setMessage(res.data.message)
      fetchBackups()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to create backup')
    }
  }

  const handleRestore = async (filename) => {
    if (!confirm('Are you sure? This will replace all current data.')) return
    try {
      const res = await axios.post(`/api/restore/${filename}`)
      setMessage(res.data.message)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to restore backup')
    }
  }

  const handlePriceUpdate = async (id, price) => {
    try {
      await axios.put(`/api/plate-sizes/${id}`, { price: parseFloat(price) })
      setMessage('Price updated')
      fetchPlateSizes()
    } catch (err) {
      setMessage('Failed to update price')
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    ...(user?.role === 'admin' ? [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'backup', label: 'Backup', icon: Database }
    ] : [])
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage application settings</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes('success') || message.includes('created') || message.includes('updated') ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-5 h-5 text-primary-600" /> : <Sun className="w-5 h-5 text-yellow-500" />}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{darkMode ? 'Dark Mode' : 'Light Mode'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark theme</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Plate Prices</h3>
            <div className="space-y-3">
              {plateSizes.map(size => (
                <div key={size.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="font-medium text-gray-900 dark:text-white">{size.size} Plate</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={size.price}
                      onBlur={(e) => handlePriceUpdate(size.id, e.target.value)}
                      className="input-field w-24 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && user?.role === 'admin' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Create New User</h3>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                className="input-field"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="input-field"
                required
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                className="input-field"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="btn-primary flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Create User
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">All Users</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Username</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Role</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">{u.username}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && user?.role === 'admin' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Backup & Restore</h3>
            <div className="flex gap-3 mb-6">
              <button onClick={handleBackup} className="btn-primary flex items-center gap-2">
                <Download className="w-4 h-4" /> Create Backup
              </button>
            </div>

            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Available Backups</h4>
            <div className="space-y-2">
              {backups.map(backup => (
                <div key={backup.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{backup.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(backup.date).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(backup.name)}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <Upload className="w-3 h-3" /> Restore
                  </button>
                </div>
              ))}
              {backups.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No backups available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings