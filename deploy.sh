#!/bin/bash
# ============================================
# DEPLOY SCRIPT - Sistem Presensi Universitas Tulungagung
# ============================================
# Cara pakai: chmod +x deploy.sh && ./deploy.sh
# ============================================

set -e
echo "========================================"
echo "  DEPLOY SISTEM PRESENSI KE VERCEL"
echo "========================================"
echo ""

# Step 1: Login Vercel
echo " Langkah 1/5: Login ke Vercel..."
vercel login
echo " Login berhasil!"

# Step 2: Link project
echo ""
echo " Langkah 2/5: Link project ke Vercel..."
vercel link --yes
echo " Project berhasil di-link!"

# Step 3: Setup environment variables
echo ""
echo " Langkah 3/5: Setup environment variables..."
echo " Masukkan DATABASE_URL dari Neon (contoh):"
echo " postgresql://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require"
echo ""
read -p " DATABASE_URL: " DB_URL
vercel env add DATABASE_URL production <<< "$DB_URL"
vercel env add DATABASE_URL preview <<< "$DB_URL"
vercel env add DATABASE_URL development <<< "$DB_URL"

if [ -n "$DB_URL" ]; then
  vercel env add DIRECT_DATABASE_URL production <<< "$DB_URL"
  vercel env add DIRECT_DATABASE_URL preview <<< "$DB_URL"
  vercel env add DIRECT_DATABASE_URL development <<< "$DB_URL"
fi

echo " Environment variables berhasil di-set!"

# Step 4: Push Prisma schema
echo ""
echo " Langkah 4/5: Push schema ke database..."
echo " Menjalankan: npx prisma db push..."
npx prisma db push --skip-generate
echo " Schema berhasil di-push!"

# Step 5: Deploy
echo ""
echo " Langkah 5/5: Deploy ke Vercel..."
vercel deploy --prod
echo ""
echo "========================================"
echo "  DEPLOY BERHASIL!"
echo "========================================"
