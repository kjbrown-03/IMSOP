# Déployer IMSOP sur un VPS

Écrit pour un VPS Hostinger KVM 2 sous Ubuntu 26.04 LTS, mais rien n'y est
propre à Hostinger : n'importe quel serveur Ubuntu récent avec un accès root
convient.

La pile tourne en conteneurs (backend, PostgreSQL, MinIO), sauf **nginx** qui
reste sur l'hôte : c'est lui qui porte le certificat TLS et qui est le seul
service exposé à Internet.

```
Internet ──443──> nginx (hôte) ──┬── /          → dist/ (build du front)
                                 ├── /api/…     → 127.0.0.1:4000
                                 └── /socket.io → 127.0.0.1:4000 (WebSocket)
                                                        │
                                              postgres ─┴─ minio  (réseau Docker)
```

---

## 1. Créer le serveur

Sur l'écran « Choose what to install » de Hostinger : onglet **Plain OS →
Ubuntu** (la dernière LTS proposée).

**Ne prends pas de panneau de contrôle** (CyberPanel, Plesk, CloudPanel). Ils
installent leur propre nginx et s'approprient les ports 80 et 443, ce qui entre
en conflit avec la configuration ci-dessous. L'onglet « Applications » propose
aussi une image Docker préinstallée ; l'option « Docker manager » de l'écran
suivant fait la même chose et évite l'étape 3.

Choisis un centre de données proche de tes utilisateurs. Pour le Cameroun, une
localisation européenne donne la meilleure latence disponible aujourd'hui.

---

## 2. Premier accès et verrouillage

```bash
ssh root@<IP-DU-VPS>
```

Crée un utilisateur non privilégié — on ne déploie pas en root :

```bash
adduser imsop
usermod -aG sudo imsop
rsync --archive --chown=imsop:imsop ~/.ssh /home/imsop/
```

> **Ouvre une deuxième fenêtre de terminal et connecte-toi en `imsop@` avant
> d'aller plus loin.** La suite coupe l'accès root : si quelque chose cloche, la
> session déjà ouverte est ce qui te permettra de réparer.

Le durcissement passe par un fichier déposé dans `sshd_config.d/`, pas par une
modification de `sshd_config`. OpenSSH retient la **première** valeur lue pour
chaque réglage, et l'inclusion de ce dossier est en tête du fichier principal :
un fichier nommé `00-` l'emporte donc sur tout le reste, y compris sur ce que
l'hébergeur a pu y déposer.

```bash
sudo tee /etc/ssh/sshd_config.d/00-imsop.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF

sudo sshd -t && sudo systemctl restart ssh
```

Vérifie ce que le serveur applique réellement — c'est la seule source qui fasse
foi :

```bash
sudo sshd -T | grep -E '^(permitrootlogin|passwordauthentication)'
```

Les deux doivent répondre `no`.

Le pare-feu ne laisse passer que SSH et le web :

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## 3. Docker

L'option « Docker manager » de Hostinger l'installe à la création du VPS.
Vérifie :

```bash
docker --version
```

S'il manque :

```bash
curl -fsSL https://get.docker.com | sh
```

Dans tous les cas, autorise l'utilisateur non privilégié à s'en servir :

```bash
sudo usermod -aG docker imsop
newgrp docker            # ou se reconnecter
```

---

## 4. Le domaine

Chez ton registraire, deux enregistrements **A** vers l'IP du VPS :

| Type | Nom  | Valeur        |
|------|------|---------------|
| A    | `@`  | `<IP-DU-VPS>` |
| A    | `www`| `<IP-DU-VPS>` |

La propagation prend de quelques minutes à quelques heures. Vérifie :

```bash
dig +short imsop.example.org
```

N'enchaîne sur l'étape 7 qu'une fois que cette commande renvoie l'IP du VPS :
Let's Encrypt vérifie le domaine en l'appelant, et échoue tant que le DNS ne
pointe pas.

---

## 5. Le code et la configuration

```bash
cd /opt
sudo git clone <url-du-depot> imsop
sudo chown -R imsop:imsop imsop
cd imsop

cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
nano deploy/.env.production
```

Remplis tout ce qui est marqué ⚠. Pour les deux secrets de session :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Un par ligne, **différents l'un de l'autre**. Le serveur refuse de démarrer en
production si l'un fait moins de 32 caractères.

---

## 5 bis. Le stockage des documents

Garage remplace MinIO, dont les images Docker ne sont plus publiques. Il faut
lui donner ses deux secrets, puis lui créer une clé et un bucket.

```bash
cd /opt/imsop/deploy/garage
cp garage.toml.example garage.toml
sed -i "s|REMPLACER_RPC_SECRET|$(openssl rand -hex 32)|"   garage.toml
sed -i "s|REMPLACER_ADMIN_TOKEN|$(openssl rand -hex 32)|" garage.toml
chmod 600 garage.toml
cd /opt/imsop
```

Démarre-le seul, le temps de le provisionner :

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d garage
```

Un nœud neuf n'a pas encore de rôle : il faut lui en assigner un, sans quoi il
refuse de stocker quoi que ce soit.

```bash
alias g='docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production exec garage /garage'

g status                                   # relève l'identifiant du nœud
g layout assign -z dc1 -c 40G <ID-DU-NOEUD>
g layout apply --version 1
```

Puis la clé d'accès et le bucket :

```bash
g key create imsop-key                     # note les deux valeurs affichées
g bucket create imsop
g bucket allow --read --write --owner imsop --key imsop-key
```

`key create` affiche une **Key ID** et une **Secret key**. Reporte-les :

```bash
nano deploy/.env.production
#   S3_ACCESS_KEY_ID=GK...
#   S3_SECRET_ACCESS_KEY=...
```

La clé secrète n'est affichée qu'une fois. Si tu la perds, `g key info imsop-key
--show-secret` la redonne.

---

## 6. Construire et lancer

Le front est un build statique, servi par nginx :

```bash
npm ci
NODE_OPTIONS=--max-old-space-size=4096 npm run build     # produit dist/
```

> Le build Vite a déjà épuisé la mémoire par défaut de Node sur cette base de
> code : ce `NODE_OPTIONS` évite un `Fatal process out of memory`.

Puis la pile applicative :

```bash
cd /opt/imsop
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm migrate
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d
```

Vérifie que le backend répond, en local d'abord :

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health   # 200 attendu
```

---

## 7. nginx et le certificat

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/imsop.conf /etc/nginx/sites-available/imsop.conf
sudo nano /etc/nginx/sites-available/imsop.conf
```

Trois choses à remplacer dans ce fichier : `server_name` (ton domaine, aux deux
endroits), la racine du build (`/opt/imsop/dist`), et les chemins des
certificats.

```bash
sudo ln -s /etc/nginx/sites-available/imsop.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d imsop.example.org -d www.imsop.example.org
```

Certbot installe le renouvellement automatique. Pour t'en assurer :

```bash
sudo certbot renew --dry-run
```

---

## 8. Créer le premier compte d'administration

Aucun compte n'existe sur une base neuve. Depuis le conteneur :

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  exec backend node prisma/seed.js
```

> Le script de semis crée les comptes de démonstration. **Sur un serveur
> ouvert au public, change leurs mots de passe immédiatement**, ou crée un
> unique administrateur à la main et supprime les autres.

---

## 9. Les sauvegardes

Le projet embarque `npm run backup` (base + documents). Une fois par nuit :

```bash
crontab -e
```

```
0 2 * * * cd /opt/imsop && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production exec -T backend node scripts/backup.js >> /var/log/imsop-backup.log 2>&1
```

Les archives atterrissent dans `deploy/backups/`, **sur le même disque que la
base**. Tant qu'elles n'en partent pas, elles ne protègent de rien : un disque
perdu emporte les deux. Ajoute une copie vers un stockage externe (`rclone`,
`restic`, ou un simple `scp` vers une autre machine).

---

## 10. Ce qui reste à faire après la mise en ligne

Ces points ne bloquent pas le démarrage, mais aucun ne doit être oublié :

- **Serveur TURN.** Les appels vidéo n'utilisent aujourd'hui que STUN. Deux
  participants derrière des NAT symétriques (réseaux mobiles, wifi
  d'entreprise) ne se connecteront pas. Installer `coturn`, puis déclarer ses
  identifiants dans la configuration ICE de `src/components/blocks/chat-template.jsx`.
- **Sauvegardes hors-site.** Elle devient critique avec Garage : les documents
  médicaux vivent sur le seul disque du VPS, en une seule copie
  (`replication_factor = 1`). Sa perte les emporte, et les sauvegardes locales
  avec. Une copie vers une autre machine n'est pas une précaution, c'est la
  condition pour que ce choix soit tenable.
- **Analyse antivirus** des documents déposés, avant stockage.
- **Console Google Cloud** : les URI de redirection OAuth doivent pointer sur le
  domaine de production, sans quoi la connexion Google échouera.
- **CVE Vite** : des vulnérabilités connues attendent une montée de version
  majeure. Elles concernent le serveur de développement, pas le build statique
  servi par nginx — le risque en production est donc faible, mais la mise à jour
  reste à planifier.
- **Taux de commission** : `COMMISSION_PLATEFORME_POURCENT` vaut 30 par défaut.
  C'est lui qui décide de ce qui revient au spécialiste sur chaque avis.

---

## Mettre à jour

```bash
cd /opt/imsop
git pull
npm ci && NODE_OPTIONS=--max-old-space-size=4096 npm run build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production build backend
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm migrate
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d backend
```

Les migrations passent avant le redémarrage du backend : l'ordre inverse
exposerait brièvement un code neuf à un schéma ancien.

## Regarder ce qui se passe

```bash
docker compose -f deploy/docker-compose.prod.yml logs -f backend
docker compose -f deploy/docker-compose.prod.yml ps
```
