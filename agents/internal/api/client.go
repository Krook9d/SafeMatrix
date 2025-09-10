package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"safematrix-agent/internal/inventory"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type HostOS struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type HostCreateRequest struct {
	Hostname   string `json:"hostname"`
	IPAddress  string `json:"ip_address"`
	MACAddress string `json:"mac_address,omitempty"`
	OS         HostOS `json:"os"`
}

type InventoryCreateRequest struct {
	HostID       string `json:"host_id"`
	SoftwareName string `json:"software_name"`
	Version      string `json:"version"`
}

type APIResponse struct {
	ID      string `json:"id"`
	Message string `json:"message,omitempty"`
}

type SoftwareItem struct {
	SoftwareName string `json:"software_name"`
	Version      string `json:"version"`
	Vendor       string `json:"vendor"`
	InstallDate  string `json:"install_date"`
}

type InventorySyncRequest struct {
	HostID       string         `json:"host_id"`
	SoftwareList []SoftwareItem `json:"software_list"`
}

// NewClient creates a new API client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

// RegisterHost registers a new host with the SafeMatrix backend
func (c *Client) RegisterHost(hostInfo *inventory.HostInfo) (string, error) {
	// Use a default IP if not provided
	ipAddress := hostInfo.IP
	if ipAddress == "" {
		ipAddress = "192.168.1.100" // Default for testing
	}

	request := HostCreateRequest{
		Hostname:   hostInfo.Hostname,
		IPAddress:  ipAddress,
		MACAddress: hostInfo.MACAddress,
		OS: HostOS{
			Name:    hostInfo.OS,
			Version: hostInfo.OSVersion,
		},
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal host data: %v", err)
	}

	fmt.Printf("Registering host: %s\n", string(jsonData))

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/agents/register",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", fmt.Errorf("failed to register host: %v", err)
	}
	defer resp.Body.Close()

	// Read response body for debugging
	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Host registration response: status=%d, body=%s\n", resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("failed to register host, status code: %d, response: %s", resp.StatusCode, string(body))
	}

	// Try to extract ID from response JSON
	var responseMap map[string]interface{}
	if err := json.Unmarshal(body, &responseMap); err != nil {
		return "", fmt.Errorf("failed to decode response: %v", err)
	}

	// The response might have different field names, let's check what's available
	fmt.Printf("Response fields: %+v\n", responseMap)

	// Try different possible ID field names
	if id, ok := responseMap["id"]; ok {
		return fmt.Sprintf("%v", id), nil
	}
	if id, ok := responseMap["_id"]; ok {
		return fmt.Sprintf("%v", id), nil
	}

	return "", fmt.Errorf("no ID found in response")
}

// SubmitInventory submits inventory data to the SafeMatrix backend using sync endpoint
func (c *Client) SubmitInventory(hostID string, hostInfo *inventory.HostInfo) error {
	fmt.Printf("Synchronizing %d software items...\n", len(hostInfo.Software))
	
	// Préparer la liste des logiciels pour la synchronisation
	softwareList := make([]SoftwareItem, 0, len(hostInfo.Software))
	for _, software := range hostInfo.Software {
		softwareList = append(softwareList, SoftwareItem{
			SoftwareName: software.Name,
			Version:      software.Version,
			Vendor:       software.Vendor,
			InstallDate:  software.InstallDate,
		})
	}
	
	syncRequest := InventorySyncRequest{
		HostID:       hostID,
		SoftwareList: softwareList,
	}

	jsonData, err := json.Marshal(syncRequest)
	if err != nil {
		return fmt.Errorf("failed to marshal sync request: %v", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/agents/sync-inventory",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to sync inventory: %v", err)
	}
	defer resp.Body.Close()

	// Lire la réponse pour récupérer les statistiques
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read sync response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to sync inventory, status code: %d, response: %s", resp.StatusCode, string(body))
	}

	// Parser la réponse pour afficher les statistiques
	var syncResponse map[string]interface{}
	if err := json.Unmarshal(body, &syncResponse); err == nil {
		if stats, ok := syncResponse["statistics"].(map[string]interface{}); ok {
			added := int(stats["added"].(float64))
			updated := int(stats["updated"].(float64))
			removed := int(stats["removed"].(float64))
			unchanged := int(stats["unchanged"].(float64))
			
			fmt.Printf("✅ Inventory synchronized successfully!\n")
			fmt.Printf("  📦 Added: %d new software\n", added)
			fmt.Printf("  🔄 Updated: %d software (version changes)\n", updated)
			fmt.Printf("  🗑️ Removed: %d obsolete software\n", removed)
			fmt.Printf("  ✓ Unchanged: %d software\n", unchanged)
		}
	}

	return nil
}

// TestConnection tests if the SafeMatrix backend is reachable
func (c *Client) TestConnection() error {
	resp, err := c.httpClient.Get(c.baseURL + "/api/v1/health/opensearch")
	if err != nil {
		return fmt.Errorf("connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed, status code: %d", resp.StatusCode)
	}

	return nil
} 