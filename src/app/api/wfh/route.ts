import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { namaLengkap, unitKerja, deskripsiPekerjaan } = body;

    if (!namaLengkap || !unitKerja || !deskripsiPekerjaan) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi' },
        { status: 400 }
      );
    }

    const activity = await db.wFHActivity.create({
      data: {
        namaLengkap: namaLengkap.trim(),
        unitKerja,
        deskripsiPekerjaan: deskripsiPekerjaan.trim(),
      },
    });

    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Error creating WFH activity:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const unit = searchParams.get('unit');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (unit && unit !== 'SEMUA') {
      where.unitKerja = unit;
    }

    if (search) {
      where.namaLengkap = {
        contains: search,
      };
    }

    const activities = await db.wFHActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching WFH activities:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data' },
      { status: 500 }
    );
  }
}
