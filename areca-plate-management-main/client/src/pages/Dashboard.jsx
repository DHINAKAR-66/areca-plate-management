import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  Factory,
  ShoppingCart,
  Zap,
  TrendingUp,
  Banknote,
  Smartphone,
  AlertTriangle,
  Plus,
  ArrowRight
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'

const StatCard = ({ title, value, icon: Icon, color, subtitle, link }) => (
  <div className="card hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    {link && (
      <Link to={link} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-3">
        View details <ArrowRight className="w-4 h-4" />
      </Link>
    )}
  </div>
)

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [charts, setCharts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    fetchCharts()
  }, [])

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/dashboard')
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCharts = async () => {
    try {
      const res = await axios.get('/api/dashboard/charts?range=7days')
      setCharts(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const getTodayProduction = () => {
    if (!data?.todayProduction) return 0
    return data.todayProduction.reduce((sum, p) => sum + Number(p.total), 0)
  }

  const getTodaySalesQty = () => {
    if (!data?.todaySales) return 0
    return data.todaySales.reduce((sum, s) => sum + Number(s.total_qty), 0)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Overview of your business</p>
        </div>
        <div className="flex gap-2">
          <Link to="/production" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Production
          </Link>
          <Link to="/sales/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Bill
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Production"
          value={getTodayProduction()}
          icon={Factory}
          color="bg-blue-500"
          subtitle="Total plates manufactured"
          link="/production"
        />
        <StatCard
          title="Today's Sales"
          value={`₹${data?.todaySalesAmount || 0}`}
          icon={ShoppingCart}
          color="bg-green-500"
          subtitle={`${getTodaySalesQty()} plates sold`}
          link="/sales"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${data?.totalRevenue || 0}`}
          icon={TrendingUp}
          color="bg-purple-500"
          subtitle="Lifetime revenue"
        />
        <StatCard
          title="Electricity Today"
          value={`${data?.todayElectricity || 0} units`}
          icon={Zap}
          color="bg-yellow-500"
          subtitle="Daily consumption"
          link="/electricity"
        />
      </div>

      {/* Payment Methods & Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Today's Payments</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Banknote className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">Cash</span>
              </div>
              <span className="font-bold text-green-600">₹{data?.todayCash || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium">GPay / UPI</span>
              </div>
              <span className="font-bold text-blue-600">₹{data?.todayUPI || 0}</span>
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Current Stock</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data?.stock?.map(item => (
              <div key={item.id} className={`p-3 rounded-lg border ${item.quantity < 100 ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.size}</p>
                <p className={`text-xl font-bold ${item.quantity < 100 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {item.quantity}
                </p>
                {item.quantity < 100 && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <span className="text-xs text-red-500">Low</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Production (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.production}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Sales Trend (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={charts.sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Sales</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Electricity Consumption</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={charts.electricity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Line type="monotone" dataKey="daily_consumption" stroke="#eab308" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Activities */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activities</h3>
        <div className="space-y-3">
          {data?.recentActivities?.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activities</p>
          )}
          {data?.recentActivities?.map(activity => (
            <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary-500"></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{activity.action}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activity.details}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(activity.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard