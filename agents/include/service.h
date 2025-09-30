#ifndef SERVICE_H
#define SERVICE_H

#include <windows.h>
#include "config.h"

#define SERVICE_NAME "SafeMatrixAgent"
#define SERVICE_DISPLAY_NAME "SafeMatrix Security Agent"
#define SERVICE_DESCRIPTION "SafeMatrix Agent provides continuous security monitoring and vulnerability assessment"

// Service control handler
void WINAPI service_ctrl_handler(DWORD ctrl_code);

// Service main function
void WINAPI service_main(DWORD argc, LPTSTR *argv);

// Start the service
int service_start(void);

// Stop the service
void service_stop(void);

// Install the service
int service_install(const char *binary_path);

// Uninstall the service
int service_uninstall(void);

// Check if running as service
int service_is_running_as_service(void);

// Run service (blocking)
int service_run(void);

// Perform security scan
void service_perform_scan(void);

#endif // SERVICE_H
