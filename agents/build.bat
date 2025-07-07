@echo off
echo Building SafeMatrix Agent...

:: Download dependencies
echo Downloading dependencies...
go mod tidy

:: Build for Windows
echo Building for Windows...
go build -o safematrix-agent.exe ./cmd/main.go

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build successful!
    echo Executable: safematrix-agent.exe
    echo.
    echo Usage:
    echo   safematrix-agent.exe           [GUI mode]
    echo   safematrix-agent.exe help      [CLI help]
) else (
    echo.
    echo ❌ Build failed!
)

pause 