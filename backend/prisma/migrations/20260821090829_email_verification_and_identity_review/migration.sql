-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "identityRejectedReason" TEXT,
ADD COLUMN     "identityReviewedById" TEXT;

-- AlterTable
ALTER TABLE "TwoFactorChallenge" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'LOGIN_2FA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;
