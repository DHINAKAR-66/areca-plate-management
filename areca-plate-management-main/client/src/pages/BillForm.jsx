import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react'

const BillForm = () => {
  const [plateSizes, setPlateSizes] = useState([])
  const [stock, setStock] = useState({})
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [items, setItems] = useState([{ plate_size_id: '', quantity: '', price_per_unit: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sizesRes, stockRes] = await Promise.all([
        axios.get('/api/plate-sizes'),
        axios.get('/api/stock')
      ])
      setPlateSizes(sizesRes.data)
      const stockMap = {}
      stockRes.data.forEach(s => stockMap[s.id] = s.quantity)
      setStock(stockMap)
    } catch (err) {
      console.error(err)
    }
  }

  const addItem = () => {
    setItems([...items, { plate_size_id: '', quantity: '', price_per_unit: '' }])
  }

  const removeItem = (index) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    
    if (field === 'plate_size_id') {
      const selected = plateSizes.find(ps => ps.id === parseInt(value))
      if (selected) {
        newItems[index].price_per_unit = selected.price
      }
    }
    
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseInt(item.quantity) || 0
      const price = parseFloat(item.price_per_unit) || 0
      return sum + (qty * price)
    }, 0)
  }

  const getStockWarning = (item) => {
    if (!item.plate_size_id || !item.quantity) return null
    const available = stock[item.plate_size_id] || 0
    const requested = parseInt(item.quantity) || 0
    if (requested > available) {
      return `Only ${available} available`
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const validItems = items.filter(item => item.plate_size_id && item.quantity && item.price_per_unit)
    if (validItems.length === 0) {
      setError('Please add at least one item')
      setLoading(false)
      return
    }

    // Check stock
    for (const item of validItems) {
      const warning = getStockWarning(item)
      if (warning) {
        setError(warning)
        setLoading(false)
        return
      }
    }

    try {
      const res = await axios.post('/api/bills', {
        date,
        customer_name: customerName,
        customer_mobile: customerMobile,
        payment_method: paymentMethod,
        items: validItems.map(item => ({
          plate_size_id: parseInt(item.plate_size_id),
          quantity: parseInt(item.quantity),
          price_per_unit: parseFloat(item.price_per_unit)
        }))
      })
      navigate(`/sales/${res.data.bill_id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Bill</h1>
        <p className="text-gray-500 dark:text-gray-400">Generate a new customer invoice</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field">
                <option value="Cash">Cash</option>
                <option value="GPay / UPI">GPay / UPI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name (Optional)</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" placeholder="Enter customer name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number (Optional)</label>
              <input type="tel" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} className="input-field" placeholder="Enter mobile number" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Bill Items</h3>
            <button type="button" onClick={addItem} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const warning = getStockWarning(item)
              const selectedSize = plateSizes.find(ps => ps.id === parseInt(item.plate_size_id))
              const availableStock = selectedSize ? stock[selectedSize.id] || 0 : 0

              return (
                <div key={index} className={`p-4 rounded-lg border ${warning ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Plate Size</label>
                      <select
                        value={item.plate_size_id}
                        onChange={(e) => updateItem(index, 'plate_size_id', e.target.value)}
                        className="input-field text-sm"
                        required
                      >
                        <option value="">Select size</option>
                        {plateSizes.map(ps => (
                          <option key={ps.id} value={ps.id}>{ps.size} (Stock: {stock[ps.id] || 0})</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="input-field text-sm"
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Price/Unit (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price_per_unit}
                        onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                        className="input-field text-sm"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total</label>
                        <p className="text-sm font-bold text-gray-900 dark:text-white py-2">
                          ₹{((parseInt(item.quantity) || 0) * (parseFloat(item.price_per_unit) || 0)).toFixed(2)}
                        </p>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mb-0.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {warning && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {warning}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">₹{calculateTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xl font-bold text-gray-900 dark:text-white">Grand Total</span>
              <span className="text-2xl font-bold text-primary-600">₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/sales')} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Bill'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default BillForm