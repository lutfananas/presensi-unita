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
  Activity,
  Building2,
  User,
  MessageSquare,
  X,
  Calendar,
  Filter,
  FileText,
  TrendingUp,
  PieChart,
  MapPin,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";

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
  "BIPA",
  "Inkubator Bisnis",
  "Galeri Investasi",
  "IT Mart",
];

type TabType = "presensi" | "wfh" | "laporan" | "analisa";
type AnalisaPeriod = "daily" | "weekly" | "monthly";

interface AttendanceRecord {
  id: string;
  namaLengkap: string;
  unitKerja: string;
  type: string;
  pesan: string | null;
  photoData: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  createdAt: string;
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

  // Attendance Form State
  const [namaLengkap, setNamaLengkap] = useState("");
  const [unitKerja, setUnitKerja] = useState("");
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
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await reverseGeocode(lat, lng);
          setIsGettingLocation(false);
          resolve({ lat, lng, address });
        },
        (error) => {
          setIsGettingLocation(false);
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

    // Green border top of bar
    ctx.fillStyle = "#4caf50";
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

  // ============ SUBMIT HANDLERS ============
  const handleSubmitAttendance = async (type: "HADIR" | "PULANG") => {
    if (!namaLengkap.trim()) { toast({ title: "Nama wajib diisi", variant: "destructive" }); return; }
    if (!unitKerja) { toast({ title: "Unit kerja wajib dipilih", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaLengkap: namaLengkap.trim(), unitKerja, type, pesan: pesan.trim() || null, photoData, latitude: geoLocation?.lat ?? null, longitude: geoLocation?.lng ?? null, locationAddress: geoLocation?.address ?? null }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `${type === "HADIR" ? "Absensi Hadir" : "Absensi Pulang"} berhasil!`, description: `Data untuk ${namaLengkap.trim()} telah tersimpan` });
        setNamaLengkap(""); setUnitKerja(""); setPesan(""); setPhotoData(null); setGeoLocation(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchStats();
      } else { toast({ title: "Gagal menyimpan", variant: "destructive" }); }
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

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], { type: `${mimeType};charset=utf-8` });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
  };

  const generateAttendanceCSV = (data: AttendanceRecord[]) => {
    const headers = ["Waktu", "Nama Lengkap", "Unit Kerja", "Tipe", "Pesan"];
    const rows = data.map(r => [formatDateTime(r.createdAt), r.namaLengkap, r.unitKerja, r.type, r.pesan || "-"]);
    return [headers, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
  };

  const generateWFHCSV = (data: WFHRecord[]) => {
    const headers = ["Waktu", "Nama Lengkap", "Unit Kerja", "Deskripsi Pekerjaan"];
    const rows = data.map(r => [formatDateTime(r.createdAt), r.namaLengkap, r.unitKerja, r.deskripsiPekerjaan]);
    return [headers, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
  };

  const handleExportCSV = () => {
    const csvData = reportTab === "presensi" ? generateAttendanceCSV(attendanceData) : generateWFHCSV(wfhData);
    downloadFile(csvData, reportTab === "presensi" ? `absensi-${filterDate}.csv` : `wfh-${filterDate}.csv`, "text/csv");
    toast({ title: "Export CSV berhasil!" });
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
  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Parallax Background */}
      <div className="parallax-bg">
        <div className="particle" /><div className="particle" /><div className="particle" />
        <div className="particle" /><div className="particle" /><div className="particle" />
        <div className="particle" /><div className="particle" />
      </div>

      {/* Header */}
      <header className="relative z-10 liquid-glass-static border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden liquid-glass-static p-1 flex-shrink-0">
                <Image src="/logo-universitas.png" alt="Logo Universitas Tulungagung" width={48} height={48} className="rounded-lg object-contain" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-shimmer">Universitas Tulungagung</h1>
                <p className="text-xs md:text-sm text-[#9fa8da]">Sistem Presensi Digital</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-[#9fa8da]">
              <div className="pulse-dot w-2 h-2 bg-green-400 rounded-full" /><span>Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="relative z-10 liquid-glass-static border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {([
              { id: "presensi" as TabType, label: "Presensi", icon: ClipboardList },
              { id: "wfh" as TabType, label: "WFH", icon: Activity },
              { id: "laporan" as TabType, label: "Laporan", icon: BarChart3 },
              { id: "analisa" as TabType, label: "Analisa", icon: TrendingUp },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-5 py-3.5 text-sm font-medium transition-all duration-300 relative whitespace-nowrap ${activeTab === tab.id ? "text-white tab-active" : "text-[#9fa8da] hover:text-white"}`}>
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 pb-12 flex-1">
        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-in-up">
            {[
              { val: stats.today.hadir, label: "Hadir Hari Ini", icon: LogIn, color: "bg-green-500/20", iconColor: "text-green-400" },
              { val: stats.today.pulang, label: "Pulang Hari Ini", icon: LogOut, color: "bg-red-500/20", iconColor: "text-red-400" },
              { val: stats.today.uniquePeople, label: "Jumlah Hari Ini", icon: Users, color: "bg-blue-500/20", iconColor: "text-blue-400" },
              { val: stats.totals.wfh, label: "Total WFH", icon: Activity, color: "bg-orange-500/20", iconColor: "text-orange-400" },
            ].map((s, i) => (
              <div key={i} className="stat-card liquid-glass rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{s.val}</p>
                    <p className="text-xs text-[#9fa8da]">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== TAB: PRESENSI ========== */}
        {activeTab === "presensi" && (
          <div className="animate-fade-in-up">
            <div className="liquid-glass rounded-2xl p-6 mb-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2"><Clock className="w-5 h-5 text-[#7986cb]" /><span className="text-sm text-[#9fa8da]">Waktu Lokal</span></div>
              <p className="text-2xl md:text-3xl font-bold text-white font-mono tracking-wider"><ClockDisplay /></p>
            </div>
            <div className="liquid-glass rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-[#7986cb]" />Form Presensi</h2>
              <div className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><User className="w-4 h-4" />Nama Lengkap <span className="text-red-400">*</span><span className="text-xs text-[#7986cb] ml-1">(tanpa gelar)</span></label>
                  <input type="text" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} placeholder="Masukkan nama lengkap tanpa gelar" className="w-full px-4 py-3 rounded-xl liquid-glass-input text-white placeholder:text-[#5c6bc0]/50 text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><Building2 className="w-4 h-4" />Unit Kerja <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <select value={unitKerja} onChange={(e) => setUnitKerja(e.target.value)} className="w-full px-4 py-3 rounded-xl liquid-glass-input text-white text-sm appearance-none cursor-pointer">
                      <option value="" className="bg-[#0a0e27] text-[#9fa8da]">-- Pilih Unit Kerja --</option>
                      {UNIT_KERJA_LIST.map((unit) => (<option key={unit} value={unit} className="bg-[#0a0e27]">{unit}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7986cb] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><MessageSquare className="w-4 h-4" />Pesan <span className="text-xs text-[#7986cb] ml-1">(opsional)</span></label>
                  <textarea value={pesan} onChange={(e) => setPesan(e.target.value)} placeholder="Contoh: Terlambat karena praktikum jam 12, izin pulang awal karena sakit, dll." rows={3} className="w-full px-4 py-3 rounded-xl liquid-glass-input text-white placeholder:text-[#5c6bc0]/50 text-sm resize-none" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><Camera className="w-4 h-4" />Foto Selfie Geotag</label>
                  {/* GeoTag Status & Button */}
                  <div className="mb-3">
                    {geoLocation ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <MapPin className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-green-400">Lokasi aktif</p>
                          <p className="text-xs text-[#9fa8da] truncate">{geoLocation.address}</p>
                        </div>
                        <button onClick={() => setGeoLocation(null)} className="text-[#5c6bc0] hover:text-red-400 transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={async () => { const loc = await requestGeoLocation(); if (loc) setGeoLocation(loc); }} disabled={isGettingLocation} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#42a5f5]/40 hover:border-[#42a5f5]/60 hover:bg-[#1a237e]/20 transition-all w-full text-left">
                        {isGettingLocation ? <Loader2 className="w-4 h-4 text-[#42a5f5] animate-spin" /> : <MapPin className="w-4 h-4 text-[#42a5f5]" />}
                        <div className="flex-1">
                          <p className="text-xs font-medium text-[#64b5f6]">{isGettingLocation ? "Mencari lokasi GPS..." : "Aktifkan Lokasi (GeoTag)"}</p>
                          <p className="text-xs text-[#5c6bc0]">{isGettingLocation ? "Mohon tunggu..." : "Foto akan dilengkapi timestamp & lokasi otomatis"}</p>
                        </div>
                      </button>
                    )}
                  </div>
                  <div onClick={() => fileInputRef.current?.click()} className="relative border-2 border-dashed border-[#3f51b5]/40 rounded-xl p-6 text-center cursor-pointer hover:border-[#5c6bc0]/60 transition-all duration-300 hover:bg-[#1a237e]/20 group">
                    {photoData ? (
                      <div className="photo-preview-container mx-auto w-40 h-52 mb-3 relative"><img src={photoData} alt="Preview" className="w-full h-full object-cover rounded-xl" /><div className="absolute bottom-0 left-0 right-0 bg-black/50 text-center py-1 rounded-b-xl"><p className="text-[10px] text-green-400 font-medium">📷 GeoTag Aktif</p></div></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-[#1a237e]/40 flex items-center justify-center group-hover:bg-[#1a237e]/60 transition-all"><Camera className="w-8 h-8 text-[#7986cb]" /></div>
                        <p className="text-sm text-[#9fa8da]">Klik untuk ambil/Upload foto selfie</p>
                        <p className="text-xs text-[#5c6bc0]">{geoLocation ? "Foto akan dilengkapi GeoTag (waktu & lokasi)" : "Aktifkan lokasi di atas untuk GeoTag"}</p>
                      </div>
                    )}
                    {photoData && (<button onClick={(e) => { e.stopPropagation(); setPhotoData(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors z-10"><X className="w-4 h-4 text-white" /></button>)}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button onClick={() => handleSubmitAttendance("HADIR")} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl btn-glow btn-glow-hadir text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"><LogIn className="w-5 h-5" />{isSubmitting ? "Menyimpan..." : "Absen Hadir"}</button>
                  <button onClick={() => handleSubmitAttendance("PULANG")} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl btn-glow btn-glow-pulang text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"><LogOut className="w-5 h-5" />{isSubmitting ? "Menyimpan..." : "Absen Pulang"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TAB: WFH ========== */}
        {activeTab === "wfh" && (
          <div className="animate-fade-in-up">
            <div className="liquid-glass rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"><Activity className="w-5 h-5 text-orange-400" /></div>
                <div><h2 className="text-xl font-bold text-white">Submit Aktivitas WFH</h2><p className="text-xs text-[#9fa8da]">Catat aktivitas pekerjaan dari rumah Anda</p></div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><User className="w-4 h-4" />Nama Lengkap <span className="text-red-400">*</span><span className="text-xs text-[#7986cb] ml-1">(tanpa gelar)</span></label>
                  <input type="text" value={wfhNama} onChange={(e) => setWfhNama(e.target.value)} placeholder="Masukkan nama lengkap tanpa gelar" className="w-full px-4 py-3 rounded-xl liquid-glass-input text-white placeholder:text-[#5c6bc0]/50 text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><Building2 className="w-4 h-4" />Unit Kerja <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <select value={wfhUnit} onChange={(e) => setWfhUnit(e.target.value)} className="w-full px-4 py-3 rounded-xl liquid-glass-input text-white text-sm appearance-none cursor-pointer">
                      <option value="" className="bg-[#0a0e27] text-[#9fa8da]">-- Pilih Unit Kerja --</option>
                      {UNIT_KERJA_LIST.map((unit) => (<option key={unit} value={unit} className="bg-[#0a0e27]">{unit}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7986cb] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><ClipboardList className="w-4 h-4" />Deskripsi Pekerjaan <span className="text-red-400">*</span></label>
                  <textarea value={wfhDeskripsi} onChange={(e) => setWfhDeskripsi(e.target.value)} placeholder="Jelaskan aktivitas pekerjaan yang Anda lakukan saat WFH..." rows={5} className="w-full px-4 py-3 rounded-xl liquid-glass-input text-white placeholder:text-[#5c6bc0]/50 text-sm resize-none" />
                </div>
                <button onClick={handleSubmitWFH} disabled={isSubmittingWfh} className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl btn-glow btn-glow-wfh text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-5 h-5" />{isSubmittingWfh ? "Menyimpan..." : "Submit Aktivitas WFH"}</button>
              </div>
            </div>
            {stats && stats.recent.wfh.length > 0 && (
              <div className="liquid-glass rounded-2xl p-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-[#7986cb]" />Aktivitas WFH Terbaru</h3>
                <div className="space-y-3">
                  {stats.recent.wfh.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl bg-[#0a0e27]/40 border border-white/5">
                      <div className="flex items-center justify-between mb-1"><span className="font-medium text-white text-sm">{item.namaLengkap}</span><span className="text-xs text-[#7986cb]">{item.unitKerja}</span></div>
                      <p className="text-xs text-[#9fa8da] line-clamp-2">{item.deskripsiPekerjaan}</p>
                      <p className="text-xs text-[#5c6bc0] mt-1">{formatDateTime(item.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== TAB: LAPORAN ========== */}
        {activeTab === "laporan" && (
          <div className="animate-fade-in-up">
            <div className="liquid-glass rounded-2xl p-1 mb-4 inline-flex gap-1">
              <button onClick={() => setReportTab("presensi")} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${reportTab === "presensi" ? "bg-[#1a237e]/80 text-white" : "text-[#9fa8da] hover:text-white"}`}><span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Presensi</span></button>
              <button onClick={() => setReportTab("wfh")} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${reportTab === "wfh" ? "bg-[#e65100]/40 text-white" : "text-[#9fa8da] hover:text-white"}`}><span className="flex items-center gap-2"><Activity className="w-4 h-4" />WFH</span></button>
            </div>
            <div className="liquid-glass rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3"><Filter className="w-4 h-4 text-[#7986cb]" /><span className="text-sm font-medium text-[#c5cae9]">Filter</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs text-[#9fa8da] mb-1 block">Tanggal</label><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg liquid-glass-input text-white text-sm" /></div>
                <div><label className="text-xs text-[#9fa8da] mb-1 block">Unit Kerja</label><div className="relative"><select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="w-full px-3 py-2.5 rounded-lg liquid-glass-input text-white text-sm appearance-none cursor-pointer"><option value="SEMUA" className="bg-[#0a0e27]">Semua Unit</option>{UNIT_KERJA_LIST.map((u) => (<option key={u} value={u} className="bg-[#0a0e27]">{u}</option>))}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7986cb] pointer-events-none" /></div></div>
                {reportTab === "presensi" && (<div><label className="text-xs text-[#9fa8da] mb-1 block">Tipe</label><div className="relative"><select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-3 py-2.5 rounded-lg liquid-glass-input text-white text-sm appearance-none cursor-pointer"><option value="SEMUA" className="bg-[#0a0e27]">Semua Tipe</option><option value="HADIR" className="bg-[#0a0e27]">Hadir</option><option value="PULANG" className="bg-[#0a0e27]">Pulang</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7986cb] pointer-events-none" /></div></div>)}
                <div><label className="text-xs text-[#9fa8da] mb-1 block">Cari Nama</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7986cb]" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama..." className="w-full pl-9 pr-3 py-2.5 rounded-lg liquid-glass-input text-white text-sm placeholder:text-[#5c6bc0]/50" /></div></div>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs text-[#9fa8da]">{reportTab === "presensi" ? `Menampilkan ${attendanceData.length} data absensi` : `Menampilkan ${wfhData.length} data WFH`}</p>
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs text-[#7986cb] hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-[#1a237e]/40 hover:bg-[#1a237e]/60"><Download className="w-3.5 h-3.5" />Export CSV</button>
            </div>
            {reportTab === "presensi" && (
              <div className="liquid-glass rounded-2xl overflow-hidden">
                {isLoadingData ? (<div className="p-12 text-center text-[#9fa8da]"><div className="animate-spin w-8 h-8 border-2 border-[#3f51b5] border-t-transparent rounded-full mx-auto mb-3" /><p className="text-sm">Memuat data...</p></div>) : attendanceData.length === 0 ? (<div className="p-12 text-center text-[#9fa8da]"><ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Belum ada data absensi</p></div>) : (
                  <div className="overflow-x-auto custom-scrollbar max-h-[70vh] overflow-y-auto">
                    <table className="w-full data-table text-sm">
                      <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-4 py-3 font-medium">Waktu</th><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium hidden md:table-cell">Unit Kerja</th><th className="px-4 py-3 font-medium">Tipe</th><th className="px-4 py-3 font-medium hidden lg:table-cell">Pesan</th><th className="px-4 py-3 font-medium hidden xl:table-cell">Lokasi</th><th className="px-4 py-3 font-medium text-center">Foto</th><th className="px-4 py-3 font-medium text-center">Aksi</th></tr></thead>
                      <tbody className="divide-y divide-white/5">{attendanceData.map((r) => (
                        <tr key={r.id} className="text-[#c5cae9]">
                          <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                          <td className="px-4 py-3 font-medium text-white text-sm">{r.namaLengkap}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs">{r.unitKerja}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${r.type === "HADIR" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{r.type === "HADIR" ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}{r.type}</span></td>
                          <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]"><span className="text-xs text-[#9fa8da] line-clamp-2">{r.pesan || "-"}</span></td>
                          <td className="px-4 py-3 hidden xl:table-cell">{r.locationAddress ? (<span className="text-xs text-[#64b5f6] flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate max-w-[150px]">{r.locationAddress.split(',')[0]}</span></span>) : (<span className="text-xs text-[#5c6bc0]/50">-</span>)}</td>
                          <td className="px-4 py-3 text-center">{r.photoData ? (<button onClick={() => setSelectedPhoto(r.photoData)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1a237e]/40 hover:bg-[#1a237e]/60 transition-colors"><Eye className="w-4 h-4 text-[#7986cb]" /></button>) : (<span className="text-xs text-[#5c6bc0]/50">-</span>)}</td>
                          <td className="px-4 py-3 text-center"><button onClick={() => handleDeleteRecord(r.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4 text-red-400" /></button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {reportTab === "wfh" && (
              <div className="liquid-glass rounded-2xl overflow-hidden">
                {isLoadingData ? (<div className="p-12 text-center text-[#9fa8da]"><div className="animate-spin w-8 h-8 border-2 border-[#f57c00] border-t-transparent rounded-full mx-auto mb-3" /><p className="text-sm">Memuat data...</p></div>) : wfhData.length === 0 ? (<div className="p-12 text-center text-[#9fa8da]"><Activity className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Belum ada data WFH</p></div>) : (
                  <div className="overflow-x-auto custom-scrollbar max-h-[70vh] overflow-y-auto">
                    <table className="w-full data-table text-sm">
                      <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-4 py-3 font-medium">Waktu</th><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium hidden md:table-cell">Unit Kerja</th><th className="px-4 py-3 font-medium">Deskripsi</th></tr></thead>
                      <tbody className="divide-y divide-white/5">{wfhData.map((r) => (<tr key={r.id} className="text-[#c5cae9]"><td className="px-4 py-3 whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td><td className="px-4 py-3 font-medium text-white text-sm">{r.namaLengkap}</td><td className="px-4 py-3 hidden md:table-cell text-xs">{r.unitKerja}</td><td className="px-4 py-3 max-w-[300px]"><span className="text-xs text-[#9fa8da]">{r.deskripsiPekerjaan}</span></td></tr>))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== TAB: ANALISA ========== */}
        {activeTab === "analisa" && (
          <div className="animate-fade-in-up">
            {/* Period & Filter */}
            <div className="liquid-glass rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-[#7986cb]" /><span className="text-sm font-medium text-[#c5cae9]">Analisa Kehadiran</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9fa8da] mb-1 block">Periode</label>
                  <div className="liquid-glass rounded-xl p-1 inline-flex gap-1">
                    {([["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"]] as [AnalisaPeriod, string][]).map(([val, lbl]) => (
                      <button key={val} onClick={() => setAnalisaPeriod(val)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${analisaPeriod === val ? "bg-[#3f51b5] text-white" : "text-[#9fa8da] hover:text-white"}`}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#9fa8da] mb-1 block">Unit Kerja</label>
                  <div className="relative">
                    <select value={analisaUnit} onChange={(e) => setAnalisaUnit(e.target.value)} className="w-full px-3 py-2.5 rounded-lg liquid-glass-input text-white text-sm appearance-none cursor-pointer">
                      <option value="SEMUA" className="bg-[#0a0e27]">Semua Unit</option>
                      {UNIT_KERJA_LIST.map((u) => (<option key={u} value={u} className="bg-[#0a0e27]">{u}</option>))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7986cb] pointer-events-none" />
                  </div>
                </div>
              </div>
              {analysisData && (
                <p className="text-xs text-[#5c6bc0] mt-2"><Calendar className="w-3 h-3 inline mr-1" />{analysisData.periodLabel}</p>
              )}
            </div>

            {/* Export PDF */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="liquid-glass rounded-2xl p-1 inline-flex gap-1">
                {([["ringkasan", "Ringkasan", PieChart], ["unit", "Per Unit", Building2], ["personal", "Per Orang", Users]] as [string, string, React.ElementType][]).map(([val, lbl, Ic]) => (
                  <button key={val} onClick={() => setAnalisaSubTab(val as typeof analisaSubTab)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${analisaSubTab === val ? "bg-[#1a237e]/80 text-white" : "text-[#9fa8da] hover:text-white"}`}><Ic className="w-3.5 h-3.5" />{lbl}</button>
                ))}
              </div>
              <button onClick={exportAnalysisPDF} disabled={!analysisData} className="flex items-center gap-1.5 text-xs text-[#7986cb] hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-[#1a237e]/40 hover:bg-[#1a237e]/60 disabled:opacity-50"><FileText className="w-3.5 h-3.5" />Export PDF</button>
            </div>

            {isLoadingAnalysis ? (
              <div className="p-16 text-center text-[#9fa8da]"><div className="animate-spin w-10 h-10 border-2 border-[#3f51b5] border-t-transparent rounded-full mx-auto mb-4" /><p className="text-sm">Memuat data analisa...</p></div>
            ) : !analysisData ? (
              <div className="p-16 text-center text-[#9fa8da]"><TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-20" /><p className="text-sm">Belum ada data analisa</p></div>
            ) : (
              <>
                {/* Aturan Kehadiran Info */}
                <div className="liquid-glass rounded-2xl p-4 mb-6 border-l-4 border-[#42a5f5]">
                  <h3 className="text-sm font-semibold text-[#64b5f6] mb-3 flex items-center gap-2"><FileText className="w-4 h-4" />Aturan Kehadiran</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#0a0e27]/50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-[#64b5f6] mb-1">Jam Kerja</p>
                      <p className="text-xs text-[#c5cae9]">08:00 - 14:00 WIB (6 jam)</p>
                    </div>
                    <div className="bg-[#0a0e27]/50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-400 mb-1">Terlambat</p>
                      <p className="text-xs text-[#c5cae9]">Absen hadir setelah pukul 08:00. Pegawai terlambat tidak mendapatkan hak lembur.</p>
                    </div>
                    <div className="bg-[#0a0e27]/50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-400 mb-1">Lembur</p>
                      <p className="text-xs text-[#c5cae9]">Hanya pegawai yang hadir sebelum/tepat 08:00. Pulang 14:00-14:59 belum lembur. Pulang mulai 15:00 = lembur 1 jam.</p>
                    </div>
                  </div>
                </div>

                {/* Insight Pimpinan */}
                {analysisData.insights && analysisData.insights.length > 0 && (
                  <div className="liquid-glass rounded-2xl p-5 mb-6 border-l-4 border-[#7c4dff]">
                    <h3 className="text-sm font-semibold text-[#b388ff] mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Insight untuk Pimpinan</h3>
                    <ul className="space-y-2">
                      {analysisData.insights.map((insight, i) => (
                        <li key={i} className="text-xs text-[#c5cae9] flex gap-2"><span className="text-[#7c4dff] font-bold mt-px">&#9679;</span><span>{insight}</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Pegawai Aktif", val: analysisData.summary.uniquePeople, color: "bg-blue-500/20 text-blue-400" },
                    { label: "Terlambat (>08:00)", val: analysisData.summary.latePeople, color: analysisData.summary.latePeople === 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400" },
                    { label: "Total Lembur", val: analysisData.summary.totalOvertimeHours > 0 ? `${analysisData.summary.totalOvertimeHours} jam` : "0 jam", color: analysisData.summary.totalOvertimeHours > 0 ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400" },
                  ].map((s, i) => (
                    <div key={i} className="stat-card liquid-glass rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{s.val}</p>
                      <p className={`text-xs mt-1 ${s.color.split(" ")[1]}`}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Total Hadir", val: analysisData.summary.totalHadir, color: "bg-green-500/20 text-green-400" },
                    { label: "Total Pulang", val: analysisData.summary.totalPulang, color: "bg-red-500/20 text-red-400" },
                    { label: "Total WFH", val: analysisData.summary.totalWFH, color: "bg-orange-500/20 text-orange-400" },
                    { label: "Total Rekord", val: analysisData.summary.totalRecords, color: "bg-purple-500/20 text-purple-400" },
                  ].map((s, i) => (
                    <div key={i} className="stat-card liquid-glass rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{s.val}</p>
                      <p className={`text-xs mt-1 ${s.color.split(" ")[1]}`}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Ringkasan Tab */}
                {analisaSubTab === "ringkasan" && (
                  <>
                    {/* Daily Breakdown */}
                    <div className="liquid-glass rounded-2xl p-5 mb-4">
                      <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#7986cb]" />Rekap Harian</h3>
                      {analysisData.dailyBreakdown.length === 0 ? (<p className="text-sm text-[#9fa8da] text-center py-4">Belum ada data</p>) : (
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full data-table text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-3 py-2.5 font-medium">Tanggal</th><th className="px-3 py-2.5 font-medium text-center">Hadir</th><th className="px-3 py-2.5 font-medium text-center">Pulang</th><th className="px-3 py-2.5 font-medium text-center">Jumlah</th><th className="px-3 py-2.5 font-medium text-center">Terlambat</th><th className="px-3 py-2.5 font-medium text-center">Lembur</th><th className="px-3 py-2.5 font-medium text-center">Status</th></tr></thead>
                            <tbody className="divide-y divide-white/5">{analysisData.dailyBreakdown.map((d, i) => {
                              const statusColor = d.status === 'Baik' ? 'bg-green-500/20 text-green-400' : d.status === 'Cukup' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
                              return (
                                <tr key={i} className="text-[#c5cae9]">
                                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{d.day}</td>
                                  <td className="px-3 py-2.5 text-center"><span className="text-green-400 font-medium">{d.hadir}</span></td>
                                  <td className="px-3 py-2.5 text-center"><span className="text-red-400 font-medium">{d.pulang}</span></td>
                                  <td className="px-3 py-2.5 text-center font-medium text-white">{d.unique}</td>
                                  <td className="px-3 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.lateCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{d.lateCount}</span></td>
                                  <td className="px-3 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.overtimeHours > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{d.overtimeHours > 0 ? `${d.overtimeHours} jam` : '-'}</span></td>
                                  <td className="px-3 py-2.5 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{d.status}</span></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Lembur Detail Records */}
                    {analysisData.lemburRecords && analysisData.lemburRecords.length > 0 && (
                      <div className="liquid-glass rounded-2xl p-5 mb-4 border-l-4 border-amber-500">
                        <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />Detail Lembur Pegawai</h3>
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full data-table text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-3 py-2.5 font-medium">Nama</th><th className="px-3 py-2.5 font-medium text-center">Tanggal</th><th className="px-3 py-2.5 font-medium text-center">Jam Hadir</th><th className="px-3 py-2.5 font-medium text-center">Jam Pulang</th><th className="px-3 py-2.5 font-medium text-center">Lembur</th></tr></thead>
                            <tbody className="divide-y divide-white/5">{analysisData.lemburRecords.map((r, i) => (
                              <tr key={i} className="text-[#c5cae9]">
                                <td className="px-3 py-2.5 text-xs font-medium text-white">{r.namaLengkap}</td>
                                <td className="px-3 py-2.5 text-center text-xs">{r.date}</td>
                                <td className="px-3 py-2.5 text-center text-xs">{r.hadirTime}</td>
                                <td className="px-3 py-2.5 text-center text-xs">{r.pulangTime}</td>
                                <td className="px-3 py-2.5 text-center"><span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{r.lemburHours} jam</span></td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Unit Tab */}
                {analisaSubTab === "unit" && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#7986cb]" />Rekap Per Unit Kerja</h3>
                    {analysisData.unitBreakdown.length === 0 ? (<p className="text-sm text-[#9fa8da] text-center py-4">Belum ada data</p>) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full data-table text-sm">
                          <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-3 py-2.5 font-medium">Unit Kerja</th><th className="px-3 py-2.5 font-medium text-center">Jumlah</th><th className="px-3 py-2.5 font-medium text-center">Hadir</th><th className="px-3 py-2.5 font-medium text-center">Pulang</th><th className="px-3 py-2.5 font-medium text-center">WFH</th><th className="px-3 py-2.5 font-medium text-center">Terlambat</th><th className="px-3 py-2.5 font-medium text-center">Lembur</th><th className="px-3 py-2.5 font-medium text-center">Status</th></tr></thead>
                          <tbody className="divide-y divide-white/5">{analysisData.unitBreakdown.map((u, i) => {
                            const statusColor = u.status === 'Aktif' ? 'bg-green-500/20 text-green-400' : u.status === 'Cukup' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
                            return (
                              <tr key={i} className="text-[#c5cae9]">
                                <td className="px-3 py-2.5 text-xs font-medium text-white">{i + 1}. {u.unitKerja}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-white">{u.unique}</td>
                                <td className="px-3 py-2.5 text-center"><span className="text-green-400">{u.hadir}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className="text-red-400">{u.pulang}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className="text-orange-400">{u.wfh}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.lateCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{u.lateCount}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.overtimeHours > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{u.overtimeHours > 0 ? `${u.overtimeHours} jam` : '-'}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{u.status}</span></td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Personal Tab */}
                {analisaSubTab === "personal" && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#7986cb]" />Rekap Per Orang</h3>
                    {analysisData.personBreakdown.length === 0 ? (<p className="text-sm text-[#9fa8da] text-center py-4">Belum ada data</p>) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full data-table text-sm">
                          <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-3 py-2.5 font-medium">Nama</th><th className="px-3 py-2.5 font-medium hidden md:table-cell">Unit Kerja</th><th className="px-3 py-2.5 font-medium text-center">Hari</th><th className="px-3 py-2.5 font-medium text-center">Hadir</th><th className="px-3 py-2.5 font-medium text-center">Pulang</th><th className="px-3 py-2.5 font-medium text-center">WFH</th><th className="px-3 py-2.5 font-medium text-center">Terlambat</th><th className="px-3 py-2.5 font-medium text-center">Lembur</th><th className="px-3 py-2.5 font-medium text-center">Status</th></tr></thead>
                          <tbody className="divide-y divide-white/5">{analysisData.personBreakdown.map((p, i) => {
                            const statusColor = p.status === 'Disiplin' ? 'bg-green-500/20 text-green-400' : p.status === 'Cukup' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
                            return (
                              <tr key={i} className="text-[#c5cae9]">
                                <td className="px-3 py-2.5 font-medium text-white text-xs">{i + 1}. {p.namaLengkap}</td>
                                <td className="px-3 py-2.5 hidden md:table-cell text-xs">{p.unitKerja}</td>
                                <td className="px-3 py-2.5 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">{p.activeDays}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">{p.hadir}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">{p.pulang}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">{p.wfh}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.lateCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{p.lateCount > 0 ? `${p.lateCount}x` : '-'}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.lemburHours > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{p.lemburHours > 0 ? `${p.lemburHours} jam` : '-'}</span></td>
                                <td className="px-3 py-2.5 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{p.status}</span></td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-lg w-full liquid-glass-static rounded-2xl p-2 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedPhoto(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors z-10"><X className="w-4 h-4 text-white" /></button>
            <img src={selectedPhoto} alt="Foto Presensi" className="w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 mt-auto">
        <div className="liquid-glass-static border-t border-white/5 py-4">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-xs text-[#5c6bc0]">Sistem Presensi Digital &copy; {new Date().getFullYear()} — Universitas Tulungagung</p>
          </div>
        </div>
      </footer>
    </div>
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
