#include "json.h"
#include <stdio.h>
#include <string.h>

void json_escape_string(const char *src, char *dest, size_t dest_size) {
    size_t j = 0;
    for (size_t i = 0; src[i] && j < dest_size - 2; i++) {
        if (src[i] == '"' || src[i] == '\\') {
            dest[j++] = '\\';
        }
        dest[j++] = src[i];
    }
    dest[j] = '\0';
}

int json_build_host_registration(const HostInfo *host_info, char *json, size_t size) {
    char hostname_escaped[512];
    char os_escaped[512];
    char os_version_escaped[256];
    
    json_escape_string(host_info->hostname, hostname_escaped, sizeof(hostname_escaped));
    json_escape_string(host_info->os, os_escaped, sizeof(os_escaped));
    json_escape_string(host_info->os_version, os_version_escaped, sizeof(os_version_escaped));
    
    _snprintf_s(json, size, _TRUNCATE,
        "{"
        "\"hostname\":\"%s\","
        "\"ip_address\":\"%s\","
        "\"mac_address\":\"%s\","
        "\"os\":{"
            "\"name\":\"%s\","
            "\"version\":\"%s\""
        "}"
        "}",
        hostname_escaped,
        host_info->ip_address[0] ? host_info->ip_address : "192.168.1.100",
        host_info->mac_address,
        os_escaped,
        os_version_escaped
    );
    
    return 0;
}

int json_build_inventory_sync(const char *host_id, const HostInfo *host_info, 
                               char *json, size_t size) {
    // Start building JSON
    char *ptr = json;
    size_t remaining = size;
    int written;
    
    written = _snprintf_s(ptr, remaining, _TRUNCATE,
        "{\"host_id\":\"%s\",\"software_list\":[", host_id);
    if (written < 0) return -1;
    ptr += written;
    remaining -= written;
    
    // Add software items
    for (int i = 0; i < host_info->software_count && remaining > 100; i++) {
        char name_escaped[512];
        char version_escaped[256];
        char vendor_escaped[512];
        
        json_escape_string(host_info->software_list[i].name, name_escaped, sizeof(name_escaped));
        json_escape_string(host_info->software_list[i].version, version_escaped, sizeof(version_escaped));
        json_escape_string(host_info->software_list[i].vendor, vendor_escaped, sizeof(vendor_escaped));
        
        written = _snprintf_s(ptr, remaining, _TRUNCATE,
            "%s{\"software_name\":\"%s\",\"version\":\"%s\",\"vendor\":\"%s\",\"install_date\":\"%s\"}",
            (i > 0 ? "," : ""),
            name_escaped,
            version_escaped,
            vendor_escaped,
            host_info->software_list[i].install_date
        );
        
        if (written < 0) break;
        ptr += written;
        remaining -= written;
    }
    
    // Close JSON
    written = _snprintf_s(ptr, remaining, _TRUNCATE, "]}");
    if (written < 0) return -1;
    
    return 0;
}

int json_parse_id(const char *json, char *id, size_t size) {
    // Simple JSON parsing to extract "id" field
    const char *id_field = strstr(json, "\"id\"");
    if (!id_field) {
        id_field = strstr(json, "\"_id\"");
    }
    
    if (!id_field) {
        return -1;
    }
    
    // Find the value after the colon
    const char *colon = strchr(id_field, ':');
    if (!colon) return -1;
    
    // Skip whitespace and quotes
    colon++;
    while (*colon && (*colon == ' ' || *colon == '"')) colon++;
    
    // Copy until next quote or comma
    size_t i = 0;
    while (*colon && *colon != '"' && *colon != ',' && *colon != '}' && i < size - 1) {
        id[i++] = *colon++;
    }
    id[i] = '\0';
    
    return i > 0 ? 0 : -1;
}
