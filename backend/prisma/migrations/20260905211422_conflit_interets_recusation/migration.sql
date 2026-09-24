-- CreateTable
CREATE TABLE "RecusationSpecialiste" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "specialisteId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecusationSpecialiste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecusationSpecialiste_dossierId_idx" ON "RecusationSpecialiste"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "RecusationSpecialiste_dossierId_specialisteId_key" ON "RecusationSpecialiste"("dossierId", "specialisteId");

-- AddForeignKey
ALTER TABLE "RecusationSpecialiste" ADD CONSTRAINT "RecusationSpecialiste_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecusationSpecialiste" ADD CONSTRAINT "RecusationSpecialiste_specialisteId_fkey" FOREIGN KEY ("specialisteId") REFERENCES "Specialiste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
