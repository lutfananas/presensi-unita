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
    const uniqueHadirNames = new Set(hadirRecords.map(a => a.namaLengkap));
    const uniquePulangNames = new Set(pulangRecords.map(a => a.namaLengkap));

    // Late check-ins (after 08:00 WIB)
    const lateCheckIns = hadirRecords.filter(a => {
      const hour = new Date(a.createdAt).getHours();
      return hour >= 8;
    });

    // Peak hour analysis
    const hourMap = new Map<number, number>();
    hadirRecords.forEach(a => {
      const hour = new Date(a.createdAt).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });
    let peakHour = 0;
    let peakHourCount = 0;
    hourMap.forEach((count, hour) => {
      if (count > peakHourCount) { peakHour = hour; peakHourCount = count; }
    });

    // Check-out rate
    const checkOutRate = uniqueHadirNames.size > 0
      ? Math.round((uniquePulangNames.size / uniqueHadirNames.size) * 100)
      : 0;

    // Per-day breakdown with enhanced data
    const dayMap = new Map<string, { hadir: number; pulang: number; hadirNames: Set<string>; pulangNames: Set<string> }>();
    allAttendance.forEach(a => {
      const day = new Date(a.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      if (!dayMap.has(day)) dayMap.set(day, { hadir: 0, pulang: 0, hadirNames: new Set(), pulangNames: new Set() });
      const entry = dayMap.get(day)!;
      if (a.type === 'HADIR') { entry.hadir++; entry.hadirNames.add(a.namaLengkap); }
      else { entry.pulang++; entry.pulangNames.add(a.namaLengkap); }
    });

    const dailyBreakdown = Array.from(dayMap.entries()).map(([day, data]) => {
      const unique = new Set([...data.hadirNames, ...data.pulangNames]).size;
      const dayCheckOutRate = data.hadirNames.size > 0
        ? Math.round((data.pulangNames.size / data.hadirNames.size) * 100)
        : 0;
      let status: 'Baik' | 'Cukup' | 'Perlu Perhatian' = 'Baik';
      if (dayCheckOutRate < 50) status = 'Perlu Perhatian';
      else if (dayCheckOutRate < 80) status = 'Cukup';
      return { day, hadir: data.hadir, pulang: data.pulang, unique, checkOutRate: dayCheckOutRate, status };
    }).reverse();

    // Per-unit breakdown with enhanced data
    const unitMap = new Map<string, { hadir: number; pulang: number; hadirNames: Set<string>; pulangNames: Set<string>; wfh: number; wfhNames: Set<string> }>();
    allAttendance.forEach(a => {
      if (!unitMap.has(a.unitKerja)) unitMap.set(a.unitKerja, { hadir: 0, pulang: 0, hadirNames: new Set(), pulangNames: new Set(), wfh: 0, wfhNames: new Set() });
      const entry = unitMap.get(a.unitKerja)!;
      if (a.type === 'HADIR') { entry.hadir++; entry.hadirNames.add(a.namaLengkap); }
      else { entry.pulang++; entry.pulangNames.add(a.namaLengkap); }
    });
    allWFH.forEach(w => {
      if (!unitMap.has(w.unitKerja)) unitMap.set(w.unitKerja, { hadir: 0, pulang: 0, hadirNames: new Set(), pulangNames: new Set(), wfh: 0, wfhNames: new Set() });
      const entry = unitMap.get(w.unitKerja)!;
      entry.wfh++;
      entry.wfhNames.add(w.namaLengkap);
    });

    const maxUnitUnique = Math.max(...Array.from(unitMap.values()).map(d => new Set([...d.hadirNames, ...d.pulangNames, ...d.wfhNames]).size), 1);

    const unitBreakdown = Array.from(unitMap.entries()).map(([unitKerja, data]) => {
      const unique = new Set([...data.hadirNames, ...data.pulangNames, ...data.wfhNames]).size;
      const unitCheckOutRate = data.hadirNames.size > 0
        ? Math.round((data.pulangNames.size / data.hadirNames.size) * 100)
        : 0;
      const totalActivities = data.hadir + data.pulang + data.wfh;
      const wfhRate = totalActivities > 0 ? Math.round((data.wfh / totalActivities) * 100) : 0;
      const activityRate = Math.round((unique / maxUnitUnique) * 100);
      let status: 'Aktif' | 'Cukup' | 'Perlu Perhatian' = 'Aktif';
      if (activityRate < 30) status = 'Perlu Perhatian';
      else if (activityRate < 60) status = 'Cukup';
      return { unitKerja, hadir: data.hadir, pulang: data.pulang, wfh: data.wfh, unique, checkOutRate: unitCheckOutRate, wfhRate, status };
    }).sort((a, b) => b.unique - a.unique);

    // Per-person breakdown with status
    const personMap = new Map<string, { unitKerja: string; hadir: number; pulang: number; wfh: number; pesan: string[]; activeDays: Set<string> }>();
    allAttendance.forEach(a => {
      if (!personMap.has(a.namaLengkap)) personMap.set(a.namaLengkap, { unitKerja: a.unitKerja, hadir: 0, pulang: 0, wfh: 0, pesan: [], activeDays: new Set() });
      const entry = personMap.get(a.namaLengkap)!;
      entry.unitKerja = a.unitKerja;
      const dayKey = new Date(a.createdAt).toLocaleDateString('id-ID');
      entry.activeDays.add(dayKey);
      if (a.type === 'HADIR') entry.hadir++;
      else entry.pulang++;
      if (a.pesan) entry.pesan.push(a.pesan);
    });
    allWFH.forEach(w => {
      if (!personMap.has(w.namaLengkap)) personMap.set(w.namaLengkap, { unitKerja: w.unitKerja, hadir: 0, pulang: 0, wfh: 0, pesan: [], activeDays: new Set() });
      const entry = personMap.get(w.namaLengkap)!;
      entry.unitKerja = w.unitKerja;
      const dayKey = new Date(w.createdAt).toLocaleDateString('id-ID');
      entry.activeDays.add(dayKey);
      entry.wfh++;
    });

    const maxActiveDays = Math.max(...Array.from(personMap.values()).map(d => d.activeDays.size), 1);

    const personBreakdown = Array.from(personMap.entries()).map(([namaLengkap, data]) => {
      const total = data.hadir + data.pulang + data.wfh;
      const consistency = Math.round((data.activeDays.size / maxActiveDays) * 100);
      let status: 'Disiplin' | 'Cukup' | 'Perlu Perhatian' = 'Disiplin';
      if (consistency < 30) status = 'Perlu Perhatian';
      else if (consistency < 60) status = 'Cukup';
      return { namaLengkap, unitKerja: data.unitKerja, hadir: data.hadir, pulang: data.pulang, wfh: data.wfh, total, activeDays: data.activeDays.size, pesan: data.pesan, status };
    }).sort((a, b) => b.total - a.total);

    // Generate insights for leadership
    const insights: string[] = [];

    // Insight 1: Check-out rate
    if (checkOutRate < 50) {
      insights.push(`Tingkat kelengkapan absensi pulang hanya ${checkOutRate}%. Perlu diingatkan kepada pegawai untuk melakukan absensi pulang.`);
    } else if (checkOutRate < 80) {
      insights.push(`Tingkat kelengkapan absensi pulang ${checkOutRate}%. Masih ada ${uniqueHadirNames.size - uniquePulangNames.size} pegawai yang belum konsisten absensi pulang.`);
    } else {
      insights.push(`Tingkat kelengkapan absensi pulang baik (${checkOutRate}%). Pegawai sudah disiplin melakukan absensi pulang.`);
    }

    // Insight 2: Late check-ins
    if (lateCheckIns.length > 0) {
      const lateNames = [...new Set(lateCheckIns.map(a => a.namaLengkap))];
      insights.push(`${lateNames.length} pegawai terdeteksi hadir setelah pukul 08:00 (${lateCheckIns.length} kali).`);
    }

    // Insight 3: Peak hour
    if (peakHourCount > 0) {
      insights.push(`Jam puncak kehadiran: pukul ${peakHour.toString().padStart(2, '0')}:00 dengan ${peakHourCount} kali absensi hadir.`);
    }

    // Insight 4: WFH
    if (allWFH.length > 0) {
      const wfhUnits = [...new Set(allWFH.map(w => w.unitKerja))];
      insights.push(`Terdapat ${allWFH.length} aktivitas WFH dari ${wfhUnits.length} unit kerja.`);
    }

    // Insight 5: Most active unit
    if (unitBreakdown.length > 0) {
      insights.push(`Unit kerja paling aktif: ${unitBreakdown[0].unitKerja} (${unitBreakdown[0].unique} pegawai).`);
    }

    // Insight 6: Least active unit
    if (unitBreakdown.length > 1) {
      const least = unitBreakdown[unitBreakdown.length - 1];
      insights.push(`Unit kerja dengan partisipasi terendah: ${least.unitKerja} (${least.unique} pegawai).`);
    }

    // Insight 7: Per-person
    if (personBreakdown.length > 0) {
      insights.push(`Pegawai paling aktif: ${personBreakdown[0].namaLengkap} (${personBreakdown[0].total} aktivitas, ${personBreakdown[0].activeDays} hari).`);
    }

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
          checkOutRate,
          lateCheckIns: lateCheckIns.length,
          latePeople: [...new Set(lateCheckIns.map(a => a.namaLengkap))].length,
          peakHour,
          peakHourCount,
        },
        insights,
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
