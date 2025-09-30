#include "service.h"
#include "logger.h"
#include "config.h"
#include "inventory.h"
#include "http_client.h"
#include "json.h"
#include "utils.h"
#include <stdio.h>
#include <string.h>

static SERVICE_STATUS service_status;
static SERVICE_STATUS_HANDLE service_status_handle;
static HANDLE stop_event = NULL;
static Config global_config;

// Forward declarations
static void update_service_status(DWORD current_state, DWORD exit_code, DWORD wait_hint);

void WINAPI service_ctrl_handler(DWORD ctrl_code) {
    switch (ctrl_code) {
        case SERVICE_CONTROL_STOP:
        case SERVICE_CONTROL_SHUTDOWN:
            LOG_INFO("Service stop requested");
            update_service_status(SERVICE_STOP_PENDING, 0, 0);
            SetEvent(stop_event);
            break;
            
        case SERVICE_CONTROL_INTERROGATE:
            break;
            
        default:
            break;
    }
}

void WINAPI service_main(DWORD argc, LPTSTR *argv) {
    (void)argc;
    (void)argv;
    
    // Register control handler
    service_status_handle = RegisterServiceCtrlHandlerA(SERVICE_NAME, service_ctrl_handler);
    if (!service_status_handle) {
        return;
    }
    
    // Initialize service status
    memset(&service_status, 0, sizeof(service_status));
    service_status.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
    service_status.dwCurrentState = SERVICE_START_PENDING;
    service_status.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN;
    
    update_service_status(SERVICE_START_PENDING, 0, 3000);
    
    // Initialize logger
    char log_path[MAX_PATH];
    utils_get_config_dir(log_path, sizeof(log_path));
    strcat_s(log_path, sizeof(log_path), "\\service.log");
    logger_init(log_path);
    
    LOG_INFO("SafeMatrix Agent service starting...");
    
    // Load configuration
    if (config_load(&global_config) != 0) {
        LOG_WARNING("Failed to load config, using defaults");
        config_init_default(&global_config);
    }
    
    // Create stop event
    stop_event = CreateEvent(NULL, TRUE, FALSE, NULL);
    if (!stop_event) {
        LOG_ERROR("Failed to create stop event");
        update_service_status(SERVICE_STOPPED, 1, 0);
        return;
    }
    
    update_service_status(SERVICE_RUNNING, 0, 0);
    LOG_INFO("SafeMatrix Agent service started successfully");
    
    // Service loop
    DWORD interval_ms = global_config.collect_interval * 60 * 1000; // Convert minutes to ms
    
    // Perform initial scan
    service_perform_scan();
    
    // Main service loop
    while (WaitForSingleObject(stop_event, interval_ms) == WAIT_TIMEOUT) {
        service_perform_scan();
    }
    
    // Cleanup
    CloseHandle(stop_event);
    logger_close();
    
    update_service_status(SERVICE_STOPPED, 0, 0);
    LOG_INFO("SafeMatrix Agent service stopped");
}

static void update_service_status(DWORD current_state, DWORD exit_code, DWORD wait_hint) {
    static DWORD checkpoint = 1;
    
    service_status.dwCurrentState = current_state;
    service_status.dwWin32ExitCode = exit_code;
    service_status.dwWaitHint = wait_hint;
    
    if (current_state == SERVICE_START_PENDING) {
        service_status.dwControlsAccepted = 0;
    } else {
        service_status.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN;
    }
    
    if ((current_state == SERVICE_RUNNING) || (current_state == SERVICE_STOPPED)) {
        service_status.dwCheckPoint = 0;
    } else {
        service_status.dwCheckPoint = checkpoint++;
    }
    
    SetServiceStatus(service_status_handle, &service_status);
}

void service_perform_scan(void) {
    LOG_INFO("Starting security scan...");
    
    HostInfo host_info;
    if (inventory_collect(&host_info) != 0) {
        LOG_ERROR("Inventory collection failed");
        return;
    }
    
    // Initialize HTTP client
    HttpClient client;
    if (http_client_init(&client, global_config.server_host, global_config.server_port) != 0) {
        LOG_ERROR("Failed to initialize HTTP client");
        inventory_free(&host_info);
        return;
    }
    
    // Build host registration JSON
    char json_request[4096];
    json_build_host_registration(&host_info, json_request, sizeof(json_request));
    
    // Register host
    char response[4096];
    if (http_client_post(&client, "/api/v1/agents/register", json_request, 
                         response, sizeof(response)) != 0) {
        LOG_ERROR("Host registration failed");
        http_client_close(&client);
        inventory_free(&host_info);
        return;
    }
    
    // Extract host ID
    char host_id[128];
    if (json_parse_id(response, host_id, sizeof(host_id)) != 0) {
        LOG_ERROR("Failed to parse host ID from response");
        http_client_close(&client);
        inventory_free(&host_info);
        return;
    }
    
    LOG_INFO("Host registered with ID: %s", host_id);
    
    // Build inventory sync JSON (may be large)
    char *json_inventory = (char *)malloc(1024 * 1024); // 1MB buffer for large inventories
    if (!json_inventory) {
        LOG_ERROR("Failed to allocate memory for inventory JSON");
        http_client_close(&client);
        inventory_free(&host_info);
        return;
    }
    
    json_build_inventory_sync(host_id, &host_info, json_inventory, 1024 * 1024);
    
    // Submit inventory
    if (http_client_post(&client, "/api/v1/agents/sync-inventory", json_inventory,
                         response, sizeof(response)) != 0) {
        LOG_ERROR("Inventory synchronization failed");
    } else {
        LOG_INFO("Inventory synchronized successfully: %d software items", host_info.software_count);
    }
    
    free(json_inventory);
    http_client_close(&client);
    inventory_free(&host_info);
    
    LOG_INFO("Security scan completed");
}

int service_run(void) {
    SERVICE_TABLE_ENTRYA service_table[] = {
        { SERVICE_NAME, service_main },
        { NULL, NULL }
    };
    
    if (!StartServiceCtrlDispatcherA(service_table)) {
        DWORD error = GetLastError();
        if (error == ERROR_FAILED_SERVICE_CONTROLLER_CONNECT) {
            // Not running as service - debug mode
            LOG_INFO("Running in debug mode (not as service)");
            service_main(0, NULL);
            return 0;
        }
        LOG_ERROR("StartServiceCtrlDispatcher failed: %d", error);
        return -1;
    }
    
    return 0;
}

int service_install(const char *binary_path) {
    SC_HANDLE sc_manager = OpenSCManagerA(NULL, NULL, SC_MANAGER_CREATE_SERVICE);
    if (!sc_manager) {
        LOG_ERROR("Failed to open SC Manager: %d", GetLastError());
        return -1;
    }
    
    char service_cmd[MAX_PATH * 2];
    _snprintf_s(service_cmd, sizeof(service_cmd), _TRUNCATE, "\"%s\" --service", binary_path);
    
    SC_HANDLE service = CreateServiceA(
        sc_manager,
        SERVICE_NAME,
        SERVICE_DISPLAY_NAME,
        SERVICE_ALL_ACCESS,
        SERVICE_WIN32_OWN_PROCESS,
        SERVICE_AUTO_START,
        SERVICE_ERROR_NORMAL,
        service_cmd,
        NULL, NULL, NULL,
        "LocalSystem",
        NULL
    );
    
    if (!service) {
        DWORD error = GetLastError();
        if (error == ERROR_SERVICE_EXISTS) {
            LOG_INFO("Service already exists");
            CloseServiceHandle(sc_manager);
            return 0;
        }
        LOG_ERROR("Failed to create service: %d", error);
        CloseServiceHandle(sc_manager);
        return -1;
    }
    
    // Set service description
    SERVICE_DESCRIPTIONA desc;
    desc.lpDescription = SERVICE_DESCRIPTION;
    ChangeServiceConfig2A(service, SERVICE_CONFIG_DESCRIPTION, &desc);
    
    LOG_INFO("Service installed successfully");
    
    // Start service
    if (StartServiceA(service, 0, NULL)) {
        LOG_INFO("Service started successfully");
    } else {
        DWORD error = GetLastError();
        if (error != ERROR_SERVICE_ALREADY_RUNNING) {
            LOG_WARNING("Failed to start service: %d", error);
        }
    }
    
    CloseServiceHandle(service);
    CloseServiceHandle(sc_manager);
    
    return 0;
}

int service_uninstall(void) {
    SC_HANDLE sc_manager = OpenSCManagerA(NULL, NULL, SC_MANAGER_CONNECT);
    if (!sc_manager) {
        LOG_ERROR("Failed to open SC Manager: %d", GetLastError());
        return -1;
    }
    
    SC_HANDLE service = OpenServiceA(sc_manager, SERVICE_NAME, 
                                      SERVICE_STOP | SERVICE_QUERY_STATUS | DELETE);
    if (!service) {
        LOG_ERROR("Failed to open service: %d", GetLastError());
        CloseServiceHandle(sc_manager);
        return -1;
    }
    
    // Stop service
    SERVICE_STATUS status;
    ControlService(service, SERVICE_CONTROL_STOP, &status);
    
    // Wait for service to stop
    for (int i = 0; i < 30; i++) {
        QueryServiceStatus(service, &status);
        if (status.dwCurrentState == SERVICE_STOPPED) break;
        Sleep(1000);
    }
    
    // Delete service
    if (!DeleteService(service)) {
        LOG_ERROR("Failed to delete service: %d", GetLastError());
        CloseServiceHandle(service);
        CloseServiceHandle(sc_manager);
        return -1;
    }
    
    LOG_INFO("Service uninstalled successfully");
    
    CloseServiceHandle(service);
    CloseServiceHandle(sc_manager);
    
    return 0;
}

int service_is_running_as_service(void) {
    HANDLE process_token;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &process_token)) {
        return 0;
    }
    
    DWORD session_id;
    DWORD return_length;
    if (!GetTokenInformation(process_token, TokenSessionId, &session_id, 
                            sizeof(session_id), &return_length)) {
        CloseHandle(process_token);
        return 0;
    }
    
    CloseHandle(process_token);
    
    // Session 0 is typically for services
    return (session_id == 0);
}
