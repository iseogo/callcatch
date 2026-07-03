-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Trade" AS ENUM ('PLUMBING', 'HVAC', 'ELECTRICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CalType" AS ENUM ('GOOGLE', 'JOBBER', 'HOUSECALL_PRO');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('EMERGENCY', 'SERVICE_REQUEST', 'QUOTE', 'RESCHEDULE', 'OTHER');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('BOOKED', 'TRANSFERRED', 'MESSAGE_TAKEN', 'MISSED_INFO');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "onCallPhone" TEXT,
    "trade" "Trade" NOT NULL,
    "timezone" TEXT NOT NULL,
    "businessHours" JSONB NOT NULL,
    "serviceArea" JSONB NOT NULL,
    "services" JSONB NOT NULL,
    "phoneNumber" TEXT,
    "retellAgentId" TEXT,
    "calendarType" "CalType" NOT NULL,
    "calendarConfig" JSONB NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'TRIAL',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER,
    "intent" "Intent",
    "outcome" "Outcome",
    "transcript" TEXT,
    "summary" TEXT,
    "jobValueEstimate" DOUBLE PRECISION,
    "retellCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "callId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsThread" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Call_retellCallId_key" ON "Call"("retellCallId");

-- CreateIndex
CREATE INDEX "Call_businessId_idx" ON "Call"("businessId");

-- CreateIndex
CREATE INDEX "Call_businessId_startedAt_idx" ON "Call"("businessId", "startedAt");

-- CreateIndex
CREATE INDEX "Call_callerPhone_idx" ON "Call"("callerPhone");

-- CreateIndex
CREATE INDEX "Booking_businessId_idx" ON "Booking"("businessId");

-- CreateIndex
CREATE INDEX "Booking_businessId_scheduledAt_idx" ON "Booking"("businessId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Booking_callId_idx" ON "Booking"("callId");

-- CreateIndex
CREATE INDEX "SmsThread_businessId_idx" ON "SmsThread"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsThread_businessId_callerPhone_key" ON "SmsThread"("businessId", "callerPhone");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsThread" ADD CONSTRAINT "SmsThread_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

