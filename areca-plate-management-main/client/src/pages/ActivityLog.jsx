import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { ClipboardList, Clock } from 'lucide-react'

const ActivityLog = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    try {
      const res = await axios.get('/api/activities')
      setActivities(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action) => {
    if (action.includes('Bill')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    if (action.includes('Production')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    if (action.includes('Stock')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    if (action.includes('Login')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    if (action.includes('Delete')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Log</h1>
        <p className="text-gray-500 dark:text-gray-400">Track all system activities</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activities</h3>
        </div>

        <div className="space-y-3">
          {activities.map(activity => (
            <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getActionColor(activity.action)}`}>
                {activity.action}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">{activity.details}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{activity.username || 'System'}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No activities recorded yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActivityLog