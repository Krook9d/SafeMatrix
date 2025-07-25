# SafeMatrix Agent

Go-based agent for software inventory collection and vulnerability monitoring.

## 📋 Features

- ✅ **Modern graphical interface** using Fyne  
- ✅ **Full command-line interface**  
- ✅ **Flexible configuration** (server, port, interval)  
- ✅ **Automatic Windows inventory collection**  
- ✅ **Secure communication** with the SafeMatrix backend  
- ✅ **Daemon mode** for continuous monitoring  

## 🚀 Installation

### Prerequisites

- Go 1.21 or higher  
- Windows (Linux/macOS support in development)  

### Build

```bash
# Clone the repository
cd agents/

# Download dependencies
go mod tidy

# Build the agent
go build -o safematrix-agent.exe ./cmd/main.go
```

### Build for Windows (from Linux/macOS)

```bash
# Cross-compilation for Windows
GOOS=windows GOARCH=amd64 go build -o safematrix-agent.exe ./cmd/main.go
```

## 🎮 Usage

### GUI Mode (Recommended)

```bash
# Launch the graphical interface
./safematrix-agent.exe
# or
./safematrix-agent.exe --gui
```

The GUI allows you to:
- Configure the SafeMatrix server address  
- Test connection  
- Launch manual scans  
- Start/stop daemon mode  
- View real-time logs  

### CLI Mode

```bash
# Show help
./safematrix-agent.exe help

# Configure server
./safematrix-agent.exe config --host 192.168.1.100 --port 8000

# Test connection
./safematrix-agent.exe test

# Run a one-time scan
./safematrix-agent.exe scan

# Daemon mode (continuous monitoring)
./safematrix-agent.exe daemon
```

## ⚙️ Configuration

The agent stores its configuration in `~/.safematrix/config.json`.

### Default Configuration

```json
{
  "server_host": "127.0.0.1",
  "server_port": 8000,
  "agent_id": "hostname-timestamp",
  "collect_interval": 5
}
```

### Parameters

- **server_host**: SafeMatrix server IP address  
- **server_port**: SafeMatrix server port  
- **agent_id**: Unique identifier for the agent  
- **collect_interval**: Time between scans (in minutes)  

## 🔧 How It Works

### Inventory Collection

The agent uses WMI (Windows Management Instrumentation) to:
- Identify hostname, OS, and architecture  
- List all installed software via `Win32_Product`  
- Retrieve name, version, and vendor for each software  

### Communication with SafeMatrix

1. **Host registration**: `POST /api/v1/hosts/`  
2. **Inventory submission**: `POST /api/v1/inventories/`  
3. **Health check**: `GET /api/v1/health/`  

### Collected Data Example

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
│   └── main.go              # Entry point
├── internal/
│   ├── config/              # Config management
│   ├── inventory/           # Windows inventory collection
│   ├── api/                 # SafeMatrix API client
│   ├── cli/                 # Command-line interface
│   └── gui/                 # Graphical interface
├── go.mod
└── README.md
```

## 🐛 Debugging

### Logs

- **GUI**: Logs visible in the interface  
- **CLI**: Printed to standard output/error  

### Common Issues

1. **"Connection failed"**  
   - Ensure SafeMatrix backend is running  
   - Confirm IP address and port  
   - Check firewall settings  

2. **"Scan failed"**  
   - Run as Administrator  
   - WMI may require elevated privileges  

3. **"No software found"**  
   - `Win32_Product` can be slow/incomplete  
   - Some software might not be listed  

## 🚧 Roadmap

- [ ] Linux support (using `dpkg`, `rpm`)  
- [ ] macOS support (using `brew`, `pkgutil`)  
- [ ] Collect active services/processes  
- [ ] Detect local vulnerabilities  
- [ ] Install as Windows service  
- [ ] Embedded web interface  

## 📝 License

This project is part of SafeMatrix and follows the same license.
