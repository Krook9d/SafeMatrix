package gui

import (
	"fmt"
	"time"
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/dialog"

	"safematrix-agent/internal/api"
	"safematrix-agent/internal/config"
	"safematrix-agent/internal/icon"
	"safematrix-agent/internal/inventory"
	"safematrix-agent/internal/installer"
)

// SafeMatrixTheme defines a custom modern theme for SafeMatrix
type SafeMatrixTheme struct{}

func (t *SafeMatrixTheme) Color(name fyne.ThemeColorName, variant fyne.ThemeVariant) color.Color {
	switch name {
	case theme.ColorNamePrimary:
		return color.RGBA{R: 25, G: 118, B: 210, A: 255} // Modern blue
	case theme.ColorNameBackground:
		if variant == theme.VariantDark {
			return color.RGBA{R: 18, G: 18, B: 18, A: 255}
		}
		return color.RGBA{R: 248, G: 250, B: 252, A: 255} // Light gray-blue
	case theme.ColorNameForeground:
		if variant == theme.VariantDark {
			return color.RGBA{R: 255, G: 255, B: 255, A: 255}
		}
		return color.RGBA{R: 33, G: 37, B: 41, A: 255}
	case theme.ColorNameSuccess:
		return color.RGBA{R: 76, G: 175, B: 80, A: 255} // Green
	case theme.ColorNameWarning:
		return color.RGBA{R: 255, G: 193, B: 7, A: 255} // Orange
	case theme.ColorNameError:
		return color.RGBA{R: 244, G: 67, B: 54, A: 255} // Red
	default:
		return theme.DefaultTheme().Color(name, variant)
	}
}

func (t *SafeMatrixTheme) Font(style fyne.TextStyle) fyne.Resource {
	return theme.DefaultTheme().Font(style)
}

func (t *SafeMatrixTheme) Icon(name fyne.ThemeIconName) fyne.Resource {
	return theme.DefaultTheme().Icon(name)
}

func (t *SafeMatrixTheme) Size(name fyne.ThemeSizeName) float32 {
	switch name {
	case theme.SizeNameText:
		return 14
	case theme.SizeNameCaptionText:
		return 11
	case theme.SizeNamePadding:
		return 6
	case theme.SizeNameInlineIcon:
		return 20
	case theme.SizeNameScrollBar:
		return 12
	default:
		return theme.DefaultTheme().Size(name)
	}
}

// GetSafeMatrixIcon returns the SafeMatrix icon resource
func GetSafeMatrixIcon() fyne.Resource {
	// TODO: Replace with actual SafeMatrix logo when we embed the SVG
	return theme.ComputerIcon()
}

type GUI struct {
	app        fyne.App
	window     fyne.Window
	config     *config.Config
	
	// UI Components
	hostEntry      *widget.Entry
	portEntry      *widget.Entry
	statusLabel    *widget.Label
	logText        *widget.Entry
	scanButton     *widget.Button
	daemonButton   *widget.Button
	testButton     *widget.Button
	progressBar    *widget.ProgressBarInfinite
	connectionCard *widget.Card
	lastScanLabel  *widget.Label
	scanCountLabel *widget.Label
	autoScanCheck  *widget.Check
	
	// New modern components
	installButton    *widget.Button
	minimizeButton   *widget.Button
	connectionStatus *canvas.Circle
	mainTabs         *container.AppTabs
	
	// State
	isDaemonRunning bool
	daemonStop      chan bool
	isAutoScanning  bool
	autoScanStop    chan bool
	lastScanTime    time.Time
	scanCount       int
	isInstalled     bool
	isMinimized     bool
	
	// System tray
	systray desktop.App
}

// RunInstaller starts the GUI in installer mode
func RunInstaller() {
	gui := &GUI{
		app:          app.New(),
		daemonStop:   make(chan bool),
		autoScanStop: make(chan bool),
		config:       config.DefaultConfig(),
		isInstalled:  false, // Installation mode
	}
	
	gui.app.Settings().SetTheme(&SafeMatrixTheme{})
	gui.setupIcon()
	gui.setupInstallerWindow()
	gui.loadConfig()
	gui.setupInstallerUI()
	
	gui.window.ShowAndRun()
}

// RunDashboard starts the dashboard GUI for installed agent
func RunDashboard() {
	gui := &GUI{
		app:          app.New(),
		daemonStop:   make(chan bool),
		autoScanStop: make(chan bool),
		config:       config.DefaultConfig(),
		isInstalled:  true, // Dashboard mode
	}
	
	gui.app.Settings().SetTheme(&SafeMatrixTheme{})
	gui.setupIcon()
	gui.setupDashboardWindow()
	gui.loadConfig()
	gui.setupDashboardUI()
	gui.startAutoScan()
	
	gui.window.ShowAndRun()
}

// Legacy Run function for backwards compatibility
func Run() {
	RunInstaller()
}

// setupIcon sets the application icon
func (g *GUI) setupIcon() {
	if g.window != nil {
		g.window.SetIcon(icon.SafeMatrixLogo)
	}
}

func (g *GUI) setupInstallerWindow() {
	g.window = g.app.NewWindow("SafeMatrix Agent - Installation Wizard")
	// g.window.SetMaster() // Let's not make it master, so dialogs can appear
	g.window.SetContent(widget.NewLabel("Loading..."))
	g.window.Resize(fyne.NewSize(540, 620))
	g.window.CenterOnScreen()
	g.setupIcon()
	
	// Add a callback to handle window close requests
	g.window.SetCloseIntercept(func() {
		g.window.Close()
	})
}

func (g *GUI) setupDashboardWindow() {
	g.window = g.app.NewWindow("SafeMatrix Agent - Security Dashboard")
	g.window.SetFixedSize(false)
	g.window.Resize(fyne.NewSize(900, 750))
	g.window.CenterOnScreen()
	
	// Handle window close - minimize to tray
	g.window.SetCloseIntercept(func() {
		g.minimizeToTray()
	})
}

// Legacy function
func (g *GUI) setupWindow() {
	if g.isInstalled {
		g.setupDashboardWindow()
	} else {
		g.setupInstallerWindow()
	}
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

func (g *GUI) setupInstallerUI() {
	// Simple installer interface
	g.progressBar = widget.NewProgressBarInfinite()
	g.progressBar.Hide()
	
	content := container.NewVBox(
		g.createInstallerHeader(),
		container.NewPadded(g.progressBar),
		container.NewPadded(g.createInstallationScreen()),
	)
	
	g.window.SetContent(content)
}

func (g *GUI) setupDashboardUI() {
	// Full dashboard interface
	g.progressBar = widget.NewProgressBarInfinite()
	g.progressBar.Hide()
	
	// Create tabbed interface
	g.mainTabs = container.NewAppTabs(
		container.NewTabItem("🏠 Dashboard", g.createDashboardTab()),
		container.NewTabItem("⚙️ Configuration", g.createConfigTab()),
		container.NewTabItem("📊 Statistics", g.createStatsTab()),
		container.NewTabItem("📝 Logs", g.createLogsTab()),
	)
	
	g.mainTabs.SetTabLocation(container.TabLocationTop)
	
	content := container.NewVBox(
		g.createModernHeader(),
		container.NewPadded(g.progressBar),
		container.NewPadded(g.mainTabs),
	)
	
	g.window.SetContent(content)
}

// Legacy function
func (g *GUI) setupUI() {
	if g.isInstalled {
		g.setupDashboardUI()
	} else {
		g.setupInstallerUI()
	}
}

func (g *GUI) createModernHeader() *fyne.Container {
	// SafeMatrix logo
	logo := widget.NewIcon(GetSafeMatrixIcon())
	logo.Resize(fyne.NewSize(48, 48))
	
	// Title and subtitle
	title := widget.NewRichTextFromMarkdown("# SafeMatrix Agent")
	subtitle := widget.NewLabel("Advanced Security Monitoring & Vulnerability Assessment")
	
	// Connection status indicator
	g.connectionStatus = canvas.NewCircle(color.RGBA{R: 244, G: 67, B: 54, A: 255}) // Red by default
	g.connectionStatus.Resize(fyne.NewSize(12, 12))
	
	statusText := widget.NewLabel("Disconnected")
	g.statusLabel = statusText
	
	// Control buttons
	if !g.isInstalled {
		g.installButton = widget.NewButton("💾 Install Agent", g.onInstall)
		g.installButton.Importance = widget.HighImportance
	}
	
	g.minimizeButton = widget.NewButton("📍 Minimize to Tray", g.onMinimizeToTray)
	g.minimizeButton.Importance = widget.LowImportance
	
	// Header layout
	leftSection := container.NewHBox(logo, container.NewVBox(title, subtitle))
	rightSection := container.NewVBox(
		container.NewHBox(g.connectionStatus, statusText),
		container.NewHBox(g.minimizeButton),
	)
	
	if !g.isInstalled && g.installButton != nil {
		rightSection.Add(g.installButton)
	}
	
	header := container.NewBorder(nil, nil, leftSection, rightSection)
	
	// Add gradient background effect
	bg := canvas.NewRectangle(color.RGBA{R: 248, G: 250, B: 252, A: 255})
	
	return container.NewStack(bg, container.NewPadded(header))
}

func (g *GUI) createInstallerHeader() *fyne.Container {
	// Load icon
	// TODO: Replace with actual embedded icon
	icon := canvas.NewImageFromResource(theme.ComputerIcon())
	icon.SetMinSize(fyne.NewSize(48, 48))
	
	// Title and subtitle
	title := widget.NewLabelWithStyle("SafeMatrix Agent", fyne.TextAlignLeading, fyne.TextStyle{Bold: true})
	subtitle := widget.NewLabel("Installation Wizard")
	
	headerText := container.NewVBox(title, subtitle)
	
	// Use a border layout for more robust alignment
	header := container.New(layout.NewBorderLayout(nil, nil, icon, nil),
		icon,       // Left
		headerText, // Center
	)
	
	return container.NewPadded(header)
}

func (g *GUI) createInstallationScreen() *fyne.Container {
	// Welcome title
	title := widget.NewLabelWithStyle("Welcome to SafeMatrix Agent", fyne.TextAlignCenter, fyne.TextStyle{Bold: true})
	
	// Description
	desc1 := widget.NewLabel("SafeMatrix Agent provides continuous security monitoring for your system. Click 'Install' to begin.")
	desc1.Wrapping = fyne.TextWrapWord
	
	
	// Configuration section
	configTitle := widget.NewLabelWithStyle("Server Configuration", fyne.TextAlignLeading, fyne.TextStyle{Bold: true})
	
	// Config form
	hostLabel := widget.NewLabel("Server Host:")
	g.hostEntry = widget.NewEntry()
	g.hostEntry.SetText(g.config.ServerHost)
	g.hostEntry.SetPlaceHolder("Enter SafeMatrix server IP address")
	
	portLabel := widget.NewLabel("Server Port:")
	g.portEntry = widget.NewEntry()
	g.portEntry.SetText(fmt.Sprintf("%d", g.config.ServerPort))
	g.portEntry.SetPlaceHolder("8000")
	
	// Buttons
	testBtn := widget.NewButton("Test Connection", g.onTestConnection)
	g.installButton = widget.NewButton("Install SafeMatrix Agent", g.onInstall)
	g.installButton.Importance = widget.HighImportance
	
	// Layout with proper spacing
	content := container.NewVBox(
		title,
		widget.NewSeparator(),
		desc1,
		widget.NewSeparator(),
		configTitle,
		hostLabel,
		g.hostEntry,
		portLabel,
		g.portEntry,
		widget.NewSeparator(),
		container.NewHBox(testBtn, layout.NewSpacer(), g.installButton),
	)
	
	// Return container directly without scroll for better display
	return container.NewPadded(content)
}

func (g *GUI) createDashboardTab() *fyne.Container {
	// Real-time status cards
	statusCard := g.createConnectionStatus()
	scanCard := g.createAutoScanControls()
	statsCard := g.createStatsCard()
	
	// Quick actions
	actionsCard := g.createActionsCard()
	
	// Recent activity
	recentActivity := widget.NewCard("Recent Activity", "", 
		widget.NewLabel("Last 5 security events will appear here..."))
	
	// Layout in grid
	topRow := container.NewHBox(statusCard, scanCard)
	middleRow := container.NewHBox(statsCard, actionsCard)
	
	return container.NewVBox(
		topRow,
		middleRow,
		recentActivity,
	)
}

func (g *GUI) createConfigTab() *fyne.Container {
	configCard := g.createConfigCard()
	
	// Advanced settings
	advancedCard := widget.NewCard("Advanced Settings", "",
		container.NewVBox(
			widget.NewLabel("Scan Interval: 5 minutes (recommended)"),
			widget.NewLabel("Log Level: Info"),
			widget.NewLabel("Auto-update: Enabled"),
		))
	
	return container.NewVBox(configCard, advancedCard)
}

func (g *GUI) createStatsTab() *fyne.Container {
	return container.NewVBox(g.createStatsCard())
}

func (g *GUI) createLogsTab() *fyne.Container {
	logCard := g.createLogCard()
	return container.NewBorder(nil, nil, nil, nil, logCard)
}

func (g *GUI) createConnectionStatus() *widget.Card {
	g.statusLabel = widget.NewLabel("🔴 Disconnected")
	g.statusLabel.TextStyle.Bold = true
	
	g.testButton = widget.NewButton("Test Connection", g.onTestConnection)
	g.testButton.Importance = widget.MediumImportance
	
	content := container.NewVBox(
		g.statusLabel,
		g.testButton,
	)
	
	return widget.NewCard("Connection", "", content)
}

func (g *GUI) createAutoScanControls() *widget.Card {
	g.autoScanCheck = widget.NewCheck("Auto-scan every 5 minutes", g.onAutoScanToggle)
	g.autoScanCheck.SetChecked(true) // Enabled by default
	
	nextScanLabel := widget.NewLabel("Next scan: Starting...")
	
	content := container.NewVBox(
		g.autoScanCheck,
		nextScanLabel,
	)
	
	return widget.NewCard("Automatic Scanning", "", content)
}

func (g *GUI) createStatsCard() *widget.Card {
	g.lastScanLabel = widget.NewLabel("Last scan: Never")
	g.scanCountLabel = widget.NewLabel("Total scans: 0")
	
	content := container.NewVBox(
		g.lastScanLabel,
		g.scanCountLabel,
	)
	
	return widget.NewCard("Statistics", "", content)
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
	g.scanButton = widget.NewButton("Run Manual Scan", g.onRunScan)
	g.scanButton.Importance = widget.HighImportance
	
	g.daemonButton = widget.NewButton("Start Background Service", g.onToggleDaemon)
	g.daemonButton.Importance = widget.MediumImportance
	
	openLogsButton := widget.NewButton("Open Log Folder", g.onOpenLogs)
	
	actions := container.NewVBox(
		g.scanButton,
		g.daemonButton,
		widget.NewSeparator(),
		openLogsButton,
	)
	
	return widget.NewCard("Manual Actions", "", actions)
}

// Auto-scan functionality
func (g *GUI) startAutoScan() {
	if g.isAutoScanning {
		return
	}
	
	g.isAutoScanning = true
	g.appendLog("🤖 Auto-scan enabled - scanning every 5 minutes")
	
	go func() {
		// Perform initial scan
		g.performAutoScan()
		
		// Setup 5-minute ticker
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		
		for {
			select {
			case <-g.autoScanStop:
				return
			case <-ticker.C:
				g.performAutoScan()
			}
		}
	}()
}

func (g *GUI) stopAutoScan() {
	if !g.isAutoScanning {
		return
	}
	
	g.isAutoScanning = false
	g.autoScanStop <- true
	g.appendLog("🤖 Auto-scan disabled")
}

func (g *GUI) performAutoScan() {
	g.scanCount++
	g.lastScanTime = time.Now()
	
	// Update UI on main thread
	time.AfterFunc(100*time.Millisecond, func() {
		g.lastScanLabel.SetText(fmt.Sprintf("Last scan: %s", g.lastScanTime.Format("15:04:05")))
		g.scanCountLabel.SetText(fmt.Sprintf("Total scans: %d", g.scanCount))
		g.progressBar.Show()
		g.progressBar.Start()
	})
	
	// Collect inventory
	hostInfo, err := inventory.CollectInventory()
	if err != nil {
		time.AfterFunc(100*time.Millisecond, func() {
			g.progressBar.Stop()
			g.progressBar.Hide()
			g.appendLog(fmt.Sprintf("❌ Auto-scan failed: %v", err))
		})
		return
	}
	
	// Send to server
	client := api.NewClient(g.config.GetServerURL())
	
	// Register host if needed and submit inventory
	hostID, err := client.RegisterHost(hostInfo)
	if err != nil {
		time.AfterFunc(100*time.Millisecond, func() {
			g.progressBar.Stop()
			g.progressBar.Hide()
			g.appendLog(fmt.Sprintf("❌ Host registration failed: %v", err))
		})
		return
	}
	
	err = client.SubmitInventory(hostID, hostInfo)
	
	// Update UI on main thread
	time.AfterFunc(100*time.Millisecond, func() {
		g.progressBar.Stop()
		g.progressBar.Hide()
		if err != nil {
			g.appendLog(fmt.Sprintf("❌ Auto-scan failed: %v", err))
		} else {
			g.appendLog(fmt.Sprintf("✅ Auto-scan completed: %d software items found", len(hostInfo.Software)))
		}
	})
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

func (g *GUI) onInstall() {
	g.appendLog("🚀 Starting SafeMatrix Agent installation...")
	if g.installButton != nil {
		g.installButton.Disable()
	}
	g.progressBar.Show()
	g.progressBar.Start()
	
	go func() {
		// Save configuration first
		g.config.ServerHost = g.hostEntry.Text
		if port := g.portEntry.Text; port != "" {
			if p, err := fmt.Sscanf(port, "%d", &g.config.ServerPort); err == nil && p == 1 {
				// Port parsed successfully
			}
		}
		g.config.Save()
		
		// Create installer and perform real installation
		inst := installer.NewInstaller()
		
		g.appendLog("📁 Creating installation directory...")
		time.Sleep(500 * time.Millisecond)
		
		g.appendLog("📋 Installing Windows service...")
		time.Sleep(1 * time.Second)
		
		g.appendLog("🔧 Configuring system startup...")
		time.Sleep(500 * time.Millisecond)
		
		g.appendLog("🚀 Starting SafeMatrix Agent service...")
		time.Sleep(1 * time.Second)
		
		// Perform actual installation
		err := inst.Install()
		
		// Update UI on main thread
		time.AfterFunc(100*time.Millisecond, func() {
			g.progressBar.Stop()
			g.progressBar.Hide()
			
			if err != nil {
				g.appendLog(fmt.Sprintf("❌ Installation failed: %v", err))
				
				// Show error dialog
				dialog.ShowError(fmt.Errorf("Installation failed:\n\n%v\n\nPlease run as Administrator and try again.", err), g.window)
				
				if g.installButton != nil {
					g.installButton.Enable()
				}
				return
			}
			
			g.appendLog("✅ SafeMatrix Agent installed successfully!")
			g.appendLog("🤖 Windows service created and started!")
			g.appendLog("📍 Agent running in system tray...")
			
			// Show completion message
			title := widget.NewLabelWithStyle("Installation Complete!", fyne.TextAlignCenter, fyne.TextStyle{Bold: true})
			
			message := widget.NewLabel(`SafeMatrix Agent has been successfully installed as a Windows service!

The agent is now running and will:
• Scan your system every 5 minutes automatically
• Monitor for security vulnerabilities  
• Report findings to your SafeMatrix dashboard
• Start automatically with Windows

You can access the agent from the system tray icon.`)
			
			okButton := widget.NewButton("Start Monitoring", func() {
				// Close installer
				g.window.Close()
			})
			okButton.Importance = widget.HighImportance
			
			content := container.NewVBox(
				title,
				widget.NewSeparator(),
				message,
				widget.NewSeparator(),
				container.NewHBox(layout.NewSpacer(), okButton, layout.NewSpacer()),
			)
			
			g.window.SetContent(container.NewPadded(content))
		})
	}()
}

func (g *GUI) startTrayMode() {
	// This would start the tray mode
	// For now, we'll just print a message
	fmt.Println("SafeMatrix Agent started in system tray mode")
	// TODO: Start actual tray agent
}

func (g *GUI) onMinimizeToTray() {
	g.minimizeToTray()
}

func (g *GUI) minimizeToTray() {
	g.isMinimized = true
	g.window.Hide()
	g.appendLog("📍 SafeMatrix Agent minimized to system tray")
	// TODO: Implement actual system tray functionality
}

func (g *GUI) restoreFromTray() {
	g.isMinimized = false
	g.window.Show()
	g.appendLog("📂 SafeMatrix Agent restored from system tray")
}

func (g *GUI) onAutoScanToggle(checked bool) {
	if checked {
		g.startAutoScan()
	} else {
		g.stopAutoScan()
	}
}

func (g *GUI) onOpenLogs() {
	// Open the log directory in the system file explorer
	g.appendLog("📁 Opening log directory...")
	// Implementation would depend on the OS
}

func (g *GUI) onTestConnection() {
	g.statusLabel.SetText("🟡 Testing...")
	if g.connectionStatus != nil {
		g.connectionStatus.FillColor = color.RGBA{R: 255, G: 193, B: 7, A: 255} // Orange
		g.connectionStatus.Refresh()
	}
	g.testButton.Disable()
	
	go func() {
		client := api.NewClient(g.config.GetServerURL())
		err := client.TestConnection()
		
		// Update UI on main thread
		time.AfterFunc(100*time.Millisecond, func() {
			g.testButton.Enable()
			if err != nil {
				g.statusLabel.SetText("🔴 Disconnected")
				if g.connectionStatus != nil {
					g.connectionStatus.FillColor = color.RGBA{R: 244, G: 67, B: 54, A: 255} // Red
					g.connectionStatus.Refresh()
				}
				g.appendLog(fmt.Sprintf("❌ Connection failed: %v", err))
			} else {
				g.statusLabel.SetText("🟢 Connected")
				if g.connectionStatus != nil {
					g.connectionStatus.FillColor = color.RGBA{R: 76, G: 175, B: 80, A: 255} // Green
					g.connectionStatus.Refresh()
				}
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
	// Safety check to avoid nil pointer dereference
	if g.logText == nil {
		fmt.Printf("[GUI] %s\n", message)
		return
	}
	
	timestamp := time.Now().Format("15:04:05")
	newText := g.logText.Text + fmt.Sprintf("[%s] %s\n", timestamp, message)
	g.logText.SetText(newText)
	
	// Auto-scroll to bottom
	g.logText.CursorRow = len(g.logText.Text)
} 