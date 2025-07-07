package main

import (
	"flag"
	"fmt"
	"os"

	"safematrix-agent/internal/cli"
)

func main() {
	var showHelp bool
	flag.BoolVar(&showHelp, "help", false, "Show help")
	flag.Parse()

	if showHelp || len(os.Args) == 1 {
		fmt.Println("SafeMatrix Agent - CLI Only Version")
		fmt.Println()
		fmt.Println("Usage:")
		fmt.Println("  safematrix-agent config                    # Configure agent settings")
		fmt.Println("  safematrix-agent config --host <ip>        # Set server host")
		fmt.Println("  safematrix-agent config --port <port>      # Set server port")
		fmt.Println("  safematrix-agent test                      # Test connection to server")
		fmt.Println("  safematrix-agent scan                      # Run inventory scan once")
		fmt.Println("  safematrix-agent daemon                    # Run as daemon (continuous)")
		fmt.Println("  safematrix-agent help                      # Show this help")
		return
	}

	// CLI mode
	fmt.Println("Starting SafeMatrix Agent CLI...")
	cli.Run()
} 