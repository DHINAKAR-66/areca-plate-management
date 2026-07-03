import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Package, Plus, Minus, History, AlertTriangle, Save, X } from 'lucide-react'

const Inventory = () => {
  const [stock, setStock] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [stockRes, historyRes] = await Promise.all([
        axios.get('/api/stock'),
        axios.get('/api/stock/history')
      ])
      setStock(stockRes.data)
      setHistory(historyRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdjust = async (e) => {
    e.preventDefault()
    if (!adjustQty || !adjustReason) return

    try {
      await axios.post('/api/stock/adjust', {
        plate_size_id: adjustModal.id,
        quantity_change: parseInt(adjustQty),
        reason: adjustReason
      })
      setMessage('Stock adjusted successfully')
      setAdjustModal(null)
      setAdjustQty('')
      setAdjustReason('')
      fetchData()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to adjust stock')
    }
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
        <p className="text-gray-500 dark:text-gray-400">Track and manage plate stock</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes('success') ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
          {message}
        </div>
      )}

      {/* Stock Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stock.map(item => (
          <div key={item.id} className={`card relative overflow-hidden ${item.quantity < 100 ? 'border-red-200 dark:border-red-800' : ''}`}>
            {item.quantity < 100 && (
              <div className="absolute top-2 right-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Package className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.size}</p>
                <p className={`text-2xl font-bold ${item.quantity < 100 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {item.quantity}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Price: ₹{item.price}/plate</p>
            <button
              onClick={() => setAdjustModal(item)}
              className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" /> Adjust Stock
            </button>
          </div>
        ))}
      </div>

      {/* Stock History */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Stock History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Size</th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Change</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Reason</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">By</th>
              </tr>
            </thead>
            <tbody>
              {history.map(record => (
                <tr key={record.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(record.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">{record.size}</td>
                  <td className={`py-2 px-3 text-sm text-right font-medium ${record.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {record.quantity_change > 0 ? '+' : ''}{record.quantity_change}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{record.reason}</td>
                  <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{record.username || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Adjust Stock - {adjustModal.size}</h3>
              <button onClick={() => setAdjustModal(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Current Stock: {adjustModal.quantity}</p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity Change (use - for decrease)
                </label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="input-field"
                  placeholder="e.g., 100 or -50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="input-field"
                  placeholder="Enter reason for adjustment"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory