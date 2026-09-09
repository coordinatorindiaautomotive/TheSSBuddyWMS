import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../context/SocketContext';
import { Radio, Truck, MapPin, Navigation, RotateCcw } from 'lucide-react';

const truckIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export default function Tracking() {
  const [activeTracking, setActiveTracking] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchActiveTracking();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('driverLocationUpdated', (data) => {
      setActiveTracking(prev => prev.map(t => {
        if (t.driver_id === data.driver_id) {
          return {
            ...t,
            location: {
              lat: data.lat,
              lng: data.lng,
              speed: data.speed,
              last_updated: data.last_updated
            }
          };
        }
        return t;
      }));
    });

    return () => socket.off('driverLocationUpdated');
  }, [socket]);

  const fetchActiveTracking = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tracking/active');
      setActiveTracking(res.data || []);
    } catch (err) {
      console.error('Error fetching active tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  const centerPos = activeTracking.length > 0 && activeTracking[0].location
    ? [activeTracking[0].location.lat, activeTracking[0].location.lng]
    : [28.5355, 77.2680];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight">
            Live GPS Fleet Tracking
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time geospatial tracking of warehouse dispatch delivery routes and vehicle telemetry.
          </p>
        </div>
        <button
          onClick={fetchActiveTracking}
          className="btn-secondary text-xs h-9"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh GPS</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaflet Map Card */}
        <div className="lg:col-span-2 card-enterprise p-2 overflow-hidden h-[500px]">
          <MapContainer center={centerPos} zoom={12} scrollWheelZoom={true} className="h-full w-full rounded-lg">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {activeTracking.map((t) => {
              if (!t.location) return null;
              return (
                <Marker key={t.id} position={[t.location.lat, t.location.lng]} icon={truckIcon}>
                  <Popup className="text-xs">
                    <div className="p-1 space-y-1">
                      <p className="font-bold text-[#004C8F]">{t.dispatch_no}</p>
                      <p className="font-semibold text-slate-800">Driver: {t.driver_name}</p>
                      <p className="text-slate-600">Vehicle: {t.vehicle_number}</p>
                      <p className="text-emerald-700 font-bold">Speed: {t.location.speed || 30} km/h</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Live Active Vehicles Panel */}
        <div className="card-enterprise p-5 flex flex-col">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#004C8F]" />
            Active Fleet Vehicles ({activeTracking.length})
          </h3>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[420px] pr-1">
            {activeTracking.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No active GPS-tracked vehicles on road.
              </div>
            ) : (
              activeTracking.map((t) => (
                <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-xs text-[#004C8F]">{t.dispatch_no}</span>
                    <span className="badge-status badge-warning">
                      {t.status}
                    </span>
                  </div>

                  <div className="text-slate-700 space-y-0.5">
                    <p className="font-semibold text-slate-900">{t.driver_name} {t.driver_phone ? `(${t.driver_phone})` : ''}</p>
                    <p className="text-slate-500 font-mono text-[11px]">Vehicle: {t.vehicle_number}</p>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/80 flex justify-between items-center text-[11px] text-emerald-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      Speed: {t.location?.speed || 30} km/h
                    </span>
                    <span className="text-slate-400">Live GPS</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

