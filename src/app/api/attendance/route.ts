import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============ GEOFENCING CONFIG ============
const CAMPUS_CENTER = {
  lat: -8.0903366,
  lng: 111.9003307,
};
const CAMPUS_RADIUS_METERS = 500;

// ============ GPS ANTI-SPOOF CONFIG ============
// Fake GPS apps typically produce these patterns:
// - accuracy: exactly 0, or very low like 0.001-1.0 (real GPS: 5-50m for phone)
// - timestamp: identical to browser time or in the future (real GPS has slight delay)
// - coordinates: "too perfect" decimal places (e.g., exactly -8.0903000 without variation)
const SUSPICIOUS_ACCURACY_THRESHOLD = 2; // meters - below this is very suspicious
const TIMELAG_WARNING_SECONDS = 120; // GPS timestamp vs browser time difference to flag

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

/**
 * Detect GPS spoofing indicators.
 * Returns an array of warning flags and a boolean isSuspicious.
 */
function detectGPSSpoofing(
  latitude: number | null,
  longitude: number | null,
  accuracy: number | null,
  clientTime: string | null,
  gpsTimestamp: number | null,
): { flags: string[]; isSuspicious: boolean; isBlocked: boolean } {
  const flags: string[] = [];
  let isBlocked = false;

  if (latitude === null || longitude === null) {
    return { flags: [], isSuspicious: false, isBlocked: false };
  }

  // 1. Check if coordinates are within Indonesia bounds (rough)
  const inIndonesia = latitude >= -11.0 && latitude <= 6.0 && longitude >= 95.0 && longitude <= 141.0;
  if (!inIndonesia) {
    flags.push('COORDINATES_OUTSIDE_INDONESIA');
    isBlocked = true;
  }

  // 2. Check GPS accuracy - suspiciously low accuracy indicates fake GPS
  if (accuracy !== null && accuracy !== undefined) {
    if (accuracy === 0) {
      flags.push('GPS_ACCURACY_EXACT_ZERO');
    } else if (accuracy < SUSPICIOUS_ACCURACY_THRESHOLD) {
      flags.push(`GPS_ACCURACY_TOO_LOW(${accuracy.toFixed(1)}m)`);
    }
    if (accuracy > 500) {
      flags.push(`GPS_ACCURACY_TOO_HIGH(${accuracy.toFixed(1)}m)`);
    }
  }

  // 3. Check GPS timestamp vs client-reported time
  if (gpsTimestamp && clientTime) {
    const clientDate = new Date(clientTime);
    const gpsDate = new Date(gpsTimestamp);
    const diffSeconds = Math.abs(gpsDate.getTime() - clientDate.getTime()) / 1000;

    // If GPS timestamp is in the future (more than 60s) - very suspicious
    if (gpsDate.getTime() - clientDate.getTime() > 60000) {
      flags.push('GPS_TIMESTAMP_IN_FUTURE');
      isBlocked = true;
    }

    // If difference is more than threshold - possible timezone manipulation
    if (diffSeconds > TIMELAG_WARNING_SECONDS) {
      flags.push(`TIME_MISMATCH(${Math.round(diffSeconds / 60)}min)`);
    }
  }

  // 4. Check for "too perfect" coordinates (common in fake GPS)
  const latStr = latitude.toString();
  const lngStr = longitude.toString();
  if (latStr.endsWith('.0') && lngStr.endsWith('.0')) {
    flags.push('COORDINATES_TOO_PERFECT');
  }

  // 5. Check if coordinates are exactly at the campus center (very suspicious)
  if (latitude === CAMPUS_CENTER.lat && longitude === CAMPUS_CENTER.lng) {
    flags.push('COORDINATES_EXACT_CAMPUS_CENTER');
  }

  const isSuspicious = flags.length > 0;

  return { flags, isSuspicious, isBlocked };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      namaLengkap, unitKerja, type, jenisKehadiran, pesan, photoData,
      latitude, longitude, locationAddress,
      gpsAccuracy, gpsTimestamp, clientTime,
      spoofFlags: clientSpoofFlags,
    } = body;

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

    // ============ GPS ANTI-SPOOF DETECTION ============
    let spoofResult = { flags: [] as string[], isSuspicious: false, isBlocked: false };
    if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
      spoofResult = detectGPSSpoofing(
        latitude, longitude,
        gpsAccuracy ?? null,
        clientTime ?? null,
        gpsTimestamp ?? null,
      );
    }

    // Merge with client-side detected flags
    let allSpoofFlags: string[] = [...spoofResult.flags];
    if (clientSpoofFlags && Array.isArray(clientSpoofFlags)) {
      allSpoofFlags = [...new Set([...allSpoofFlags, ...clientSpoofFlags])];
    }

    // Block if coordinates are outside Indonesia or GPS timestamp is impossible
    if (spoofResult.isBlocked) {
      return NextResponse.json(
        {
          error: 'Deteksi lokasi tidak valid. Kemungkinan menggunakan fake GPS atau manipulasi waktu. Silakan matikan aplikasi fake GPS dan coba lagi.',
          spoofFlags: allSpoofFlags,
          blocked: true,
        },
        { status: 403 }
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

    // ============ SERVER-SIDE TIMESTAMP (WIB = UTC+7) ============
    // IMPORTANT: createdAt uses Prisma @default(now()) which is SERVER time (UTC)
    // We use server time for all calculations - client timezone cannot manipulate this
    const serverNow = new Date();
    const todayStart = new Date(serverNow);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(serverNow);
    todayEnd.setHours(23, 59, 59, 999);

    // Cegah duplikat: cek apakah nama sudah absen dengan tipe yang sama hari ini
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
        gpsAccuracy: gpsAccuracy !== null && gpsAccuracy !== undefined ? gpsAccuracy : null,
        gpsTimestamp: gpsTimestamp ? new Date(gpsTimestamp) : null,
        spoofFlags: allSpoofFlags.length > 0 ? JSON.stringify(allSpoofFlags) : null,
      },
    });

    // Determine server time in WIB for late check (08:00 WIB = 01:00 UTC)
    const wibHour = (serverNow.getUTCHours() + 7) % 24;
    const wibMinute = serverNow.getUTCMinutes();
    const isLate = type === 'HADIR' && (wibHour > 8 || (wibHour === 8 && wibMinute > 0));

    return NextResponse.json({
      success: true,
      data: attendance,
      geoInfo: distanceFromCampus !== null ? {
        distanceFromCampus,
        campusRadius: CAMPUS_RADIUS_METERS,
        geoVerified,
      } : null,
      spoofWarning: spoofResult.isSuspicious ? {
        flags: allSpoofFlags,
        message: 'Peringatan: Deteksi indikasi manipulasi lokasi/waktu. Data tetap disimpan dan ditandai di laporan.',
      } : null,
      serverTime: serverNow.toISOString(),
      serverTimeWIB: serverNow.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      isLate: isLate ? `Ya (${wibHour}:${String(wibMinute).padStart(2, '0')} WIB)` : 'Tidak',
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

    // Calculate geofence distance & spoof info for each record
    const enrichedData = attendance.map((record) => {
      const enriched: Record<string, unknown> = {
        ...record,
        _distanceFromCampus: null,
        _geoVerified: null,
        _spoofFlags: null,
        _isSuspicious: false,
        _wibTime: null, // Server time converted to WIB for display
      };

      if (record.latitude && record.longitude) {
        const dist = Math.round(
          haversineDistance(record.latitude, record.longitude, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng)
        );
        const isKampus = record.jenisKehadiran?.includes("Kampus") ?? true;
        enriched._distanceFromCampus = dist;
        enriched._geoVerified = isKampus ? dist <= CAMPUS_RADIUS_METERS : true;
      }

      // Parse spoof flags
      if (record.spoofFlags) {
        try {
          enriched._spoofFlags = JSON.parse(record.spoofFlags);
          enriched._isSuspicious = true;
        } catch {
          enriched._spoofFlags = [record.spoofFlags];
          enriched._isSuspicious = true;
        }
      }

      // Convert createdAt (UTC server time) to WIB for consistent display
      if (record.createdAt) {
        enriched._wibTime = new Date(record.createdAt).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
      }

      return enriched;
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
