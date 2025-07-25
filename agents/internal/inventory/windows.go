//go:build windows

package inventory

import (
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
	"golang.org/x/sys/windows/registry"
)

type Software struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Vendor      string `json:"vendor"`
	InstallDate string `json:"install_date"`
}

type HostInfo struct {
	Hostname    string     `json:"hostname"`
	OS          string     `json:"os"`
	OSVersion   string     `json:"os_version"`
	Architecture string    `json:"architecture"`
	IP          string     `json:"ip"`
	MACAddress  string     `json:"mac_address"`
	LastSeen    time.Time  `json:"last_seen"`
	Software    []Software `json:"software"`
}

// CollectInventory collects software inventory from Windows system
func CollectInventory() (*HostInfo, error) {
	hostInfo := &HostInfo{
		LastSeen: time.Now(),
		Software: []Software{},
	}

	// Get system information using WMI
	if err := getSystemInfo(hostInfo); err != nil {
		return nil, fmt.Errorf("failed to get system info: %v", err)
	}

	// Get MAC address
	macAddress, err := getMACAddress()
	if err != nil {
		// Don't fail the entire operation, just log and continue
		fmt.Printf("Warning: Could not get MAC address: %v\n", err)
	} else {
		hostInfo.MACAddress = macAddress
	}

	// Get installed software from Registry (much faster and more complete)
	if err := getInstalledSoftwareFromRegistry(hostInfo); err != nil {
		return nil, fmt.Errorf("failed to get installed software: %v", err)
	}

	return hostInfo, nil
}

// getSystemInfo retrieves basic system information using WMI
func getSystemInfo(hostInfo *HostInfo) error {
	// Initialize COM
	ole.CoInitialize(0)
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return err
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return err
	}
	defer wmi.Release()

	// Connect to WMI
	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer")
	if err != nil {
		return err
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	// Query Win32_ComputerSystem for hostname and architecture
	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT Name, SystemType FROM Win32_ComputerSystem")
	if err != nil {
		return err
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil {
		return err
	}
	count := int(countVar.Val)

	if count > 0 {
		itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
		if err != nil {
			return err
		}
		item := itemRaw.ToIDispatch()
		defer item.Release()

		name, _ := oleutil.GetProperty(item, "Name")
		hostInfo.Hostname = name.ToString()

		systemType, _ := oleutil.GetProperty(item, "SystemType")
		hostInfo.Architecture = systemType.ToString()
	}

	// Query Win32_OperatingSystem for OS info
	osResultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT Caption, Version FROM Win32_OperatingSystem")
	if err != nil {
		return err
	}
	osResult := osResultRaw.ToIDispatch()
	defer osResult.Release()

	osCountVar, err := oleutil.GetProperty(osResult, "Count")
	if err != nil {
		return err
	}
	osCount := int(osCountVar.Val)

	if osCount > 0 {
		osItemRaw, err := oleutil.CallMethod(osResult, "ItemIndex", 0)
		if err != nil {
			return err
		}
		osItem := osItemRaw.ToIDispatch()
		defer osItem.Release()

		caption, _ := oleutil.GetProperty(osItem, "Caption")
		hostInfo.OS = caption.ToString()

		version, _ := oleutil.GetProperty(osItem, "Version")
		hostInfo.OSVersion = version.ToString()
	}

	return nil
}

// getInstalledSoftwareFromRegistry retrieves installed software from Windows Registry
// This method is faster and more complete than Win32_Product
func getInstalledSoftwareFromRegistry(hostInfo *HostInfo) error {
	// Registry paths where installed software is listed
	registryPaths := []struct {
		root registry.Key
		path string
	}{
		// 64-bit software on 64-bit systems or 32-bit software on 32-bit systems
		{registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`},
		// 32-bit software on 64-bit systems (WOW6432Node)
		{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`},
		// Current user installations
		{registry.CURRENT_USER, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`},
	}

	softwareMap := make(map[string]Software) // Use map to avoid duplicates

	for _, regPath := range registryPaths {
		err := scanRegistryPath(regPath.root, regPath.path, softwareMap)
		if err != nil {
			// Continue with other paths even if one fails
			continue
		}
	}

	// Convert map to slice
	for _, software := range softwareMap {
		hostInfo.Software = append(hostInfo.Software, software)
	}

	return nil
}

// scanRegistryPath scans a specific registry path for installed software
func scanRegistryPath(root registry.Key, path string, softwareMap map[string]Software) error {
	key, err := registry.OpenKey(root, path, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return err
	}
	defer key.Close()

	subkeys, err := key.ReadSubKeyNames(-1)
	if err != nil {
		return err
	}

	for _, subkey := range subkeys {
		software, err := readSoftwareInfo(root, path+"\\"+subkey)
		if err != nil {
			continue // Skip entries that can't be read
		}

		// Only include software with a display name and that's not a system component
		if software.Name != "" && !isSystemComponent(software) {
			// Use name as key to avoid duplicates
			softwareMap[software.Name] = software
		}
	}

	return nil
}

// readSoftwareInfo reads software information from a registry entry
func readSoftwareInfo(root registry.Key, keyPath string) (Software, error) {
	software := Software{}

	key, err := registry.OpenKey(root, keyPath, registry.QUERY_VALUE)
	if err != nil {
		return software, err
	}
	defer key.Close()

	// Display Name
	if displayName, _, err := key.GetStringValue("DisplayName"); err == nil {
		software.Name = strings.TrimSpace(displayName)
	}

	// Version
	if version, _, err := key.GetStringValue("DisplayVersion"); err == nil {
		software.Version = strings.TrimSpace(version)
	}

	// Publisher/Vendor
	if publisher, _, err := key.GetStringValue("Publisher"); err == nil {
		software.Vendor = strings.TrimSpace(publisher)
	}

	// Install Date
	if installDate, _, err := key.GetStringValue("InstallDate"); err == nil {
		software.InstallDate = strings.TrimSpace(installDate)
	}

	return software, nil
}

// isSystemComponent checks if the software should be excluded (system updates, etc.)
func isSystemComponent(software Software) bool {
	name := strings.ToLower(software.Name)
	vendor := strings.ToLower(software.Vendor)

	// Skip Windows system updates and components
	excludePatterns := []string{
		"update for microsoft",
		"hotfix for microsoft",
		"security update for microsoft",
		"microsoft visual c++ 2",
		"microsoft .net framework",
		"microsoft edge update",
		"microsoft edge webview2",
		"windows software development kit",
		"microsoft windows performance toolkit",
	}

	for _, pattern := range excludePatterns {
		if strings.Contains(name, pattern) {
			return true
		}
	}

	// Skip Microsoft system components
	if vendor == "microsoft corporation" {
		microsoftSystemApps := []string{
			"microsoft edge",
			"windows",
			"microsoft visual c++",
			".net framework",
			"visual studio",
		}

		for _, app := range microsoftSystemApps {
			if strings.Contains(name, app) {
				return true
			}
		}
	}

	return false
}

// getMACAddress gets the MAC address of the first active network interface
func getMACAddress() (string, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}

	for _, iface := range interfaces {
		// Skip loopback and interfaces that are down
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		// Skip interfaces without hardware address
		if len(iface.HardwareAddr) == 0 {
			continue
		}

		return iface.HardwareAddr.String(), nil
	}

	return "", fmt.Errorf("no suitable network interface found")
} 