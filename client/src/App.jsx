import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Production from './pages/Production'
import Sales from './pages/Sales'
import BillForm from './pages/BillForm'
import BillView from './pages/BillView'
import Inventory from './pages/Inventory'
import Electricity from './pages/Electricity'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ActivityLog from './pages/ActivityLog'

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/production" element={<Production />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/new" element={<BillForm />} />
                <Route path="/sales/:id" element={<BillView />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/electricity" element={<Electricity />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/activities" element={<ActivityLog />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App