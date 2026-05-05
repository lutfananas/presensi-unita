---
Task ID: 1
Agent: Main Agent
Task: Add Live Attendance Map (Peta) tab and Confetti Effects to UNITA Presensi System

Work Log:
- Installed packages: canvas-confetti, leaflet, react-leaflet, @types/leaflet
- Created `/src/components/AttendanceMap.tsx` - Full interactive Leaflet map component with:
  - OpenStreetMap tiles (free, no API key)
  - Color-coded markers (blue = Hadir, orange = Pulang)
  - Campus center marker with tooltip
  - Geofence circle (500m radius, dashed border)
  - Custom popup with person details (name, unit, time, location, jenis kehadiran, fake GPS warning)
  - Stats row (Hadir count, Pulang count, Unique people)
  - Refresh button, filter support (date, unit, type)
  - Legend card
  - Responsive map height (450px mobile, 550px tablet, 600px desktop)
  - Custom styled zoom controls and popups matching app theme
- Updated `src/app/page.tsx`:
  - Added "peta" to TabType union
  - Added Globe icon import
  - Added confetti import and dynamic AttendanceMap import (SSR disabled)
  - Added map filter state (mapFilterUnit, mapFilterType, mapFilterDate)
  - Added confetti effects to handleSubmitAttendance (green+blue for Hadir, orange+yellow for Pulang)
  - Added confetti effects to handleSubmitWFH (purple+pink for remote vibes)
  - Added "Peta" tab to desktop nav and mobile bottom nav
  - Added Peta tab content section with filter card and AttendanceMap component
- Updated `src/app/globals.css`:
  - Added Leaflet map container styles (responsive heights)
  - Custom Leaflet zoom control, popup, tooltip, and marker styles
  - Marker pop animation keyframe
- Build succeeded locally
- Deployed to Vercel production (presensi-universitas.vercel.app / presensi.unita.ac.id)

Stage Summary:
- Two new features deployed: Live Attendance Map tab (Peta) and Confetti Effects on form submission
- Map uses Leaflet + OpenStreetMap (100% free, no API key needed)
- Confetti uses canvas-confetti library with different color themes per action
- All 5 tabs now: Presensi, WFH, Laporan, Analisa, Peta
