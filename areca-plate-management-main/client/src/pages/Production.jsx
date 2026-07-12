import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Minus, Save, History, Factory } from 'lucide-react'

const Production = () => {
  const [plateSizes, setPlateSizes] = useState([])
  const [quantities, setQuantities] = useState({})
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchPlateSizes()
    fetchHistory()
  }, [])

  const fetchPlateSizes = async () => {
    try {
      const res = await axios.get('/api/plate-sizes')
      setPlateSizes(res.data)
      const initial = {}
      res.data.forEach(ps => initial[ps.id] = '')
      setQuantities(initial)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/production')
      setHistory(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleQuantityChange = (id, value) => {
    setQuantities(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty && parseInt(qty) > 0)
      .map(([plate_size_id, quantity]) => ({
        plate_size_id: parseInt(plate_size_id),
        quantity: parseInt(quantity)
      }))

    if (items.length === 0) {
      setMessage('Please enter at least one quantity')
      setLoading(false)
      return
    }

    try {
      await axios.post('/api/production', { date, items })
      setMessage('Production recorded successfully!')
      const reset = {}
      plateSizes.forEach(ps => reset[ps.id] = '')
      setQuantities(reset)
      fetchHistory()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save production')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Production Entry</h1>
        <p className="text-gray-500 dark:text-gray-400">Record daily plate manufacturing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-2">
          <div className="card">
            {message && (
              <div className={`p-3 mb-4 rounded-lg text-sm ${message.includes('success') ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Production Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {plateSizes.map(size => (
                  <div key={size.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {size.size} Plate
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(size.id, Math.max(0, (parseInt(quantities[size.id]) || 0) - 10))}
                        className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantities[size.id] || ''}
                        onChange={(e) => handleQuantityChange(size.id, e.target.value)}
                        className="input-field text-center"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(size.id, (parseInt(quantities[size.id]) || 0) + 10)}
                        className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Production'}
              </button>
            </form>
          </div>
        </div>

        {/* Recent History */}
        <div>
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Production</h3>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {history.slice(0, 20).map((record, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{record.size}</span>
                    <span className="text-sm font-bold text-primary-600">+{record.quantity}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{record.date}</p>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No records yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Production