import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Printer, Download, ArrowLeft, Edit2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const BillView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const billRef = useRef()

  useEffect(() => {
    fetchBill()
  }, [id])

  const fetchBill = async () => {
    try {
      const res = await axios.get(`/api/bills/${id}`)
      setBill(res.data)
      setEditData({
        customer_name: res.data.customer_name || '',
        customer_mobile: res.data.customer_mobile || '',
        payment_method: res.data.payment_method
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    const element = billRef.current
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`${bill.bill_number}.pdf`)
  }

  const handleUpdate = async () => {
    try {
      await axios.put(`/api/bills/${id}`, editData)
      setEditing(false)
      fetchBill()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Bill not found</p>
        <Link to="/sales" className="text-primary-600 hover:underline mt-2 inline-block">Back to Sales</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bill {bill.bill_number}</h1>
            <p className="text-gray-500 dark:text-gray-400">{bill.date}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Bill Content */}
      <div ref={billRef} className="card max-w-3xl mx-auto print:shadow-none print:border-none">
        <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ARECA PLATE MANUFACTURING</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tax Invoice / Bill</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Bill Number</p>
            <p className="font-bold text-gray-900 dark:text-white">{bill.bill_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
            <p className="font-bold text-gray-900 dark:text-white">{bill.date}</p>
          </div>
        </div>

        <div className="mb-6 no-print">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">Customer Name</label>
                <input
                  type="text"
                  value={editData.customer_name}
                  onChange={(e) => setEditData({...editData, customer_name: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Mobile</label>
                <input
                  type="text"
                  value={editData.customer_mobile}
                  onChange={(e) => setEditData({...editData, customer_mobile: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Payment Method</label>
                <select
                  value={editData.payment_method}
                  onChange={(e) => setEditData({...editData, payment_method: e.target.value})}
                  className="input-field"
                >
                  <option value="Cash">Cash</option>
                  <option value="GPay / UPI">GPay / UPI</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleUpdate} className="btn-primary flex items-center gap-2">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Customer: <span className="font-medium text-gray-900 dark:text-white">{bill.customer_name || 'Walk-in Customer'}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Mobile: <span className="font-medium text-gray-900 dark:text-white">{bill.customer_mobile || '-'}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Payment: <span className="font-medium text-gray-900 dark:text-white">{bill.payment_method}</span></p>
              </div>
              <button onClick={() => setEditing(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-primary-600">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Print-only customer info */}
        <div className="hidden print:block mb-6">
          <p className="text-sm"><strong>Customer:</strong> {bill.customer_name || 'Walk-in Customer'}</p>
          <p className="text-sm"><strong>Mobile:</strong> {bill.customer_mobile || '-'}</p>
          <p className="text-sm"><strong>Payment:</strong> {bill.payment_method}</p>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 text-sm font-medium">Item</th>
              <th className="text-right py-2 text-sm font-medium">Qty</th>
              <th className="text-right py-2 text-sm font-medium">Rate</th>
              <th className="text-right py-2 text-sm font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-sm">{item.size} Plate</td>
                <td className="py-2 text-sm text-right">{item.quantity}</td>
                <td className="py-2 text-sm text-right">₹{item.price_per_unit}</td>
                <td className="py-2 text-sm text-right font-medium">₹{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-bold text-gray-900 dark:text-white">₹{bill.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-2 text-xl">
            <span className="font-bold text-gray-900 dark:text-white">Grand Total</span>
            <span className="font-bold text-primary-600">₹{bill.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Thank you for your business!</p>
          <p className="mt-1">Generated by Areca Plate Management System</p>
        </div>
      </div>
    </div>
  )
}

export default BillView