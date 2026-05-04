import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============ GEOFENCING CONFIG ============
const CAMPUS_CENTER = {
  lat: -8.0903366,
  lng: 111.9003307,
};
const CAMPUS_RADIUS_METERS = 500;

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { namaLengkap, unitKerja, type, jenisKehadiran, pesan, photoData, latitude, longitude, locationAddress } = body;

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

    // ============ GEOFENCE STATUS (tidak blokir, hanya catat) ============
    let distanceFromCampus: number | null = null;
    let geoVerified = false;

    if (latitude && longitude) {
      distanceFromCampus = Math.round(
        haversineDistance(latitude, longitude, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng)
      );
      const jenisKehadiranValue = jenisKehadiran?.trim() || "Masuk Kerja Kampus";
      const isKampus = jenisKehadiranValue.includes("Kampus");
      geoVerified = isKampus ? distanceFromCampus <= CAMPUS_RADIUS_METERS : true;
    }

    // Cegah duplikat: cek apakah nama sudah absen dengan tipe yang sama hari ini (case-insensitive)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayRecords = await db.attendance.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        type: type,
      },
    });

    const inputName = namaLengkap.trim().toLowerCase();
    const alreadyExists = todayRecords.some(
      (r) => r.namaLengkap.toLowerCase() === inputName
    );

    if (alreadyExists) {
      return NextResponse.json(
        { error: `${namaLengkap.trim()} sudah absen ${type === 'HADIR' ? 'Hadir' : 'Pulang'} hari ini. Tidak bisa absen dua kali.` },
        { status: 409 }
      );
    }

    const attendance = await db.attendance.create({
      data: {
        namaLengkap: namaLengkap.trim(),
        unitKerja,
        type,
        jenisKehadiran: jenisKehadiran?.trim() || "Masuk Kerja Kampus",
        pesan: pesan?.trim() || null,
        photoData: photoData || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationAddress: locationAddress?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: attendance,
      geoInfo: distanceFromCampus !== null ? {
        distanceFromCampus,
        campusRadius: CAMPUS_RADIUS_METERS,
        geoVerified,
      } : null,
    });
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

    // Calculate geofence distance for each record (server-side enrichment)
    const enrichedData = attendance.map((record) => {
      if (record.latitude && record.longitude) {
        const dist = Math.round(
          haversineDistance(record.latitude, record.longitude, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng)
        );
        const isKampus = record.jenisKehadiran?.includes("Kampus") ?? true;
        const geoVerified = isKampus ? dist <= CAMPUS_RADIUS_METERS : true;
        return {
          ...record,
          _distanceFromCampus: dist,
          _geoVerified: geoVerified,
        };
      }
      return {
        ...record,
        _distanceFromCampus: null,
        _geoVerified: null,
      };
    });

    return NextResponse.json({ success: true, data: enrichedData });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data' },
      { status: 500 }
    );
  }
}
