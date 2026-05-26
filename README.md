# TrackFlow - Field Force Tracking Platform

TrackFlow is a full-stack MERN application that provides real-time location tracking for employees, geo-fencing administration, offline-first PWA caching, and automated attendance logging.

## Technologies Used

- **Backend**: Node.js, Express, MongoDB, Socket.IO, JWT, Turf.js, PDFKit
- **Frontend**: React (Vite), Tailwind CSS, React-Leaflet, Socket.IO Client, IndexedDB, PWA Service Workers

## Folder Structure

- `/backend` - Express API, models, sockets, and report generation
- `/frontend` - React single-page application with PWA manifest

## Setup & Execution

### 1. Backend Setup

1. Open a terminal and navigate to `/backend`
2. Run `npm install`
3. Make sure MongoDB is running locally on port 27017, or update the `MONGO_URI` in `backend/.env`
4. Start the server: `npm run dev` (Runs on port 5000)

### 2. Frontend Setup

1. Open a new terminal and navigate to `/frontend`
2. Run `npm install`
3. Start the dev server: `npm run dev` (Runs on port 3000)

### 3. Usage

- Navigate to `http://localhost:3000`
- Use the Register page to create an admin or employee account, or test the live socket functions across two different browsers/tabs.
- The map view supports real-time geofence polygon checks and history playbacks.

## Features Completed

- [x] JWT Authentication & Security Rate Limiting
- [x] Real-time live map tracking (Socket.IO)
- [x] Background sync and offline IDB buffering via Service Worker
- [x] Geofencing (Circle/Polygon) using Turf.js
- [x] Automated geofenced attendance (Check-in/out)
- [x] SOS emergency trigger workflow
- [x] PDF/CSV report generation
