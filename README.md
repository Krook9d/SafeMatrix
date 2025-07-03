# SafeMatrix

# Architecture du Backend FastAPI (SafeMatrix)

Ce document explique la structure des dossiers et des fichiers de ce projet backend. L'objectif est de séparer clairement les responsabilités (`separation of concerns`) pour rendre le code plus facile à maintenir et à faire évoluer.

---

### `main.py`

C'est le **point d'entrée** principal de l'application.
- Il initialise l'application FastAPI.
- Il lance la création des tables de la base de données au démarrage.
- Il inclut les routeurs de l'API définis dans le dossier `/api`.

---

### Dossier `/core`

Contient la logique et la configuration "centrales" de l'application.
- **`config.py`**: Gère les variables d'environnement et les paramètres de configuration (ex: URL de la base de données, clés secrètes) en utilisant Pydantic.
- **`database.py`**: Établit la connexion à la base de données PostgreSQL (le "moteur" SQLAlchemy) et fournit les sessions de base de données à l'application.
- **`opensearch_client.py`**: Gère la connexion au cluster OpenSearch et contient la logique pour créer les index (`hosts`, `inventories`) au démarrage de l'application.
- **`security.py`**: Contient les fonctions liées à la sécurité, comme le hachage des mots de passe et la création/vérification des tokens JWT.
- **`dependencies.py`**: Définit les dépendances réutilisables à travers l'application, comme `get_db` pour obtenir une session de base de données, `get_current_user` pour la protection des routes, et `get_opensearch_client` pour l'accès à OpenSearch.

---

### Dossier `/models`

Définit la structure des **tables de la base de données**.
- **`user.py`**: Contient la classe `User`, qui est le modèle SQLAlchemy correspondant à la table `users` dans PostgreSQL. Il définit les colonnes (`id`, `username`, `hashed_password`, etc.).

---

### Dossier `/schemas`

Définit la **forme des données** que l'API reçoit et envoie, en utilisant des modèles Pydantic pour la validation.
- **`user.py`**: Contient les schémas pour l'utilisateur (`UserCreate`, `User`).
- **`host.py`**: Contient les schémas pour les machines (`HostCreate`, `Host`, etc.), définissant la structure attendue pour créer ou retourner une machine.

---

### Dossier `/crud`

Signifie **C**reate, **R**ead, **U**pdate, **D**elete. Contient la logique qui interagit directement avec les bases de données (PostgreSQL ou OpenSearch).
- **`user.py`**: Contient les fonctions pour manipuler les utilisateurs dans PostgreSQL (`get_user_by_username`, `create_user`).
- **`host.py`**: Contient les fonctions pour manipuler les machines dans OpenSearch (`create_host`, `get_host`).

---

### Dossier `/api`

Définit les **routes (endpoints)** de l'API.
- **`/v1`**: Un sous-dossier pour la version 1 de notre API.
  - **`users.py`**: Définit les routes pour les utilisateurs (`POST /users/`, `GET /users/me`).
  - **`login.py`**: Définit la route d'authentification (`POST /login/access-token`).
  - **`health.py`**: Contient les routes pour vérifier l'état des services, comme OpenSearch.
  - **`hosts.py`**: Définit les routes pour les machines (`POST /hosts/`, `GET /hosts/{host_id}`).

---

### Setup & Lancement

Pour faire fonctionner l'application, les services de base de données (PostgreSQL, OpenSearch) doivent d'abord être lancés via Docker. Ensuite, le backend Python peut être démarré.

#### 1. Lancer les services (Docker)
Depuis la **racine du projet** (le dossier contenant `docker-compose.yml`), lancez :
```bash
docker-compose up -d
```
Cela va démarrer PostgreSQL et OpenSearch en arrière-plan.

Pour les arrêter proprement, utilisez :
```bash
docker-compose down
```

#### 2. Lancer le Backend (Python)
Une fois les services Docker démarrés, suivez ces étapes depuis la racine du dossier `backend/`.

**a. Créer un environnement virtuel**
```bash
python -m venv venv
```

**b. Activer l'environnement virtuel**
- Sur Windows (PowerShell):
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- Sur macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

**c. Installer les dépendances**
Assurez-vous que l'environnement virtuel est activé, puis lancez :
```bash
pip install -r requirements.txt
```

**d. Lancer le serveur de développement**
Cette commande démarre le serveur, qui se rechargera automatiquement à chaque modification de code.
```bash
uvicorn main:app --reload
```
L'API sera alors accessible à l'adresse `http://127.0.0.1:8000`. 
