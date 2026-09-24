# =============================================================================
# Image de production du backend IMSOP.
#
# Deux étages : le premier installe les dépendances et génère le client Prisma,
# le second ne garde que ce qui sert à l'exécution. Les outils de compilation ne
# se retrouvent donc pas sur le serveur, où ils ne seraient qu'une surface
# d'attaque de plus.
# =============================================================================

# --- Étage 1 : dépendances ---------------------------------------------------
FROM node:22-alpine AS build

# Prisma a besoin d'OpenSSL pour détecter la cible du moteur de requêtes ;
# Alpine ne l'embarque pas par défaut.
RUN apk add --no-cache openssl

WORKDIR /app

# Les manifestes d'abord : tant qu'ils ne changent pas, Docker réutilise la
# couche d'installation et le build reste rapide.
COPY package*.json ./
RUN npm ci --omit=dev

# Le client Prisma est généré contre le schéma, pas contre la base : il peut
# donc l'être ici, sans connexion à PostgreSQL.
COPY prisma ./prisma
RUN npx prisma generate

# --- Étage 2 : exécution -----------------------------------------------------
FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts

# L'image de base fournit déjà un utilisateur `node` sans privilèges. Tourner en
# root dans un conteneur exposé au réseau n'a aucune raison d'être.
USER node

EXPOSE 4000

# Pas de `npm start` : npm resterait entre init et Node, et avalerait les
# signaux d'arrêt. Node reçoit ainsi SIGTERM directement et ferme proprement ses
# connexions PostgreSQL et ses sockets.
CMD ["node", "src/server.js"]
