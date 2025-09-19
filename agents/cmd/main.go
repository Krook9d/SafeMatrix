package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"safematrix-agent/internal/cli"
	"safematrix-agent/internal/gui"
	"safematrix-agent/internal/tray"
	"safematrix-agent/internal/config"
	"safematrix-agent/internal/service"
	"safematrix-agent/internal/installer"
	"log"
)

func main() {
	var useGUI bool
	var useTray bool
	var forceInstall bool
	var runService bool
	var debugService bool
	
	flag.BoolVar(&useGUI, "gui", false, "Launch GUI mode")
	flag.BoolVar(&useTray, "tray", false, "Launch in system tray mode")
	flag.BoolVar(&forceInstall, "install", false, "Force installation mode")
	flag.BoolVar(&runService, "service", false, "Run as Windows service")
	flag.BoolVar(&debugService, "debug", false, "Run service in debug mode")
	flag.Parse()

	// Check if running as Windows service
	if service.IsWindowsService() || runService {
		fmt.Println("Starting SafeMatrix Agent as Windows service...")
		err := service.RunService(debugService)
		if err != nil {
			fmt.Printf("Service error: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// Check if SafeMatrix Agent is installed
	inst := installer.NewInstaller()
	isInstalled := inst.IsInstalled()
	
	// Determine mode based on context
	if forceInstall || !isInstalled {
		// Show installation GUI
		fmt.Println("Starting SafeMatrix Agent Installation...")
		gui.RunInstaller()
	} else if useTray || (!useGUI && len(os.Args) == 1) {
		// Run in system tray mode (default for installed agent)
		fmt.Println("Starting SafeMatrix Agent in background...")
		runTrayMode()
	} else if useGUI {
		// Show full GUI dashboard
		fmt.Println("Starting SafeMatrix Agent Dashboard...")
		gui.RunDashboard()
	} else {
		// CLI mode
		fmt.Println("Starting SafeMatrix Agent CLI...")
		cli.Run()
	}
}

func checkIfInstalled() bool {
	// Check if the agent is installed in Program Files
	programFiles := os.Getenv("PROGRAMFILES")
	if programFiles == "" {
		programFiles = "C:\\Program Files"
	}
	
	installPath := filepath.Join(programFiles, "SafeMatrix", "Agent", "safematrix-agent.exe")
	_, err := os.Stat(installPath)
	return err == nil
}

func runTrayMode() {
	// Setup logging for tray mode
	logFile, err := setupLogging("tray")
	if err != nil {
		// Cannot log, but still try to run
		fmt.Printf("Failed to setup logging: %v\n", err)
	} else {
		defer logFile.Close()
		log.SetOutput(logFile)
	}

	log.Println("--- Starting SafeMatrix Agent in Tray Mode ---")
	
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Printf("Failed to load config, using default: %v", err)
		cfg = config.DefaultConfig()
	} else {
		log.Println("Configuration loaded successfully.")
	}

	// Create tray agent with callback to show GUI
	trayAgent := tray.NewTrayAgent(cfg, func() {
		log.Println("Show GUI callback triggered.")
		gui.RunDashboard()
	})

	log.Println("Tray agent created, starting now...")
	// Start tray agent (blocking)
	trayAgent.Start()
	log.Println("Tray agent has exited.")
}

func setupLogging(mode string) (*os.File, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	logDir := filepath.Join(configDir, "SafeMatrix")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, err
	}

	logPath := filepath.Join(logDir, fmt.Sprintf("%s.log", mode))
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}
	
	return file, nil
} 