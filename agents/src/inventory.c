#include "inventory.h"
#include "logger.h"
#include "utils.h"
#include <stdio.h>
#include <string.h>
#include <wbemidl.h>
#include <iphlpapi.h>

#pragma comment(lib, "wbemuuid.lib")
#pragma comment(lib, "iphlpapi.lib")

static int is_system_component(const Software *software);
static int scan_registry_path(HKEY root, const char *path, Software *software_list, int *count, int max_count);
static int read_software_info(HKEY root, const char *key_path, Software *software);

int inventory_collect(HostInfo *host_info) {
    memset(host_info, 0, sizeof(HostInfo));
    
    LOG_INFO("Starting inventory collection...");
    
    // Allocate software list
    host_info->software_list = (Software *)calloc(MAX_SOFTWARE_ITEMS, sizeof(Software));
    if (!host_info->software_list) {
        LOG_ERROR("Failed to allocate memory for software list");
        return -1;
    }
    host_info->software_count = 0;
    
    // Get system information
    if (inventory_get_system_info(host_info) != 0) {
        LOG_ERROR("Failed to get system information");
        free(host_info->software_list);
        return -1;
    }
    
    // Get network information
    inventory_get_mac_address(host_info->mac_address, sizeof(host_info->mac_address));
    inventory_get_ip_address(host_info->ip_address, sizeof(host_info->ip_address));
    
    // Get installed software
    if (inventory_get_installed_software(host_info) != 0) {
        LOG_ERROR("Failed to get installed software");
        free(host_info->software_list);
        return -1;
    }
    
    LOG_INFO("Inventory collection completed: %d software items", host_info->software_count);
    return 0;
}

void inventory_free(HostInfo *host_info) {
    if (host_info->software_list) {
        free(host_info->software_list);
        host_info->software_list = NULL;
    }
    host_info->software_count = 0;
}

int inventory_get_system_info(HostInfo *host_info) {
    HRESULT hr;
    
    // Initialize COM
    hr = CoInitializeEx(0, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        LOG_ERROR("Failed to initialize COM: 0x%08X", hr);
        return -1;
    }
    
    // Set security levels
    hr = CoInitializeSecurity(
        NULL, -1, NULL, NULL,
        RPC_C_AUTHN_LEVEL_DEFAULT,
        RPC_C_IMP_LEVEL_IMPERSONATE,
        NULL, EOAC_NONE, NULL
    );
    
    IWbemLocator *locator = NULL;
    IWbemServices *services = NULL;
    
    // Create WMI locator
    hr = CoCreateInstance(
        &CLSID_WbemLocator,
        NULL,
        CLSCTX_INPROC_SERVER,
        &IID_IWbemLocator,
        (LPVOID *)&locator
    );
    
    if (FAILED(hr)) {
        LOG_ERROR("Failed to create WbemLocator: 0x%08X", hr);
        CoUninitialize();
        return -1;
    }
    
    // Connect to WMI
    hr = locator->lpVtbl->ConnectServer(
        locator,
        L"ROOT\\CIMV2",
        NULL, NULL, NULL, 0, NULL, NULL,
        &services
    );
    
    if (FAILED(hr)) {
        LOG_ERROR("Failed to connect to WMI: 0x%08X", hr);
        locator->lpVtbl->Release(locator);
        CoUninitialize();
        return -1;
    }
    
    // Set security on proxy
    hr = CoSetProxyBlanket(
        (IUnknown *)services,
        RPC_C_AUTHN_WINNT,
        RPC_C_AUTHZ_NONE,
        NULL,
        RPC_C_AUTHN_LEVEL_CALL,
        RPC_C_IMP_LEVEL_IMPERSONATE,
        NULL,
        EOAC_NONE
    );
    
    // Query Win32_ComputerSystem
    IEnumWbemClassObject *enumerator = NULL;
    hr = services->lpVtbl->ExecQuery(
        services,
        L"WQL",
        L"SELECT Name, SystemType FROM Win32_ComputerSystem",
        WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY,
        NULL,
        &enumerator
    );
    
    if (SUCCEEDED(hr)) {
        IWbemClassObject *obj = NULL;
        ULONG returned = 0;
        
        while (enumerator->lpVtbl->Next(enumerator, WBEM_INFINITE, 1, &obj, &returned) == S_OK) {
            VARIANT vt;
            
            // Get Name (hostname)
            hr = obj->lpVtbl->Get(obj, L"Name", 0, &vt, NULL, NULL);
            if (SUCCEEDED(hr) && vt.vt == VT_BSTR) {
                WideCharToMultiByte(CP_UTF8, 0, vt.bstrVal, -1, 
                    host_info->hostname, sizeof(host_info->hostname), NULL, NULL);
                VariantClear(&vt);
            }
            
            // Get SystemType (architecture)
            hr = obj->lpVtbl->Get(obj, L"SystemType", 0, &vt, NULL, NULL);
            if (SUCCEEDED(hr) && vt.vt == VT_BSTR) {
                WideCharToMultiByte(CP_UTF8, 0, vt.bstrVal, -1,
                    host_info->architecture, sizeof(host_info->architecture), NULL, NULL);
                VariantClear(&vt);
            }
            
            obj->lpVtbl->Release(obj);
            break;
        }
        
        enumerator->lpVtbl->Release(enumerator);
    }
    
    // Query Win32_OperatingSystem
    hr = services->lpVtbl->ExecQuery(
        services,
        L"WQL",
        L"SELECT Caption, Version FROM Win32_OperatingSystem",
        WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY,
        NULL,
        &enumerator
    );
    
    if (SUCCEEDED(hr)) {
        IWbemClassObject *obj = NULL;
        ULONG returned = 0;
        
        while (enumerator->lpVtbl->Next(enumerator, WBEM_INFINITE, 1, &obj, &returned) == S_OK) {
            VARIANT vt;
            
            // Get Caption (OS name)
            hr = obj->lpVtbl->Get(obj, L"Caption", 0, &vt, NULL, NULL);
            if (SUCCEEDED(hr) && vt.vt == VT_BSTR) {
                WideCharToMultiByte(CP_UTF8, 0, vt.bstrVal, -1,
                    host_info->os, sizeof(host_info->os), NULL, NULL);
                VariantClear(&vt);
            }
            
            // Get Version
            hr = obj->lpVtbl->Get(obj, L"Version", 0, &vt, NULL, NULL);
            if (SUCCEEDED(hr) && vt.vt == VT_BSTR) {
                WideCharToMultiByte(CP_UTF8, 0, vt.bstrVal, -1,
                    host_info->os_version, sizeof(host_info->os_version), NULL, NULL);
                VariantClear(&vt);
            }
            
            obj->lpVtbl->Release(obj);
            break;
        }
        
        enumerator->lpVtbl->Release(enumerator);
    }
    
    // Cleanup
    services->lpVtbl->Release(services);
    locator->lpVtbl->Release(locator);
    CoUninitialize();
    
    LOG_INFO("System info: %s, %s %s, %s", 
        host_info->hostname, host_info->os, host_info->os_version, host_info->architecture);
    
    return 0;
}

int inventory_get_installed_software(HostInfo *host_info) {
    int count = 0;
    
    // Scan registry paths
    const char *registry_paths[] = {
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
    };
    
    for (int i = 0; i < 2; i++) {
        scan_registry_path(HKEY_LOCAL_MACHINE, registry_paths[i], 
                          host_info->software_list, &count, MAX_SOFTWARE_ITEMS);
    }
    
    // Also scan current user
    scan_registry_path(HKEY_CURRENT_USER, 
                      "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                      host_info->software_list, &count, MAX_SOFTWARE_ITEMS);
    
    host_info->software_count = count;
    return 0;
}

static int scan_registry_path(HKEY root, const char *path, Software *software_list, int *count, int max_count) {
    HKEY key;
    
    if (RegOpenKeyExA(root, path, 0, KEY_READ, &key) != ERROR_SUCCESS) {
        return -1;
    }
    
    DWORD index = 0;
    char subkey_name[256];
    DWORD subkey_name_size;
    
    while (*count < max_count) {
        subkey_name_size = sizeof(subkey_name);
        
        if (RegEnumKeyExA(key, index++, subkey_name, &subkey_name_size, 
                         NULL, NULL, NULL, NULL) != ERROR_SUCCESS) {
            break;
        }
        
        // Build full path
        char full_path[512];
        _snprintf_s(full_path, sizeof(full_path), _TRUNCATE, "%s\\%s", path, subkey_name);
        
        Software software;
        if (read_software_info(root, full_path, &software) == 0) {
            // Check if it's not a system component
            if (software.name[0] != '\0' && !is_system_component(&software)) {
                // Check for duplicates
                int duplicate = 0;
                for (int i = 0; i < *count; i++) {
                    if (strcmp(software_list[i].name, software.name) == 0) {
                        duplicate = 1;
                        break;
                    }
                }
                
                if (!duplicate) {
                    memcpy(&software_list[*count], &software, sizeof(Software));
                    (*count)++;
                }
            }
        }
    }
    
    RegCloseKey(key);
    return 0;
}

static int read_software_info(HKEY root, const char *key_path, Software *software) {
    memset(software, 0, sizeof(Software));
    
    HKEY key;
    if (RegOpenKeyExA(root, key_path, 0, KEY_READ, &key) != ERROR_SUCCESS) {
        return -1;
    }
    
    DWORD type;
    DWORD size;
    
    // Display Name
    size = sizeof(software->name);
    RegQueryValueExA(key, "DisplayName", NULL, &type, (LPBYTE)software->name, &size);
    
    // Version
    size = sizeof(software->version);
    RegQueryValueExA(key, "DisplayVersion", NULL, &type, (LPBYTE)software->version, &size);
    
    // Publisher
    size = sizeof(software->vendor);
    RegQueryValueExA(key, "Publisher", NULL, &type, (LPBYTE)software->vendor, &size);
    
    // Install Date
    size = sizeof(software->install_date);
    RegQueryValueExA(key, "InstallDate", NULL, &type, (LPBYTE)software->install_date, &size);
    
    RegCloseKey(key);
    
    return (software->name[0] != '\0') ? 0 : -1;
}

static int is_system_component(const Software *software) {
    char name_lower[MAX_SOFTWARE_NAME];
    char vendor_lower[MAX_VENDOR];
    
    strcpy_s(name_lower, sizeof(name_lower), software->name);
    strcpy_s(vendor_lower, sizeof(vendor_lower), software->vendor);
    
    utils_to_lower(name_lower);
    utils_to_lower(vendor_lower);
    
    // Exclude Windows updates and system components
    const char *exclude_patterns[] = {
        "update for microsoft",
        "hotfix for microsoft",
        "security update for microsoft",
        "microsoft visual c++ 2",
        "microsoft .net framework",
        "microsoft edge update",
        "microsoft edge webview2",
        NULL
    };
    
    for (int i = 0; exclude_patterns[i] != NULL; i++) {
        if (utils_contains(name_lower, exclude_patterns[i])) {
            return 1;
        }
    }
    
    return 0;
}

int inventory_get_mac_address(char *mac_address, size_t size) {
    IP_ADAPTER_INFO adapter_info[16];
    DWORD buffer_size = sizeof(adapter_info);
    
    DWORD result = GetAdaptersInfo(adapter_info, &buffer_size);
    if (result != ERROR_SUCCESS) {
        LOG_WARNING("Failed to get adapter info: %d", result);
        strcpy_s(mac_address, size, "00:00:00:00:00:00");
        return -1;
    }
    
    // Find first non-loopback adapter
    PIP_ADAPTER_INFO adapter = adapter_info;
    while (adapter) {
        if (adapter->Type == MIB_IF_TYPE_ETHERNET || adapter->Type == IF_TYPE_IEEE80211) {
            _snprintf_s(mac_address, size, _TRUNCATE,
                "%02X:%02X:%02X:%02X:%02X:%02X",
                adapter->Address[0], adapter->Address[1],
                adapter->Address[2], adapter->Address[3],
                adapter->Address[4], adapter->Address[5]
            );
            return 0;
        }
        adapter = adapter->Next;
    }
    
    strcpy_s(mac_address, size, "00:00:00:00:00:00");
    return -1;
}

int inventory_get_ip_address(char *ip_address, size_t size) {
    IP_ADAPTER_INFO adapter_info[16];
    DWORD buffer_size = sizeof(adapter_info);
    
    DWORD result = GetAdaptersInfo(adapter_info, &buffer_size);
    if (result != ERROR_SUCCESS) {
        LOG_WARNING("Failed to get adapter info: %d", result);
        strcpy_s(ip_address, size, "127.0.0.1");
        return -1;
    }
    
    // Find first non-loopback adapter with an IP
    PIP_ADAPTER_INFO adapter = adapter_info;
    while (adapter) {
        if (adapter->IpAddressList.IpAddress.String[0] != '0' &&
            strcmp(adapter->IpAddressList.IpAddress.String, "127.0.0.1") != 0) {
            strcpy_s(ip_address, size, adapter->IpAddressList.IpAddress.String);
            return 0;
        }
        adapter = adapter->Next;
    }
    
    strcpy_s(ip_address, size, "127.0.0.1");
    return -1;
}
