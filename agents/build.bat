@echo off
REM SafeMatrix Agent Build Script for Windows
REM Requires: Visual Studio (with C/C++ tools) or MinGW-w64

echo ================================================
echo   SafeMatrix Agent - Build System
echo   Professional C Agent for Windows
echo ================================================
echo.

REM Check if cmake is available
where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake not found!
    echo Please install CMake from https://cmake.org/download/
    echo Or install Visual Studio with C++ development tools
    pause
    exit /b 1
)

echo [1/4] Creating build directory...
if not exist build mkdir build
cd build

echo.
echo [2/4] Generating build files with CMake...
cmake .. -G "Visual Studio 17 2022" -A x64
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: CMake generation failed!
    echo.
    echo Trying with MinGW Makefiles...
    cmake .. -G "MinGW Makefiles"
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: CMake generation failed with MinGW too!
        echo Please install Visual Studio or MinGW-w64
        cd ..
        pause
        exit /b 1
    )
)

echo.
echo [3/4] Building SafeMatrix Agent...
cmake --build . --config Release
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    cd ..
    pause
    exit /b 1
)

echo.
echo [4/4] Copying executable...
cd ..
if exist build\bin\Release\safematrix-agent.exe (
    copy /Y build\bin\Release\safematrix-agent.exe safematrix-agent.exe
) else if exist build\bin\safematrix-agent.exe (
    copy /Y build\bin\safematrix-agent.exe safematrix-agent.exe
) else (
    echo WARNING: Executable not found in expected location
    echo Looking in build directory...
    dir /s /b build\safematrix-agent.exe
)

if exist safematrix-agent.exe (
    echo.
    echo ================================================
    echo   ✓ BUILD SUCCESSFUL!
    echo ================================================
    echo.
    echo Executable: safematrix-agent.exe
    echo Size: 
    dir safematrix-agent.exe | find "safematrix-agent.exe"
    echo.
    echo Usage:
    echo   safematrix-agent.exe          - Show status or install
    echo   safematrix-agent.exe install  - Install as Windows service
    echo   safematrix-agent.exe help     - Show all commands
    echo.
    echo Installation:
    echo   Run as Administrator to install:
    echo   safematrix-agent.exe install
    echo.
) else (
    echo.
    echo ERROR: Build completed but executable not found!
    echo Please check the build directory manually.
)

pause