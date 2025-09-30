#ifndef JSON_H
#define JSON_H

#include "inventory.h"

// Build JSON for host registration
int json_build_host_registration(const HostInfo *host_info, char *json, size_t size);

// Build JSON for inventory sync
int json_build_inventory_sync(const char *host_id, const HostInfo *host_info, 
                               char *json, size_t size);

// Parse JSON response to extract ID
int json_parse_id(const char *json, char *id, size_t size);

// Escape JSON string
void json_escape_string(const char *src, char *dest, size_t dest_size);

#endif // JSON_H
