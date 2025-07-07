package gui

import (
	"fmt"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"fyne.io/fyne/v2/theme"

	"safematrix-agent/internal/api"
	"safematrix-agent/internal/config"
	"safematrix-agent/internal/inventory"
)

type GUI struct {
	app        fyne.App
	window     fyne.Window
	config     *config.Config
	
	// UI Components
	hostEntry     *widget.Entry
	portEntry     *widget.Entry
	statusLabel   *widget.Label
	logText       *widget.Entry
	scanButton    *widget.Button
	daemonButton  *widget.Button
	testButton    *widget.Button
	
	// State
	isDaemonRunning bool
	daemonStop      chan bool
}

// Run starts the GUI application
func Run() {
	gui := &GUI{
		app:        app.New(),
		daemonStop: make(chan bool),
	}
	
	gui.app.SetIcon(theme.ComputerIcon())
	gui.setupWindow()
	gui.loadConfig()
	gui.setupUI()
	
	gui.window.ShowAndRun()
}

func (g *GUI) setupWindow() {
	g.window = g.app.NewWindow("SafeMatrix Agent")
	g.window.SetFixedSize(true)
	g.window.Resize(fyne.NewSize(600, 500))
	g.window.CenterOnScreen()
}

func (g *GUI) loadConfig() {
	cfg, err := config.Load()
	if err != nil {
		g.config = config.DefaultConfig()
		g.appendLog("Warning: Could not load config, using defaults")
	} else {
		g.config = cfg
		g.appendLog("Configuration loaded successfully")
	}
}

func (g *GUI) setupUI() {
	// Title
	title := widget.NewLabelWithStyle("SafeMatrix Agent", fyne.TextAlignCenter, fyne.TextStyle{Bold: true})
	
	// Configuration section
	configCard := g.createConfigCard()
	
	// Actions section
	actionsCard := g.createActionsCard()
	
	// Status section
	statusCard := g.createStatusCard()
	
	// Log section
	logCard := g.createLogCard()
	
	// Main layout
	content := container.NewVBox(
		title,
		container.NewGridWithRows(2,
			container.NewGridWithColumns(2, configCard, actionsCard),
			container.NewGridWithColumns(1, statusCard),
		),
		logCard,
	)
	
	g.window.SetContent(container.NewPadded(content))
}

func (g *GUI) createConfigCard() *widget.Card {
	g.hostEntry = widget.NewEntry()
	g.hostEntry.SetText(g.config.ServerHost)
	
	g.portEntry = widget.NewEntry()
	g.portEntry.SetText(fmt.Sprintf("%d", g.config.ServerPort))
	
	saveButton := widget.NewButton("Save Config", g.onSaveConfig)
	
	form := container.NewVBox(
		widget.NewLabel("Server Host:"),
		g.hostEntry,
		widget.NewLabel("Server Port:"),
		g.portEntry,
		saveButton,
	)
	
	return widget.NewCard("Configuration", "", form)
}

func (g *GUI) createActionsCard() *widget.Card {
	g.testButton = widget.NewButton("Test Connection", g.onTestConnection)
	g.scanButton = widget.NewButton("Run Scan", g.onRunScan)
	g.daemonButton = widget.NewButton("Start Daemon", g.onToggleDaemon)
	
	actions := container.NewVBox(
		g.testButton,
		g.scanButton,
		g.daemonButton,
	)
	
	return widget.NewCard("Actions", "", actions)
}

func (g *GUI) createStatusCard() *widget.Card {
	g.statusLabel = widget.NewLabel("Status: Ready")
	
	infoText := fmt.Sprintf("Agent ID: %s\nScan Interval: %d minutes", 
		g.config.AgentID, g.config.CollectInterval)
	infoLabel := widget.NewLabel(infoText)
	
	status := container.NewVBox(
		g.statusLabel,
		widget.NewSeparator(),
		infoLabel,
	)
	
	return widget.NewCard("Status", "", status)
}

func (g *GUI) createLogCard() *widget.Card {
	g.logText = widget.NewMultiLineEntry()
	g.logText.SetText("SafeMatrix Agent started\n")
	g.logText.Disable()
	
	scroll := container.NewScroll(g.logText)
	scroll.SetMinSize(fyne.NewSize(0, 150))
	
	return widget.NewCard("Log", "", scroll)
}

func (g *GUI) onSaveConfig() {
	g.config.ServerHost = g.hostEntry.Text
	if port := g.portEntry.Text; port != "" {
		if p, err := fmt.Sscanf(port, "%d", &g.config.ServerPort); err != nil || p != 1 {
			g.appendLog("Error: Invalid port number")
			return
		}
	}
	
	if err := g.config.Save(); err != nil {
		g.appendLog(fmt.Sprintf("Error saving config: %v", err))
	} else {
		g.appendLog("Configuration saved successfully")
		g.statusLabel.SetText("Status: Configuration updated")
	}
}

func (g *GUI) onTestConnection() {
	g.statusLabel.SetText("Status: Testing connection...")
	g.testButton.Disable()
	
	go func() {
		client := api.NewClient(g.config.GetServerURL())
		err := client.TestConnection()
		
		// Update UI on main thread
		time.AfterFunc(100*time.Millisecond, func() {
			g.testButton.Enable()
			if err != nil {
				g.statusLabel.SetText("Status: Connection failed")
				g.appendLog(fmt.Sprintf("❌ Connection failed: %v", err))
			} else {
				g.statusLabel.SetText("Status: Connection successful")
				g.appendLog("✅ Connection test successful")
			}
		})
	}()
}

func (g *GUI) onRunScan() {
	g.statusLabel.SetText("Status: Running scan...")
	g.scanButton.Disable()
	
	go func() {
		// Collect inventory
		hostInfo, err := inventory.CollectInventory()
		if err != nil {
			time.AfterFunc(100*time.Millisecond, func() {
				g.scanButton.Enable()
				g.statusLabel.SetText("Status: Scan failed")
				g.appendLog(fmt.Sprintf("❌ Scan failed: %v", err))
			})
			return
		}
		
		// Send to server
		client := api.NewClient(g.config.GetServerURL())
		
		// Register host
		hostID, err := client.RegisterHost(hostInfo)
		if err != nil {
			time.AfterFunc(100*time.Millisecond, func() {
				g.scanButton.Enable()
				g.statusLabel.SetText("Status: Host registration failed")
				g.appendLog(fmt.Sprintf("❌ Host registration failed: %v", err))
			})
			return
		}
		
		// Submit inventory
		err = client.SubmitInventory(hostID, hostInfo)
		
		// Update UI on main thread
		time.AfterFunc(100*time.Millisecond, func() {
			g.scanButton.Enable()
			if err != nil {
				g.statusLabel.SetText("Status: Inventory submission failed")
				g.appendLog(fmt.Sprintf("❌ Inventory submission failed: %v", err))
			} else {
				g.statusLabel.SetText("Status: Scan completed successfully")
				g.appendLog(fmt.Sprintf("✅ Scan completed: %d software items found", len(hostInfo.Software)))
			}
		})
	}()
}

func (g *GUI) onToggleDaemon() {
	if g.isDaemonRunning {
		// Stop daemon
		g.daemonStop <- true
		g.isDaemonRunning = false
		g.daemonButton.SetText("Start Daemon")
		g.statusLabel.SetText("Status: Daemon stopped")
		g.appendLog("Daemon stopped")
	} else {
		// Start daemon
		g.isDaemonRunning = true
		g.daemonButton.SetText("Stop Daemon")
		g.statusLabel.SetText("Status: Daemon running")
		g.appendLog("Daemon started")
		
		go g.runDaemon()
	}
}

func (g *GUI) runDaemon() {
	client := api.NewClient(g.config.GetServerURL())
	var hostID string
	
	ticker := time.NewTicker(time.Duration(g.config.CollectInterval) * time.Minute)
	defer ticker.Stop()
	
	// Initial scan
	g.performDaemonScan(client, &hostID)
	
	for {
		select {
		case <-g.daemonStop:
			return
		case <-ticker.C:
			g.performDaemonScan(client, &hostID)
		}
	}
}

func (g *GUI) performDaemonScan(client *api.Client, hostID *string) {
	hostInfo, err := inventory.CollectInventory()
	if err != nil {
		g.appendLog(fmt.Sprintf("❌ Daemon scan failed: %v", err))
		return
	}
	
	// Register host if not done yet
	if *hostID == "" {
		id, err := client.RegisterHost(hostInfo)
		if err != nil {
			g.appendLog(fmt.Sprintf("❌ Host registration failed: %v", err))
			return
		}
		*hostID = id
		g.appendLog(fmt.Sprintf("✅ Host registered with ID: %s", *hostID))
	}
	
	// Submit inventory
	if err := client.SubmitInventory(*hostID, hostInfo); err != nil {
		g.appendLog(fmt.Sprintf("❌ Inventory submission failed: %v", err))
	} else {
		g.appendLog(fmt.Sprintf("✅ Daemon scan completed: %d items", len(hostInfo.Software)))
	}
}

func (g *GUI) appendLog(message string) {
	timestamp := time.Now().Format("15:04:05")
	newText := g.logText.Text + fmt.Sprintf("[%s] %s\n", timestamp, message)
	g.logText.SetText(newText)
	
	// Auto-scroll to bottom
	g.logText.CursorRow = len(g.logText.Text)
} 