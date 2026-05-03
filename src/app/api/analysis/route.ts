import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    const unit = searchParams.get('unit') || 'SEMUA';

    const now = new Date();
    let startDate: Date;
    let endDate = new Date();

    if (period === 'daily') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'weekly') {
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay() || 7; // Monday = 1
      startDate.setDate(startDate.getDate() - dayOfWeek + 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
    };
    if (unit && unit !== 'SEMUA') {
      where.unitKerja = unit;
    }

    const [allAttendance, allWFH] = await Promise.all([
      db.attendance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.wFHActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Summary stats
    const hadirRecords = allAttendance.filter(a => a.type === 'HADIR');
    const pulangRecords = allAttendance.filter(a => a.type === 'PULANG');
    const uniqueNames = new Set(allAttendance.map(a => a.namaLengkap));

    // Per-day breakdown
    const dayMap = new Map<string, { hadir: number; pulang: number; unique: Set<string> }>();
    allAttendance.forEach(a => {
      const day = new Date(a.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      if (!dayMap.has(day)) dayMap.set(day, { hadir: 0, pulang: 0, unique: new Set() });
      const entry = dayMap.get(day)!;
      if (a.type === 'HADIR') { entry.hadir++; entry.unique.add(a.namaLengkap); }
      else { entry.pulang++; entry.unique.add(a.namaLengkap); }
    });

    const dailyBreakdown = Array.from(dayMap.entries()).map(([day, data]) => ({
      day,
      hadir: data.hadir,
      pulang: data.pulang,
      unique: data.unique.size,
    })).reverse();

    // Per-unit breakdown
    const unitMap = new Map<string, { hadir: number; pulang: number; unique: Set<string>; wfh: number }>();
    allAttendance.forEach(a => {
      if (!unitMap.has(a.unitKerja)) unitMap.set(a.unitKerja, { hadir: 0, pulang: 0, unique: new Set(), wfh: 0 });
      const entry = unitMap.get(a.unitKerja)!;
      if (a.type === 'HADIR') { entry.hadir++; entry.unique.add(a.namaLengkap); }
      else { entry.pulang++; entry.unique.add(a.namaLengkap); }
    });
    allWFH.forEach(w => {
      if (!unitMap.has(w.unitKerja)) unitMap.set(w.unitKerja, { hadir: 0, pulang: 0, unique: new Set(), wfh: 0 });
      const entry = unitMap.get(w.unitKerja)!;
      entry.wfh++;
      entry.unique.add(w.namaLengkap);
    });

    const unitBreakdown = Array.from(unitMap.entries()).map(([unitKerja, data]) => ({
      unitKerja,
      hadir: data.hadir,
      pulang: data.pulang,
      wfh: data.wfh,
      unique: data.unique.size,
    })).sort((a, b) => b.unique - a.unique);

    // Per-person breakdown
    const personMap = new Map<string, { unitKerja: string; hadir: number; pulang: number; wfh: number; pesan: string[] }>();
    allAttendance.forEach(a => {
      if (!personMap.has(a.namaLengkap)) personMap.set(a.namaLengkap, { unitKerja: a.unitKerja, hadir: 0, pulang: 0, wfh: 0, pesan: [] });
      const entry = personMap.get(a.namaLengkap)!;
      entry.unitKerja = a.unitKerja;
      if (a.type === 'HADIR') entry.hadir++;
      else entry.pulang++;
      if (a.pesan) entry.pesan.push(a.pesan);
    });
    allWFH.forEach(w => {
      if (!personMap.has(w.namaLengkap)) personMap.set(w.namaLengkap, { unitKerja: w.unitKerja, hadir: 0, pulang: 0, wfh: 0, pesan: [] });
      const entry = personMap.get(w.namaLengkap)!;
      entry.unitKerja = w.unitKerja;
      entry.wfh++;
    });

    const personBreakdown = Array.from(personMap.entries()).map(([namaLengkap, data]) => ({
      namaLengkap,
      unitKerja: data.unitKerja,
      hadir: data.hadir,
      pulang: data.pulang,
      wfh: data.wfh,
      total: data.hadir + data.pulang + data.wfh,
      pesan: data.pesan,
    })).sort((a, b) => b.total - a.total);

    // Period label
    let periodLabel = '';
    if (period === 'daily') {
      periodLabel = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } else if (period === 'weekly') {
      periodLabel = `Minggu ke-${Math.ceil(now.getDate() / 7)} ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
    } else {
      periodLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    return NextResponse.json({
      success: true,
      data: {
        period: period,
        periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalHadir: hadirRecords.length,
          totalPulang: pulangRecords.length,
          uniquePeople: uniqueNames.size,
          totalWFH: allWFH.length,
          totalRecords: allAttendance.length,
        },
        dailyBreakdown,
        unitBreakdown,
        personBreakdown,
        attendanceRecords: allAttendance,
        wfhRecords: allWFH,
      },
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data analisa' },
      { status: 500 }
    );
  }
}
