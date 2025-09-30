#include "config.h"
#include "utils.h"
#include "logger.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <shlobj.h>

void config_init_default(Config *config) {
    strcpy_s(config->server_host, sizeof(config->server_host), "127.0.0.1");
    config->server_port = 8000;
    config_generate_agent_id(config->agent_id, sizeof(config->agent_id));
    config->collect_interval = 5; // 5 minutes
}

void config_get_path(char *path, size_t size) {
    char config_dir[MAX_PATH];
    utils_get_config_dir(config_dir, sizeof(config_dir));
    _snprintf_s(path, size, _TRUNCATE, "%s\\config.json", config_dir);
}

int config_load(Config *config) {
    char path[MAX_PATH];
    config_get_path(path, sizeof(path));
    
    FILE *file = NULL;
    errno_t err = fopen_s(&file, path, "r");
    
    if (err != 0 || file == NULL) {
        // File doesn't exist, create default config
        config_init_default(config);
        return config_save(config);
    }
    
    // Simple JSON parsing (basic key-value pairs)
    char line[512];
    while (fgets(line, sizeof(line), file)) {
        char *colon = strchr(line, ':');
        if (!colon) continue;
        
        *colon = '\0';
        char *key = utils_trim(line);
        char *value = utils_trim(colon + 1);
        
        // Remove quotes and commas
        char *quote = strchr(value, '"');
        if (quote) {
            value = quote + 1;
            char *end_quote = strchr(value, '"');
            if (end_quote) *end_quote = '\0';
        }
        char *comma = strchr(value, ',');
        if (comma) *comma = '\0';
        
        if (strstr(key, "server_host")) {
            strcpy_s(config->server_host, sizeof(config->server_host), value);
        } else if (strstr(key, "server_port")) {
            config->server_port = atoi(value);
        } else if (strstr(key, "agent_id")) {
            strcpy_s(config->agent_id, sizeof(config->agent_id), value);
        } else if (strstr(key, "collect_interval")) {
            config->collect_interval = atoi(value);
        }
    }
    
    fclose(file);
    return 0;
}

int config_save(const Config *config) {
    char path[MAX_PATH];
    config_get_path(path, sizeof(path));
    
    // Create directory if needed
    char dir[MAX_PATH];
    utils_get_config_dir(dir, sizeof(dir));
    utils_create_directory(dir);
    
    FILE *file = NULL;
    errno_t err = fopen_s(&file, path, "w");
    
    if (err != 0 || file == NULL) {
        LOG_ERROR("Failed to save config to %s", path);
        return -1;
    }
    
    fprintf(file, "{\n");
    fprintf(file, "  \"server_host\": \"%s\",\n", config->server_host);
    fprintf(file, "  \"server_port\": %d,\n", config->server_port);
    fprintf(file, "  \"agent_id\": \"%s\",\n", config->agent_id);
    fprintf(file, "  \"collect_interval\": %d\n", config->collect_interval);
    fprintf(file, "}\n");
    
    fclose(file);
    LOG_INFO("Configuration saved to %s", path);
    return 0;
}

void config_get_server_url(const Config *config, char *url, size_t size) {
    _snprintf_s(url, size, _TRUNCATE, "http://%s:%d", 
                config->server_host, config->server_port);
}

void config_generate_agent_id(char *agent_id, size_t size) {
    char hostname[256];
    utils_get_hostname(hostname, sizeof(hostname));
    
    time_t now = time(NULL);
    _snprintf_s(agent_id, size, _TRUNCATE, "%s-%lld", hostname, (long long)now);
}
