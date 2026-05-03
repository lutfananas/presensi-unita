import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await db.attendance.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const hadirCount = todayAttendance.filter(a => a.type === 'HADIR').length;
    const pulangCount = todayAttendance.filter(a => a.type === 'PULANG').length;
    const uniqueNames = new Set(todayAttendance.map(a => a.namaLengkap)).size;

    const totalAttendance = await db.attendance.count();
    const totalWFH = await db.wFHActivity.count();

    const recentAttendance = await db.attendance.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentWFH = await db.wFHActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        today: {
          hadir: hadirCount,
          pulang: pulangCount,
          uniquePeople: uniqueNames,
        },
        totals: {
          attendance: totalAttendance,
          wfh: totalWFH,
        },
        recent: {
          attendance: recentAttendance,
          wfh: recentWFH,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil statistik' },
      { status: 500 }
    );
  }
}
