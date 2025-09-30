#include <windows.h>
#include <stdio.h>
#include <string.h>
#include "config.h"
#include "logger.h"
#include "installer.h"
#include "service.h"
#include "inventory.h"
#include "http_client.h"
#include "json.h"
#include "utils.h"
#include "tray.h"
#include "gui_installer.h"

static void print_usage(void);
static void cmd_install(HINSTANCE hInstance);
static void cmd_uninstall(void);
static void cmd_config(int argc, char *argv[]);
static void cmd_test(void);
static void cmd_scan(void);
static void cmd_status(void);
static void cmd_help(void);

// Entry point for GUI application
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    (void)hPrevInstance;
    (void)nCmdShow;
    
    // Initialize logger
    char log_path[MAX_PATH];
    utils_get_config_dir(log_path, sizeof(log_path));
    strcat_s(log_path, sizeof(log_path), "\\agent.log");
    logger_init(log_path);
    
    // Parse command line
    int argc = 0;
    LPWSTR *argv_wide = CommandLineToArgvW(GetCommandLineW(), &argc);
    
    // Convert to char**
    char **argv = (char **)malloc(argc * sizeof(char *));
    for (int i = 0; i < argc; i++) {
        int size = WideCharToMultiByte(CP_UTF8, 0, argv_wide[i], -1, NULL, 0, NULL, NULL);
        argv[i] = (char *)malloc(size);
        WideCharToMultiByte(CP_UTF8, 0, argv_wide[i], -1, argv[i], size, NULL, NULL);
    }
    LocalFree(argv_wide);
    
    // Check if running as service
    if (argc > 1 && strcmp(argv[1], "--service") == 0) {
        LOG_INFO("Starting as Windows service");
        int result = service_run();
        
        for (int i = 0; i < argc; i++) free(argv[i]);
        free(argv);
        logger_close();
        return result;
    }
    
    // Check for tray mode
    if (argc > 1 && strcmp(argv[1], "--tray") == 0) {
        LOG_INFO("Starting in tray mode");
        int result = tray_run(hInstance);
        
        for (int i = 0; i < argc; i++) free(argv[i]);
        free(argv);
        logger_close();
        return result;
    }
    
    // For CLI commands, allocate console
    BOOL console_allocated = FALSE;
    if (argc > 1) {
        AllocConsole();
        console_allocated = TRUE;
        
        // Redirect stdout and stderr
        FILE *fp;
        freopen_s(&fp, "CONOUT$", "w", stdout);
        freopen_s(&fp, "CONOUT$", "w", stderr);
    }
    
    // Check for commands
    if (argc == 1) {
        // No arguments - check if installed
        Installer installer;
        installer_init(&installer);
        
        if (!installer_is_installed(&installer)) {
            // Not installed - show GUI installation
            int result = gui_installer_show(hInstance, &installer);
            
            for (int i = 0; i < argc; i++) free(argv[i]);
            free(argv);
            logger_close();
            return result;
        } else {
            // Already installed - start tray
            int result = tray_run(hInstance);
            
            for (int i = 0; i < argc; i++) free(argv[i]);
            free(argv);
            logger_close();
            return result;
        }
    }
    
    int result = 0;
    
    // Parse command
    if (strcmp(argv[1], "install") == 0) {
        cmd_install(hInstance);
    } else if (strcmp(argv[1], "uninstall") == 0) {
        cmd_uninstall();
    } else if (strcmp(argv[1], "config") == 0) {
        cmd_config(argc - 1, &argv[1]);
    } else if (strcmp(argv[1], "test") == 0) {
        cmd_test();
    } else if (strcmp(argv[1], "scan") == 0) {
        cmd_scan();
    } else if (strcmp(argv[1], "status") == 0) {
        cmd_status();
    } else if (strcmp(argv[1], "help") == 0 || strcmp(argv[1], "--help") == 0 || 
               strcmp(argv[1], "-h") == 0) {
        cmd_help();
    } else {
        printf("Unknown command: %s\n\n", argv[1]);
        print_usage();
        result = 1;
    }
    
    if (console_allocated) {
        printf("\nPress Enter to exit...");
        getchar();
        FreeConsole();
    }
    
    for (int i = 0; i < argc; i++) free(argv[i]);
    free(argv);
    logger_close();
    
    return result;
}

static void print_usage(void) {
    printf("SafeMatrix Agent - Security Monitoring Agent\n");
    printf("\n");
    printf("Usage:\n");
    printf("  safematrix-agent                     Show installation status or install\n");
    printf("  safematrix-agent install             Install agent and start service\n");
    printf("  safematrix-agent uninstall           Uninstall agent and remove service\n");
    printf("  safematrix-agent config              Show current configuration\n");
    printf("  safematrix-agent config --host <ip>  Set server host\n");
    printf("  safematrix-agent config --port <port> Set server port\n");
    printf("  safematrix-agent test                Test connection to server\n");
    printf("  safematrix-agent scan                Run inventory scan once\n");
    printf("  safematrix-agent status              Show service status\n");
    printf("  safematrix-agent help                Show this help\n");
    printf("\n");
}

static void cmd_install(HINSTANCE hInstance) {
    Installer installer;
    installer_init(&installer);
    
    if (installer_is_installed(&installer)) {
        MessageBoxA(NULL,
            "SafeMatrix Agent is already installed.",
            "Already Installed",
            MB_OK | MB_ICONINFORMATION);
        return;
    }
    
    // Show GUI installer
    gui_installer_show(hInstance, &installer);
}

static void cmd_uninstall(void) {
    Installer installer;
    installer_init(&installer);
    
    if (!installer_is_installed(&installer)) {
        printf("SafeMatrix Agent is not installed.\n");
        return;
    }
    
    printf("Uninstalling SafeMatrix Agent...\n");
    
    if (installer_uninstall(&installer) == 0) {
        printf("SafeMatrix Agent has been uninstalled successfully.\n");
    } else {
        printf("Uninstallation failed. Please check the logs.\n");
    }
}

static void cmd_config(int argc, char *argv[]) {
    Config config;
    
    if (config_load(&config) != 0) {
        printf("Failed to load configuration. Using defaults.\n");
        config_init_default(&config);
    }
    
    // If no additional arguments, just show current config
    if (argc == 1) {
        printf("SafeMatrix Agent Configuration\n");
        printf("==============================\n");
        printf("Server Host:      %s\n", config.server_host);
        printf("Server Port:      %d\n", config.server_port);
        printf("Agent ID:         %s\n", config.agent_id);
        printf("Collect Interval: %d minutes\n", config.collect_interval);
        printf("\n");
        
        char url[512];
        config_get_server_url(&config, url, sizeof(url));
        printf("Server URL: %s\n", url);
        
        char config_path[MAX_PATH];
        config_get_path(config_path, sizeof(config_path));
        printf("Config file: %s\n", config_path);
        return;
    }
    
    // Parse config options
    int modified = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--host") == 0 && i + 1 < argc) {
            strcpy_s(config.server_host, sizeof(config.server_host), argv[i + 1]);
            printf("Server host set to: %s\n", config.server_host);
            i++;
            modified = 1;
        } else if (strcmp(argv[i], "--port") == 0 && i + 1 < argc) {
            config.server_port = atoi(argv[i + 1]);
            printf("Server port set to: %d\n", config.server_port);
            i++;
            modified = 1;
        } else if (strcmp(argv[i], "--interval") == 0 && i + 1 < argc) {
            config.collect_interval = atoi(argv[i + 1]);
            printf("Collect interval set to: %d minutes\n", config.collect_interval);
            i++;
            modified = 1;
        }
    }
    
    if (modified) {
        if (config_save(&config) == 0) {
            printf("\nConfiguration saved successfully.\n");
            printf("\nNote: Restart the service for changes to take effect:\n");
            printf("  net stop SafeMatrixAgent\n");
            printf("  net start SafeMatrixAgent\n");
        } else {
            printf("Failed to save configuration.\n");
        }
    }
}

static void cmd_test(void) {
    printf("Testing connection to SafeMatrix server...\n\n");
    
    Config config;
    if (config_load(&config) != 0) {
        printf("Failed to load configuration.\n");
        return;
    }
    
    printf("Server: %s:%d\n", config.server_host, config.server_port);
    
    HttpClient client;
    if (http_client_init(&client, config.server_host, config.server_port) != 0) {
        printf("Failed to initialize HTTP client.\n");
        return;
    }
    
    printf("Connecting...\n");
    
    if (http_client_test_connection(&client) == 0) {
        printf("\n");
        printf("✓ Connection successful!\n");
        printf("  The SafeMatrix server is reachable.\n");
    } else {
        printf("\n");
        printf("✗ Connection failed!\n");
        printf("  Please check:\n");
        printf("  - Server is running\n");
        printf("  - Server host and port are correct\n");
        printf("  - Network/firewall allows connection\n");
    }
    
    http_client_close(&client);
}

static void cmd_scan(void) {
    printf("SafeMatrix Agent - Manual Scan\n");
    printf("===============================\n\n");
    
    Config config;
    if (config_load(&config) != 0) {
        printf("Failed to load configuration.\n");
        return;
    }
    
    printf("Collecting system inventory...\n");
    
    HostInfo host_info;
    if (inventory_collect(&host_info) != 0) {
        printf("Failed to collect inventory.\n");
        return;
    }
    
    printf("\n");
    printf("System Information:\n");
    printf("  Hostname:     %s\n", host_info.hostname);
    printf("  OS:           %s %s\n", host_info.os, host_info.os_version);
    printf("  Architecture: %s\n", host_info.architecture);
    printf("  IP Address:   %s\n", host_info.ip_address);
    printf("  MAC Address:  %s\n", host_info.mac_address);
    printf("  Software:     %d items\n", host_info.software_count);
    printf("\n");
    
    printf("Connecting to SafeMatrix server...\n");
    
    HttpClient client;
    if (http_client_init(&client, config.server_host, config.server_port) != 0) {
        printf("Failed to initialize HTTP client.\n");
        inventory_free(&host_info);
        return;
    }
    
    // Register host
    char json_request[4096];
    char response[4096];
    
    json_build_host_registration(&host_info, json_request, sizeof(json_request));
    
    printf("Registering host...\n");
    if (http_client_post(&client, "/api/v1/agents/register", json_request,
                         response, sizeof(response)) != 0) {
        printf("Failed to register host.\n");
        http_client_close(&client);
        inventory_free(&host_info);
        return;
    }
    
    char host_id[128];
    if (json_parse_id(response, host_id, sizeof(host_id)) != 0) {
        printf("Failed to parse host ID.\n");
        http_client_close(&client);
        inventory_free(&host_info);
        return;
    }
    
    printf("Host registered with ID: %s\n", host_id);
    
    // Sync inventory
    printf("Synchronizing inventory (%d items)...\n", host_info.software_count);
    
    char *json_inventory = (char *)malloc(1024 * 1024);
    if (!json_inventory) {
        printf("Failed to allocate memory.\n");
        http_client_close(&client);
        inventory_free(&host_info);
        return;
    }
    
    json_build_inventory_sync(host_id, &host_info, json_inventory, 1024 * 1024);
    
    if (http_client_post(&client, "/api/v1/agents/sync-inventory", json_inventory,
                         response, sizeof(response)) == 0) {
        printf("\n");
        printf("✓ Inventory synchronized successfully!\n");
        printf("\n");
        printf("Scan completed. You can view the results in the SafeMatrix dashboard.\n");
    } else {
        printf("Failed to synchronize inventory.\n");
    }
    
    free(json_inventory);
    http_client_close(&client);
    inventory_free(&host_info);
}

static void cmd_status(void) {
    printf("SafeMatrix Agent - Status\n");
    printf("=========================\n\n");
    
    Installer installer;
    installer_init(&installer);
    
    if (!installer_is_installed(&installer)) {
        printf("Status: NOT INSTALLED\n");
        printf("\n");
        printf("Run 'safematrix-agent install' to install the agent.\n");
        return;
    }
    
    printf("Status: INSTALLED\n");
    printf("Installation path: %s\n\n", installer.install_path);
    
    // Check service status
    SC_HANDLE sc_manager = OpenSCManagerA(NULL, NULL, SC_MANAGER_CONNECT);
    if (sc_manager) {
        SC_HANDLE service = OpenServiceA(sc_manager, SERVICE_NAME, SERVICE_QUERY_STATUS);
        if (service) {
            SERVICE_STATUS status;
            if (QueryServiceStatus(service, &status)) {
                printf("Service Status: ");
                switch (status.dwCurrentState) {
                    case SERVICE_RUNNING:
                        printf("RUNNING\n");
                        break;
                    case SERVICE_STOPPED:
                        printf("STOPPED\n");
                        break;
                    case SERVICE_START_PENDING:
                        printf("STARTING\n");
                        break;
                    case SERVICE_STOP_PENDING:
                        printf("STOPPING\n");
                        break;
                    default:
                        printf("UNKNOWN (%d)\n", status.dwCurrentState);
                }
            }
            CloseServiceHandle(service);
        } else {
            printf("Service Status: NOT FOUND\n");
        }
        CloseServiceHandle(sc_manager);
    }
    
    // Show configuration
    Config config;
    if (config_load(&config) == 0) {
        printf("\nConfiguration:\n");
        printf("  Server: %s:%d\n", config.server_host, config.server_port);
        printf("  Agent ID: %s\n", config.agent_id);
        printf("  Scan Interval: %d minutes\n", config.collect_interval);
    }
    
    printf("\n");
    printf("Commands:\n");
    printf("  Test connection:  safematrix-agent test\n");
    printf("  Run manual scan:  safematrix-agent scan\n");
    printf("  Configure:        safematrix-agent config\n");
    printf("  Uninstall:        safematrix-agent uninstall\n");
}

static void cmd_help(void) {
    print_usage();
}