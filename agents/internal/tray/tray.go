package tray

import (
	"fmt"
	"time"

	"github.com/getlantern/systray"
	"safematrix-agent/internal/api"
	"safematrix-agent/internal/config"
	"safematrix-agent/internal/icon"
	"safematrix-agent/internal/inventory"
)

// TrayAgent represents the system tray agent
type TrayAgent struct {
	config          *config.Config
	isScanning      bool
	lastScanTime    time.Time
	scanCount       int
	onShowGUI       func()
	scanStop        chan bool
	
	// Menu items
	statusItem      *systray.MenuItem
	lastScanItem    *systray.MenuItem
	scanCountItem   *systray.MenuItem
	showGUIItem     *systray.MenuItem
	scanNowItem     *systray.MenuItem
	exitItem        *systray.MenuItem
}

// NewTrayAgent creates a new system tray agent
func NewTrayAgent(cfg *config.Config, onShowGUI func()) *TrayAgent {
	return &TrayAgent{
		config:    cfg,
		onShowGUI: onShowGUI,
		scanStop:  make(chan bool),
	}
}

// Start initializes and starts the system tray (blocking)
func (t *TrayAgent) Start() {
	systray.Run(t.onReady, t.onExit)
}

// Stop stops the system tray
func (t *TrayAgent) Stop() {
	if t.scanStop != nil {
		select {
		case t.scanStop <- true:
		default:
		}
	}
	systray.Quit()
}

func (t *TrayAgent) onReady() {
	// Set icon and tooltip
	systray.SetIcon(icon.SafeMatrixLogo.StaticContent)
	systray.SetTitle("SafeMatrix Agent")
	systray.SetTooltip("SafeMatrix Agent - Continuous Security Monitoring")

	// Create menu items
	t.statusItem = systray.AddMenuItem("Status: Idle", "Current connection status")
	t.lastScanItem = systray.AddMenuItem("Last scan: never", "Last scan time")
	t.scanCountItem = systray.AddMenuItem("Scans: 0", "Total number of scans")
	systray.AddSeparator()

	t.showGUIItem = systray.AddMenuItem("Open Dashboard", "Show monitoring dashboard")
	t.scanNowItem = systray.AddMenuItem("Scan Now", "Trigger immediate scan")
	systray.AddSeparator()

	t.exitItem = systray.AddMenuItem("Exit", "Close the agent")
	
	// Start background goroutines
	go t.handleMenuClicks()
}

func (t *TrayAgent) onExit() {
	// Cleanup if needed
}

func (t *TrayAgent) handleMenuClicks() {
	for {
		select {
		case <-t.showGUIItem.ClickedCh:
			if t.onShowGUI != nil {
				t.onShowGUI()
			}
		case <-t.scanNowItem.ClickedCh:
			if !t.isScanning {
				go t.performScan()
			}
		case <-t.exitItem.ClickedCh:
			systray.Quit()
			return
		case <-t.scanStop:
			return
		}
	}
}

func (t *TrayAgent) performScan() {
	if t.isScanning {
		return
	}
	t.isScanning = true
	t.updateMenu()

	defer func() {
		t.isScanning = false
		t.updateMenu()
	}()

	// Collect inventory
	hostInfo, err := inventory.CollectInventory()
	if err != nil {
		fmt.Println("Inventory collection failed:", err)
		return
	}

	// Send to server
	client := api.NewClient(t.config.GetServerURL())

	// Register host
	hostID, err := client.RegisterHost(hostInfo)
	if err != nil {
		fmt.Println("Host registration failed:", err)
		return
	}

	// Submit inventory
	_ = client.SubmitInventory(hostID, hostInfo)

	t.lastScanTime = time.Now()
	t.scanCount++
	t.updateMenu()
}

func (t *TrayAgent) updateMenu() {
	if t.statusItem == nil {
		return
	}
	if t.isScanning {
		t.statusItem.SetTitle("Status: Scanning...")
	} else {
		t.statusItem.SetTitle("Status: Idle")
	}
	if !t.lastScanTime.IsZero() {
		t.lastScanItem.SetTitle("Last scan: " + t.lastScanTime.Format("15:04"))
	}
	t.scanCountItem.SetTitle(fmt.Sprintf("Scans: %d", t.scanCount))
}

// UpdateStatus updates the tray status
func (t *TrayAgent) UpdateStatus(status string) {
	if t.statusItem != nil {
		t.statusItem.SetTitle(status)
	}
}
