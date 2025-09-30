#ifndef INVENTORY_H
#define INVENTORY_H

#include <windows.h>

#define MAX_SOFTWARE_ITEMS 2048
#define MAX_SOFTWARE_NAME 256
#define MAX_VERSION 128
#define MAX_VENDOR 256

typedef struct {
    char name[MAX_SOFTWARE_NAME];
    char version[MAX_VERSION];
    char vendor[MAX_VENDOR];
    char install_date[32];
} Software;

typedef struct {
    char hostname[256];
    char os[256];
    char os_version[128];
    char architecture[64];
    char ip_address[64];
    char mac_address[32];
    Software *software_list;
    int software_count;
} HostInfo;

// Collect system inventory
int inventory_collect(HostInfo *host_info);

// Free inventory data
void inventory_free(HostInfo *host_info);

// Get system information via WMI
int inventory_get_system_info(HostInfo *host_info);

// Get installed software from registry
int inventory_get_installed_software(HostInfo *host_info);

// Get MAC address
int inventory_get_mac_address(char *mac_address, size_t size);

// Get IP address
int inventory_get_ip_address(char *ip_address, size_t size);

#endif // INVENTORY_H
