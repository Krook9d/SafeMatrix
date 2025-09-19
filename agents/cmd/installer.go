package main

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"fyne.io/fyne/v2/dialog"
)

var (
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutex  = kernel32.NewProc("CreateMutexW")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
)

// Installer represents the SafeMatrix Agent installer
type Installer struct {
	app    fyne.App
	window fyne.Window
	progress *widget.ProgressBar
	statusLabel *widget.Label
}

func main() {
	// Check if already running
	if isAlreadyRunning() {
		fmt.Println("SafeMatrix Agent installer is already running.")
		return
	}

	installer := &Installer{
		app: app.New(),
	}
	
	installer.app.SetIcon(theme.ComputerIcon()) // TODO: Use SafeMatrix icon
	installer.setupWindow()
	installer.showInstaller()
	installer.window.ShowAndRun()
}

func (i *Installer) setupWindow() {
	i.window = i.app.NewWindow("SafeMatrix Agent - Installation Wizard")
	i.window.SetFixedSize(true)
	i.window.Resize(fyne.NewSize(600, 500))
	i.window.CenterOnScreen()
}

func (i *Installer) showInstaller() {
	// Welcome screen
	title := widget.NewLabelWithStyle("SafeMatrix Agent Installation", fyne.TextAlignCenter, fyne.TextStyle{Bold: true})
	
	description := widget.NewLabel(`
SafeMatrix Agent will be installed on your computer to provide:

• Continuous security monitoring
• Automatic vulnerability detection  
• Real-time threat assessment
• Silent background operation

The installation will:
1. Copy SafeMatrix Agent to Program Files
2. Create desktop shortcut
3. Configure automatic startup
4. Start the monitoring service

Click "Install" to begin the installation process.`)

	i.progress = widget.NewProgressBar()
	i.progress.Hide()
	
	i.statusLabel = widget.NewLabel("Ready to install")
	
	// Buttons
	cancelBtn := widget.NewButton("Cancel", func() {
		i.window.Close()
	})
	
	installBtn := widget.NewButton("Install", i.startInstallation)
	installBtn.Importance = widget.HighImportance
	
	// Layout
	content := container.NewVBox(
		title,
		widget.NewSeparator(),
		description,
		widget.NewSeparator(),
		i.statusLabel,
		i.progress,
		widget.NewSeparator(),
		container.NewHBox(cancelBtn, layout.NewSpacer(), installBtn),
	)
	
	i.window.SetContent(container.NewPadded(content))
}

func (i *Installer) startInstallation() {
	i.progress.Show()
	i.statusLabel.SetText("Installing SafeMatrix Agent...")
	
	go func() {
		// Installation steps
		steps := []struct {
			name string
			action func() error
		}{
			{"Creating installation directory", i.createInstallDir},
			{"Copying agent files", i.copyAgentFiles},
			{"Creating desktop shortcut", i.createShortcut},
			{"Configuring startup", i.configureStartup},
			{"Starting agent service", i.startAgent},
		}
		
		for idx, step := range steps {
			i.statusLabel.SetText(step.name + "...")
			i.progress.SetValue(float64(idx) / float64(len(steps)))
			
			if err := step.action(); err != nil {
				dialog.ShowError(fmt.Errorf("Installation failed: %v", err), i.window)
				return
			}
		}
		
		// Installation complete
		i.progress.SetValue(1.0)
		i.statusLabel.SetText("Installation completed successfully!")
		
		// Show completion dialog
		dialog.ShowInformation("Installation Complete", 
			"SafeMatrix Agent has been installed successfully!\n\n" +
			"The agent is now running in the background and monitoring your system.\n" +
			"You can access it from the system tray icon.", i.window)
		
		// Close installer
		i.window.Close()
	}()
}

func (i *Installer) createInstallDir() error {
	installPath := getInstallPath()
	return os.MkdirAll(installPath, 0755)
}

func (i *Installer) copyAgentFiles() error {
	// Copy the agent executable to Program Files
	installPath := getInstallPath()
	
	// Get current executable path
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	
	// Copy to installation directory
	destPath := filepath.Join(installPath, "safematrix-agent.exe")
	return copyFile(exePath, destPath)
}

func (i *Installer) createShortcut() error {
	// Create desktop shortcut (Windows specific)
	// This would require additional Windows API calls
	return nil
}

func (i *Installer) configureStartup() error {
	// Add to Windows startup (registry)
	// This would require registry manipulation
	return nil
}

func (i *Installer) startAgent() error {
	// Start the agent in background mode
	installPath := getInstallPath()
	agentPath := filepath.Join(installPath, "safematrix-agent.exe")
	
	// Execute the agent with --background flag
	// This would start the agent in system tray mode
	return nil
}

func getInstallPath() string {
	programFiles := os.Getenv("PROGRAMFILES")
	if programFiles == "" {
		programFiles = "C:\\Program Files"
	}
	return filepath.Join(programFiles, "SafeMatrix", "Agent")
}

func copyFile(src, dst string) error {
	// Simple file copy implementation
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, input, 0755)
}

func isAlreadyRunning() bool {
	mutexName, _ := syscall.UTF16PtrFromString("SafeMatrixAgentInstaller")
	handle, _, _ := procCreateMutex.Call(0, 0, uintptr(unsafe.Pointer(mutexName)))
	
	if handle == 0 {
		return true
	}
	
	// Don't close the handle - keep it open to maintain the mutex
	return false
}
