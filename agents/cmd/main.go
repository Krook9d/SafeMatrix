package main

import (
	"flag"
	"fmt"
	"os"

	"safematrix-agent/internal/cli"
	"safematrix-agent/internal/gui"
)

func main() {
	var useGUI bool
	flag.BoolVar(&useGUI, "gui", false, "Launch GUI mode")
	flag.Parse()

	// If no arguments or --gui flag, launch GUI
	if len(os.Args) == 1 || useGUI {
		fmt.Println("Starting SafeMatrix Agent GUI...")
		gui.Run()
	} else {
		// CLI mode
		fmt.Println("Starting SafeMatrix Agent CLI...")
		cli.Run()
	}
} 