@echo off
echo Building SafeMatrix Agent v2.0...

:: Download dependencies
echo Downloading dependencies...
go mod tidy

:: Clean previous builds
if exist safematrix-agent.exe del safematrix-agent.exe
if exist safematrix-agent-gui.exe del safematrix-agent-gui.exe
if exist safematrix-installer.exe del safematrix-installer.exe

:: Build main GUI version (installer + dashboard + tray)
echo Building SafeMatrix Agent GUI...
set GOOS=windows
set GOARCH=amd64
go build -ldflags "-H windowsgui -s -w" -o safematrix-agent-gui.exe ./cmd/main.go

if %ERRORLEVEL% EQU 0 (
    echo ✅ GUI Build successful!
    echo Executable: safematrix-agent-gui.exe
) else (
    echo ❌ GUI Build failed!
    exit /b 1
)

:: Build CLI version
echo Building CLI version for Windows...
go build -ldflags "-s -w" -o safematrix-agent.exe ./cmd/main-cli.go

if %ERRORLEVEL% EQU 0 (
    echo ✅ CLI Build successful!
    echo Executable: safematrix-agent.exe
) else (
    echo ❌ CLI Build failed!
    exit /b 1
)

echo.
echo 🎉 Build completed successfully!
echo.
echo 📦 SafeMatrix Agent v2.0 Executables:
echo.
echo 🖥️  safematrix-agent-gui.exe - Main Agent (Installer/Dashboard/Tray)
echo     • Double-click to install (first run)
echo     • Runs in system tray after installation
echo     • Click tray icon to open dashboard
echo.
echo 💻 safematrix-agent.exe - CLI Version  
echo     • Command line interface for servers
echo     • Use with scripts and automation
echo.
echo 🚀 Usage:
echo   safematrix-agent-gui.exe          (Install or show dashboard)
echo   safematrix-agent-gui.exe --tray   (Force tray mode)
echo   safematrix-agent-gui.exe --gui    (Force GUI dashboard)
echo   safematrix-agent.exe help         (CLI commands)
echo.

pause 