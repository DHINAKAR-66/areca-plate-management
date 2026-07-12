# Areca Plate Manufacturing Management System

A complete full-stack web application for managing Areca Plate manufacturing business. Built with React, Tailwind CSS, Node.js, Express, and SQLite.

## Features

- **Dashboard** - Real-time business overview with charts and statistics
- **Production Management** - Daily production entry with automatic stock updates
- **Sales & Billing** - Create bills, print invoices, manage payments (Cash/UPI)
- **Inventory Management** - Track stock levels, adjust stock, view history
- **Electricity Tracking** - Meter reading entry with automatic consumption calculation
- **Reports** - Daily/weekly/monthly/yearly reports with export to CSV
- **User Management** - Admin and Staff roles with JWT authentication
- **Backup & Restore** - Database backup and restore functionality
- **Dark/Light Mode** - Theme switching support
- **Mobile Responsive** - Works on phones, tablets, and desktops

## Default Login Credentials

- **Admin**: username `admin`, password `admin123`
- **Staff**: username `staff`, password `staff123`

## Quick Start

### Install Dependencies
```bash
npm run install:all
```

### Run Development (Both Frontend & Backend)
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Run Production Build
```bash
npm run build
npm start
```

## Technology Stack

- **Frontend**: React 18, Tailwind CSS, Recharts, Lucide React
- **Backend**: Node.js, Express, SQLite3
- **Authentication**: JWT (JSON Web Tokens)
- **PDF Generation**: jsPDF, html2canvas

## Project Structure

```
areca-plate-management/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Layout, Sidebar, Navbar
│   │   ├── context/        # Auth & Theme Context
│   │   ├── pages/          # All page components
│   │   └── App.jsx
│   └── package.json
├── server/                 # Express Backend
│   ├── server.js           # Main server file
│   ├── database.js         # SQLite setup
│   └── package.json
└── package.json
```

## Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Import to Vercel
3. Set build command: `cd client && npm run build`
4. Set output directory: `client/dist`

### Backend (Render/Railway)
1. Push code to GitHub
2. Create new Web Service
3. Set start command: `cd server && npm start`
4. Set environment variable: `JWT_SECRET=your-secret-key`

## Database

The application uses SQLite by default (file-based, no setup required). The database file is created automatically at `server/data/areca_plates.db`.

To switch to PostgreSQL or MySQL, update `server/database.js` with your preferred database driver and connection details.

## License

MIT