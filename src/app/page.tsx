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
  summary: { totalHadir: number; totalPulang: number; uniquePeople: number; totalWFH: number; totalRecords: number };
  dailyBreakdown: { day: string; hadir: number; pulang: number; unique: number }[];
  unitBreakdown: { unitKerja: string; hadir: number; pulang: number; wfh: number; unique: number }[];
  personBreakdown: { namaLengkap: string; unitKerja: string; hadir: number; pulang: number; wfh: number; total: number; pesan: string[] }[];
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

  // ============ PHOTO HANDLING ============
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
        const canvas = document.createElement("canvas");
        const maxW = 800, maxH = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        if (h > maxH) { w = (w * maxH) / h; h = maxH; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        setPhotoData(canvas.toDataURL("image/jpeg", 0.7));
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
        body: JSON.stringify({ namaLengkap: namaLengkap.trim(), unitKerja, type, pesan: pesan.trim() || null, photoData }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `${type === "HADIR" ? "Absensi Hadir" : "Absensi Pulang"} berhasil!`, description: `Data untuk ${namaLengkap.trim()} telah tersimpan` });
        setNamaLengkap(""); setUnitKerja(""); setPesan(""); setPhotoData(null);
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
    doc.text(`Total Absensi Hadir: ${s.totalHadir}`, 14, y); y += 5;
    doc.text(`Total Absensi Pulang: ${s.totalPulang}`, 14, y); y += 5;
    doc.text(`Jumlah Orang Unik: ${s.uniquePeople}`, 14, y); y += 5;
    doc.text(`Total Aktivitas WFH: ${s.totalWFH}`, 14, y); y += 5;
    doc.text(`Total Rekord: ${s.totalRecords}`, 14, y); y += 10;

    // Unit breakdown
    if (analysisData.unitBreakdown.length > 0 && y < pageH - 40) {
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Rekap Per Unit Kerja", 14, y); y += 7;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("No", 14, y); doc.text("Unit Kerja", 24, y); doc.text("Hadir", 120, y);
      doc.text("Pulang", 150, y); doc.text("WFH", 180, y); doc.text("Orang Unik", 210, y);
      y += 2; doc.setLineWidth(0.3); doc.line(14, y, pageW - 14, y); y += 4;
      doc.setFont("helvetica", "normal");
      analysisData.unitBreakdown.forEach((u, i) => {
        if (y > pageH - 15) { doc.addPage(); y = 15; }
        doc.text(`${i + 1}`, 14, y); doc.text(u.unitKerja, 24, y);
        doc.text(String(u.hadir), 120, y); doc.text(String(u.pulang), 150, y);
        doc.text(String(u.wfh), 180, y); doc.text(String(u.unique), 210, y);
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
      doc.text("Tanggal", 14, y); doc.text("Hadir", 80, y); doc.text("Pulang", 120, y); doc.text("Unik", 160, y);
      y += 2; doc.line(14, y, pageW - 14, y); y += 4;
      doc.setFont("helvetica", "normal");
      analysisData.dailyBreakdown.forEach((d) => {
        if (y > pageH - 15) { doc.addPage(); y = 15; }
        doc.text(d.day, 14, y); doc.text(String(d.hadir), 80, y);
        doc.text(String(d.pulang), 120, y); doc.text(String(d.unique), 160, y);
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
      doc.text("No", 14, y); doc.text("Nama", 24, y); doc.text("Unit Kerja", 100, y);
      doc.text("Hadir", 170, y); doc.text("Pulang", 200, y); doc.text("WFH", 230, y);
      doc.text("Pesan/Keterangan", 255, y);
      y += 2; doc.line(14, y, pageW - 14, y); y += 4;
      doc.setFont("helvetica", "normal");
      analysisData.personBreakdown.forEach((p, i) => {
        if (y > pageH - 10) { doc.addPage(); y = 15; }
        doc.text(`${i + 1}`, 14, y); doc.text(p.namaLengkap, 24, y);
        doc.text(p.unitKerja, 100, y, { maxWidth: 65 });
        doc.text(String(p.hadir), 170, y); doc.text(String(p.pulang), 200, y);
        doc.text(String(p.wfh), 230, y);
        const pesanStr = p.pesan.length > 0 ? p.pesan.join("; ") : "-";
        doc.text(pesanStr.substring(0, 40), 255, y, { maxWidth: 40 });
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
              { val: stats.today.uniquePeople, label: "Unik Hari Ini", icon: Users, color: "bg-blue-500/20", iconColor: "text-blue-400" },
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
                  <label className="flex items-center gap-2 text-sm font-medium text-[#c5cae9] mb-2"><Camera className="w-4 h-4" />Foto Selfie</label>
                  <div onClick={() => fileInputRef.current?.click()} className="relative border-2 border-dashed border-[#3f51b5]/40 rounded-xl p-6 text-center cursor-pointer hover:border-[#5c6bc0]/60 transition-all duration-300 hover:bg-[#1a237e]/20 group">
                    {photoData ? (
                      <div className="photo-preview-container mx-auto w-40 h-40 mb-3"><img src={photoData} alt="Preview" className="w-full h-full object-cover rounded-xl" /></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-[#1a237e]/40 flex items-center justify-center group-hover:bg-[#1a237e]/60 transition-all"><Camera className="w-8 h-8 text-[#7986cb]" /></div>
                        <p className="text-sm text-[#9fa8da]">Klik untuk ambil/Upload foto selfie</p>
                        <p className="text-xs text-[#5c6bc0]">JPG/PNG, maks 5MB</p>
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
                      <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-4 py-3 font-medium">Waktu</th><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium hidden md:table-cell">Unit Kerja</th><th className="px-4 py-3 font-medium">Tipe</th><th className="px-4 py-3 font-medium hidden lg:table-cell">Pesan</th><th className="px-4 py-3 font-medium text-center">Foto</th><th className="px-4 py-3 font-medium text-center">Aksi</th></tr></thead>
                      <tbody className="divide-y divide-white/5">{attendanceData.map((r) => (
                        <tr key={r.id} className="text-[#c5cae9]">
                          <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                          <td className="px-4 py-3 font-medium text-white text-sm">{r.namaLengkap}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs">{r.unitKerja}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${r.type === "HADIR" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{r.type === "HADIR" ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}{r.type}</span></td>
                          <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]"><span className="text-xs text-[#9fa8da] line-clamp-2">{r.pesan || "-"}</span></td>
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
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: "Total Hadir", val: analysisData.summary.totalHadir, color: "bg-green-500/20 text-green-400" },
                    { label: "Total Pulang", val: analysisData.summary.totalPulang, color: "bg-red-500/20 text-red-400" },
                    { label: "Orang Unik", val: analysisData.summary.uniquePeople, color: "bg-blue-500/20 text-blue-400" },
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
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-4 py-2.5 font-medium">Tanggal</th><th className="px-4 py-2.5 font-medium text-center">Hadir</th><th className="px-4 py-2.5 font-medium text-center">Pulang</th><th className="px-4 py-2.5 font-medium text-center">Unik</th><th className="px-4 py-2.5 font-medium text-center">Visualisasi</th></tr></thead>
                            <tbody className="divide-y divide-white/5">{analysisData.dailyBreakdown.map((d, i) => {
                              const maxVal = Math.max(...analysisData.dailyBreakdown.map(x => x.hadir + x.pulang), 1);
                              const total = d.hadir + d.pulang;
                              const pct = (total / maxVal) * 100;
                              return (
                                <tr key={i} className="text-[#c5cae9]">
                                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">{d.day}</td>
                                  <td className="px-4 py-2.5 text-center"><span className="text-green-400 font-medium">{d.hadir}</span></td>
                                  <td className="px-4 py-2.5 text-center"><span className="text-red-400 font-medium">{d.pulang}</span></td>
                                  <td className="px-4 py-2.5 text-center font-medium text-white">{d.unique}</td>
                                  <td className="px-4 py-2.5"><div className="w-full bg-[#0a0e27] rounded-full h-3 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} /></div></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Unit Tab */}
                {analisaSubTab === "unit" && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#7986cb]" />Rekap Per Unit Kerja</h3>
                    {analysisData.unitBreakdown.length === 0 ? (<p className="text-sm text-[#9fa8da] text-center py-4">Belum ada data</p>) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full data-table text-sm">
                          <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-4 py-2.5 font-medium">Unit Kerja</th><th className="px-4 py-2.5 font-medium text-center">Hadir</th><th className="px-4 py-2.5 font-medium text-center">Pulang</th><th className="px-4 py-2.5 font-medium text-center">WFH</th><th className="px-4 py-2.5 font-medium text-center">Orang Unik</th><th className="px-4 py-2.5 font-medium text-center">Visualisasi</th></tr></thead>
                          <tbody className="divide-y divide-white/5">{analysisData.unitBreakdown.map((u, i) => {
                            const maxVal = Math.max(...analysisData.unitBreakdown.map(x => x.unique), 1);
                            const pct = (u.unique / maxVal) * 100;
                            return (
                              <tr key={i} className="text-[#c5cae9]">
                                <td className="px-4 py-2.5 text-sm font-medium text-white">{u.unitKerja}</td>
                                <td className="px-4 py-2.5 text-center"><span className="text-green-400">{u.hadir}</span></td>
                                <td className="px-4 py-2.5 text-center"><span className="text-red-400">{u.pulang}</span></td>
                                <td className="px-4 py-2.5 text-center"><span className="text-orange-400">{u.wfh}</span></td>
                                <td className="px-4 py-2.5 text-center font-bold text-white">{u.unique}</td>
                                <td className="px-4 py-2.5"><div className="w-full bg-[#0a0e27] rounded-full h-3 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#3f51b5] to-[#7986cb] transition-all duration-500" style={{ width: `${pct}%` }} /></div></td>
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
                          <thead><tr className="text-left text-xs uppercase tracking-wider text-[#9fa8da]"><th className="px-4 py-2.5 font-medium">Nama</th><th className="px-4 py-2.5 font-medium hidden md:table-cell">Unit Kerja</th><th className="px-4 py-2.5 font-medium text-center">Hadir</th><th className="px-4 py-2.5 font-medium text-center">Pulang</th><th className="px-4 py-2.5 font-medium text-center">WFH</th><th className="px-4 py-2.5 font-medium text-center hidden lg:table-cell">Pesan/Keterangan</th></tr></thead>
                          <tbody className="divide-y divide-white/5">{analysisData.personBreakdown.map((p, i) => (
                            <tr key={i} className="text-[#c5cae9]">
                              <td className="px-4 py-2.5 font-medium text-white text-sm">{i + 1}. {p.namaLengkap}</td>
                              <td className="px-4 py-2.5 hidden md:table-cell text-xs">{p.unitKerja}</td>
                              <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">{p.hadir}</span></td>
                              <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">{p.pulang}</span></td>
                              <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">{p.wfh}</span></td>
                              <td className="px-4 py-2.5 hidden lg:table-cell"><span className="text-xs text-[#9fa8da]">{p.pesan.length > 0 ? p.pesan.join("; ") : "-"}</span></td>
                            </tr>
                          ))}</tbody>
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
