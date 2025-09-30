#ifndef INSTALLER_H
#define INSTALLER_H

#include <windows.h>

#define INSTALL_DIR "SafeMatrix\\Agent"
#define INSTALL_EXE "safematrix-agent.exe"

typedef struct {
    char install_path[MAX_PATH];
    char service_path[MAX_PATH];
} Installer;

// Initialize installer
void installer_init(Installer *installer);

// Check if agent is installed
int installer_is_installed(const Installer *installer);

// Check if running with admin privileges
int installer_is_admin(void);

// Perform installation
int installer_install(Installer *installer);

// Perform uninstallation
int installer_uninstall(Installer *installer);

// Create installation directory
int installer_create_directory(const Installer *installer);

// Copy executable to installation directory
int installer_copy_files(const Installer *installer);

// Configure Windows startup
int installer_configure_startup(const Installer *installer);

// Create desktop shortcut
int installer_create_desktop_shortcut(const Installer *installer);

// Create uninstaller
int installer_create_uninstaller(const Installer *installer);

// Add to Programs and Features
int installer_add_to_programs(const Installer *installer);

// Remove from Programs and Features
int installer_remove_from_programs(void);

#endif // INSTALLER_H
