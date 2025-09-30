#ifndef CONFIG_H
#define CONFIG_H

#include <windows.h>

#define MAX_PATH_LEN 512
#define MAX_STRING_LEN 256

typedef struct {
    char server_host[MAX_STRING_LEN];
    int server_port;
    char agent_id[MAX_STRING_LEN];
    int collect_interval;  // in minutes
} Config;

// Initialize default configuration
void config_init_default(Config *config);

// Load configuration from file
int config_load(Config *config);

// Save configuration to file
int config_save(const Config *config);

// Get configuration file path
void config_get_path(char *path, size_t size);

// Get server URL
void config_get_server_url(const Config *config, char *url, size_t size);

// Generate unique agent ID
void config_generate_agent_id(char *agent_id, size_t size);

#endif // CONFIG_H
