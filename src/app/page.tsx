"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import {
  Camera,
  Send,
  ClipboardList,
  BarChart3,
  Clock,
  Users,
  LogIn,
  LogOut,
  Trash2,
  Eye,
  Search,
  Download,
  ChevronDown,
  ClipboardCheck,
  Activity,
  Building2,
  User,
  MessageSquare,
  X,
  Calendar,
  Filter,
  Lock,
  FileText,
  TrendingUp,
  PieChart,
  MapPin,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

// ============ CONSTANTS ============
const UNIT_KERJA_LIST = [
  "Rektorat",
  "Biro Administrasi Akademik",
  "Biro Administrasi Umum dan Keuangan",
  "Biro Administrasi Kemahasiswaan",
  "Fakultas Ekonomi",
  "Fakultas Hukum",
  "Fakultas Ilmu Sosial dan Politik",
  "Fakultas Pertanian",
  "Fakultas Teknik",
  "D3 Kebidanan",
  "LPPM",
  "PPM",
  "Perpustakaan",
  "PMB",
  "Pusat Bahasa",
  "Pusat Budaya",
  "Inkubator Bisnis",
  "Galeri Investasi",
  "IT Mart",
  "UKSI",
];

type TabType = "presensi" | "wfh" | "laporan" | "analisa";
type AnalisaPeriod = "daily" | "weekly" | "monthly";

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
  _distanceFromCampus?: number | null;
  _geoVerified?: boolean | null;
}

interface WFHRecord {
  id: string;
  namaLengkap: string;
  unitKerja: string;
  deskripsiPekerjaan: string;
  createdAt: string;
}

interface StatsData {
  today: { hadir: number; pulang: number; uniquePeople: number };
  totals: { attendance: number; wfh: number };
  recent: { attendance: AttendanceRecord[]; wfh: WFHRecord[] };
}

interface AnalysisData {
  period: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  summary: { totalHadir: number; totalPulang: number; uniquePeople: number; totalWFH: number; totalRecords: number; lateCheckIns: number; latePeople: number; lateNames: string[]; peakHour: number; peakHourCount: number; totalOvertimeHours: number; totalOvertimePeople: number };
  insights: string[];
  dailyBreakdown: { day: string; hadir: number; pulang: number; unique: number; status: string; lateCount: number; overtimeHours: number }[];
  unitBreakdown: { unitKerja: string; hadir: number; pulang: number; wfh: number; unique: number; wfhRate: number; status: string; lateCount: number; overtimeHours: number }[];
  personBreakdown: { namaLengkap: string; unitKerja: string; hadir: number; pulang: number; wfh: number; total: number; activeDays: number; pesan: string[]; status: string; lateCount: number; lemburHours: number; isOnTime: boolean }[];
  lemburRecords: { namaLengkap: string; date: string; hadirTime: string; pulangTime: string; lemburHours: number }[];
}

// ============ MAIN PAGE ============
export default function PresensiPage() {
  const [activeTab, setActiveTab] = useState<TabType>("presensi");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Protection State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [passwordError, setPasswordError] = useState(false);

  // Attendance Form State
  const [namaLengkap, setNamaLengkap] = useState("");
  const [unitKerja, setUnitKerja] = useState("");
  const [jenisKehadiran, setJenisKehadiran] = useState("");
  const [pesan, setPesan] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // WFH Form State
  const [wfhNama, setWfhNama] = useState("");
  const [wfhUnit, setWfhUnit] = useState("");
  const [wfhDeskripsi, setWfhDeskripsi] = useState("");
  const [isSubmittingWfh, setIsSubmittingWfh] = useState(false);

  // Report State
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [wfhData, setWfhData] = useState<WFHRecord[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterUnit, setFilterUnit] = useState("SEMUA");
  const [filterType, setFilterType] = useState("SEMUA");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [reportTab, setReportTab] = useState<"presensi" | "wfh">("presensi");

  // Analysis State
  const [analisaPeriod, setAnalisaPeriod] = useState<AnalisaPeriod>("daily");
  const [analisaUnit, setAnalisaUnit] = useState("SEMUA");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analisaSubTab, setAnalisaSubTab] = useState<"ringkasan" | "unit" | "personal">("ringkasan");

  // ============ DATA FETCHING ============
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchAttendanceData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterUnit !== "SEMUA") params.set("unit", filterUnit);
      if (filterType !== "SEMUA") params.set("type", filterType);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/attendance?${params}`);
      const json = await res.json();
      if (json.success) setAttendanceData(json.data);
    } catch (err) {
      toast({ title: "Gagal memuat data", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [filterDate, filterUnit, filterType, searchQuery, toast]);

  const fetchWfhData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterUnit !== "SEMUA") params.set("unit", filterUnit);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/wfh?${params}`);
      const json = await res.json();
      if (json.success) setWfhData(json.data);
    } catch (err) {
      console.error("Failed to fetch WFH:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [filterDate, filterUnit, searchQuery]);

  const fetchAnalysisData = useCallback(async () => {
    setIsLoadingAnalysis(true);
    try {
      const params = new URLSearchParams({ period: analisaPeriod });
      if (analisaUnit !== "SEMUA") params.set("unit", analisaUnit);
      const res = await fetch(`/api/analysis?${params}`);
      const json = await res.json();
      if (json.success) setAnalysisData(json.data);
    } catch (err) {
      toast({ title: "Gagal memuat analisa", variant: "destructive" });
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [analisaPeriod, analisaUnit, toast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (activeTab === "laporan") {
      if (reportTab === "presensi") fetchAttendanceData();
      else fetchWfhData();
    }
  }, [activeTab, reportTab, fetchAttendanceData, fetchWfhData]);

  useEffect(() => {
    if (activeTab === "analisa") fetchAnalysisData();
  }, [activeTab, fetchAnalysisData]);

  // ============ GEOFENCING CONFIG ============
  const CAMPUS_CENTER = { lat: -8.0903366, lng: 111.9003307 };
  const ALLOWED_RADIUS = 500; // meter
  const [geoFenceStatus, setGeoFenceStatus] = useState<'inside' | 'outside' | 'loading' | null>(null);
  const [distanceFromCampus, setDistanceFromCampus] = useState<number | null>(null);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ============ GEOLOCATION ============
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'id' },
      });
      const data = await res.json();
      if (data.display_name) {
        const parts = data.display_name.split(',').slice(0, 3).join(', ');
        return parts;
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const requestGeoLocation = async (): Promise<{ lat: number; lng: number; address: string } | null> => {
    if (!navigator.geolocation) {
      toast({ title: "GPS tidak didukung browser ini", variant: "destructive" });
      return null;
    }
    setIsGettingLocation(true);
    setGeoFenceStatus('loading');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await reverseGeocode(lat, lng);
          // Calculate geofence
          const dist = haversineDistance(lat, lng, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng);
          setDistanceFromCampus(Math.round(dist));
          if (dist <= ALLOWED_RADIUS) {
            setGeoFenceStatus('inside');
          } else {
            setGeoFenceStatus('outside');
          }
          setIsGettingLocation(false);
          resolve({ lat, lng, address });
        },
        (error) => {
          setIsGettingLocation(false);
          setGeoFenceStatus(null);
          switch (error.code) {
            case 1: toast({ title: "Izin lokasi ditolak", description: "Aktifkan izin lokasi di browser untuk menggunakan fitur geotag", variant: "destructive" }); break;
            case 2: toast({ title: "Lokasi tidak tersedia", description: "Pastikan GPS perangkat aktif", variant: "destructive" }); break;
            case 3: toast({ title: "Timeout lokasi", description: "Coba lagi, tidak dapat menemukan lokasi", variant: "destructive" }); break;
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  // ============ PHOTO HANDLING ============
  const drawGeoTagOverlay = (img: HTMLImageElement): string => {
    const canvas = document.createElement("canvas");
    const maxW = 800, maxH = 1000;
    let w = img.width, h = img.height;

    if (w > maxW) { h = (h * maxW) / w; w = maxW; }
    if (h > maxH) { w = (w * maxH) / h; h = maxH; }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    // Draw original photo
    ctx.drawImage(img, 0, 0, w, h);

    if (!geoLocation) return canvas.toDataURL("image/jpeg", 0.85);

    // Overlay bar at bottom
    const barH = Math.max(h * 0.1, 60);
    const barY = h - barH;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, barY, w, barH);

    // Timestamp
    const now = new Date();
    const timeStr = now.toLocaleString("id-ID", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(barH * 0.22, 11)}px monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText(timeStr, 10, barY + barH * 0.35);

    // Location icon + address
    const fontSize = Math.max(barH * 0.17, 9);
    ctx.font = `${fontSize}px monospace`;
    const addressText = geoLocation.address;
    const maxTextWidth = w - 20;
    let displayText = addressText;
    if (ctx.measureText(displayText).width > maxTextWidth) {
      while (ctx.measureText(displayText + "...").width > maxTextWidth && displayText.length > 0) {
        displayText = displayText.slice(0, -1);
      }
      displayText += "...";
    }
    ctx.fillStyle = "#4fc3f7";
    ctx.fillText("📍 " + displayText, 10, barY + barH * 0.7);

    // Coordinates on the right
    ctx.fillStyle = "#81c784";
    ctx.font = `bold ${Math.max(barH * 0.15, 8)}px monospace`;
    const coordText = `${geoLocation.lat.toFixed(5)}, ${geoLocation.lng.toFixed(5)}`;
    const coordWidth = ctx.measureText(coordText).width;
    ctx.fillText(coordText, w - coordWidth - 10, barY + barH * 0.7);

    // Green border top of bar - using UNITA blue
    ctx.fillStyle = "#005590";
    ctx.fillRect(0, barY, w, 2);

    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Format tidak didukung", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File terlalu besar (maks 5MB)", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        // Use geotag overlay if location is available
        const processedData = geoLocation ? drawGeoTagOverlay(img) : (() => {
          const canvas = document.createElement("canvas");
          const maxW = 800, maxH = 800;
          let w = img.width, h = img.height;
          if (w > maxW) { h = (h * maxW) / w; w = maxW; }
          if (h > maxH) { w = (w * maxH) / h; h = maxH; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/jpeg", 0.7);
        })();
        setPhotoData(processedData);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // ============ PASSWORD PROTECTION ============
  const PROTECTED_TABS: TabType[] = ["laporan", "analisa"];
  const ACCESS_PASSWORD = "muharsono";

  const handleTabSwitch = (tabId: TabType) => {
    if (PROTECTED_TABS.includes(tabId) && !isUnlocked) {
      setPendingTab(tabId);
      setShowPasswordModal(true);
      setPasswordInput("");
      setPasswordError(false);
      return;
    }
    setActiveTab(tabId);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === ACCESS_PASSWORD) {
      setIsUnlocked(true);
      setShowPasswordModal(false);
      setPasswordInput("");
      setPasswordError(false);
      if (pendingTab) {
        setActiveTab(pendingTab);
        setPendingTab(null);
      }
    } else {
      setPasswordError(true);
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handlePasswordSubmit();
  };

  // ============ SUBMIT HANDLERS ============
  const handleSubmitAttendance = async (type: "HADIR" | "PULANG") => {
    if (!namaLengkap.trim()) { toast({ title: "Nama wajib diisi", variant: "destructive" }); return; }
    if (!unitKerja) { toast({ title: "Unit kerja wajib dipilih", variant: "destructive" }); return; }
    if (!jenisKehadiran) { toast({ title: "Jenis kehadiran wajib dipilih", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaLengkap: namaLengkap.trim(), unitKerja, type, jenisKehadiran, pesan: pesan.trim() || null, photoData, latitude: geoLocation?.lat ?? null, longitude: geoLocation?.lng ?? null, locationAddress: geoLocation?.address ?? null }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `${type === "HADIR" ? "Absensi Hadir" : "Absensi Pulang"} berhasil!`, description: `Data untuk ${namaLengkap.trim()} telah tersimpan` });
        setNamaLengkap(""); setUnitKerja(""); setJenisKehadiran(""); setPesan(""); setPhotoData(null); setGeoLocation(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchStats();
      } else { toast({ title: json.error || "Gagal menyimpan", variant: "destructive" }); }
    } catch { toast({ title: "Terjadi kesalahan", variant: "destructive" }); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmitWFH = async () => {
    if (!wfhNama.trim() || !wfhUnit || !wfhDeskripsi.trim()) {
      toast({ title: "Semua field wajib diisi", variant: "destructive" }); return;
    }
    setIsSubmittingWfh(true);
    try {
      const res = await fetch("/api/wfh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaLengkap: wfhNama.trim(), unitKerja: wfhUnit, deskripsiPekerjaan: wfhDeskripsi.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Aktivitas WFH berhasil disimpan!" });
        setWfhNama(""); setWfhUnit(""); setWfhDeskripsi(""); fetchStats();
      } else { toast({ title: "Gagal menyimpan", variant: "destructive" }); }
    } catch { toast({ title: "Terjadi kesalahan", variant: "destructive" }); }
    finally { setIsSubmittingWfh(false); }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      const res = await fetch(`/api/attendance/delete?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { toast({ title: "Data berhasil dihapus" }); fetchAttendanceData(); fetchStats(); }
    } catch { toast({ title: "Gagal menghapus data", variant: "destructive" }); }
  };

  // ============ UTILITY FUNCTIONS ============
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const escapeCSV = (str: string) => `"${String(str).replace(/"/g, '""')}"`;

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (reportTab === "presensi") {
      const headers = ["No", "Waktu", "Nama Lengkap", "Unit Kerja", "Tipe", "Jenis Kehadiran", "Lokasi", "Jarak (m)", "Geo Verifikasi", "Pesan"];
      const rows = attendanceData.map((r, i) => [
        i + 1,
        formatDateTime(r.createdAt),
        r.namaLengkap,
        r.unitKerja,
        r.type,
        r.jenisKehadiran || "Masuk Kerja Kampus",
        r.locationAddress || "-",
        r._distanceFromCampus != null ? r._distanceFromCampus : "-",
        r._geoVerified ? "Ya" : r._distanceFromCampus != null ? "Di Luar Kampus" : "-",
        r.pesan || "-"
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [
        { wch: 5 },
        { wch: 22 },
        { wch: 28 },
        { wch: 30 },
        { wch: 8 },
        { wch: 35 },
        { wch: 40 },
        { wch: 12 },
        { wch: 16 },
        { wch: 35 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    } else {
      const headers = ["No", "Waktu", "Nama Lengkap", "Unit Kerja", "Deskripsi Pekerjaan"];
      const rows = wfhData.map((r, i) => [
        i + 1,
        formatDateTime(r.createdAt),
        r.namaLengkap,
        r.unitKerja,
        r.deskripsiPekerjaan
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [
        { wch: 5 },
        { wch: 22 },
        { wch: 28 },
        { wch: 30 },
        { wch: 50 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "WFH");
    }

    XLSX.writeFile(wb, reportTab === "presensi" ? `Laporan-Absensi-${filterDate}.xlsx` : `Laporan-WFH-${filterDate}.xlsx`, { bookType: "xlsx", type: "array" });
    toast({ title: "Export Excel berhasil!" });
  };

  // ============ PDF EXPORT ============
  const exportAnalysisPDF = () => {
    if (!analysisData) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 15;

    // Header
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Laporan Analisa Kehadiran", pageW / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text("Universitas Tulungagung", pageW / 2, y, { align: "center" });
    y += 6;
    doc.text(`Periode: ${analysisData.periodLabel}`, pageW / 2, y, { align: "center" });
    y += 8;
    doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5);
    doc.line(14, y, pageW - 14, y);
    y += 8;

    // Summary
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Ringkasan", 14, y); y += 7;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const s = analysisData.summary;
    doc.text(`Pegawai Aktif: ${s.uniquePeople}`, 14, y); y += 5;
    doc.text(`Total Absensi Hadir: ${s.totalHadir}`, 14, y); y += 5;
    doc.text(`Total Absensi Pulang: ${s.totalPulang}`, 14, y); y += 5;
    doc.text(`Terlambat (>08:00): ${s.latePeople} orang (${s.lateCheckIns} kali)`, 14, y); y += 5;
    doc.text(`Total Lembur: ${s.totalOvertimeHours} jam (${s.totalOvertimePeople} pegawai)`, 14, y); y += 5;
    doc.text(`Total Aktivitas WFH: ${s.totalWFH}`, 14, y); y += 5;
    doc.text(`Total Rekord: ${s.totalRecords}`, 14, y); y += 5;
    y += 5;

    // Aturan
    if (y > pageH - 30) { doc.addPage(); y = 15; }
    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text("Aturan: Jam Kerja 08:00-14:00 WIB (6 jam). Terlambat = hadir > 08:00 (tidak dapat lembur). Lembur = hadir <= 08:00 & pulang >= 15:00.", 14, y, { maxWidth: pageW - 28 }); y += 5;
    doc.setFont("helvetica", "normal");
    y += 3;

    // Insights
    if (analysisData.insights && analysisData.insights.length > 0) {
      if (y > pageH - 40) { doc.addPage(); y = 15; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Insight untuk Pimpinan", 14, y); y += 7;
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      analysisData.insights.forEach((insight) => {
        if (y > pageH - 10) { doc.addPage(); y = 15; }
        doc.text(`- ${insight}`, 14, y, { maxWidth: pageW - 28 }); y += 5;
      });
      y += 5;
    }

    // Unit breakdown
    if (analysisData.unitBreakdown.length > 0 && y < pageH - 40) {
      if (y > pageH - 40) { doc.addPage(); y = 15; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Rekap Per Unit Kerja", 14, y); y += 7;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("No", 14, y); doc.text("Unit Kerja", 24, y); doc.text("Jumlah", 90, y);
      doc.text("Hadir", 108, y); doc.text("Pulang", 128, y); doc.text("WFH", 148, y);
      doc.text("Terlambat", 168, y); doc.text("Lembur", 195, y); doc.text("Status", 228, y);
      y += 2; doc.setLineWidth(0.3); doc.line(14, y, pageW - 14, y); y += 4;
      doc.setFont("helvetica", "normal");
      analysisData.unitBreakdown.forEach((u, i) => {
        if (y > pageH - 15) { doc.addPage(); y = 15; }
        doc.text(`${i + 1}`, 14, y); doc.text(u.unitKerja, 24, y);
        doc.text(String(u.unique), 90, y); doc.text(String(u.hadir), 108, y);
        doc.text(String(u.pulang), 128, y); doc.text(String(u.wfh), 148, y);
        doc.text(String(u.lateCount), 168, y);
        doc.text(u.overtimeHours > 0 ? `${u.overtimeHours} jam` : "-", 195, y);
        doc.text(u.status, 228, y);
        y += 5;
      });
      y += 5;
    }

    // Daily breakdown
    if (analysisData.dailyBreakdown.length > 0 && y < pageH - 40) {
      if (y > pageH - 40) { doc.addPage(); y = 15; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Rekap Harian", 14, y); y += 7;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("Tanggal", 14, y); doc.text("Hadir", 65, y); doc.text("Pulang", 90, y);
      doc.text("Jumlah", 115, y);
      doc.text("Terlambat", 150, y); doc.text("Lembur", 185, y); doc.text("Status", 225, y);
      y += 2; doc.line(14, y, pageW - 14, y); y += 4;
      doc.setFont("helvetica", "normal");
      analysisData.dailyBreakdown.forEach((d) => {
        if (y > pageH - 15) { doc.addPage(); y = 15; }
        doc.text(d.day, 14, y); doc.text(String(d.hadir), 65, y);
        doc.text(String(d.pulang), 90, y); doc.text(String(d.unique), 115, y);
        doc.text(String(d.lateCount), 150, y);
        doc.text(d.overtimeHours > 0 ? `${d.overtimeHours} jam` : "-", 185, y);
        doc.text(d.status, 225, y);
        y += 5;
      });
      y += 5;
    }

    // Person breakdown
    if (analysisData.personBreakdown.length > 0 && y < pageH - 40) {
      if (y > pageH - 40) { doc.addPage(); y = 15; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Rekap Per Orang", 14, y); y += 7;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("No", 14, y); doc.text("Nama", 24, y); doc.text("Unit Kerja", 80, y);
      doc.text("Hari", 140, y); doc.text("Hadir", 158, y); doc.text("Pulang", 178, y);
      doc.text("WFH", 198, y); doc.text("Terlambat", 218, y); doc.text("Lembur", 243, y); doc.text("Status", 268, y);
      y += 2; doc.line(14, y, pageW - 14, y); y += 4;
      doc.setFont("helvetica", "normal");
      analysisData.personBreakdown.forEach((p, i) => {
        if (y > pageH - 10) { doc.addPage(); y = 15; }
        doc.text(`${i + 1}`, 14, y); doc.text(p.namaLengkap, 24, y);
        doc.text(p.unitKerja, 80, y, { maxWidth: 55 });
        doc.text(String(p.activeDays), 140, y); doc.text(String(p.hadir), 158, y);
        doc.text(String(p.pulang), 178, y); doc.text(String(p.wfh), 198, y);
        doc.text(p.lateCount > 0 ? `${p.lateCount}x` : "-", 218, y);
        doc.text(p.lemburHours > 0 ? `${p.lemburHours} jam` : "-", 243, y);
        doc.text(p.status, 268, y);
        y += 5;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(
        `Dicetak: ${new Date().toLocaleString("id-ID")} | Halaman ${i} dari ${pageCount}`,
        pageW / 2, pageH - 8, { align: "center" }
      );
    }

    doc.save(`analisa-${analisaPeriod}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Export PDF berhasil!" });
  };

  // ============ RENDER ============
  // Fixed-position nav elements are placed OUTSIDE the flex container to avoid
  // the iOS Safari bug where position:fixed breaks inside flex containers.
  return (
    <>
      {/* ===== Fixed Navigation (Frosted Glass) ===== */}
      {/* Top nav - only shows logo on mobile */}
      <nav className="apple-nav">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              <Image src="/logo-universitas.png" alt="Logo" width={28} height={28} className="rounded-lg object-contain" />
            </div>
            <span className="text-sm font-semibold text-[#005590] tracking-tight">Unita</span>
          </div>

          {/* Center Nav Links - Mobile: bottom bar, Desktop: pill nav */}
          {/* Desktop nav (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-1">
            {([
              { id: "presensi" as TabType, label: "Presensi", desc: "Absensi Hadir & Pulang", icon: ClipboardList },
              { id: "wfh" as TabType, label: "WFH", desc: "Aktivitas Kerja dari Rumah", icon: Activity },
              { id: "laporan" as TabType, label: "Laporan", desc: "Rekap Data Absensi", icon: BarChart3 },
              { id: "analisa" as TabType, label: "Analisa", desc: "Statistik & Insight", icon: TrendingUp },
            ]).map((tab) => (
              <div key={tab.id} className="relative group">
                <button onClick={() => handleTabSwitch(tab.id)}
                  className={`nav-link flex items-center gap-1.5 ${activeTab === tab.id ? "active" : ""}`}>
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {PROTECTED_TABS.includes(tab.id) && !isUnlocked && <Lock className="w-3 h-3 text-[#ffcb01]" />}
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-white border border-blue-900 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  <p className="text-[11px] font-medium text-white">{tab.desc}</p>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white border-l border-t border-blue-900" />
                </div>
              </div>
            ))}
          </div>

          {/* Right side: Online status */}
          <div className="hidden md:flex items-center gap-2">
            <div className="pulse-dot w-1.5 h-1.5 rounded-full" style={{ background: "#ffcb01" }} />
            <span className="text-[10px] text-white/70">Online</span>
          </div>
        </div>
      </nav>
      {/* Bottom mobile navigation bar - SOLID bg, no blur (iOS safe) */}
      <div className="md:hidden mobile-bottom-nav">
        <div className="flex items-center justify-around px-1">
          {([
            { id: "presensi" as TabType, label: "Presensi", icon: ClipboardList },
            { id: "wfh" as TabType, label: "WFH", icon: Activity },
            { id: "laporan" as TabType, label: "Laporan", icon: BarChart3 },
            { id: "analisa" as TabType, label: "Analisa", icon: TrendingUp },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => handleTabSwitch(tab.id)}
              className="mobile-nav-btn flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl">
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? "text-[#ffcb01]" : "text-white/60"}`} />
              <span className={`text-[10px] font-medium ${activeTab === tab.id ? "text-[#ffcb01]" : "text-white/60"}`}>{tab.label}</span>
              {activeTab === tab.id && <div className="w-1 h-1 rounded-full bg-[#ffcb01]" />}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Main Page Content ===== */}
      <div className="min-h-screen flex flex-col" style={{ background: "#004a7e" }}>
      <main className="flex-1 apple-main">
        {/* Hero Section */}
        <section className="relative text-center px-4 sm:px-6 pb-6 sm:pb-10">
          <div className="relative z-10 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-3">
              Universitas Tulungagung
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#ffcb01] font-medium max-w-xl mx-auto">
              Sistem Presensi Digital
            </p>
          </div>
        </section>

        {/* ===== Content Wrapper ===== */}
        <div className="apple-section-wide pb-8 sm:pb-20">

          {/* ===== Stats Dashboard ===== */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-12 animate-fade-in-up">
              {[
                { val: stats.today.hadir, label: "Hadir Hari Ini", icon: LogIn, color: "rgba(255, 255, 255, 0.1)", iconColor: "#ffffff" },
                { val: stats.today.pulang, label: "Pulang Hari Ini", icon: LogOut, color: "rgba(255, 203, 1, 0.2)", iconColor: "#ffcb01" },
                { val: stats.today.uniquePeople, label: "Jumlah Hari Ini", icon: Users, color: "rgba(255, 255, 255, 0.1)", iconColor: "#ffffff" },
                { val: stats.totals.wfh, label: "Total WFH", icon: Activity, color: "rgba(255, 203, 1, 0.2)", iconColor: "#ffcb01" },
              ].map((s, i) => (
                <div key={i} className={`stat-card-apple p-3 sm:p-6 animate-fade-in-up animate-fade-in-up-d${i + 1}`}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.color }}>
                      <s.icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: s.iconColor }} />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold text-white">{s.val}</p>
                      <p className="text-[10px] sm:text-xs text-white/70 mt-0.5">{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========== TAB: PRESENSI ========== */}
          {activeTab === "presensi" && (
            <div className="animate-fade-in-up space-y-5 sm:space-y-8">

              {/* Clock Display */}
              <div className="rounded-2xl p-5 sm:p-8 text-center" style={{ background: '#005590' }}>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-xs uppercase tracking-widest text-white/80 font-medium">Waktu Lokal</span>
                </div>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white font-mono tracking-wider">
                  <ClockDisplay />
                </p>
              </div>

              {/* Attendance Form */}
              <div className="apple-card p-5 sm:p-6 md:p-10">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 255, 255, 0.1)" }}>
                    <ClipboardList className="w-4.5 h-4.5 text-[#005590]" />
                  </div>
                  Form Presensi
                </h2>
                <div className="space-y-5 sm:space-y-7">
                  {/* Nama Lengkap */}
                  <div>
                    <label className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-widest text-white/70 font-medium mb-2.5 sm:mb-3">
                      <User className="w-3.5 h-3.5" />
                      Nama Lengkap <span style={{ color: "#ffcb01" }}>*</span>
                      <span className="normal-case tracking-normal text-white/70/60 ml-1">(tanpa gelar)</span>
                    </label>
                    <input type="text" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} placeholder="Masukkan nama lengkap tanpa gelar" className="apple-input" />
                  </div>

                  {/* Unit Kerja */}
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <Building2 className="w-3.5 h-3.5" />
                      Unit Kerja <span style={{ color: "#ffcb01" }}>*</span>
                    </label>
                    <div className="relative">
                      <select value={unitKerja} onChange={(e) => setUnitKerja(e.target.value)} className="apple-select">
                        <option value="">-- Pilih Unit Kerja --</option>
                        {UNIT_KERJA_LIST.map((unit) => (<option key={unit} value={unit}>{unit}</option>))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                    </div>
                  </div>

                  {/* Jenis Kehadiran */}
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Jenis Kehadiran <span style={{ color: "#ffcb01" }}>*</span>
                    </label>
                    <div className="relative">
                      <select value={jenisKehadiran} onChange={(e) => setJenisKehadiran(e.target.value)} className="apple-select">
                        <option value="">-- Pilih Jenis Kehadiran --</option>
                        <option value="Masuk Kerja Kampus">Masuk Kerja Kampus</option>
                        <option value="Dinas Luar Kampus (Penelitian dan Pengabdian)">Dinas Luar Kampus (Penelitian dan Pengabdian)</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                    </div>
                  </div>

                  {/* Pesan */}
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Pesan
                      <span className="normal-case tracking-normal text-white/70/60 ml-1">(opsional)</span>
                    </label>
                    <textarea value={pesan} onChange={(e) => setPesan(e.target.value)} placeholder="Contoh: Terlambat karena praktikum jam 12, izin pulang awal karena sakit, dll." rows={3} className="apple-textarea" />
                  </div>

                  {/* Photo / GeoTag */}
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <Camera className="w-3.5 h-3.5" />
                      Foto Selfie Geotag
                    </label>

                    {/* GeoTag Status */}
                    <div className="mb-4">
                      {geoLocation ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{
                            background: geoFenceStatus === 'outside' ? "rgba(255, 203, 1, 0.1)" : "rgba(255, 255, 255, 0.08)",
                            border: geoFenceStatus === 'outside' ? "1px solid rgba(255, 203, 1, 0.3)" : "1px solid rgba(0, 85, 144, 0.15)",
                          }}>
                            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: geoFenceStatus === 'outside' ? "#e6b800" : "#005590" }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium" style={{ color: geoFenceStatus === 'outside' ? "#e6b800" : "#005590" }}>
                                {geoFenceStatus === 'inside' ? 'Lokasi aktif - Area Kampus' : geoFenceStatus === 'outside' ? 'Di luar Area Kampus' : 'Lokasi aktif'}
                              </p>
                              <p className="text-xs text-white/70 truncate">{geoLocation.address}</p>
                            </div>
                            <button onClick={() => { setGeoLocation(null); setGeoFenceStatus(null); setDistanceFromCampus(null); }} className="text-white/60 hover:text-[#005590] transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                          </div>
                          {geoFenceStatus === 'outside' && distanceFromCampus !== null && jenisKehadiran.includes('Kampus') && (
                            <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255, 203, 1, 0.08)", border: "1px solid rgba(255, 203, 1, 0.2)" }}>
                              <p className="text-xs font-medium" style={{ color: "#e6b800" }}>
                                Perhatian: Anda berada {distanceFromCampus}m dari kampus. Absensi tetap tersimpan, namun akan ditandai di Laporan.
                              </p>
                              <p className="text-[10px] text-white/70 mt-1">Jika Anda sedang Dinas Luar Kampus, pilih Jenis Kehadiran "Dinas Luar Kampus" pada dropdown di atas.</p>
                            </div>
                          )}
                          {geoFenceStatus === 'inside' && distanceFromCampus !== null && (
                            <p className="text-[10px] text-white/70 px-1">
                              Jarak dari kampus: {distanceFromCampus}m (dalam radius {ALLOWED_RADIUS}m)
                            </p>
                          )}
                        </div>
                      ) : (
                        <button onClick={async () => { const loc = await requestGeoLocation(); if (loc) setGeoLocation(loc); }} disabled={isGettingLocation} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed w-full text-left transition-all" style={{ borderColor: "rgba(0, 85, 144, 0.3)" }}>
                          {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#005590" }} /> : <MapPin className="w-4 h-4" style={{ color: "#005590" }} />}
                          <div className="flex-1">
                            <p className="text-xs font-medium" style={{ color: "#005590" }}>{isGettingLocation ? "Mencari lokasi GPS..." : "Aktifkan Lokasi (GeoTag)"}</p>
                            <p className="text-xs text-white/70">{isGettingLocation ? "Mohon tunggu, sedang verifikasi area..." : "Lokasi akan diverifikasi apakah di area kampus"}</p>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Photo Upload */}
                    <div onClick={() => fileInputRef.current?.click()} className="photo-upload-area relative border-2 border-dashed rounded-xl p-4 sm:p-8 text-center cursor-pointer group" style={{ borderColor: "rgba(0, 85, 144, 0.2)", background: "rgba(0, 85, 144, 0.02)" }}>
                      {photoData ? (
                        <div className="photo-preview-container mx-auto w-40 h-52 mb-3 relative">
                          <img src={photoData} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                          <div className="absolute bottom-0 left-0 right-0 text-center py-1.5 rounded-b-xl" style={{ background: "rgba(0,0,0,0.6)" }}>
                            <p className="text-[10px] font-medium" style={{ color: "#ffcb01" }}>GeoTag Aktif</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="photo-placeholder-icon w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 255, 255, 0.08)" }}>
                            <Camera className="w-8 h-8" style={{ color: "rgba(255,255,255,0.6)" }} />
                          </div>
                          <p className="text-sm text-white/70">Klik untuk ambil / Upload foto selfie</p>
                          <p className="text-xs text-white/70/60">{geoLocation ? "Foto akan dilengkapi GeoTag (waktu & lokasi)" : "Aktifkan lokasi di atas untuk GeoTag"}</p>
                        </div>
                      )}
                      {photoData && (
                        <button onClick={(e) => { e.stopPropagation(); setPhotoData(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                          <X className="w-4 h-4 text-white" />
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                    </div>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button onClick={() => handleSubmitAttendance("HADIR")} disabled={isSubmitting} className="apple-btn apple-btn-green w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      <LogIn className="w-4 h-4" />
                      {isSubmitting ? "Menyimpan..." : "Absen Hadir"}
                    </button>
                    <button onClick={() => handleSubmitAttendance("PULANG")} disabled={isSubmitting} className="apple-btn apple-btn-red w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      <LogOut className="w-4 h-4" />
                      {isSubmitting ? "Menyimpan..." : "Absen Pulang"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== TAB: WFH ========== */}
          {activeTab === "wfh" && (
            <div className="animate-fade-in-up space-y-5 sm:space-y-8">
              <div className="apple-card p-5 sm:p-6 md:p-10">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255, 203, 1, 0.12)" }}>
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "#ffcb01" }} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Submit Aktivitas WFH</h2>
                    <p className="text-xs text-white/70 mt-0.5">Catat aktivitas pekerjaan dari rumah Anda</p>
                  </div>
                </div>
                <div className="space-y-7">
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <User className="w-3.5 h-3.5" />
                      Nama Lengkap <span style={{ color: "#e6b800" }}>*</span>
                      <span className="normal-case tracking-normal text-white/70/60 ml-1">(tanpa gelar)</span>
                    </label>
                    <input type="text" value={wfhNama} onChange={(e) => setWfhNama(e.target.value)} placeholder="Masukkan nama lengkap tanpa gelar" className="apple-input" />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <Building2 className="w-3.5 h-3.5" />
                      Unit Kerja <span style={{ color: "#e6b800" }}>*</span>
                    </label>
                    <div className="relative">
                      <select value={wfhUnit} onChange={(e) => setWfhUnit(e.target.value)} className="apple-select">
                        <option value="" style={{ background: "#ffffff", color: "rgba(255,255,255,0.7)" }}>-- Pilih Unit Kerja --</option>
                        {UNIT_KERJA_LIST.map((unit) => (<option key={unit} value={unit} style={{ background: "#005590" }}>{unit}</option>))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-medium mb-3">
                      <ClipboardList className="w-3.5 h-3.5" />
                      Deskripsi Pekerjaan <span style={{ color: "#e6b800" }}>*</span>
                    </label>
                    <textarea value={wfhDeskripsi} onChange={(e) => setWfhDeskripsi(e.target.value)} placeholder="Jelaskan aktivitas pekerjaan yang Anda lakukan saat WFH..." rows={5} className="apple-textarea" />
                  </div>
                  <button onClick={handleSubmitWFH} disabled={isSubmittingWfh} className="apple-btn apple-btn-orange w-full disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-4 h-4" />
                    {isSubmittingWfh ? "Menyimpan..." : "Submit Aktivitas WFH"}
                  </button>
                </div>
              </div>

              {/* Recent WFH */}
              {stats && stats.recent.wfh.length > 0 && (
                <div className="apple-card p-6 md:p-8">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/70" />
                    Aktivitas WFH Terbaru
                  </h3>
                  <div className="space-y-3">
                    {stats.recent.wfh.map((item) => (
                      <div key={item.id} className="p-4 rounded-2xl" style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white text-sm">{item.namaLengkap}</span>
                          <span className="text-xs text-white/70">{item.unitKerja}</span>
                        </div>
                        <p className="text-xs text-white/70 line-clamp-2">{item.deskripsiPekerjaan}</p>
                        <p className="text-xs text-white/70/60 mt-2">{formatDateTime(item.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== TAB: LAPORAN ========== */}
          {activeTab === "laporan" && (
            <div className="animate-fade-in-up space-y-6">

              {/* Sub-tab toggle: Presensi / WFH */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="pill-toggle">
                  <button onClick={() => setReportTab("presensi")} className={`pill-toggle-item flex items-center gap-2 ${reportTab === "presensi" ? "active" : ""}`}>
                    <ClipboardList className="w-3.5 h-3.5" />Presensi
                  </button>
                  <button onClick={() => setReportTab("wfh")} className={`pill-toggle-item flex items-center gap-2 ${reportTab === "wfh" ? "active" : ""}`}>
                    <Activity className="w-3.5 h-3.5" />WFH
                  </button>
                </div>
                <button onClick={handleExportExcel} className="apple-btn apple-btn-secondary text-xs">
                  <Download className="w-3.5 h-3.5" />Export Excel
                </button>
              </div>

              {/* Filter Card */}
              <div className="apple-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-white/70" />
                  <span className="text-xs uppercase tracking-widest text-white/70 font-medium">Filter</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 filter-grid">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/70 mb-2 block font-medium">Tanggal</label>
                    <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="apple-input text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/70 mb-2 block font-medium">Unit Kerja</label>
                    <div className="relative">
                      <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="apple-select text-sm">
                        <option value="SEMUA" style={{ background: "#005590" }}>Semua Unit</option>
                        {UNIT_KERJA_LIST.map((u) => (<option key={u} value={u} style={{ background: "#005590" }}>{u}</option>))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70 pointer-events-none" />
                    </div>
                  </div>
                  {reportTab === "presensi" && (
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-white/70 mb-2 block font-medium">Tipe</label>
                      <div className="relative">
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="apple-select text-sm">
                          <option value="SEMUA" style={{ background: "#005590" }}>Semua Tipe</option>
                          <option value="HADIR" style={{ background: "#005590" }}>Hadir</option>
                          <option value="PULANG" style={{ background: "#005590" }}>Pulang</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70 pointer-events-none" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/70 mb-2 block font-medium">Cari Nama</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70" />
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama..." className="apple-input text-sm" style={{ paddingLeft: "36px" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Results count */}
              <p className="text-xs text-white/70 px-2">
                {reportTab === "presensi" ? `Menampilkan ${attendanceData.length} data absensi` : `Menampilkan ${wfhData.length} data WFH`}
              </p>

              {/* Presensi Table */}
              {reportTab === "presensi" && (
                <div className="apple-card overflow-hidden rounded-2xl">
                  {isLoadingData ? (
                    <div className="p-16 text-center text-white/70">
                      <div className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-4" style={{ borderColor: "rgba(0, 85, 144, 0.3)", borderTopColor: "#005590" }} />
                      <p className="text-sm">Memuat data...</p>
                    </div>
                  ) : attendanceData.length === 0 ? (
                    <div className="p-16 text-center text-white/70">
                      <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">Belum ada data absensi</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto custom-scrollbar max-h-[70vh] overflow-y-auto">
                      <table className="data-table text-sm">
                        <thead>
                          <tr>
                            <th>Waktu</th>
                            <th>Nama</th>
                            <th className="hidden md:table-cell">Unit Kerja</th>
                            <th>Tipe</th>
                            <th className="hidden lg:table-cell">Jenis Kehadiran</th>
                            <th className="hidden lg:table-cell">Lokasi</th>
                            <th className="hidden xl:table-cell text-center">Geo</th>
                            <th className="hidden lg:table-cell">Pesan</th>
                            <th className="text-center">Foto</th>
                            <th className="text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceData.map((r) => (
                            <tr key={r.id}>
                              <td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                              <td className="font-medium text-white text-sm">{r.namaLengkap}</td>
                              <td className="hidden md:table-cell text-xs">{r.unitKerja}</td>
                              <td>
                                <span className={`apple-badge ${r.type === "HADIR" ? "bg-[#005590]/15 text-[#005590]" : "bg-[#e6b800]/15 text-[#e6b800]"}`}>
                                  {r.type === "HADIR" ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}{r.type}
                                </span>
                              </td>
                              <td className="hidden lg:table-cell">
                                <span className={`apple-badge ${r.jenisKehadiran && r.jenisKehadiran.includes('Dinas') ? "bg-[#ffcb01]/15 text-[#ffcb01]" : "bg-[#005590]/15 text-[#005590]"}`}>
                                  {r.jenisKehadiran || "Masuk Kerja Kampus"}
                                </span>
                              </td>
                              <td className="hidden lg:table-cell">
                                {r.locationAddress && r.latitude && r.longitude ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
                                    style={{ color: "#005590" }}
                                  >
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate max-w-[120px]">{r.locationAddress.split(',')[0]}</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-white/70/40">-</span>
                                )}
                              </td>
                              <td className="hidden xl:table-cell text-center">
                                {r._distanceFromCampus !== null && r._distanceFromCampus !== undefined ? (
                                  r._geoVerified ? (
                                    <span className="apple-badge bg-[#005590]/15 text-[#005590]">
                                      {r._distanceFromCampus}m
                                    </span>
                                  ) : (
                                    <span className="apple-badge bg-[#e6b800]/15 text-[#e6b800] cursor-help" title={`Di luar area kampus (${r._distanceFromCampus}m). Periksa foto untuk verifikasi.`}>
                                      {r._distanceFromCampus}m !
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-white/70/40">-</span>
                                )}
                              </td>
                              <td className="hidden lg:table-cell max-w-[200px]"><span className="text-xs text-white/70 line-clamp-2">{r.pesan || "-"}</span></td>
                              <td className="text-center">
                                {r.photoData ? (
                                  <button onClick={() => setSelectedPhoto(r.photoData)} className="inline-flex items-center justify-center w-8 h-8 rounded-xl transition-colors" style={{ background: "rgba(255,255,255,0.1)" }}>
                                    <Eye className="w-4 h-4" style={{ color: "#005590" }} />
                                  </button>
                                ) : (
                                  <span className="text-xs text-white/70/40">-</span>
                                )}
                              </td>
                              <td className="text-center">
                                <button onClick={() => handleDeleteRecord(r.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-xl transition-colors" style={{ background: "rgba(255, 203, 1, 0.1)" }}>
                                  <Trash2 className="w-4 h-4" style={{ color: "#e6b800" }} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* WFH Table */}
              {reportTab === "wfh" && (
                <div className="apple-card overflow-hidden rounded-2xl">
                  {isLoadingData ? (
                    <div className="p-16 text-center text-white/70">
                      <div className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-4" style={{ borderColor: "rgba(255, 203, 1, 0.3)", borderTopColor: "#ffcb01" }} />
                      <p className="text-sm">Memuat data...</p>
                    </div>
                  ) : wfhData.length === 0 ? (
                    <div className="p-16 text-center text-white/70">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">Belum ada data WFH</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto custom-scrollbar max-h-[70vh] overflow-y-auto">
                      <table className="data-table text-sm">
                        <thead>
                          <tr>
                            <th>Waktu</th>
                            <th>Nama</th>
                            <th className="hidden md:table-cell">Unit Kerja</th>
                            <th>Deskripsi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wfhData.map((r) => (
                            <tr key={r.id}>
                              <td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                              <td className="font-medium text-white text-sm">{r.namaLengkap}</td>
                              <td className="hidden md:table-cell text-xs">{r.unitKerja}</td>
                              <td className="max-w-[300px]"><span className="text-xs text-white/70">{r.deskripsiPekerjaan}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========== TAB: ANALISA ========== */}
          {activeTab === "analisa" && (
            <div className="animate-fade-in-up space-y-6">

              {/* Period & Filter */}
              <div className="apple-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-white/70" />
                  <span className="text-xs uppercase tracking-widest text-white/70 font-medium">Analisa Kehadiran</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/70 mb-3 block font-medium">Periode</label>
                    <div className="pill-toggle">
                      {([["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"]] as [AnalisaPeriod, string][]).map(([val, lbl]) => (
                        <button key={val} onClick={() => setAnalisaPeriod(val)} className={`pill-toggle-item ${analisaPeriod === val ? "active" : ""}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/70 mb-3 block font-medium">Unit Kerja</label>
                    <div className="relative">
                      <select value={analisaUnit} onChange={(e) => setAnalisaUnit(e.target.value)} className="apple-select text-sm">
                        <option value="SEMUA" style={{ background: "#005590" }}>Semua Unit</option>
                        {UNIT_KERJA_LIST.map((u) => (<option key={u} value={u} style={{ background: "#005590" }}>{u}</option>))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70 pointer-events-none" />
                    </div>
                  </div>
                </div>
                {analysisData && (
                  <p className="text-xs text-white/70/60 mt-4 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />{analysisData.periodLabel}
                  </p>
                )}
              </div>

              {/* Sub-tab + Export PDF */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="pill-toggle">
                  {([["ringkasan", "Ringkasan", PieChart], ["unit", "Per Unit", Building2], ["personal", "Per Orang", Users]] as [string, string, React.ElementType][]).map(([val, lbl, Ic]) => (
                    <button key={val} onClick={() => setAnalisaSubTab(val as typeof analisaSubTab)} className={`pill-toggle-item flex items-center gap-1.5 ${analisaSubTab === val ? "active" : ""}`}>
                      <Ic className="w-3.5 h-3.5" />{lbl}
                    </button>
                  ))}
                </div>
                <button onClick={exportAnalysisPDF} disabled={!analysisData} className="apple-btn apple-btn-secondary text-xs disabled:opacity-40">
                  <FileText className="w-3.5 h-3.5" />Export PDF
                </button>
              </div>

              {isLoadingAnalysis ? (
                <div className="p-20 text-center text-white/70">
                  <div className="animate-spin w-10 h-10 border-2 rounded-full mx-auto mb-4" style={{ borderColor: "rgba(0, 85, 144, 0.3)", borderTopColor: "#005590" }} />
                  <p className="text-sm">Memuat data analisa...</p>
                </div>
              ) : !analysisData ? (
                <div className="p-20 text-center text-white/70">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-15" />
                  <p className="text-sm">Belum ada data analisa</p>
                </div>
              ) : (
                <>
                  {/* Aturan Kehadiran */}
                  <div className="apple-card p-6" style={{ borderLeft: "3px solid #005590" }}>
                    <h3 className="text-sm font-semibold text-[#005590] mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />Aturan Kehadiran
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-2xl p-4" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                        <p className="text-xs font-semibold text-[#005590] mb-1.5">Jam Kerja</p>
                        <p className="text-xs text-white/70 leading-relaxed">08:00 - 14:00 WIB (6 jam)</p>
                      </div>
                      <div className="rounded-2xl p-4" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: "#e6b800" }}>Terlambat</p>
                        <p className="text-xs text-white/70 leading-relaxed">Absen hadir setelah pukul 08:00. Pegawai terlambat tidak mendapatkan hak lembur.</p>
                      </div>
                      <div className="rounded-2xl p-4" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: "#ffcb01" }}>Lembur</p>
                        <p className="text-xs text-white/70 leading-relaxed">Hanya pegawai yang hadir sebelum/tepat 08:00. Pulang mulai 15:00 = lembur 1 jam.</p>
                      </div>
                    </div>
                  </div>

                  {/* Insight Pimpinan */}
                  {analysisData.insights && analysisData.insights.length > 0 && (
                    <div className="insight-card p-6">
                      <h3 className="text-sm font-semibold text-[#005590] mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />Insight untuk Pimpinan
                      </h3>
                      <ul className="space-y-2.5">
                        {analysisData.insights.map((insight, i) => (
                          <li key={i} className="text-xs text-white/70 flex gap-2.5">
                            <span className="font-bold mt-px flex-shrink-0" style={{ color: "#005590" }}>&#9679;</span>
                            <span className="leading-relaxed">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summary Cards Row 1 */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: "Pegawai Aktif", val: analysisData.summary.uniquePeople, color: "#005590" },
                      { label: "Terlambat (>08:00)", val: analysisData.summary.latePeople, color: analysisData.summary.latePeople === 0 ? "#005590" : "#e6b800" },
                      { label: "Total Lembur", val: analysisData.summary.totalOvertimeHours > 0 ? `${analysisData.summary.totalOvertimeHours} jam` : "0 jam", color: analysisData.summary.totalOvertimeHours > 0 ? "#ffcb01" : "#005590" },
                    ].map((s, i) => (
                      <div key={i} className="stat-card-apple text-center">
                        <p className="text-2xl font-bold text-white">{s.val}</p>
                        <p className="text-xs mt-1" style={{ color: s.color }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Summary Cards Row 2 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Hadir", val: analysisData.summary.totalHadir, color: "#005590" },
                      { label: "Total Pulang", val: analysisData.summary.totalPulang, color: "#e6b800" },
                      { label: "Total WFH", val: analysisData.summary.totalWFH, color: "#ffcb01" },
                      { label: "Total Rekord", val: analysisData.summary.totalRecords, color: "#005590" },
                    ].map((s, i) => (
                      <div key={i} className="stat-card-apple text-center">
                        <p className="text-2xl font-bold text-white">{s.val}</p>
                        <p className="text-xs mt-1" style={{ color: s.color }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* ===== Ringkasan Tab ===== */}
                  {analisaSubTab === "ringkasan" && (
                    <>
                      {/* Daily Breakdown */}
                      <div className="apple-card overflow-hidden rounded-2xl">
                        <div className="p-6 pb-0">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-white/70" />Rekap Harian
                          </h3>
                        </div>
                        {analysisData.dailyBreakdown.length === 0 ? (
                          <p className="text-sm text-white/70 text-center py-8">Belum ada data</p>
                        ) : (
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="data-table text-sm">
                              <thead>
                                <tr>
                                  <th>Tanggal</th>
                                  <th className="text-center">Hadir</th>
                                  <th className="text-center">Pulang</th>
                                  <th className="text-center">Jumlah</th>
                                  <th className="text-center">Terlambat</th>
                                  <th className="text-center">Lembur</th>
                                  <th className="text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysisData.dailyBreakdown.map((d, i) => {
                                  const statusColor = d.status === 'Baik' ? 'bg-[#005590]/15 text-[#005590]' : d.status === 'Cukup' ? 'bg-[#ffcb01]/15 text-[#ffcb01]' : 'bg-[#e6b800]/15 text-[#e6b800]';
                                  return (
                                    <tr key={i}>
                                      <td className="text-xs whitespace-nowrap">{d.day}</td>
                                      <td className="text-center"><span style={{ color: "#005590" }} className="font-medium">{d.hadir}</span></td>
                                      <td className="text-center"><span style={{ color: "#e6b800" }} className="font-medium">{d.pulang}</span></td>
                                      <td className="text-center font-medium text-white">{d.unique}</td>
                                      <td className="text-center">
                                        <span className={`apple-badge ${d.lateCount > 0 ? 'bg-[#e6b800]/15 text-[#e6b800]' : 'bg-[#005590]/15 text-[#005590]'}`}>
                                          {d.lateCount}
                                        </span>
                                      </td>
                                      <td className="text-center">
                                        <span className={`apple-badge ${d.overtimeHours > 0 ? 'bg-[#ffcb01]/15 text-[#ffcb01]' : 'bg-[#005590]/15 text-[#005590]'}`}>
                                          {d.overtimeHours > 0 ? `${d.overtimeHours} jam` : '-'}
                                        </span>
                                      </td>
                                      <td className="text-center">
                                        <span className={`apple-badge ${statusColor}`}>{d.status}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Lembur Detail Records */}
                      {analysisData.lemburRecords && analysisData.lemburRecords.length > 0 && (
                        <div className="apple-card overflow-hidden rounded-2xl" style={{ borderLeft: "3px solid #ffcb01" }}>
                          <div className="p-6 pb-0">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "#ffcb01" }}>
                              <Clock className="w-4 h-4" />Detail Lembur Pegawai
                            </h3>
                          </div>
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="data-table text-sm">
                              <thead>
                                <tr>
                                  <th>Nama</th>
                                  <th className="text-center">Tanggal</th>
                                  <th className="text-center">Jam Hadir</th>
                                  <th className="text-center">Jam Pulang</th>
                                  <th className="text-center">Lembur</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysisData.lemburRecords.map((r, i) => (
                                  <tr key={i}>
                                    <td className="text-xs font-medium text-white">{r.namaLengkap}</td>
                                    <td className="text-center text-xs">{r.date}</td>
                                    <td className="text-center text-xs">{r.hadirTime}</td>
                                    <td className="text-center text-xs">{r.pulangTime}</td>
                                    <td className="text-center">
                                      <span className="apple-badge bg-[#ffcb01]/15 text-[#ffcb01] font-bold">{r.lemburHours} jam</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ===== Unit Tab ===== */}
                  {analisaSubTab === "unit" && (
                    <div className="apple-card overflow-hidden rounded-2xl">
                      <div className="p-6 pb-0">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-white/70" />Rekap Per Unit Kerja
                        </h3>
                      </div>
                      {analysisData.unitBreakdown.length === 0 ? (
                        <p className="text-sm text-white/70 text-center py-8">Belum ada data</p>
                      ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="data-table text-sm">
                            <thead>
                              <tr>
                                <th>Unit Kerja</th>
                                <th className="text-center">Jumlah</th>
                                <th className="text-center">Hadir</th>
                                <th className="text-center">Pulang</th>
                                <th className="text-center">WFH</th>
                                <th className="text-center">Terlambat</th>
                                <th className="text-center">Lembur</th>
                                <th className="text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysisData.unitBreakdown.map((u, i) => {
                                const statusColor = u.status === 'Aktif' ? 'bg-[#005590]/15 text-[#005590]' : u.status === 'Cukup' ? 'bg-[#ffcb01]/15 text-[#ffcb01]' : 'bg-[#e6b800]/15 text-[#e6b800]';
                                return (
                                  <tr key={i}>
                                    <td className="text-xs font-medium text-white">{i + 1}. {u.unitKerja}</td>
                                    <td className="text-center font-bold text-white">{u.unique}</td>
                                    <td className="text-center"><span style={{ color: "#005590" }}>{u.hadir}</span></td>
                                    <td className="text-center"><span style={{ color: "#e6b800" }}>{u.pulang}</span></td>
                                    <td className="text-center"><span style={{ color: "#ffcb01" }}>{u.wfh}</span></td>
                                    <td className="text-center">
                                      <span className={`apple-badge ${u.lateCount > 0 ? 'bg-[#e6b800]/15 text-[#e6b800]' : 'bg-[#005590]/15 text-[#005590]'}`}>
                                        {u.lateCount}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`apple-badge ${u.overtimeHours > 0 ? 'bg-[#ffcb01]/15 text-[#ffcb01]' : 'bg-[#005590]/15 text-[#005590]'}`}>
                                        {u.overtimeHours > 0 ? `${u.overtimeHours} jam` : '-'}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`apple-badge ${statusColor}`}>{u.status}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ===== Personal Tab ===== */}
                  {analisaSubTab === "personal" && (
                    <div className="apple-card overflow-hidden rounded-2xl">
                      <div className="p-6 pb-0">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4 text-white/70" />Rekap Per Orang
                        </h3>
                      </div>
                      {analysisData.personBreakdown.length === 0 ? (
                        <p className="text-sm text-white/70 text-center py-8">Belum ada data</p>
                      ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="data-table text-sm">
                            <thead>
                              <tr>
                                <th>Nama</th>
                                <th className="hidden md:table-cell">Unit Kerja</th>
                                <th className="text-center">Hari</th>
                                <th className="text-center">Hadir</th>
                                <th className="text-center">Pulang</th>
                                <th className="text-center">WFH</th>
                                <th className="text-center">Terlambat</th>
                                <th className="text-center">Lembur</th>
                                <th className="text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysisData.personBreakdown.map((p, i) => {
                                const statusColor = p.status === 'Disiplin' ? 'bg-[#005590]/15 text-[#005590]' : p.status === 'Cukup' ? 'bg-[#ffcb01]/15 text-[#ffcb01]' : 'bg-[#e6b800]/15 text-[#e6b800]';
                                return (
                                  <tr key={i}>
                                    <td className="font-medium text-white text-xs">{i + 1}. {p.namaLengkap}</td>
                                    <td className="hidden md:table-cell text-xs">{p.unitKerja}</td>
                                    <td className="text-center">
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#005590" }}>{p.activeDays}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#005590" }}>{p.hadir}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: "rgba(255,203,1,0.12)", color: "#e6b800" }}>{p.pulang}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: "rgba(255,203,1,0.12)", color: "#ffcb01" }}>{p.wfh}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`apple-badge ${p.lateCount > 0 ? 'bg-[#e6b800]/15 text-[#e6b800]' : 'bg-[#005590]/15 text-[#005590]'}`}>
                                        {p.lateCount > 0 ? `${p.lateCount}x` : '-'}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`apple-badge ${p.lemburHours > 0 ? 'bg-[#ffcb01]/15 text-[#ffcb01]' : 'bg-[#005590]/15 text-[#005590]'}`}>
                                        {p.lemburHours > 0 ? `${p.lemburHours} jam` : '-'}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`apple-badge ${statusColor}`}>{p.status}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="mt-auto">
        <div className="apple-divider" />
        <div className="py-8 text-center">
          <p className="text-xs text-white/70">
            Sistem Presensi Digital &copy; {new Date().getFullYear()} &mdash; Universitas Tulungagung
          </p>
        </div>
      </footer>

      </div>

      {/* ===== Photo Modal ===== */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-lg w-full rounded-2xl p-2 animate-fade-in-up" style={{ background: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,85,144,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedPhoto(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10" style={{ background: "#005590" }}>
              <X className="w-4 h-4 text-white" />
            </button>
            <img src={selectedPhoto} alt="Foto Presensi" className="w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* ===== Password Modal ===== */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => { setShowPasswordModal(false); setPasswordInput(""); setPasswordError(false); }}>
          <div className="relative max-w-sm w-full rounded-2xl p-6 sm:p-8 animate-fade-in-up" style={{ background: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,85,144,0.1)" }} onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button onClick={() => { setShowPasswordModal(false); setPasswordInput(""); setPasswordError(false); }} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(0,85,144,0.08)" }}>
              <X className="w-4 h-4 text-white/70" />
            </button>

            {/* Lock icon */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255, 203, 1, 0.12)" }}>
                <Lock className="w-7 h-7" style={{ color: "#ffcb01" }} />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-white text-center mb-2">Menu Terkunci</h3>
            <p className="text-xs text-white/70 text-center mb-6">
              Menu <span className="text-white font-medium">{pendingTab === "laporan" ? "Laporan" : "Analisa"}</span> memerlukan password untuk mengakses
            </p>

            {/* Password input */}
            <div className="mb-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={handlePasswordKeyDown}
                placeholder="Masukkan password"
                className="apple-input text-center"
                autoFocus
              />
            </div>

            {/* Error message */}
            {passwordError && (
              <p className="text-xs text-[#e6b800] text-center mb-4 animate-fade-in-up">
                Password salah. Silakan coba lagi.
              </p>
            )}

            {/* Submit button */}
            <button onClick={handlePasswordSubmit} className="apple-btn apple-btn-blue w-full" style={{ background: "#ffcb01" }}>
              <Lock className="w-4 h-4" />
              Buka Kunci
            </button>
          </div>
        </div>
      )}

    </>
  );
}

// ============ CLOCK COMPONENT ============
function ClockDisplay() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{time}</>;
}
