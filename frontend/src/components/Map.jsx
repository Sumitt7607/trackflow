import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createEmployeeIcon = (name, status) => {
  const color = status === 'online' ? '#10b981' : '#64748b';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:40px;height:40px;border-radius:50%;
          background:linear-gradient(135deg,#8b5cf6,#6d28d9);
          border:3px solid ${color};
          display:flex;align-items:center;justify-content:center;
          color:white;font-weight:700;font-size:14px;
          box-shadow:0 4px 14px rgba(139,92,246,0.5);
        ">${name?.charAt(0)?.toUpperCase() || '?'}</div>
        <div style="
          position:absolute;top:-4px;right:-4px;
          width:12px;height:12px;border-radius:50%;
          background:${color};border:2px solid white;
        "></div>
        <div style="
          margin-top:3px;background:rgba(15,23,42,0.85);
          color:white;font-size:10px;font-weight:600;
          padding:2px 6px;border-radius:8px;white-space:nowrap;
          backdrop-filter:blur(4px);
        ">${name || 'Employee'}</div>
      </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 55],
    popupAnchor: [0, -55],
  });
};

const createMyIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div style="
        width:20px;height:20px;border-radius:50%;
        background:#3b82f6;border:3px solid white;
        box-shadow:0 0 0 4px rgba(59,130,246,0.3);
      "></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FlyToLocation({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center?.lat && center?.lng) {
      map.flyTo([center.lat, center.lng], 15, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

export default function MapView({
  center = { lat: 20.5937, lng: 78.9629 },
  zoom = 5,
  employees = [],
  routeHistory = [],
  geofences = [],
  myLocation = null,
  flyTo = null,
  height = '100%',
  showHeatmap = false,
  routeWaypoints = [],
}) {
  return (
    <div style={{ height, width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {flyTo && <FlyToLocation center={flyTo} />}

        {/* My Location (employee view) */}
        {myLocation?.lat && (
          <>
            <Marker position={[myLocation.lat, myLocation.lng]} icon={createMyIcon()}>
              <Popup><strong>Your Location</strong></Popup>
            </Marker>
            <Circle
              center={[myLocation.lat, myLocation.lng]}
              radius={myLocation.accuracy || 20}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}
            />
          </>
        )}

        {/* Employee Markers (admin view) */}
        {employees.map((emp) => {
          const loc = emp.location || emp.currentLocation;
          if (!loc?.latitude && !loc?.lat) return null;
          const lat = loc.latitude ?? loc.lat;
          const lng = loc.longitude ?? loc.lng;
          return (
            <Marker
              key={emp.employeeId || emp._id}
              position={[lat, lng]}
              icon={createEmployeeIcon(emp.name, emp.status)}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold text-slate-900">{emp.name}</p>
                  <p className="text-slate-500">{emp.email}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p>🔋 Battery: <strong>{emp.batteryLevel ?? '—'}%</strong></p>
                    <p>📡 GPS: <strong>±{Math.round(emp.gpsAccuracy ?? 0)}m</strong></p>
                    <p>⏱ Last seen: <strong>{emp.lastActive ? new Date(emp.lastActive).toLocaleTimeString() : '—'}</strong></p>
                  </div>
                  <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    emp.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>{emp.status}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Route History Polyline */}
        {!showHeatmap && routeHistory.length > 1 && (
          <Polyline
            positions={routeHistory.map(p => [p.latitude, p.longitude])}
            pathOptions={{ color: '#8b5cf6', weight: 3, opacity: 0.8, dashArray: '6 4' }}
          />
        )}

        {/* Heatmap Overlay (simulated using overlapping gradient density circles) */}
        {showHeatmap && routeHistory.length > 0 && routeHistory.map((p, idx) => (
          <Circle
            key={`heat-${idx}`}
            center={[p.latitude, p.longitude]}
            radius={30}
            pathOptions={{
              stroke: false,
              fillColor: '#f43f5e',
              fillOpacity: 0.12,
            }}
          />
        ))}

        {/* Geofence Overlays */}
        {geofences.map((fence) => {
          if (fence.type === 'circle' && fence.circleCenter) {
            return (
              <Circle
                key={fence._id}
                center={[fence.circleCenter.lat, fence.circleCenter.lng]}
                radius={fence.radius}
                pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.15, weight: 2, dashArray: '6 4' }}
              >
                <Popup><strong>{fence.name}</strong><br />Radius: {fence.radius}m</Popup>
              </Circle>
            );
          }
          if (fence.type === 'polygon' && fence.polygonCoordinates?.length > 2) {
            return (
              <Polygon
                key={fence._id}
                positions={fence.polygonCoordinates.map(c => [c.lat, c.lng])}
                pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.15, weight: 2, dashArray: '6 4' }}
              >
                <Popup><strong>{fence.name}</strong></Popup>
              </Polygon>
            );
          }
          return null;
        })}

        {/* Route Waypoints Polyline */}
        {routeWaypoints.length > 1 && (
          <Polyline
            positions={routeWaypoints.map(w => [w.lat, w.lng])}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
          />
        )}

        {/* Waypoint Markers */}
        {routeWaypoints.map((wp, idx) => (
          <Marker
            key={`wp-${idx}`}
            position={[wp.lat, wp.lng]}
            icon={L.divIcon({
              className: '',
              html: `
                <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                  <div style="
                    width: 24px; height: 24px; border-radius: 50%;
                    background: ${wp.isVisited ? '#10b981' : '#3b82f6'};
                    border: 2px solid white;
                    color: white; font-weight: bold; font-size: 11px;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                  ">${idx + 1}</div>
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Popup>
              <strong>Stop ${idx + 1}: {wp.address}</strong><br />
              Status: {wp.isVisited ? 'Visited ✅' : 'Pending ⏳'}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
