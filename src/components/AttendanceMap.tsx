"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, LogIn, LogOut, Activity, Filter, Calendar, Loader2, Users, Building2, RefreshCw } from "lucide-react";

// ============ CUSTOM ICONS ============
const campusIcon = new L.DivIcon({
  html: `<div style="
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(0, 85, 144, 0.15); border: 3px solid #005590;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 20px rgba(0, 85, 144, 0.3);
  "><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#005590" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const hadirIcon = new L.DivIcon({
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #005590; border: 2.5px solid #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 85, 144, 0.4);
    animation: marker-pop 0.3s ease;
  "><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const pulangIcon = new L.DivIcon({
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #d97706; border: 2.5px solid #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(217, 119, 6, 0.4);
    animation: marker-pop 0.3s ease;
  "><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// ============ INTERFACES ============
interface AttendanceRecord {
  id: string;
  namaLengkap: string;
  unitKerja: string;
  type: string;
  jenisKehadiran: string;
  pesan: string | null;
  photoData: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  createdAt: string;
  _wibTime?: string | null;
  _isSuspicious?: boolean | null;
  _spoofFlags?: string[] | null;
}

// ============ MAP CONTROLS ============
function FlyToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { duration: 1.5 });
  }, [map, center]);
  return null;
}

function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);
  return null;
}

// ============ MAIN COMPONENT ============
export default function AttendanceMap({
  filterDate,
  filterUnit,
  filterType,
  allUnits,
}: {
  filterDate: string;
  filterUnit: string;
  filterType: string;
  allUnits: string[];
}) {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const CAMPUS_CENTER: [number, number] = [-8.0903366, 111.9003307];
  const ALLOWED_RADIUS = 500;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterUnit !== "SEMUA") params.set("unit", filterUnit);
      if (filterType !== "SEMUA") params.set("type", filterType);
      const res = await fetch(`/api/attendance?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data || []);
    } catch {
      console.error("Failed to fetch map data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDate, filterUnit, filterType]);

  // Group records by location (same coords = cluster)
  const validRecords = useMemo(() =>
    data.filter((r) => r.latitude != null && r.longitude != null),
    [data]
  );

  const hadirCount = validRecords.filter((r) => r.type === "HADIR").length;
  const pulangCount = validRecords.filter((r) => r.type === "PULANG").length;
  const uniqueNames = new Set(validRecords.map((r) => r.namaLengkap)).size;

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("id-ID", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Map Header Card */}
      <div className="apple-card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#1e293b] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0, 85, 144, 0.06)" }}>
                <MapPin className="w-4.5 h-4.5 text-[#005590]" />
              </div>
              Peta Presensi
            </h2>
            <p className="text-xs sm:text-sm text-[#64748b] mt-1.5 ml-12">
              Lokasi check-in/check-out pegawai hari ini
            </p>
          </div>
          <button onClick={fetchData} disabled={isLoading}
            className="apple-btn apple-btn-secondary text-xs sm:text-sm py-2 px-4 self-start sm:self-auto">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-3 mt-5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(0, 85, 144, 0.06)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#005590" }} />
            <span className="text-xs font-semibold text-[#1e293b]">{hadirCount} Hadir</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(217, 119, 6, 0.06)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#d97706" }} />
            <span className="text-xs font-semibold text-[#1e293b]">{pulangCount} Pulang</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(0, 85, 144, 0.06)" }}>
            <Users className="w-3.5 h-3.5 text-[#005590]" />
            <span className="text-xs font-semibold text-[#1e293b]">{uniqueNames} Orang</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="apple-card overflow-hidden" style={{ padding: 0 }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#005590]" />
            <span className="text-sm text-[#64748b]">Memuat peta...</span>
          </div>
        ) : (
          <div className="attendance-map-container">
            <MapContainer
              center={CAMPUS_CENTER}
              zoom={15}
              className="attendance-map"
              zoomControl={false}
              attributionControl={false}
            >
              <ResizeHandler />
              <FlyToCenter center={CAMPUS_CENTER} />

              {/* Tile Layer - OpenStreetMap */}
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Campus Geofence Circle */}
              <CircleMarker
                center={CAMPUS_CENTER}
                radius={ALLOWED_RADIUS * 1.3}
                pathOptions={{
                  color: "#005590",
                  weight: 2,
                  fillColor: "#005590",
                  fillOpacity: 0.05,
                  dashArray: "8 4",
                }}
              />

              {/* Campus Center Marker */}
              <Marker position={CAMPUS_CENTER} icon={campusIcon}>
                <Tooltip direction="top" offset={[0, -25]} permanent>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#005590" }}>
                    Universitas Tulungagung
                  </span>
                </Tooltip>
              </Marker>

              {/* Attendance Markers */}
              {validRecords.map((record) => {
                const icon = record.type === "HADIR" ? hadirIcon : pulangIcon;
                const key = `${record.id}-${record.type}`;
                return (
                  <Marker
                    key={key}
                    position={[record.latitude!, record.longitude!]}
                    icon={icon}
                    eventHandlers={{
                      click: () => setActiveMarker(activeMarker === key ? null : key),
                    }}
                  >
                    <Popup maxWidth={280} minWidth={220}>
                      <div style={{ fontFamily: "var(--font-geist-sans), -apple-system, sans-serif" }}>
                        {/* Header */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          marginBottom: 10, paddingBottom: 8,
                          borderBottom: "2px solid #e2e8f0"
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: record.type === "HADIR" ? "#005590" : "#d97706",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {record.type === "HADIR" ? (
                              <LogIn size={14} color="#fff" />
                            ) : (
                              <LogOut size={14} color="#fff" />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
                              {record.namaLengkap}
                            </div>
                            <div style={{
                              fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                              background: record.type === "HADIR" ? "rgba(0,85,144,0.1)" : "rgba(217,119,6,0.1)",
                              color: record.type === "HADIR" ? "#005590" : "#d97706",
                              display: "inline-block", marginTop: 2,
                            }}>
                              {record.type}
                            </div>
                          </div>
                        </div>

                        {/* Details */}
                        <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.7 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Building2 size={12} style={{ color: "#64748b", flexShrink: 0, marginTop: 2 }} />
                            <span style={{ color: "#64748b" }}>Unit:</span>
                            <strong>{record.unitKerja}</strong>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Calendar size={12} style={{ color: "#64748b", flexShrink: 0, marginTop: 2 }} />
                            <span style={{ color: "#64748b" }}>Waktu:</span>
                            <strong>{record._wibTime || formatTime(record.createdAt)}</strong>
                          </div>
                          {record.locationAddress && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <MapPin size={12} style={{ color: "#64748b", flexShrink: 0, marginTop: 2 }} />
                              <span style={{ fontSize: 10, color: "#64748b" }}>
                                {record.locationAddress.length > 60
                                  ? record.locationAddress.slice(0, 60) + "..."
                                  : record.locationAddress}
                              </span>
                            </div>
                          )}
                          {record.jenisKehadiran && (
                            <div style={{
                              marginTop: 6, padding: "4px 8px", borderRadius: 6,
                              background: "#f1f5f9", fontSize: 10, color: "#334155",
                            }}>
                              {record.jenisKehadiran}
                            </div>
                          )}
                          {record._isSuspicious && (
                            <div style={{
                              marginTop: 6, padding: "4px 8px", borderRadius: 6,
                              background: "#fef2f2", fontSize: 10, color: "#ef4444",
                              fontWeight: 600,
                            }}>
                              Fake GPS Terdeteksi!
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="apple-card p-4">
        <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Legenda</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full border-2 border-[#005590] flex items-center justify-center" style={{ background: "rgba(0,85,144,0.1)" }}>
              <div className="w-2 h-2 rounded-full bg-[#005590]" />
            </div>
            <span className="text-xs text-[#334155]">Absen Hadir</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full border-2 border-[#d97706] flex items-center justify-center" style={{ background: "rgba(217,119,6,0.1)" }}>
              <div className="w-2 h-2 rounded-full bg-[#d97706]" />
            </div>
            <span className="text-xs text-[#334155]">Absen Pulang</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-[#005590] flex items-center justify-center" style={{ background: "rgba(0,85,144,0.05)" }}>
              <Building2 className="w-3 h-3 text-[#005590]" />
            </div>
            <span className="text-xs text-[#334155]">Area Kampus (500m)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
