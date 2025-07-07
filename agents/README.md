# SafeMatrix Agent

Agent Go pour la collecte d'inventaire logiciel et la surveillance des vulnérabilités.

## 📋 Fonctionnalités

- ✅ **Interface graphique** moderne avec Fyne
- ✅ **Interface en ligne de commande** complète
- ✅ **Configuration flexible** (serveur, port, intervalle)
- ✅ **Collecte automatique** d'inventaire Windows
- ✅ **Communication sécurisée** avec le backend SafeMatrix
- ✅ **Mode daemon** pour surveillance continue

## 🚀 Installation

### Prérequis

- Go 1.21 ou supérieur
- Windows (support Linux/macOS en développement)

### Compilation

```bash
# Cloner le repository
cd agents/

# Télécharger les dépendances
go mod tidy

# Compiler l'agent
go build -o safematrix-agent.exe ./cmd/main.go
```

### Build pour Windows (depuis Linux/macOS)

```bash
# Cross-compilation pour Windows
GOOS=windows GOARCH=amd64 go build -o safematrix-agent.exe ./cmd/main.go
```

## 🎮 Utilisation

### Mode GUI (Recommandé)

```bash
# Lancer l'interface graphique
./safematrix-agent.exe
# ou
./safematrix-agent.exe --gui
```

L'interface graphique permet de :
- Configurer l'adresse du serveur SafeMatrix
- Tester la connexion
- Lancer des scans manuels
- Démarrer/arrêter le mode daemon
- Voir les logs en temps réel

### Mode CLI

```bash
# Afficher l'aide
./safematrix-agent.exe help

# Configurer le serveur
./safematrix-agent.exe config --host 192.168.1.100 --port 8000

# Tester la connexion
./safematrix-agent.exe test

# Lancer un scan unique
./safematrix-agent.exe scan

# Mode daemon (surveillance continue)
./safematrix-agent.exe daemon
```

## ⚙️ Configuration

L'agent stocke sa configuration dans `~/.safematrix/config.json`.

### Configuration par défaut

```json
{
  "server_host": "127.0.0.1",
  "server_port": 8000,
  "agent_id": "hostname-timestamp",
  "collect_interval": 5
}
```

### Paramètres

- **server_host** : Adresse IP du serveur SafeMatrix
- **server_port** : Port du serveur SafeMatrix  
- **agent_id** : Identifiant unique de l'agent
- **collect_interval** : Intervalle entre les scans (en minutes)

## 🔧 Fonctionnement

### Collecte d'inventaire

L'agent utilise WMI (Windows Management Instrumentation) pour :
- Identifier le hostname, OS, architecture
- Lister tous les logiciels installés via `Win32_Product`
- Récupérer nom, version, éditeur de chaque logiciel

### Communication avec SafeMatrix

1. **Enregistrement du host** : `POST /api/v1/hosts/`
2. **Soumission d'inventaire** : `POST /api/v1/inventories/`
3. **Test de santé** : `GET /api/v1/health/`

### Données collectées

```json
{
  "hostname": "PC-JOHN-DOE",
  "os": "Microsoft Windows 10 Pro",
  "os_version": "10.0.19044",
  "architecture": "x64-based PC",
  "software": [
    {
      "name": "Mozilla Firefox",
      "version": "91.0.1",
      "vendor": "Mozilla",
      "install_date": "20210901"
    }
  ]
}
```

## 🏗️ Architecture

```
safematrix-agent/
├── cmd/
│   └── main.go              # Point d'entrée
├── internal/
│   ├── config/             # Gestion configuration
│   ├── inventory/          # Collecte inventaire Windows
│   ├── api/               # Client API SafeMatrix
│   ├── cli/               # Interface ligne de commande
│   └── gui/               # Interface graphique
├── go.mod
└── README.md
```

## 🐛 Débogage

### Logs

- **GUI** : Logs visibles dans l'interface
- **CLI** : Sortie standard/erreur

### Problèmes courants

1. **"Connection failed"**
   - Vérifier que le serveur SafeMatrix est démarré
   - Confirmer l'adresse IP et le port
   - Vérifier le pare-feu

2. **"Scan failed"**
   - Lancer en tant qu'administrateur
   - WMI peut nécessiter des privilèges élevés

3. **"No software found"**
   - `Win32_Product` peut être lent/incomplet
   - Certains logiciels ne sont pas répertoriés

## 🚧 Roadmap

- [ ] Support Linux (utilisation de `dpkg`, `rpm`)
- [ ] Support macOS (utilisation de `brew`, `pkgutil`)
- [ ] Collecte de services/processus actifs
- [ ] Détection de vulnérabilités locales
- [ ] Installation en tant que service Windows
- [ ] Interface web embarquée

## 📝 Licence

Ce projet fait partie de SafeMatrix et suit la même licence. 