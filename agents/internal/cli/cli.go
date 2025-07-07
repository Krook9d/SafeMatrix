package cli

import (
	"flag"
	"fmt"
	"os"
	"time"

	"safematrix-agent/internal/api"
	"safematrix-agent/internal/config"
	"safematrix-agent/internal/inventory"
)

// Run starts the CLI interface
func Run() {
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	command := os.Args[1]

	switch command {
	case "config":
		handleConfigCommand()
	case "test":
		handleTestCommand()
	case "scan":
		handleScanCommand()
	case "daemon":
		handleDaemonCommand()
	case "help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n", command)
		printUsage()
	}
}

func printUsage() {
	fmt.Println("SafeMatrix Agent - CLI Mode")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  safematrix-agent config                    # Configure agent settings")
	fmt.Println("  safematrix-agent config --host <ip>        # Set server host")
	fmt.Println("  safematrix-agent config --port <port>      # Set server port")
	fmt.Println("  safematrix-agent test                      # Test connection to server")
	fmt.Println("  safematrix-agent scan                      # Run inventory scan once")
	fmt.Println("  safematrix-agent daemon                    # Run as daemon (continuous)")
	fmt.Println("  safematrix-agent help                      # Show this help")
	fmt.Println()
}

func handleConfigCommand() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return
	}

	configFlags := flag.NewFlagSet("config", flag.ExitOnError)
	host := configFlags.String("host", "", "Server host/IP")
	port := configFlags.Int("port", 0, "Server port")

	configFlags.Parse(os.Args[2:])

	// Update config if flags provided
	updated := false
	if *host != "" {
		cfg.ServerHost = *host
		updated = true
	}
	if *port != 0 {
		cfg.ServerPort = *port
		updated = true
	}

	if updated {
		if err := cfg.Save(); err != nil {
			fmt.Printf("Error saving config: %v\n", err)
			return
		}
		fmt.Println("Configuration updated successfully!")
	}

	// Show current config
	fmt.Println("Current Configuration:")
	fmt.Printf("  Server Host: %s\n", cfg.ServerHost)
	fmt.Printf("  Server Port: %d\n", cfg.ServerPort)
	fmt.Printf("  Agent ID: %s\n", cfg.AgentID)
	fmt.Printf("  Collect Interval: %d minutes\n", cfg.CollectInterval)
	fmt.Printf("  Server URL: %s\n", cfg.GetServerURL())
}

func handleTestCommand() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return
	}

	fmt.Printf("Testing connection to %s...\n", cfg.GetServerURL())

	client := api.NewClient(cfg.GetServerURL())
	if err := client.TestConnection(); err != nil {
		fmt.Printf("❌ Connection failed: %v\n", err)
		return
	}

	fmt.Println("✅ Connection successful!")
}

func handleScanCommand() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return
	}

	fmt.Println("Collecting system inventory...")

	hostInfo, err := inventory.CollectInventory()
	if err != nil {
		fmt.Printf("❌ Failed to collect inventory: %v\n", err)
		return
	}

	fmt.Printf("✅ Inventory collected successfully!\n")
	fmt.Printf("  Hostname: %s\n", hostInfo.Hostname)
	fmt.Printf("  OS: %s %s\n", hostInfo.OS, hostInfo.OSVersion)
	fmt.Printf("  Architecture: %s\n", hostInfo.Architecture)
	fmt.Printf("  Software found: %d\n", len(hostInfo.Software))

	// Send to server
	client := api.NewClient(cfg.GetServerURL())
	
	fmt.Println("Registering host with server...")
	hostID, err := client.RegisterHost(hostInfo)
	if err != nil {
		fmt.Printf("❌ Failed to register host: %v\n", err)
		return
	}

	fmt.Printf("✅ Host registered with ID: %s\n", hostID)

	fmt.Println("Submitting inventory...")
	if err := client.SubmitInventory(hostID, hostInfo); err != nil {
		fmt.Printf("❌ Failed to submit inventory: %v\n", err)
		return
	}

	fmt.Println("✅ Inventory submitted successfully!")
}

func handleDaemonCommand() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return
	}

	fmt.Printf("Starting SafeMatrix Agent daemon...\n")
	fmt.Printf("Server: %s\n", cfg.GetServerURL())
	fmt.Printf("Scan interval: %d minutes\n", cfg.CollectInterval)
	fmt.Println("Press Ctrl+C to stop")

	client := api.NewClient(cfg.GetServerURL())
	
	// Test connection first
	if err := client.TestConnection(); err != nil {
		fmt.Printf("❌ Cannot connect to server: %v\n", err)
		return
	}

	var hostID string
	
	for {
		fmt.Printf("\n[%s] Collecting inventory...\n", time.Now().Format("15:04:05"))

		hostInfo, err := inventory.CollectInventory()
		if err != nil {
			fmt.Printf("❌ Failed to collect inventory: %v\n", err)
		} else {
			// Register host if not done yet
			if hostID == "" {
				hostID, err = client.RegisterHost(hostInfo)
				if err != nil {
					fmt.Printf("❌ Failed to register host: %v\n", err)
				} else {
					fmt.Printf("✅ Host registered with ID: %s\n", hostID)
				}
			}

			// Submit inventory
			if hostID != "" {
				if err := client.SubmitInventory(hostID, hostInfo); err != nil {
					fmt.Printf("❌ Failed to submit inventory: %v\n", err)
				} else {
					fmt.Printf("✅ Inventory submitted (%d software items)\n", len(hostInfo.Software))
				}
			}
		}

		// Wait for next scan
		fmt.Printf("Next scan in %d minutes...\n", cfg.CollectInterval)
		time.Sleep(time.Duration(cfg.CollectInterval) * time.Minute)
	}
} 