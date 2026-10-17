# Guide de Déploiement Local & Passation en Boutique
**Projet :** Bighrissen Phone — Système de Caisse & Gestion de Stock  
**Environnement Cible :** Déploiement local hors-ligne sur le PC portable de la boutique (Utilisateur non technique / Oncle)  
**Stack Technique :** Django REST Framework (ASGI / Daphne), PostgreSQL 16, React (Vite + TypeScript), Nginx Reverse Proxy, Docker Compose.

---

## 1. Vue d'Ensemble & Architecture Révisée

Pour que la caisse fonctionne de manière autonome, robuste et sans nécessiter de compétences techniques :

```
                        ┌────────────────────────────────────────────────────────┐
                        │              PC PORTABLE BOUTIQUE (WINDOWS)            │
                        │                                                        │
[Raccourci Bureau] ---> │  Microsoft Edge / Chrome en mode Application Standalone │
(start_pos.bat)         │  (http://localhost - Plein écran, sans barre d'URL)    │
                        └───────────────────────────┬────────────────────────────┘
                                                    │
                                                    ▼ Port 80
                        ┌────────────────────────────────────────────────────────┐
                        │                   DOCKER COMPOSE                       │
                        │                                                        │
                        │  ┌──────────────────────────────────────────────────┐  │
                        │  │             bighrissen_frontend (Nginx)          │  │
                        │  │  - Fichiers statiques React / Vite               │  │
                        │  │  - Proxy inverse API (/api/) vers Django         │  │
                        │  │  - Proxy inverse WebSocket (/ws/) avec Upgrade   │  │
                        │  │  - Fichiers Médias (/media/) et Admin CSS        │  │
                        │  └──────────────────────────┬───────────────────────┘  │
                        │                             │                          │
                        │                             ▼ Port 8000 (interne)      │
                        │  ┌──────────────────────────────────────────────────┐  │
                        │  │             bighrissen_backend (Daphne)          │  │
                        │  │  - Django ASGI Server (Daphne)                   │  │
                        │  │  - Support complet WebSockets (Paniers en direct)│  │
                        │  │  - Tâche de fond Daily Digest Scheduler          │  │
                        │  │  - Auto-chargement des données de départ         │  │
                        │  └──────────────────────────┬───────────────────────┘  │
                        │                             │                          │
                        │                             ▼ Port 5432 (interne)      │
                        │  ┌──────────────────────────────────────────────────┐  │
                        │  │             bighrissen_db (PostgreSQL 16)        │  │
                        │  │  - Volume persistant : postgres_data             │  │
                        │  │  - Sauvegarde automatique quotidienne (pg_dump)   │  │
                        │  └──────────────────────────────────────────────────┘  │
                        └────────────────────────────────────────────────────────┘
```

---

## 2. Ce qui a été corrigé par rapport à l'ébauche initiale

| Élément | Ébauche initiale | Version Corrigée & Testée |
| :--- | :--- | :--- |
| **Serveur Backend** | `gunicorn core.wsgi:application` *(aurait crashé : module inexistant + perte des WebSockets)* | `daphne config.asgi:application` *(supporte l'API REST + WebSockets `/ws/cart/` + notifications automatiques)* |
| **Nginx & WebSockets** | Pas de proxy WebSocket pour `/ws/` | Ajout du bloc `location /ws/` avec `Upgrade` et `Connection "upgrade"` pour le scanner caméra et la synchro en direct |
| **Dépendances Python** | `requirements.txt` incomplet (manquait `daphne`, `channels`, `pillow`, `python-barcode`) | `requirements.txt` mis à jour et validé avec tous les packages nécessaires |
| **Variables Base de Données** | Mismatch entre `DATABASE_URL` et `POSTGRES_*` | `settings.py` mis à jour pour supporter aussi bien `DATABASE_URL` que `POSTGRES_*` sans erreur |
| **Données de Départ** | Base vide à la livraison (l'oncle aurait dû tout retaper) | Fixture complète générée (`fixtures/initial_data.json`) : Magasin Guelmim, téléphone, logo, opérateurs et catalogue auto-chargés au premier démarrage |
| **Bouton de Sauvegarde** | Sauvegarde uniquement en ligne de commande | **Bouton « Sauvegarder la base »** ajouté directement dans la page **Paramètres** de la caisse pour un export instantané en un clic |
| **Accès Wi-Fi Boutique** | Restreint strictement au PC portable | `ALLOWED_HOSTS: "*"` configuré pour permettre aux smartphones/tablettes de la boutique de scanner les articles à distance |
| **Sauvegarde Quotidienne** | Sauvegarde sur le même disque dur uniquement | `backup_db.bat` sauvegarde sur `C:\POS_Backups` **ET duplique automatiquement sur toute clé USB branchée** |

---

## 3. Procédure d'Installation sur le PC de l'Oncle (Une Seule Fois)

Suivez ces 4 étapes simples lorsque vous préparez le PC portable de la boutique :

### Étape 1 : Installer Docker Desktop sur Windows
1. Téléchargez et installez **Docker Desktop pour Windows** (version officielle gratuite).
2. Lors de l'installation, assurez-vous que la case **« Use WSL 2 instead of Hyper-V »** est cochée.
3. Ouvrez Docker Desktop, allez dans les **Paramètres (icône engrenage) > General**, et cochez :
   - ✅ **« Start Docker Desktop when you log in »** (pour que Docker démarre tout seul à l'allumage du PC).
4. Attendez que l'icône Docker en bas à droite devienne verte (**« Engine running »**).

### Étape 2 : Copier le Dossier du Projet
1. Copiez l'intégralité du dossier `bighrissen-phone` sur le disque dur du PC, à un emplacement stable :
   👉 `C:\BighrissenPOS`

### Étape 3 : Lancer l'Installation Automatique
1. Dans le dossier `C:\BighrissenPOS`, faites un clic droit sur :
   👉 **`setup_store_laptop.bat`**
2. Choisissez **« Exécuter en tant qu'administrateur »**.
3. Le script va automatiquement :
   - Construire les conteneurs Docker (PostgreSQL, Backend Daphne, Frontend Nginx).
   - Appliquer les migrations de base de données.
   - Charger automatiquement la boutique Bighrissen Phone Guelmim, le catalogue et les opérateurs.
   - Créer le raccourci **« Bighrissen Phone POS »** sur le Bureau.
   - Configurer le lancement automatique au démarrage de Windows.
   - Planifier la sauvegarde quotidienne de 21h30 dans le Planificateur de tâches Windows.

### Étape 4 : Vérification
- Double-cliquez sur le nouveau raccourci **Bighrissen Phone POS** sur le bureau.
- L'application s'ouvre en mode application de bureau (sans barre d'adresse de navigateur).
- Connectez-vous avec l'opérateur (ex: `Mohamed` ou `Hassan`).
- Vérifiez que le catalogue et les paramètres de la boutique de Guelmim sont bien affichés.

---

## 4. Utilisation Quotidienne par l'Oncle (Zéro Technique)

### Le Matin à l'Ouverture :
- **Allumer le PC portable :** Docker démarre en arrière-plan et la caisse s'ouvre toute seule sur l'écran.
- Si la fenêtre a été fermée, l'oncle a juste à double-cliquer sur le raccourci bureau **« Bighrissen Phone POS »**.

### Pendant la Journée :
- **Encaisser :** Utilisation normale de la caisse (Espèces, Dette client, Virement bancaire, Paiement mixte).
- **Scanner un article :** Le lecteur code-barres USB tape automatiquement le code ou l'IMEI dans la barre de recherche.
- **Imprimer un ticket :** Cliquer sur **« Imprimer »** ou imprimer via le navigateur (mise en page ticket thermique avec logo circulaire 50px et coordonnées de Guelmim).
- **Virement bancaire :** Enregistrer le virement en attente, vérifier la réception sur le téléphone, puis cliquer sur **« Reprendre le paiement »** et valider.

### Le Soir à la Fermeture :
- À **21h30**, la tâche Windows exécute silencieusement `backup_db.bat`.
- La sauvegarde est stockée dans `C:\POS_Backups\backup_AAAA-MM-JJ_HHMMSS.sql`.
- **Conseil sécurité :** Laisser une clé USB branchée sur le PC (ex: lecteur D: ou E:). Le script y copiera automatiquement un double de la sauvegarde.
- L'oncle peut éteindre l'ordinateur normalement.

---

## 5. Système de Sauvegarde & Récupération d'Urgence

### Méthode 1 : Sauvegarde en 1 Clic depuis la Caisse (Recommandé)
- Rendez-vous sur la page **Paramètres** de l'application.
- Cliquez en haut à droite sur le bouton **« Sauvegarder la base »**.
- Le fichier JSON complet contenant l'ensemble de la boutique est instantanément téléchargé.

### Méthode 2 : Restauration en Cas de Panne Matérielle
Si l'ordinateur tombe en panne ou est remplacé :
1. Installez Docker Desktop sur le nouveau PC et recopiez le dossier `C:\BighrissenPOS`.
2. Lancez `setup_store_laptop.bat`.
3. Pour restaurer la dernière sauvegarde SQL :
   ```powershell
   docker compose exec -T db psql -U pos_user -d bighrissen_pos < "C:\POS_Backups\backup_DOUBLON.sql"
   ```
4. Toutes les ventes, dettes, garanties et stocks sont immédiatement restaurés.

---

## 6. Réglages Matériels Spécifiques aux Magasins de Téléphonie

### A. Imprimante Thermique Ticket de Caisse (58mm / 80mm ESC/POS)
1. Branchez l'imprimante thermique en USB et installez son pilote Windows (souvent "POS-80" ou "POS-58").
2. Dans Windows, définissez-la comme **Imprimante par défaut**.
3. Dans la boîte de dialogue d'impression du navigateur (la première fois) :
   - **Mise en page :** Portrait.
   - **Marges :** *Aucune* (ou Minimum).
   - **En-têtes et pieds de page :** *Décocher* (pour ne pas afficher la date du navigateur ou l'URL).
   - **Graphiques d'arrière-plan :** *Cocher* (pour imprimer le logo et les séparateurs).

### B. Douchette / Lecteur Code-Barres & QR Code (USB)
- La quasi-totalité des douchettes USB fonctionnent en mode émulation clavier (HID Keyboard).
- Quand un code-barres ou IMEI est scanné, il est saisi directement dans le champ de recherche actif et valide avec `Entrée`.
- L'interface Bighrissen POS donne automatiquement le focus au champ de recherche à l'ouverture de la caisse (raccourci `/`).

### C. Utiliser un Téléphone Portable comme Scanner Caméra (Wi-Fi Boutique)
1. Connectez le smartphone au même réseau Wi-Fi que le PC portable.
2. Trouvez l'adresse IP locale du PC portable (ex: `192.168.1.50`).
3. Sur le smartphone, ouvrez le navigateur et tapez :
   👉 `http://192.168.1.50/`
4. Vous pouvez scanner les articles directement depuis les rayons grâce à la caméra du smartphone, et le panier du PC portable se met à jour en temps réel via WebSockets.
