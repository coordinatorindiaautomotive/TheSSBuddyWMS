# WMS Enterprise ("The SS Buddy") — Node.js & React Full Stack Replicated App

This application is a 100% feature-complete replication of the original ASP.NET Core WMS logistics system built with **Node.js (Express + Socket.io)** backend and **React (Vite + Tailwind CSS)** frontend.

---

## 🛠️ Tech Stack

- **Backend**:
  - **Node.js & Express**: RESTful API endpoints & JWT + Cookie Authentication
  - **Socket.io**: Real-time WebSocket notifications & live GPS vehicle tracking
  - **MySQL / Relational Database**: Enterprise MySQL Database (`wms_enterprise_db`) with connection pooling, automated schema migration, and seeder (with SQLite fallback)
  - **SheetJS (`xlsx`)**: E-Way Bill excel parsing, tax calculations, and JSON export generator
  - **SLA Background Monitor**: Continuous background dispatch monitoring service

- **Frontend**:
  - **React 18 & Vite**: Fast SPA rendering with React Router v6
  - **Tailwind CSS v3**: Modern dark glassmorphism design system
  - **Recharts**: Weekly analytics & dispatch performance charts
  - **Leaflet & React-Leaflet**: Live driver GPS tracking map with real-time WebSocket markers
  - **Lucide Icons**: Modern UI icons

---

## 📁 Directory Structure

```
thesssystem_node_react/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # SQLite connection & schema initialization
│   │   ├── controllers/          # All API controllers (Auth, Dashboard, Dispatch, Delivery, EWayBill, etc.)
│   │   ├── middleware/           # JWT Auth & Warehouse Context middleware
│   │   ├── services/             # Dispatch SLA Monitor Background Service
│   │   ├── seed.js               # Database seeder script
│   │   └── server.js             # Main Express & Socket.io server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/Layout.jsx # Navigation sidebar, Topbar, Warehouse Switcher, Notifications
│   │   ├── context/              # AuthContext & SocketContext
│   │   ├── pages/                # All 15+ Web App pages
│   │   ├── App.jsx               # Routes definition
│   │   └── main.jsx
│   └── package.json
├── start.bat                     # Windows launch script
└── README.md
```

---

## 🚀 How to Run

### Method 1: Using Quick Launcher (Windows)
Double-click `start.bat` in `thesssystem_node_react/` directory.

### Method 2: Manual Terminal Execution

#### 1. Start Backend:
```bash
cd backend
npm install
npm start
```
*Backend runs on:* `http://localhost:5000`

#### 2. Start Frontend:
```bash
cd frontend
npm install
npm run dev
```
*Frontend app runs on:* `http://localhost:5173`

---

## 🔐 Credentials Demo Presets

- **Super Admin**: Username `admin` | Password `admin123`
- **Dispatcher**: Username `dispatcher1` | Password `admin123`
- **Driver**: Username `driver_rajesh` | Password `driver123`
