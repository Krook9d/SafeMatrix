# 🛠️ Architecture Récapitulative

## Résumé du projet

SafeMatrix est une Plateforme centralisée pour la collecte, l’analyse et la visualisation de l’inventaire logiciel et des vulnérabilités des postes Windows, Linux et macOS via des agents Go. Les vulnérabilités sont automatiquement enrichies à partir de sources publiques externes (AlienVault, etc.). Backend FastAPI (Python), stockage sécurisé (OpenSearch, PostgreSQL), dashboard React, authentification forte.



## 1. Vue d'ensemble

```
[Agent Go]
   |  (Push JSON via HTTPS)
   v
[API Python FastAPI]  <---  [Dashboard React]
   |                       (fetch via JWT token)
   +--> [PostgreSQL] (users/auth)
   |
   +--> [OpenSearch] (hosts, inventaire, logs)
```

---

## 2. Agents endpoint

- Codés en **Go**, packagés pour Windows/Linux/macOS
- Fonctionnent comme service/daemon en tâche de fond (invisible)
- Collectent la liste des logiciels installés + versions toutes les 5 min
- Poussent les données en **HTTPS/JSON** sur l’API backend

---

## 3. Backend principal (FastAPI)

- Reçoit les inventaires des agents
- Interroge des API publiques (AlienVault, etc.) pour enrichir les logiciels/versions avec les vulnérabilités connues
- Stocke les données enrichies dans OpenSearch
- Authentifie les utilisateurs via **PostgreSQL** (username, password hash)
- Gère les sessions avec **JWT**
- Expose une API REST pour :
  - Recevoir les inventaires des agents
  - Permettre au frontend (dashboard) d’afficher hosts, inventaires, vulnérabilités, etc.
  - Authentifier les users

---

## 4. Stockage

- **PostgreSQL** :
  - Table `users` (username, hash, role, created\_at…)
- **OpenSearch** :
  - Index `hosts` : 1 doc/host (id, nom, ip, os…)
  - Index `inventories` : inventaire logiciels, version, date, **vulns**
    - ex : `vulns` : [ {cve\_id, description, score, url…}, … ]
  - Index logs/alertes si besoin

---

## 5. Frontend (React)

- Authentification via API (login/password → token JWT)
- Dashboard ergonomique, moderne, quelques pages seulement :
  - Liste des hosts + détails inventaire/logiciels par host
  - Visualisation des vulnérabilités associées à chaque logiciel/host
  - Graphiques synthétiques (répartition vulnéras, hot hosts, etc.)
  - Filtres/recherche (full-text via API/backend)
- UI Kit recommandé : **Ant Design** ou **Material-UI**

---

## 6. Déploiement

- **Docker Compose** pour tout orchestrer :
  - Container FastAPI backend
  - Container PostgreSQL
  - Container OpenSearch
  - (Optionnel) Container OpenSearch Dashboard
  - Container frontend React (servi via nginx ou Vite)
- Agents Go : installés directement sur les endpoints à monitorer (hors Compose)

---

## 7. Sécurité

- MDP hashés en **bcrypt** dans PostgreSQL
- Accès à OpenSearch restreint au backend uniquement
- Tout le trafic en **HTTPS**
- Aucun mot de passe ou info sensible dans OpenSearch

---

## 8. Scalabilité / Roadmap

- MVP simple-tenant, évolutif multi-tenant en ajoutant une colonne/clé sur les tables indexées
- Possibilité d’ajouter un worker asynchrone/celery pour du traitement batch si besoin plus tard
- Ajout de l’IA/LLM possible dans un second temps (module à part)

---

## 9. Flux utilisateur

1. **Admin/analyste** se connecte sur le dashboard (React)
2. Le frontend interroge l’API backend (FastAPI), avec le JWT
3. L’API lit les users/auth dans PostgreSQL, les inventaires/hosts dans OpenSearch
4. Les **agents Go** pushent les inventaires régulièrement
5. Les nouveaux softs/vulnéras apparaissent en quasi temps réel dans le dashboard

---

## 10. Diagramme ASCII

```
      [Endpoints/Users]
            |
        [Agent Go]
            |
         (Push HTTPS/JSON)
            |
       [FastAPI Backend]---[PostgreSQL: users/auth]
            |
       [OpenSearch: data]
            |
       [React Dashboard]
```

---

## Optionnel : OpenSearch Dashboard

- Peut être ajouté comme outil de debug/interrogation technique
- Pas obligatoire pour le fonctionnement
- Pratique pour explorer les données brutes ou créer des dashboards techniques rapidement

---

