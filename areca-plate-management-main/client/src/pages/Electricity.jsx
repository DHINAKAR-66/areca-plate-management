import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Zap, Save, TrendingUp, Calendar, AlertTriangle, Pencil, X, Check } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const Electricity = () => {
  const [readings, setReadings] = useState([])
  const [summary, setSummary] = useState({ monthly: 0, yearly: 0 })
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [meterReading, setMeterReading] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  // Edit mode state
  const [editingId, setEditingId] = useState(null)
  const [editReading, setEditReading] = useState('')
  const [editDate, setEditDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [readingsRes, summaryRes] = await Promise.all([
        axios.get('/api/electricity'),
        axios.get('/api/electricity/summary')
      ])
      setReadings(readingsRes.data)
      setSummary(summaryRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await axios.post('/api/electricity', {
        date,
        meter_reading: parseFloat(meterReading)
      })
      setMessage(`Reading saved! Daily consumption: ${res.data.daily_consumption} units`)
      setMeterReading('')
      fetchData()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save reading')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (reading) => {
    setEditingId(reading.id)
    setEditDate(reading.date)
    setEditReading(reading.meter_reading)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDate('')
    setEditReading('')
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await axios.post('/api/electricity', {
        date: editDate,
        meter_reading: parseFloat(editReading)
      })
      setMessage(`Reading updated! Daily consumption: ${res.data.daily_consumption} units`)
      setEditingId(null)
      fetchData()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update reading')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this reading?')) return
    // Note: Backend delete endpoint would need to be added
    setMessage('Delete functionality requires backend update')
  }

  const chartData = [...readings].reverse().filter(r => r.daily_consumption > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Electricity Consumption</h1>
        <p className="text-gray-500 dark:text-gray-400">Track meter readings and usage</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Usage</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.monthly} units</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Yearly Usage</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.yearly} units</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Reading</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {readings[0]?.meter_reading || 0} units
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Enter Reading</h3>
          {message && (
            <div className={`p-3 mb-4 rounded-lg text-sm ${message.includes('saved') || message.includes('updated') ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meter Reading (Cumulative)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={meterReading}
                onChange={(e) => setMeterReading(e.target.value)}
                className="input-field"
                placeholder="Enter meter reading"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter the cumulative meter reading value</p>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Reading'}
            </button>
          </form>
        </div>

        {/* Chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Consumption Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Line type="monotone" dataKey="daily_consumption" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Readings Table */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Reading History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Meter Reading</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Daily Consumption</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {readings.map(reading => (
                <tr key={reading.id} className="border-b border-gray-100 dark:border-gray-800">
                  {editingId === reading.id ? (
                    <>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="input-field text-sm py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editReading}
                          onChange={(e) => setEditReading(e.target.value)}
                          className="input-field text-sm py-1 text-right"
                        />
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">-</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={handleUpdate} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">{reading.date}</td>
                      <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400 text-right">{reading.meter_reading}</td>
                      <td className={`py-2 px-3 text-sm text-right font-medium ${reading.daily_consumption > 500 ? 'text-red-600' : 'text-green-600'}`}>
                        {reading.daily_consumption} units
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => startEdit(reading)} 
                            className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {readings.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No readings recorded yet</p>
        )}
      </div>
    </div>
  )
}

export default Electricity