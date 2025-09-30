#ifndef UTILS_H
#define UTILS_H

#include <windows.h>

// Get current timestamp as string
void utils_get_timestamp(char *buffer, size_t size);

// Get hostname
int utils_get_hostname(char *hostname, size_t size);

// Get user config directory
void utils_get_config_dir(char *path, size_t size);

// Create directory recursively
int utils_create_directory(const char *path);

// String utilities
char* utils_trim(char *str);
int utils_starts_with(const char *str, const char *prefix);
int utils_contains(const char *str, const char *substr);

// Convert to lowercase
void utils_to_lower(char *str);

// Sleep for milliseconds
void utils_sleep_ms(int milliseconds);

#endif // UTILS_H
