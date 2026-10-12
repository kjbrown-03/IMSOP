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

Le front est un build statique, servi par nginx. Node n'est **pas** installé sur
l'hôte — et n'a pas à l'être : le build passe par un conteneur jetable, ce qui
évite d'avoir à suivre une version de Node de plus sur le serveur.

```bash
cd /opt/imsop
docker run --rm -v /opt/imsop:/app -w /app -u "$(id -u):$(id -g)" \
  -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e NODE_OPTIONS=--max-old-space-size=4096 \
  node:22-alpine sh -c "npm ci && npm run build"      # produit dist/
```

> `-u "$(id -u):$(id -g)"` fait écrire `dist/` et `node_modules/` au compte
> `imsop` plutôt qu'à `root` : sans ça, le déploiement suivant ne pourrait plus
> les remplacer.
>
> `NODE_OPTIONS` n'est pas décoratif : le build Vite a déjà épuisé la mémoire
> par défaut de Node sur cette base de code (`Fatal process out of memory`).
>
> Les passages suivants peuvent se contenter de `npm run build` si aucune
> dépendance n'a changé — `npm ci` réinstalle tout et coûte plusieurs minutes.

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

La procédure complète, la restauration comprise, est dans
**[docs/BACKUPS.md](../docs/BACKUPS.md)**. L'essentiel ici.

La tâche interne à l'application ne peut **pas** faire ce travail en production :
le dump de la base passe par `docker compose exec`, or le conteneur backend
n'embarque pas le client Docker. Laissée active, elle échoue chaque nuit en
silence — ce qui s'est produit pendant des semaines après la mise en ligne, avec
`BACKUP_CRON_IN_APP` non renseigné et un dossier `deploy/backups` appartenant à
`root`. La sauvegarde est donc planifiée par systemd, sur l'hôte.

```bash
sudo apt install -y restic

cd /opt/imsop
cp deploy/.env.sauvegarde.example deploy/.env.sauvegarde
chmod 600 deploy/.env.sauvegarde
nano deploy/.env.sauvegarde          # dépôt distant, phrase de passe, clés

# Le conteneur backend écrit ici sous l'uid 1000.
sudo chown -R 1000:1000 deploy/backups

chmod +x deploy/sauvegarde-hors-site.sh
./deploy/sauvegarde-hors-site.sh     # premier passage, à la main

sudo cp deploy/systemd/imsop-sauvegarde*.service /etc/systemd/system/
sudo cp deploy/systemd/imsop-sauvegarde.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now imsop-sauvegarde.timer
systemctl list-timers imsop-sauvegarde.timer

# L'alerte en cas d'echec : a tester une fois, sinon on ne saura jamais
# qu'elle ne part pas.
sudo systemctl start imsop-sauvegarde-alerte.service
```

Et dans `deploy/.env.production` : `BACKUP_CRON_IN_APP=0`.

restic chiffre avant d'envoyer, ce qui est la condition pour que des dossiers
médicaux quittent la machine. **Gardez une copie de `RESTIC_PASSWORD` hors du
serveur** : sans elle, aucune restauration n'est possible.

---

## 9 bis. Le relais d'appels (TURN)

Sans relais, un appel vidéo entre deux réseaux mobiles sonne puis échoue : les
opérateurs placent leurs abonnés derrière un NAT symétrique, et aucun des deux
navigateurs ne peut recevoir l'autre.

```bash
cd /opt/imsop
cp deploy/coturn/turnserver.conf.example deploy/coturn/turnserver.conf
nano deploy/coturn/turnserver.conf   # external-ip et static-auth-secret
```

Le même secret va dans `deploy/.env.production`, en `TURN_SECRET` — les deux
valeurs doivent être identiques, sinon coturn rejettera tout le monde.

```bash
openssl rand -base64 48              # à coller aux deux endroits
```

Ouvrir les ports, puis lancer :

```bash
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 49160:49200/udp       # plage de relais (turnserver.conf)

docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d coturn
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs coturn --tail 20
```

Vérifier que le backend distribue bien des identifiants (depuis un compte
connecté, jeton en main) :

```bash
curl -s -H "Authorization: Bearer <jeton>" https://imsop.org/api/webrtc/ice | head -c 400
```

`relaisDisponible: true` et un `username` de la forme `<horodatage>:<id>`
signifient que tout est en place. Pour tester le relais lui-même, l'outil de
Google ([webrtc.github.io/samples/src/content/peerconnection/trickle-ice](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/))
doit faire apparaître au moins un candidat de type `relay`.

> `turnserver.conf` interdit le relais vers les réseaux privés
> (`denied-peer-ip`). Ce n'est pas optionnel : sans ces lignes, n'importe quel
> compte pourrait faire transiter du trafic vers PostgreSQL, Garage ou le
> backend, que le pare-feu protège justement d'Internet.

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
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production build backend migrate
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm migrate
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d backend
```

Les migrations passent avant le redémarrage du backend : l'ordre inverse
exposerait brièvement un code neuf à un schéma ancien.

`build backend migrate` et non `build backend` seul : ce sont **deux images**
distinctes, et le Dockerfile copie `prisma/` — migrations comprises — dans
l'image. Ne reconstruire que `backend` laisse le conteneur de migration tourner
avec l'ancien dossier, et `migrate deploy` annonce tranquillement
« No pending migrations to apply » alors qu'une migration vient d'arriver.

## Regarder ce qui se passe

```bash
docker compose -f deploy/docker-compose.prod.yml logs -f backend
docker compose -f deploy/docker-compose.prod.yml ps
```
