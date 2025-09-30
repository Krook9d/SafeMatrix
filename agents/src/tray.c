#include "tray.h"
#include "service.h"
#include "logger.h"
#include "config.h"
#include <stdio.h>
#include <shellapi.h>
#include <commctrl.h>

static NOTIFYICONDATAA nid;
static HWND g_hwnd = NULL;

int tray_init(HINSTANCE hInstance) {
    // Register window class
    WNDCLASSEXA wc = {0};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.lpfnWndProc = tray_window_proc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "SafeMatrixTrayClass";
    wc.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(1));
    wc.hIconSm = LoadIcon(hInstance, MAKEINTRESOURCE(1));
    
    if (!RegisterClassExA(&wc)) {
        return -1;
    }
    
    // Create hidden window
    g_hwnd = CreateWindowExA(
        0,
        "SafeMatrixTrayClass",
        "SafeMatrix Agent",
        0,
        0, 0, 0, 0,
        NULL, NULL, hInstance, NULL
    );
    
    if (!g_hwnd) {
        return -1;
    }
    
    return 0;
}

int tray_add_icon(HWND hwnd) {
    memset(&nid, 0, sizeof(NOTIFYICONDATAA));
    nid.cbSize = sizeof(NOTIFYICONDATAA);
    nid.hWnd = hwnd;
    nid.uID = TRAY_ICON_ID;
    nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP | NIF_INFO;
    nid.uCallbackMessage = WM_TRAYICON;
    
    // Get module handle
    HINSTANCE hInstance = GetModuleHandle(NULL);
    
    // Try multiple methods to load the icon
    // Method 1: Load small icon from resources (16x16)
    nid.hIcon = (HICON)LoadImageA(hInstance, MAKEINTRESOURCEA(1), IMAGE_ICON, 
                                   GetSystemMetrics(SM_CXSMICON), 
                                   GetSystemMetrics(SM_CYSMICON), 
                                   LR_DEFAULTCOLOR);
    
    if (!nid.hIcon) {
        // Method 2: Try loading with different size
        nid.hIcon = (HICON)LoadImageA(hInstance, MAKEINTRESOURCEA(1), IMAGE_ICON, 
                                       16, 16, LR_DEFAULTCOLOR);
    }
    
    if (!nid.hIcon) {
        // Method 3: Standard icon loading
        nid.hIcon = LoadIconA(hInstance, MAKEINTRESOURCEA(1));
    }
    
    if (!nid.hIcon) {
        // Method 4: Extract icon from executable
        char exe_path[MAX_PATH];
        GetModuleFileNameA(NULL, exe_path, sizeof(exe_path));
        ExtractIconExA(exe_path, 0, NULL, &nid.hIcon, 1);
    }
    
    if (!nid.hIcon) {
        // Last resort: use Windows default shield icon (admin)
        nid.hIcon = LoadIcon(NULL, IDI_SHIELD);
        LOG_WARNING("Using default Windows icon for tray");
    }
    
    strcpy_s(nid.szTip, sizeof(nid.szTip), "SafeMatrix Agent - Active");
    
    BOOL result = Shell_NotifyIconA(NIM_ADD, &nid);
    if (!result) {
        DWORD error = GetLastError();
        LOG_ERROR("Failed to add tray icon: error %d", error);
        return -1;
    }
    
    LOG_INFO("Tray icon added successfully");
    return 0;
}

void tray_remove_icon(HWND hwnd) {
    nid.hWnd = hwnd;
    nid.uID = TRAY_ICON_ID;
    Shell_NotifyIconA(NIM_DELETE, &nid);
}

void tray_show_menu(HWND hwnd) {
    POINT pt;
    GetCursorPos(&pt);
    
    HMENU hMenu = CreatePopupMenu();
    
    // Add menu items
    AppendMenuA(hMenu, MF_STRING, ID_TRAY_STATUS, "Status");
    AppendMenuA(hMenu, MF_STRING, ID_TRAY_CONFIG, "Configuration");
    AppendMenuA(hMenu, MF_STRING, ID_TRAY_SCAN, "Run Scan Now");
    AppendMenuA(hMenu, MF_SEPARATOR, 0, NULL);
    AppendMenuA(hMenu, MF_STRING, ID_TRAY_ABOUT, "About");
    AppendMenuA(hMenu, MF_SEPARATOR, 0, NULL);
    AppendMenuA(hMenu, MF_STRING, ID_TRAY_EXIT, "Exit");
    
    // Required for popup menu to work correctly
    SetForegroundWindow(hwnd);
    
    TrackPopupMenu(hMenu, TPM_BOTTOMALIGN | TPM_LEFTALIGN,
                   pt.x, pt.y, 0, hwnd, NULL);
    
    DestroyMenu(hMenu);
}

static void show_about_dialog(HWND hwnd) {
    MessageBoxA(hwnd,
        "SafeMatrix Agent v2.1.0\n\n"
        "Professional Security Monitoring Agent\n\n"
        "Features:\n"
        "• Continuous system monitoring\n"
        "• Automatic software inventory\n"
        "• Vulnerability detection\n"
        "• Real-time synchronization\n\n"
        "© 2025 SafeMatrix",
        "About SafeMatrix Agent",
        MB_OK | MB_ICONINFORMATION);
}

static void show_status_dialog(HWND hwnd) {
    char message[1024];
    
    // Check service status
    SC_HANDLE sc_manager = OpenSCManagerA(NULL, NULL, SC_MANAGER_CONNECT);
    if (sc_manager) {
        SC_HANDLE service = OpenServiceA(sc_manager, SERVICE_NAME, SERVICE_QUERY_STATUS);
        if (service) {
            SERVICE_STATUS status;
            if (QueryServiceStatus(service, &status)) {
                const char *state = "UNKNOWN";
                switch (status.dwCurrentState) {
                    case SERVICE_RUNNING: state = "RUNNING"; break;
                    case SERVICE_STOPPED: state = "STOPPED"; break;
                    case SERVICE_START_PENDING: state = "STARTING"; break;
                    case SERVICE_STOP_PENDING: state = "STOPPING"; break;
                }
                
                Config config;
                if (config_load(&config) == 0) {
                    _snprintf_s(message, sizeof(message), _TRUNCATE,
                        "Service Status: %s\n\n"
                        "Server: %s:%d\n"
                        "Agent ID: %s\n"
                        "Scan Interval: %d minutes\n\n"
                        "The agent is monitoring your system and\n"
                        "synchronizing with the SafeMatrix server.",
                        state, config.server_host, config.server_port,
                        config.agent_id, config.collect_interval);
                } else {
                    _snprintf_s(message, sizeof(message), _TRUNCATE,
                        "Service Status: %s\n\n"
                        "Configuration not found.\n"
                        "Please run configuration setup.",
                        state);
                }
            } else {
                strcpy_s(message, sizeof(message), "Failed to query service status.");
            }
            CloseServiceHandle(service);
        } else {
            strcpy_s(message, sizeof(message), "Service not found.\nPlease reinstall the agent.");
        }
        CloseServiceHandle(sc_manager);
    } else {
        strcpy_s(message, sizeof(message), "Failed to access Service Control Manager.");
    }
    
    MessageBoxA(hwnd, message, "SafeMatrix Agent Status", MB_OK | MB_ICONINFORMATION);
}

static void show_config_dialog(HWND hwnd) {
    MessageBoxA(hwnd,
        "To configure the agent, please run:\n\n"
        "safematrix-agent.exe config --host <server-ip>\n"
        "safematrix-agent.exe config --port <port>\n\n"
        "Then restart the service:\n"
        "net stop SafeMatrixAgent\n"
        "net start SafeMatrixAgent",
        "Configuration",
        MB_OK | MB_ICONINFORMATION);
}

static void run_manual_scan(HWND hwnd) {
    int result = MessageBoxA(hwnd,
        "This will run a manual inventory scan.\n"
        "This may take a few moments.\n\n"
        "Continue?",
        "Run Manual Scan",
        MB_YESNO | MB_ICONQUESTION);
    
    if (result == IDYES) {
        // Run scan in background
        char exe_path[MAX_PATH];
        GetModuleFileNameA(NULL, exe_path, sizeof(exe_path));
        
        STARTUPINFOA si = {sizeof(si)};
        PROCESS_INFORMATION pi;
        
        char cmd[MAX_PATH + 20];
        _snprintf_s(cmd, sizeof(cmd), _TRUNCATE, "\"%s\" scan", exe_path);
        
        if (CreateProcessA(NULL, cmd, NULL, NULL, FALSE,
                          CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            
            MessageBoxA(hwnd,
                "Manual scan started.\n"
                "Check the logs for results.",
                "Scan Started",
                MB_OK | MB_ICONINFORMATION);
        } else {
            MessageBoxA(hwnd,
                "Failed to start scan.",
                "Error",
                MB_OK | MB_ICONERROR);
        }
    }
}

LRESULT CALLBACK tray_window_proc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_TRAYICON:
            if (lParam == WM_RBUTTONUP || lParam == WM_LBUTTONUP) {
                tray_show_menu(hwnd);
            }
            break;
            
        case WM_COMMAND:
            switch (LOWORD(wParam)) {
                case ID_TRAY_ABOUT:
                    show_about_dialog(hwnd);
                    break;
                    
                case ID_TRAY_STATUS:
                    show_status_dialog(hwnd);
                    break;
                    
                case ID_TRAY_CONFIG:
                    show_config_dialog(hwnd);
                    break;
                    
                case ID_TRAY_SCAN:
                    run_manual_scan(hwnd);
                    break;
                    
                case ID_TRAY_EXIT:
                    tray_remove_icon(hwnd);
                    PostQuitMessage(0);
                    break;
            }
            break;
            
        case WM_DESTROY:
            tray_remove_icon(hwnd);
            PostQuitMessage(0);
            break;
            
        default:
            return DefWindowProc(hwnd, msg, wParam, lParam);
    }
    return 0;
}

int tray_run(HINSTANCE hInstance) {
    if (tray_init(hInstance) != 0) {
        LOG_ERROR("Failed to initialize tray");
        return -1;
    }
    
    if (tray_add_icon(g_hwnd) != 0) {
        LOG_ERROR("Failed to add tray icon");
        return -1;
    }
    
    LOG_INFO("System tray initialized");
    
    // Message loop
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    return 0;
}
