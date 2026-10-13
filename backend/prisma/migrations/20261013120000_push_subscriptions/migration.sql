-- Abonnements des appareils aux notifications poussees.
--
-- Un utilisateur en a autant qu'il a d'appareils. `endpoint` est fourni par le
-- navigateur et sert d'identifiant unique : c'est lui qu'on remplace quand le
-- meme appareil se reabonne.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccess" TIMESTAMP(3),
    "echecs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- Supprimer un compte supprime ses abonnements : garder des cles de chiffrement
-- rattachees a personne n'aurait aucun usage.
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
