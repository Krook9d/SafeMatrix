package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type Config struct {
	ServerHost     string `json:"server_host"`
	ServerPort     int    `json:"server_port"`
	AgentID        string `json:"agent_id"`
	CollectInterval int   `json:"collect_interval"` 
}

// DefaultConfig returns the default configuration
func DefaultConfig() *Config {
	return &Config{
		ServerHost:      "127.0.0.1",
		ServerPort:      8000,
		AgentID:         generateAgentID(),
		CollectInterval: 5, 
	}
}

// configPath returns the path to the configuration file
func configPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".safematrix", "config.json")
}

// Load loads configuration from file, creates default if not exists
func Load() (*Config, error) {
	path := configPath()
	
	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	// If config file doesn't exist, create default
	if _, err := os.Stat(path); os.IsNotExist(err) {
		config := DefaultConfig()
		if err := config.Save(); err != nil {
			return nil, err
		}
		return config, nil
	}

	// Load existing config
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

// Save saves the configuration to file
func (c *Config) Save() error {
	path := configPath()
	
	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// GetServerURL returns the full server URL
func (c *Config) GetServerURL() string {
	return fmt.Sprintf("http://%s:%d", c.ServerHost, c.ServerPort)
}

// generateAgentID generates a unique agent ID
func generateAgentID() string {
	hostname, _ := os.Hostname()
	return fmt.Sprintf("%s-%d", hostname, time.Now().Unix())
} 