import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Download, FileText, Calendar, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const Reports = () => {
  const [reportType, setReportType] = useState('daily')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6']

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('type', reportType)
      if (startDate && endDate) {
        params.append('startDate', startDate)
        params.append('endDate', endDate)
      }
      const res = await axios.get(`/api/reports?${params}`)
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  const exportToCSV = () => {
    if (!data) return
    
    let csv = 'Report Type,' + reportType + '\n\n'
    csv += 'Production\nDate,Size,Quantity\n'
    data.production.forEach(p => {
      csv += `${p.date},${p.plate_size_id},${p.total}\n`
    })
    csv += '\nSales\nDate,Total,Bill Count\n'
    data.sales.forEach(s => {
      csv += `${s.date},${s.total},${s.bill_count}\n`
    })
    csv += '\nPayment Methods\nMethod,Total\n'
    data.paymentMethods.forEach(p => {
      csv += `${p.payment_method},${p.total}\n`
    })
    csv += '\nStock\nSize,Quantity\n'
    data.stock.forEach(s => {
      csv += `${s.size},${s.quantity}\n`
    })
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400">Generate business reports</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="input-field">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" placeholder="Start Date" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" placeholder="End Date" />
          <div className="flex gap-2">
            <button onClick={fetchReport} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" /> Generate
            </button>
            <button onClick={exportToCSV} className="btn-secondary flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Production</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.production.reduce((sum, p) => sum + p.total, 0)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₹{data.sales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.sales.reduce((sum, s) => sum + s.bill_count, 0)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Electricity Used</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.electricity.reduce((sum, e) => sum + e.daily_consumption, 0)} units
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Sales by Date</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.paymentMethods}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="total"
                    nameKey="payment_method"
                    label={({ payment_method, percent }) => `${payment_method} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.paymentMethods.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stock Table */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Current Stock Status</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Plate Size</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock.map(s => (
                    <tr key={s.size} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">{s.size}</td>
                      <td className={`py-2 px-3 text-sm text-right font-bold ${s.quantity < 100 ? 'text-red-600' : 'text-green-600'}`}>
                        {s.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Reports