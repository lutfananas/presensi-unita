import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { namaLengkap, unitKerja, type, pesan, photoData, latitude, longitude, locationAddress } = body;

    if (!namaLengkap || !unitKerja || !type) {
      return NextResponse.json(
        { error: 'Nama, Unit Kerja, dan Tipe Absensi wajib diisi' },
        { status: 400 }
      );
    }

    if (!['HADIR', 'PULANG'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipe harus HADIR atau PULANG' },
        { status: 400 }
      );
    }

    const attendance = await db.attendance.create({
      data: {
        namaLengkap: namaLengkap.trim(),
        unitKerja,
        type,
        pesan: pesan?.trim() || null,
        photoData: photoData || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationAddress: locationAddress?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error creating attendance:', error);
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
    const type = searchParams.get('type');
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

    if (type && type !== 'SEMUA') {
      where.type = type;
    }

    if (search) {
      where.namaLengkap = {
        contains: search,
      };
    }

    const attendance = await db.attendance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data' },
      { status: 500 }
    );
  }
}
