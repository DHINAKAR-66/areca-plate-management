import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Plus, Search, Eye, Trash2, Edit2, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Sales = () => {
  const [bills, setBills] = useState([])
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    fetchBills()
  }, [search, dateFilter, paymentFilter, page])

  const fetchBills = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (dateFilter) params.append('date', dateFilter)
      if (paymentFilter) params.append('payment_method', paymentFilter)
      params.append('page', page)
      
      const res = await axios.get(`/api/bills?${params}`)
      setBills(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this bill? Stock will be restored.')) return
    try {
      await axios.delete(`/api/bills/${id}`)
      fetchBills()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete bill')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales & Billing</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage customer bills and invoices</p>
        </div>
        <Link to="/sales/new" className="btn-primary flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Create Bill
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search bills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="input-field"
          />
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="GPay / UPI">GPay / UPI</option>
          </select>
        </div>
      </div>

      {/* Bills List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Bill #</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Payment</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{bill.bill_number}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{bill.date}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{bill.customer_name || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${bill.payment_method === 'Cash' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {bill.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-gray-900 dark:text-white text-right">₹{bill.total}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <Link to={`/sales/${bill.id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-primary-600">
                        <Eye className="w-4 h-4" />
                      </Link>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(bill.id)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bills.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No bills found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={bills.length < 20}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default Sales