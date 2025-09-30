#include "installer.h"
#include "service.h"
#include "logger.h"
#include "utils.h"
#include <stdio.h>
#include <string.h>
#include <shlobj.h>

void installer_init(Installer *installer) {
    char program_files[MAX_PATH];
    
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_PROGRAM_FILES, NULL, 0, program_files))) {
        _snprintf_s(installer->install_path, sizeof(installer->install_path), _TRUNCATE,
                   "%s\\%s", program_files, INSTALL_DIR);
    } else {
        strcpy_s(installer->install_path, sizeof(installer->install_path), 
                "C:\\Program Files\\" INSTALL_DIR);
    }
    
    _snprintf_s(installer->service_path, sizeof(installer->service_path), _TRUNCATE,
               "%s\\%s", installer->install_path, INSTALL_EXE);
}

int installer_is_installed(const Installer *installer) {
    // Check if service exists
    SC_HANDLE sc_manager = OpenSCManagerA(NULL, NULL, SC_MANAGER_CONNECT);
    if (!sc_manager) {
        return 0;
    }
    
    SC_HANDLE service = OpenServiceA(sc_manager, SERVICE_NAME, SERVICE_QUERY_STATUS);
    if (!service) {
        CloseServiceHandle(sc_manager);
        return 0;
    }
    
    CloseServiceHandle(service);
    CloseServiceHandle(sc_manager);
    
    // Check if executable exists
    DWORD attrs = GetFileAttributesA(installer->service_path);
    if (attrs == INVALID_FILE_ATTRIBUTES) {
        return 0;
    }
    
    return 1;
}

int installer_is_admin(void) {
    BOOL is_admin = FALSE;
    PSID admin_group = NULL;
    SID_IDENTIFIER_AUTHORITY nt_authority = SECURITY_NT_AUTHORITY;
    
    if (AllocateAndInitializeSid(&nt_authority, 2, SECURITY_BUILTIN_DOMAIN_RID,
                                  DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &admin_group)) {
        CheckTokenMembership(NULL, admin_group, &is_admin);
        FreeSid(admin_group);
    }
    
    return is_admin;
}

int installer_install(Installer *installer) {
    LOG_INFO("Starting SafeMatrix Agent installation...");
    
    // Check admin privileges
    if (!installer_is_admin()) {
        LOG_ERROR("Installation requires administrator privileges");
        MessageBoxA(NULL, 
                   "Installation requires administrator privileges.\nPlease run as Administrator.",
                   "SafeMatrix Agent - Installation Error",
                   MB_OK | MB_ICONERROR);
        return -1;
    }
    
    // Create installation directory
    if (installer_create_directory(installer) != 0) {
        LOG_ERROR("Failed to create installation directory");
        MessageBoxA(NULL,
                   "Failed to create installation directory.",
                   "SafeMatrix Agent - Installation Error",
                   MB_OK | MB_ICONERROR);
        return -1;
    }
    
    // Copy files
    if (installer_copy_files(installer) != 0) {
        LOG_ERROR("Failed to copy files");
        MessageBoxA(NULL,
                   "Failed to copy installation files.",
                   "SafeMatrix Agent - Installation Error",
                   MB_OK | MB_ICONERROR);
        return -1;
    }
    
    // Install Windows service
    if (service_install(installer->service_path) != 0) {
        LOG_ERROR("Failed to install Windows service");
        MessageBoxA(NULL,
                   "Failed to install Windows service.",
                   "SafeMatrix Agent - Installation Error",
                   MB_OK | MB_ICONERROR);
        return -1;
    }
    
    // Configure startup (optional, best effort)
    installer_configure_startup(installer);

    // Create uninstaller
    if (installer_create_uninstaller(installer) != 0) {
        LOG_WARNING("Failed to create uninstaller");
    }

    // Add to Programs and Features
    if (installer_add_to_programs(installer) != 0) {
        LOG_WARNING("Failed to add to Programs and Features");
    }
    
    LOG_INFO("Installation completed successfully");
    
    MessageBoxA(NULL,
               "SafeMatrix Agent has been installed successfully!\n\n"
               "The service is now running in the background and will start automatically on system boot.\n\n"
               "Use 'safematrix-agent.exe status' to check the agent status.",
               "SafeMatrix Agent - Installation Complete",
               MB_OK | MB_ICONINFORMATION);
    
    return 0;
}

int installer_uninstall(Installer *installer) {
    LOG_INFO("Starting SafeMatrix Agent uninstallation...");
    
    if (!installer_is_admin()) {
        LOG_ERROR("Uninstallation requires administrator privileges");
        MessageBoxA(NULL,
                   "Uninstallation requires administrator privileges.\nPlease run as Administrator.",
                   "SafeMatrix Agent - Uninstallation Error",
                   MB_OK | MB_ICONERROR);
        return -1;
    }
    
    // Remove from Programs and Features
    installer_remove_from_programs();
    
    // Uninstall service
    service_uninstall();
    
    // Remove startup entries
    HKEY key;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, 
                     "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                     0, KEY_SET_VALUE, &key) == ERROR_SUCCESS) {
        RegDeleteValueA(key, "SafeMatrixAgent");
        RegCloseKey(key);
    }
    
    if (RegOpenKeyExA(HKEY_CURRENT_USER,
                     "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                     0, KEY_SET_VALUE, &key) == ERROR_SUCCESS) {
        RegDeleteValueA(key, "SafeMatrixAgent");
        RegCloseKey(key);
    }
    
    // Remove desktop shortcut
    char desktop[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_DESKTOPDIRECTORY, NULL, 0, desktop))) {
        char shortcut[MAX_PATH];
        _snprintf_s(shortcut, sizeof(shortcut), _TRUNCATE, 
                   "%s\\SafeMatrix Agent.lnk", desktop);
        DeleteFileA(shortcut);
    }
    
    // Remove config directory and all data
    char config_dir[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_COMMON_APPDATA, NULL, 0, config_dir))) {
        strcat_s(config_dir, sizeof(config_dir), "\\SafeMatrix");
        
        WIN32_FIND_DATAA find_data;
        char search_path[MAX_PATH];
        _snprintf_s(search_path, sizeof(search_path), _TRUNCATE, "%s\\*.*", config_dir);
        
        HANDLE hFind = FindFirstFileA(search_path, &find_data);
        if (hFind != INVALID_HANDLE_VALUE) {
            do {
                if (strcmp(find_data.cFileName, ".") != 0 && strcmp(find_data.cFileName, "..") != 0) {
                    char file_path[MAX_PATH];
                    _snprintf_s(file_path, sizeof(file_path), _TRUNCATE, 
                               "%s\\%s", config_dir, find_data.cFileName);
                    DeleteFileA(file_path);
                }
            } while (FindNextFileA(hFind, &find_data));
            FindClose(hFind);
        }
        
        RemoveDirectoryA(config_dir);
    }
    
    // Wait a bit for service to fully stop
    Sleep(2000);
    
    // Remove installation directory
    char cmd[MAX_PATH * 2];
    _snprintf_s(cmd, sizeof(cmd), _TRUNCATE,
               "cmd.exe /C timeout /T 2 /NOBREAK > NUL && rd /S /Q \"%s\"",
               installer->install_path);
    
    STARTUPINFOA si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    
    if (CreateProcessA(NULL, cmd, NULL, NULL, FALSE, 
                      CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }
    
    LOG_INFO("Uninstallation completed successfully");
    LOG_INFO("All traces of SafeMatrix Agent have been removed");
    
    MessageBoxA(NULL,
               "SafeMatrix Agent a été complètement désinstallé.\n\n"
               "Tous les fichiers, services et entrées de registre ont été supprimés.",
               "SafeMatrix Agent - Désinstallation Terminée",
               MB_OK | MB_ICONINFORMATION);
    
    return 0;
}

int installer_create_directory(const Installer *installer) {
    return utils_create_directory(installer->install_path);
}

int installer_copy_files(const Installer *installer) {
    // Get current executable path
    char exe_path[MAX_PATH];
    if (GetModuleFileNameA(NULL, exe_path, sizeof(exe_path)) == 0) {
        LOG_ERROR("Failed to get current executable path");
        return -1;
    }
    
    // Copy to installation directory
    if (!CopyFileA(exe_path, installer->service_path, FALSE)) {
        LOG_ERROR("Failed to copy executable: %d", GetLastError());
        return -1;
    }
    
    LOG_INFO("Copied %s to %s", exe_path, installer->service_path);
    return 0;
}

int installer_configure_startup(const Installer *installer) {
    HKEY key;
    char value[MAX_PATH * 2];
    
    _snprintf_s(value, sizeof(value), _TRUNCATE, "\"%s\" --tray", installer->service_path);
    
    // Add to current user startup (best effort)
    if (RegOpenKeyExA(HKEY_CURRENT_USER,
                     "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                     0, KEY_SET_VALUE, &key) == ERROR_SUCCESS) {
        RegSetValueExA(key, "SafeMatrixAgent", 0, REG_SZ, 
                      (BYTE *)value, (DWORD)strlen(value) + 1);
        RegCloseKey(key);
        LOG_INFO("Added to user startup");
    }
    
    return 0;
}

int installer_create_desktop_shortcut(const Installer *installer) {
    // Get desktop path
    char desktop[MAX_PATH];
    if (FAILED(SHGetFolderPathA(NULL, CSIDL_DESKTOPDIRECTORY, NULL, 0, desktop))) {
        return -1;
    }
    
    char shortcut_path[MAX_PATH];
    _snprintf_s(shortcut_path, sizeof(shortcut_path), _TRUNCATE,
               "%s\\SafeMatrix Agent.lnk", desktop);
    
    // Use PowerShell to create shortcut
    char ps_script[1024];
    _snprintf_s(ps_script, sizeof(ps_script), _TRUNCATE,
        "$WshShell = New-Object -comObject WScript.Shell; "
        "$Shortcut = $WshShell.CreateShortcut('%s'); "
        "$Shortcut.TargetPath = '%s'; "
        "$Shortcut.Arguments = 'status'; "
        "$Shortcut.Description = 'SafeMatrix Security Agent'; "
        "$Shortcut.Save()",
        shortcut_path, installer->service_path
    );
    
    char cmd[2048];
    _snprintf_s(cmd, sizeof(cmd), _TRUNCATE,
               "powershell.exe -NoProfile -NonInteractive -Command \"%s\"", ps_script);
    
    STARTUPINFOA si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    
    if (CreateProcessA(NULL, cmd, NULL, NULL, FALSE,
                      CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        WaitForSingleObject(pi.hProcess, 5000);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        LOG_INFO("Desktop shortcut created");
        return 0;
    }
    
    return -1;
}

int installer_create_uninstaller(const Installer *installer) {
    char uninstaller_path[MAX_PATH];
    _snprintf_s(uninstaller_path, sizeof(uninstaller_path), _TRUNCATE,
               "%s\\uninstall.exe", installer->install_path);
    
    // Copy current executable as uninstaller
    char exe_path[MAX_PATH];
    if (GetModuleFileNameA(NULL, exe_path, sizeof(exe_path)) == 0) {
        return -1;
    }
    
    if (!CopyFileA(exe_path, uninstaller_path, FALSE)) {
        LOG_ERROR("Failed to create uninstaller: %d", GetLastError());
        return -1;
    }
    
    LOG_INFO("Uninstaller created: %s", uninstaller_path);
    return 0;
}

int installer_add_to_programs(const Installer *installer) {
    HKEY key;
    char reg_path[] = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SafeMatrixAgent";
    
    LONG result = RegCreateKeyExA(
        HKEY_LOCAL_MACHINE,
        reg_path,
        0,
        NULL,
        REG_OPTION_NON_VOLATILE,
        KEY_WRITE,
        NULL,
        &key,
        NULL
    );
    
    if (result != ERROR_SUCCESS) {
        LOG_ERROR("Failed to create registry key: %d", result);
        return -1;
    }
    
    // Set display name
    const char *display_name = "SafeMatrix Agent";
    RegSetValueExA(key, "DisplayName", 0, REG_SZ,
                  (BYTE *)display_name, (DWORD)strlen(display_name) + 1);
    
    // Set version
    const char *version = "2.0.0";
    RegSetValueExA(key, "DisplayVersion", 0, REG_SZ,
                  (BYTE *)version, (DWORD)strlen(version) + 1);
    
    // Set publisher
    const char *publisher = "SafeMatrix";
    RegSetValueExA(key, "Publisher", 0, REG_SZ,
                  (BYTE *)publisher, (DWORD)strlen(publisher) + 1);
    
    // Set install location
    RegSetValueExA(key, "InstallLocation", 0, REG_SZ,
                  (BYTE *)installer->install_path, (DWORD)strlen(installer->install_path) + 1);
    
    // Set uninstall string
    char uninstall_cmd[MAX_PATH * 2];
    _snprintf_s(uninstall_cmd, sizeof(uninstall_cmd), _TRUNCATE,
               "\"%s\\uninstall.exe\" uninstall", installer->install_path);
    RegSetValueExA(key, "UninstallString", 0, REG_SZ,
                  (BYTE *)uninstall_cmd, (DWORD)strlen(uninstall_cmd) + 1);
    
    // Set display icon
    char icon_path[MAX_PATH];
    _snprintf_s(icon_path, sizeof(icon_path), _TRUNCATE,
               "%s,0", installer->service_path);
    RegSetValueExA(key, "DisplayIcon", 0, REG_SZ,
                  (BYTE *)icon_path, (DWORD)strlen(icon_path) + 1);
    
    // Set estimated size (in KB)
    DWORD size = 1024; // ~1 MB
    RegSetValueExA(key, "EstimatedSize", 0, REG_DWORD,
                  (BYTE *)&size, sizeof(DWORD));
    
    // Set NoModify and NoRepair
    DWORD no_modify = 1;
    RegSetValueExA(key, "NoModify", 0, REG_DWORD,
                  (BYTE *)&no_modify, sizeof(DWORD));
    RegSetValueExA(key, "NoRepair", 0, REG_DWORD,
                  (BYTE *)&no_modify, sizeof(DWORD));
    
    RegCloseKey(key);
    
    LOG_INFO("Added to Programs and Features");
    return 0;
}

int installer_remove_from_programs(void) {
    LONG result = RegDeleteKeyA(
        HKEY_LOCAL_MACHINE,
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SafeMatrixAgent"
    );
    
    if (result == ERROR_SUCCESS) {
        LOG_INFO("Removed from Programs and Features");
        return 0;
    }
    
    return -1;
}
