package installer

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const (
	ServiceName        = "SafeMatrixAgent"
	ServiceDisplayName = "SafeMatrix Security Agent"
	ServiceDescription = "SafeMatrix Agent provides continuous security monitoring and vulnerability assessment"
)

// Installer handles the installation process
type Installer struct {
	installPath string
	servicePath string
}

// NewInstaller creates a new installer instance
func NewInstaller() *Installer {
	programFiles := os.Getenv("PROGRAMFILES")
	if programFiles == "" {
		programFiles = "C:\\Program Files"
	}

	installPath := filepath.Join(programFiles, "SafeMatrix", "Agent")
	servicePath := filepath.Join(installPath, "safematrix-agent.exe")

	return &Installer{
		installPath: installPath,
		servicePath: servicePath,
	}
}

// Install performs the complete installation
func (i *Installer) Install() error {
	// Step 1: Check admin privileges
	if !i.isAdmin() {
		return fmt.Errorf("installation requires administrator privileges")
	}

	// Step 2: Create installation directory
	if err := i.createInstallDirectory(); err != nil {
		return fmt.Errorf("failed to create installation directory: %v", err)
	}

	// Step 3: Copy files (copy current executable as service binary)
	if err := i.copyFiles(); err != nil {
		return fmt.Errorf("failed to copy files: %v", err)
	}

	// Step 4: Install Windows service
	if err := i.installService(); err != nil {
		return fmt.Errorf("failed to install service: %v", err)
	}

	// Step 5: Configure startup for tray (per-user and machine)
	if err := i.configureStartup(); err != nil {
		return fmt.Errorf("failed to configure startup: %v", err)
	}
	_ = i.createStartupShortcut() // best-effort

	// Step 6: Start the service
	if err := i.startService(); err != nil {
		return fmt.Errorf("failed to start service: %v", err)
	}

	// Step 7: Launch tray now (so user sees the icon immediately)
	_ = exec.Command(i.servicePath, "--tray").Start()

	return nil
}

// isAdmin checks if the process is running with administrator privileges
func (i *Installer) isAdmin() bool {
	// Try to open the service control manager with full access
	// This requires admin privileges
	m, err := mgr.Connect()
	if err != nil {
		return false
	}
	defer m.Disconnect()
	return true
}

// createInstallDirectory creates the installation directory
func (i *Installer) createInstallDirectory() error {
	return os.MkdirAll(i.installPath, 0755)
}

// copyFiles copies the agent executable to the installation directory
func (i *Installer) copyFiles() error {
	// Get current executable path
	exePath, err := os.Executable()
	if err != nil {
		return err
	}

	// Copy to installation directory
	input, err := os.ReadFile(exePath)
	if err != nil {
		return err
	}

	return os.WriteFile(i.servicePath, input, 0755)
}

// installService installs the Windows service
func (i *Installer) installService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	// Check if service already exists
	s, err := m.OpenService(ServiceName)
	if err == nil {
		// Service exists, stop and delete it first
		s.Control(svc.Stop)
		s.Delete()
		s.Close()
	}

	// Create new service
	s, err = m.CreateService(ServiceName, i.servicePath, mgr.Config{
		DisplayName:      ServiceDisplayName,
		Description:      ServiceDescription,
		StartType:        mgr.StartAutomatic,
		ServiceStartName: "LocalSystem",
		Dependencies:     []string{},
		BinaryPathName:   fmt.Sprintf(`"%s" --service`, i.servicePath),
	})
	if err != nil {
		return err
	}
	defer s.Close()

	return nil
}

// configureStartup adds registry entries for startup configuration
func (i *Installer) configureStartup() error {
	// Prefer HKCU (current user) so the tray runs for the logged-in user
	if err := setRunKey(registry.CURRENT_USER, "SafeMatrixAgent", fmt.Sprintf(`"%s" --tray`, i.servicePath)); err != nil {
		return err
	}
	// Best-effort HKLM for all users (optional)
	_ = setRunKey(registry.LOCAL_MACHINE, "SafeMatrixAgent", fmt.Sprintf(`"%s" --tray`, i.servicePath))
	return nil
}

func setRunKey(root registry.Key, name, value string) error {
	k, err := registry.OpenKey(root, `SOFTWARE\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue(name, value)
}

// startService starts the SafeMatrix Agent service
func (i *Installer) startService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()

	return s.Start()
}

// createDesktopShortcut creates a desktop shortcut
func (i *Installer) createDesktopShortcut() error {
	desktop := filepath.Join(os.Getenv("USERPROFILE"), "Desktop")
	shortcutPath := filepath.Join(desktop, "SafeMatrix Agent.lnk")

	script := fmt.Sprintf(`
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("%s")
$Shortcut.TargetPath = "%s"
$Shortcut.Arguments = "--gui"
$Shortcut.Description = "SafeMatrix Security Agent"
$Shortcut.Save()
`, shortcutPath, i.servicePath)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	return cmd.Run()
}

// createStartupShortcut creates a shortcut in the user's Startup folder
func (i *Installer) createStartupShortcut() error {
	startup := filepath.Join(os.Getenv("APPDATA"), `Microsoft\\Windows\\Start Menu\\Programs\\Startup`)
	shortcutPath := filepath.Join(startup, "SafeMatrix Agent.lnk")

	script := fmt.Sprintf(`
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("%s")
$Shortcut.TargetPath = "%s"
$Shortcut.Arguments = "--tray"
$Shortcut.Description = "SafeMatrix Agent Tray"
$Shortcut.Save()
`, shortcutPath, i.servicePath)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	return cmd.Run()
}

// Uninstall removes the SafeMatrix Agent
func (i *Installer) Uninstall() error {
	// Stop and delete service
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err == nil {
		s.Control(svc.Stop)
		s.Delete()
		s.Close()
	}

	// Remove startup registry entries
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE); err == nil {
		k.DeleteValue("SafeMatrixAgent")
		k.Close()
	}
	if k, err := registry.OpenKey(registry.CURRENT_USER, `SOFTWARE\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE); err == nil {
		k.DeleteValue("SafeMatrixAgent")
		k.Close()
	}

	// Remove startup shortcut
	startup := filepath.Join(os.Getenv("APPDATA"), `Microsoft\\Windows\\Start Menu\\Programs\\Startup`, "SafeMatrix Agent.lnk")
	_ = os.Remove(startup)

	// Remove installation directory
	return os.RemoveAll(i.installPath)
}

// IsInstalled checks if SafeMatrix Agent is installed
func (i *Installer) IsInstalled() bool {
	// Check if service exists
	m, err := mgr.Connect()
	if err != nil {
		return false
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err != nil {
		return false
	}
	s.Close()

	// Check if executable exists
	_, err = os.Stat(i.servicePath)
	return err == nil
}

// GetInstallPath returns the installation path
func (i *Installer) GetInstallPath() string {
	return i.installPath
}

// GetServicePath returns the service executable path
func (i *Installer) GetServicePath() string {
	return i.servicePath
}
