import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============ CONSTANTS ============
const WORK_START_MINUTES = 8 * 60; // 08:00 = 480 menit
const OVERTIME_THRESHOLD_MINUTES = 15 * 60; // 15:00 = 900 menit (08:00 + 6jam + 1jam grace)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
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
      const dayOfWeek = startDate.getDay() || 7;
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

    // ============ MATCH HADIR/PULANG PER PERSON PER DAY ============
    // Helper: Convert UTC Date to WIB hours/minutes
    const toWIB = (date: Date) => {
      const utcHours = date.getUTCHours();
      const utcMinutes = date.getUTCMinutes();
      const wibHours = (utcHours + 7) % 24;
      return { hours: wibHours, minutes: utcMinutes, totalMinutes: wibHours * 60 + utcMinutes };
    };

    interface PersonDayEntry {
      namaLengkap: string;
      dayKey: string;
      hadirTime: Date | null;
      pulangTime: Date | null;
      unitKerja: string;
      pesan: string | null;
    }
    const personDayMap = new Map<string, PersonDayEntry>();
    allAttendance.forEach(a => {
      // Use WIB for day grouping (UTC+7)
      const wibDate = new Date(a.createdAt.getTime() + 7 * 60 * 60 * 1000);
      const dayKey = wibDate.toLocaleDateString('id-ID', { timeZone: 'UTC' });
      const key = `${a.namaLengkap}__${dayKey}`;
      if (!personDayMap.has(key)) {
        personDayMap.set(key, { namaLengkap: a.namaLengkap, dayKey, hadirTime: null, pulangTime: null, unitKerja: a.unitKerja, pesan: null });
      }
      const entry = personDayMap.get(key)!;
      entry.unitKerja = a.unitKerja;
      if (a.type === 'HADIR') {
        entry.hadirTime = new Date(a.createdAt);
        if (a.pesan) entry.pesan = a.pesan;
      } else {
        entry.pulangTime = new Date(a.createdAt);
      }
    });

    // ============ CALCULATE LATE & OVERTIME PER PERSON PER DAY ============
    interface PersonLemburStats {
      lemburHours: number;
      lemburDays: number;
      lateCount: number;
      isOnTime: boolean;
    }
    const personLemburMap = new Map<string, PersonLemburStats>();

    interface DayStats {
      overtimePeople: Set<string>;
      overtimeHours: number;
      latePeople: Set<string>;
    }
    const dayOvertimeMap = new Map<string, DayStats>();

    const lateNamesList: string[] = [];
    const lemburRecords: { namaLengkap: string; date: string; hadirTime: string; pulangTime: string; lemburHours: number }[] = [];

    personDayMap.forEach((entry) => {
      if (!personLemburMap.has(entry.namaLengkap)) {
        personLemburMap.set(entry.namaLengkap, { lemburHours: 0, lemburDays: 0, lateCount: 0, isOnTime: true });
      }
      const pStats = personLemburMap.get(entry.namaLengkap)!;

      if (!dayOvertimeMap.has(entry.dayKey)) {
        dayOvertimeMap.set(entry.dayKey, { overtimePeople: new Set(), overtimeHours: 0, latePeople: new Set() });
      }
      const dStats = dayOvertimeMap.get(entry.dayKey)!;

      // Check late (hadir > 08:00 WIB)
      if (entry.hadirTime) {
        const hadirMinutes = toWIB(entry.hadirTime).totalMinutes;
        if (hadirMinutes > WORK_START_MINUTES) {
          pStats.lateCount++;
          pStats.isOnTime = false;
          dStats.latePeople.add(entry.namaLengkap);
          lateNamesList.push(entry.namaLengkap);
        }
      }

      // Check overtime: only if hadir <= 08:00 WIB AND pulang >= 15:00 WIB
      if (entry.hadirTime && entry.pulangTime) {
        const hadirMinutes = toWIB(entry.hadirTime).totalMinutes;
        const pulangMinutes = toWIB(entry.pulangTime).totalMinutes;

        if (hadirMinutes <= WORK_START_MINUTES && pulangMinutes >= OVERTIME_THRESHOLD_MINUTES) {
          const lemburHours = Math.floor((pulangMinutes - OVERTIME_THRESHOLD_MINUTES) / 60);
          if (lemburHours >= 1) {
            pStats.lemburHours += lemburHours;
            pStats.lemburDays++;
            dStats.overtimeHours += lemburHours;
            dStats.overtimePeople.add(entry.namaLengkap);
            lemburRecords.push({
              namaLengkap: entry.namaLengkap,
              date: entry.dayKey,
              hadirTime: toWIB(entry.hadirTime).hours.toString().padStart(2, '0') + ':' + toWIB(entry.hadirTime).minutes.toString().padStart(2, '0') + ' WIB',
              pulangTime: toWIB(entry.pulangTime).hours.toString().padStart(2, '0') + ':' + toWIB(entry.pulangTime).minutes.toString().padStart(2, '0') + ' WIB',
              lemburHours,
            });
          }
        }
      }
    });

    // ============ SUMMARY STATS ============
    const hadirRecords = allAttendance.filter(a => a.type === 'HADIR');
    const pulangRecords = allAttendance.filter(a => a.type === 'PULANG');
    const uniqueNames = new Set(allAttendance.map(a => a.namaLengkap));
    const uniqueHadirNames = new Set(hadirRecords.map(a => a.namaLengkap));
    const uniquePulangNames = new Set(pulangRecords.map(a => a.namaLengkap));

    // Late stats (using WIB time)
    const lateCheckIns = hadirRecords.filter(a => {
      const minutes = toWIB(new Date(a.createdAt)).totalMinutes;
      return minutes > WORK_START_MINUTES;
    });
    const uniqueLateNames = [...new Set(lateCheckIns.map(a => a.namaLengkap))];

    // Peak hour (using WIB)
    const hourMap = new Map<number, number>();
    hadirRecords.forEach(a => {
      const hour = toWIB(new Date(a.createdAt)).hours;
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });
    let peakHour = 0;
    let peakHourCount = 0;
    hourMap.forEach((count, hour) => {
      if (count > peakHourCount) { peakHour = hour; peakHourCount = count; }
    });

    // Overtime totals
    let totalOvertimeHours = 0;
    let totalOvertimePeople = 0;
    personLemburMap.forEach((stats) => {
      totalOvertimeHours += stats.lemburHours;
      if (stats.lemburDays > 0) totalOvertimePeople++;
    });

    // ============ PER-DAY BREAKDOWN ============
    const dayMap = new Map<string, { hadir: number; pulang: number; hadirNames: Set<string>; pulangNames: Set<string> }>();
    allAttendance.forEach(a => {
      const wibDate = new Date(a.createdAt.getTime() + 7 * 60 * 60 * 1000);
      const day = wibDate.toLocaleDateString('id-ID', {
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
      let status: 'Baik' | 'Cukup' | 'Perlu Perhatian' = 'Baik';
      const totalActivities = data.hadir + data.pulang;
      if (totalActivities === 0) status = 'Perlu Perhatian';
      else if (unique < 5) status = 'Cukup';

      const dayKey = new Date().toLocaleDateString('id-ID');
      const dOvertime = dayOvertimeMap.get(day);
      const lateCount = dOvertime ? dOvertime.latePeople.size : 0;
      const overtimeHours = dOvertime ? dOvertime.overtimeHours : 0;

      return { day, hadir: data.hadir, pulang: data.pulang, unique, status, lateCount, overtimeHours };
    }).reverse();

    // ============ PER-UNIT BREAKDOWN ============
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
      const totalActivities = data.hadir + data.pulang + data.wfh;
      const wfhRate = totalActivities > 0 ? Math.round((data.wfh / totalActivities) * 100) : 0;
      const activityRate = Math.round((unique / maxUnitUnique) * 100);
      let status: 'Aktif' | 'Cukup' | 'Perlu Perhatian' = 'Aktif';
      if (activityRate < 30) status = 'Perlu Perhatian';
      else if (activityRate < 60) status = 'Cukup';

      // Late & overtime per unit
      let unitLateCount = 0;
      let unitOvertimeHours = 0;
      personLemburMap.forEach((stats, name) => {
        const personHasUnit = allAttendance.some(a => a.namaLengkap === name && a.unitKerja === unitKerja);
        if (personHasUnit) {
          unitLateCount += stats.lateCount;
          unitOvertimeHours += stats.lemburHours;
        }
      });

      return { unitKerja, hadir: data.hadir, pulang: data.pulang, wfh: data.wfh, unique, wfhRate, status, lateCount: unitLateCount, overtimeHours: unitOvertimeHours };
    }).sort((a, b) => b.unique - a.unique);

    // ============ PER-PERSON BREAKDOWN ============
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

      const lemburStats = personLemburMap.get(namaLengkap) || { lemburHours: 0, lemburDays: 0, lateCount: 0, isOnTime: true };

      return {
        namaLengkap,
        unitKerja: data.unitKerja,
        hadir: data.hadir,
        pulang: data.pulang,
        wfh: data.wfh,
        total,
        activeDays: data.activeDays.size,
        pesan: data.pesan,
        status,
        lateCount: lemburStats.lateCount,
        lemburHours: lemburStats.lemburHours,
        isOnTime: lemburStats.isOnTime,
      };
    }).sort((a, b) => b.total - a.total);

    // ============ INSIGHTS ============
    const insights: string[] = [];

    // Insight: Late
    if (uniqueLateNames.length > 0) {
      const lateCountMsg = lateCheckIns.length;
      insights.push(`${uniqueLateNames.length} pegawai terdeteksi TERLAMBAT (hadir > 08:00) sebanyak ${lateCountMsg} kali: ${uniqueLateNames.slice(0, 10).join(', ')}${uniqueLateNames.length > 10 ? ' dan lainnya' : ''}. Pegawai terlambat tidak mendapatkan hak lembur.`);
    } else if (hadirRecords.length > 0) {
      insights.push(`Tidak ada pegawai yang terlambat. Semua hadir tepat waktu (sebelum/tepat 08:00).`);
    }

    // Insight: Overtime
    if (totalOvertimeHours > 0) {
      insights.push(`Total lembur: ${totalOvertimeHours} jam dari ${totalOvertimePeople} pegawai. Syarat lembur: hadir sebelum/tepat 08:00 dan pulang minimal 15:00 (grace 1 jam setelah jam kerja 08:00-14:00).`);
    } else if (hadirRecords.length > 0 && pulangRecords.length > 0) {
      insights.push(`Tidak ada lembur tercatat pada periode ini.`);
    }

    // Insight: Peak hour
    if (peakHourCount > 0) {
      insights.push(`Jam puncak kehadiran: pukul ${peakHour.toString().padStart(2, '0')}:00 dengan ${peakHourCount} kali absensi hadir.`);
    }

    // Insight: WFH
    if (allWFH.length > 0) {
      const wfhUnits = [...new Set(allWFH.map(w => w.unitKerja))];
      insights.push(`Terdapat ${allWFH.length} aktivitas WFH dari ${wfhUnits.length} unit kerja.`);
    }

    // Insight: Most/least active unit
    if (unitBreakdown.length > 0) {
      insights.push(`Unit kerja paling aktif: ${unitBreakdown[0].unitKerja} (${unitBreakdown[0].unique} pegawai).`);
    }
    if (unitBreakdown.length > 1) {
      const least = unitBreakdown[unitBreakdown.length - 1];
      insights.push(`Unit kerja dengan partisipasi terendah: ${least.unitKerja} (${least.unique} pegawai).`);
    }

    // Insight: Most active person
    if (personBreakdown.length > 0) {
      insights.push(`Pegawai paling aktif: ${personBreakdown[0].namaLengkap} (${personBreakdown[0].total} aktivitas, ${personBreakdown[0].activeDays} hari).`);
    }

    // ============ PERIOD LABEL ============
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
          lateCheckIns: lateCheckIns.length,
          latePeople: uniqueLateNames.length,
          lateNames: uniqueLateNames,
          peakHour,
          peakHourCount,
          totalOvertimeHours,
          totalOvertimePeople,
        },
        insights,
        dailyBreakdown,
        unitBreakdown,
        personBreakdown,
        lemburRecords,
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
