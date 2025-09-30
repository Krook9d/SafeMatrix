#include "gui_installer.h"
#include "logger.h"
#include "config.h"
#include "http_client.h"
#include <commctrl.h>
#include <shlobj.h>
#include <stdio.h>

#define IDC_NEXT_BTN 2001
#define IDC_BACK_BTN 2002
#define IDC_CANCEL_BTN 2003
#define IDC_HOST_EDIT 2004
#define IDC_PORT_EDIT 2005
#define IDC_BROWSE_BTN 2006
#define IDC_PATH_EDIT 2007
#define IDC_TEST_BTN 2008
#define IDC_INSTALL_BTN 2009
#define IDC_FINISH_BTN 2010
#define IDC_PROGRESS 2011

#define PAGE_WELCOME 0
#define PAGE_DIRECTORY 1
#define PAGE_CONFIG 2
#define PAGE_INSTALLING 3
#define PAGE_COMPLETE 4

// Colors
#define COLOR_BG_LIGHT RGB(245, 245, 245)
#define COLOR_HEADER RGB(0, 120, 215)
#define COLOR_SUCCESS RGB(0, 135, 80)
#define COLOR_ERROR RGB(232, 17, 35)

typedef struct {
    Installer *installer;
    HWND hwnd;
    char server_host[256];
    int server_port;
    char install_path[MAX_PATH];
    int current_page;
    HFONT title_font;
    HFONT normal_font;
    HBRUSH bg_brush;
} InstallerData;

static InstallerData g_installer_data;

static void show_page(HWND hwnd, int page);
static void create_welcome_page(HWND hwnd);
static void create_directory_page(HWND hwnd);
static void create_config_page(HWND hwnd);
static void create_installing_page(HWND hwnd);
static void create_complete_page(HWND hwnd);
static void browse_folder(HWND hwnd);
static void test_connection(HWND hwnd);

static DWORD WINAPI install_thread(LPVOID lpParam) {
    InstallerData *data = (InstallerData *)lpParam;
    
    strcpy_s(data->installer->install_path, MAX_PATH, data->install_path);
    _snprintf_s(data->installer->service_path, MAX_PATH, _TRUNCATE,
               "%s\\safematrix-agent.exe", data->install_path);
    
    Config config;
    config_init_default(&config);
    strcpy_s(config.server_host, sizeof(config.server_host), data->server_host);
    config.server_port = data->server_port;
    config_save(&config);
    
    int result = installer_install(data->installer);
    PostMessage(data->hwnd, WM_USER + 100, result, 0);
    
    return 0;
}

static void create_fonts(void) {
    g_installer_data.title_font = CreateFontA(
        28, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE,
        DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
        CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Segoe UI");
    
    g_installer_data.normal_font = CreateFontA(
        18, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
        DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
        CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Segoe UI");
    
    g_installer_data.bg_brush = CreateSolidBrush(COLOR_BG_LIGHT);
}

static void create_welcome_page(HWND hwnd) {
    // Title
    HWND hTitle = CreateWindowA("STATIC", "Welcome",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 15, 640, 50,
        hwnd, (HMENU)3001, GetModuleHandle(NULL), NULL);
    SendMessage(hTitle, WM_SETFONT, (WPARAM)g_installer_data.title_font, TRUE);

    // Subtitle
    CreateWindowA("STATIC", "SafeMatrix Agent Installation",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 100, 640, 30,
        hwnd, (HMENU)3002, GetModuleHandle(NULL), NULL);

    // Description
    CreateWindowA("STATIC",
        "This wizard will install SafeMatrix Agent on your system.\r\n\r\n"
        "SafeMatrix Agent is a professional monitoring agent that:\r\n\r\n"
        "  - Provides real-time monitoring\r\n"
        "  - Automatically inventories installed software\r\n"
        "  - Detects vulnerabilities\r\n"
        "  - Synchronizes with the SafeMatrix server\r\n\r\n"
        "Click Next to continue.",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 145, 640, 240,
        hwnd, (HMENU)3003, GetModuleHandle(NULL), NULL);
}

static void create_directory_page(HWND hwnd) {
    HWND hTitle = CreateWindowA("STATIC", "Installation Directory",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 30, 640, 40,
        hwnd, (HMENU)3010, GetModuleHandle(NULL), NULL);
    SendMessage(hTitle, WM_SETFONT, (WPARAM)g_installer_data.title_font, TRUE);

    CreateWindowA("STATIC",
        "Choose the folder where SafeMatrix Agent will be installed.",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 85, 640, 25,
        hwnd, (HMENU)3011, GetModuleHandle(NULL), NULL);

    CreateWindowA("STATIC", "Destination folder:",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 130, 250, 25,
        hwnd, (HMENU)3012, GetModuleHandle(NULL), NULL);

    CreateWindowA("EDIT", g_installer_data.install_path,
        WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL | ES_READONLY,
        30, 160, 520, 28,
        hwnd, (HMENU)IDC_PATH_EDIT, GetModuleHandle(NULL), NULL);

    CreateWindowA("BUTTON", "Browse...",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        560, 160, 110, 28,
        hwnd, (HMENU)IDC_BROWSE_BTN, GetModuleHandle(NULL), NULL);

    CreateWindowA("STATIC",
        "Required space: ~1 MB",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 210, 640, 25,
        hwnd, (HMENU)3013, GetModuleHandle(NULL), NULL);
}

static void create_config_page(HWND hwnd) {
    HWND hTitle = CreateWindowA("STATIC", "Server Configuration",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 30, 640, 40,
        hwnd, (HMENU)3020, GetModuleHandle(NULL), NULL);
    SendMessage(hTitle, WM_SETFONT, (WPARAM)g_installer_data.title_font, TRUE);

    CreateWindowA("STATIC",
        "Configure the connection parameters to the SafeMatrix server.",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 85, 640, 25,
        hwnd, (HMENU)3021, GetModuleHandle(NULL), NULL);

    // Group box
    CreateWindowA("BUTTON", "SafeMatrix Server",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        20, 130, 660, 180,
        hwnd, (HMENU)3022, GetModuleHandle(NULL), NULL);

    CreateWindowA("STATIC", "Server address:",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        40, 165, 200, 25,
        hwnd, (HMENU)3023, GetModuleHandle(NULL), NULL);

    CreateWindowA("EDIT", g_installer_data.server_host,
        WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL,
        250, 162, 250, 28,
        hwnd, (HMENU)IDC_HOST_EDIT, GetModuleHandle(NULL), NULL);

    CreateWindowA("STATIC", "Port:",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        40, 205, 200, 25,
        hwnd, (HMENU)3024, GetModuleHandle(NULL), NULL);

    char port_str[16];
    _snprintf_s(port_str, sizeof(port_str), _TRUNCATE, "%d", g_installer_data.server_port);
    CreateWindowA("EDIT", port_str,
        WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL | ES_NUMBER,
        250, 202, 100, 28,
        hwnd, (HMENU)IDC_PORT_EDIT, GetModuleHandle(NULL), NULL);

    CreateWindowA("BUTTON", "Test Connection",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        40, 255, 200, 35,
        hwnd, (HMENU)IDC_TEST_BTN, GetModuleHandle(NULL), NULL);

    CreateWindowA("STATIC", "",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        250, 262, 400, 25,
        hwnd, (HMENU)3025, GetModuleHandle(NULL), NULL);
}

static void create_installing_page(HWND hwnd) {
    HWND hTitle = CreateWindowA("STATIC", "Installing...",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 30, 640, 40,
        hwnd, (HMENU)3030, GetModuleHandle(NULL), NULL);
    SendMessage(hTitle, WM_SETFONT, (WPARAM)g_installer_data.title_font, TRUE);

    CreateWindowA("STATIC", "Please wait while SafeMatrix Agent is being installed.",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 85, 640, 25,
        hwnd, (HMENU)3031, GetModuleHandle(NULL), NULL);

    HWND hProgress = CreateWindowA(PROGRESS_CLASS, NULL,
        WS_CHILD | WS_VISIBLE | PBS_MARQUEE,
        30, 130, 640, 30,
        hwnd, (HMENU)IDC_PROGRESS, GetModuleHandle(NULL), NULL);
    SendMessage(hProgress, PBM_SETMARQUEE, TRUE, 0);

    CreateWindowA("STATIC",
        "- Copying files...\r\n"
        "- Installing Windows service...\r\n"
        "- Configuring automatic startup...\r\n"
        "- Registering with system...",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 180, 640, 120,
        hwnd, (HMENU)3032, GetModuleHandle(NULL), NULL);
}

static void create_complete_page(HWND hwnd) {
    HWND hTitle = CreateWindowA("STATIC", "Installation Complete",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 30, 640, 40,
        hwnd, (HMENU)3040, GetModuleHandle(NULL), NULL);
    SendMessage(hTitle, WM_SETFONT, (WPARAM)g_installer_data.title_font, TRUE);

    CreateWindowA("STATIC",
        "SafeMatrix Agent has been installed successfully!\r\n\r\n"
        "The agent is now active and running in the background.\r\n"
        "An icon will appear in the system tray.\r\n\r\n"
        "Installed features:\r\n\r\n"
        "  [OK] Windows Service (automatic startup)\r\n"
        "  [OK] System tray icon\r\n"
        "  [OK] Automatic scans every 5 minutes\r\n"
        "  [OK] Server synchronization\r\n\r\n"
        "Click Finish to exit the wizard.",
        WS_CHILD | WS_VISIBLE | SS_LEFT,
        30, 85, 640, 300,
        hwnd, (HMENU)3041, GetModuleHandle(NULL), NULL);
}

static void hide_all_controls(HWND hwnd) {
    HWND hChild = GetWindow(hwnd, GW_CHILD);
    while (hChild) {
        int id = GetDlgCtrlID(hChild);
        if (id >= 3000 && id < 4000) {
            ShowWindow(hChild, SW_HIDE);
        }
        hChild = GetWindow(hChild, GW_HWNDNEXT);
    }
}

static void show_page(HWND hwnd, int page) {
    g_installer_data.current_page = page;
    hide_all_controls(hwnd);
    
    switch (page) {
        case PAGE_WELCOME:
            create_welcome_page(hwnd);
            EnableWindow(GetDlgItem(hwnd, IDC_BACK_BTN), FALSE);
            EnableWindow(GetDlgItem(hwnd, IDC_NEXT_BTN), TRUE);
            ShowWindow(GetDlgItem(hwnd, IDC_NEXT_BTN), SW_SHOW);
            ShowWindow(GetDlgItem(hwnd, IDC_INSTALL_BTN), SW_HIDE);
            ShowWindow(GetDlgItem(hwnd, IDC_FINISH_BTN), SW_HIDE);
            break;
            
        case PAGE_DIRECTORY:
            create_directory_page(hwnd);
            EnableWindow(GetDlgItem(hwnd, IDC_BACK_BTN), TRUE);
            EnableWindow(GetDlgItem(hwnd, IDC_NEXT_BTN), TRUE);
            break;
            
        case PAGE_CONFIG:
            create_config_page(hwnd);
            EnableWindow(GetDlgItem(hwnd, IDC_BACK_BTN), TRUE);
            ShowWindow(GetDlgItem(hwnd, IDC_NEXT_BTN), SW_HIDE);
            ShowWindow(GetDlgItem(hwnd, IDC_INSTALL_BTN), SW_SHOW);
            break;
            
        case PAGE_INSTALLING:
            create_installing_page(hwnd);
            EnableWindow(GetDlgItem(hwnd, IDC_BACK_BTN), FALSE);
            ShowWindow(GetDlgItem(hwnd, IDC_INSTALL_BTN), SW_HIDE);
            EnableWindow(GetDlgItem(hwnd, IDC_CANCEL_BTN), FALSE);
            CreateThread(NULL, 0, install_thread, &g_installer_data, 0, NULL);
            break;
            
        case PAGE_COMPLETE:
            create_complete_page(hwnd);
            ShowWindow(GetDlgItem(hwnd, IDC_FINISH_BTN), SW_SHOW);
            ShowWindow(GetDlgItem(hwnd, IDC_CANCEL_BTN), SW_HIDE);
            break;
    }
    
    InvalidateRect(hwnd, NULL, TRUE);
}

static void browse_folder(HWND hwnd) {
    BROWSEINFOA bi = {0};
    bi.hwndOwner = hwnd;
    bi.lpszTitle = "Select Installation Folder";
    bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;

    LPITEMIDLIST pidl = SHBrowseForFolderA(&bi);
    if (pidl != NULL) {
        char path[MAX_PATH];
        if (SHGetPathFromIDListA(pidl, path)) {
            strcat_s(path, MAX_PATH, "\\SafeMatrix\\Agent");
            strcpy_s(g_installer_data.install_path, MAX_PATH, path);
            SetDlgItemTextA(hwnd, IDC_PATH_EDIT, path);
        }
        CoTaskMemFree(pidl);
    }
}

static void test_connection(HWND hwnd) {
    char host[256];
    char port_str[16];
    GetDlgItemTextA(hwnd, IDC_HOST_EDIT, host, sizeof(host));
    GetDlgItemTextA(hwnd, IDC_PORT_EDIT, port_str, sizeof(port_str));
    int port = atoi(port_str);

    if (strlen(host) == 0 || port <= 0) {
        SetDlgItemTextA(hwnd, 3025, "[ERROR] Invalid parameters");
        return;
    }

    SetDlgItemTextA(hwnd, 3025, "Testing connection...");
    UpdateWindow(hwnd);

    HttpClient client;
    if (http_client_init(&client, host, port) == 0) {
        if (http_client_test_connection(&client) == 0) {
            SetDlgItemTextA(hwnd, 3025, "[SUCCESS] Connection successful!");
            strcpy_s(g_installer_data.server_host, sizeof(g_installer_data.server_host), host);
            g_installer_data.server_port = port;
        } else {
            SetDlgItemTextA(hwnd, 3025, "[ERROR] Server unreachable");
        }
        http_client_close(&client);
    } else {
        SetDlgItemTextA(hwnd, 3025, "[ERROR] Connection error");
    }
}

LRESULT CALLBACK installer_window_proc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            create_fonts();
            
            // Buttons at bottom
            CreateWindowA("BUTTON", "< Precedent",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                350, 420, 120, 35,
                hwnd, (HMENU)IDC_BACK_BTN, GetModuleHandle(NULL), NULL);
            
            CreateWindowA("BUTTON", "Suivant >",
                WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                480, 420, 120, 35,
                hwnd, (HMENU)IDC_NEXT_BTN, GetModuleHandle(NULL), NULL);
            
            CreateWindowA("BUTTON", "Installer",
                WS_CHILD | BS_DEFPUSHBUTTON,
                480, 420, 120, 35,
                hwnd, (HMENU)IDC_INSTALL_BTN, GetModuleHandle(NULL), NULL);
            
            CreateWindowA("BUTTON", "Terminer",
                WS_CHILD | BS_DEFPUSHBUTTON,
                480, 420, 120, 35,
                hwnd, (HMENU)IDC_FINISH_BTN, GetModuleHandle(NULL), NULL);
            
            CreateWindowA("BUTTON", "Annuler",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                610, 420, 90, 35,
                hwnd, (HMENU)IDC_CANCEL_BTN, GetModuleHandle(NULL), NULL);
            
            show_page(hwnd, PAGE_WELCOME);
            break;
        }
        
        case WM_CTLCOLORSTATIC: {
            HDC hdcStatic = (HDC)wParam;
            SetBkMode(hdcStatic, TRANSPARENT);
            return (LRESULT)g_installer_data.bg_brush;
        }
        
        case WM_COMMAND:
            switch (LOWORD(wParam)) {
                case IDC_NEXT_BTN:
                    if (g_installer_data.current_page < PAGE_CONFIG) {
                        show_page(hwnd, g_installer_data.current_page + 1);
                    }
                    break;
                
                case IDC_BACK_BTN:
                    if (g_installer_data.current_page > PAGE_WELCOME) {
                        show_page(hwnd, g_installer_data.current_page - 1);
                    }
                    break;
                
                case IDC_BROWSE_BTN:
                    browse_folder(hwnd);
                    break;
                
                case IDC_TEST_BTN:
                    test_connection(hwnd);
                    break;
                
                case IDC_INSTALL_BTN: {
                    char host[256], port_str[16];
                    GetDlgItemTextA(hwnd, IDC_HOST_EDIT, host, sizeof(host));
                    GetDlgItemTextA(hwnd, IDC_PORT_EDIT, port_str, sizeof(port_str));
                    
                    strcpy_s(g_installer_data.server_host, sizeof(g_installer_data.server_host), host);
                    g_installer_data.server_port = atoi(port_str);
                    
                    show_page(hwnd, PAGE_INSTALLING);
                    break;
                }
                
                case IDC_FINISH_BTN:
                case IDC_CANCEL_BTN:
                    DestroyWindow(hwnd);
                    break;
            }
            break;
        
        case WM_USER + 100: {
            int result = (int)wParam;
            
            if (result == 0) {
                char exe_path[MAX_PATH];
                GetModuleFileNameA(NULL, exe_path, sizeof(exe_path));

                STARTUPINFOA si = {sizeof(si)};
                PROCESS_INFORMATION pi;

                char cmd[MAX_PATH + 20];
                _snprintf_s(cmd, sizeof(cmd), _TRUNCATE, "\"%s\" --tray", exe_path);

                CreateProcessA(NULL, cmd, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
                if (pi.hProcess) {
                    CloseHandle(pi.hProcess);
                    CloseHandle(pi.hThread);
                }

                show_page(hwnd, PAGE_COMPLETE);
            } else {
                MessageBoxA(hwnd,
                    "Installation failed. Please check the logs.",
                    "Error",
                    MB_OK | MB_ICONERROR);
                show_page(hwnd, PAGE_CONFIG);
            }
            break;
        }
        
        case WM_CLOSE:
            if (g_installer_data.current_page == PAGE_INSTALLING) {
                MessageBoxA(hwnd,
                    "Installation in progress. Please wait.",
                    "Installation",
                    MB_OK | MB_ICONWARNING);
            } else {
                DestroyWindow(hwnd);
            }
            break;
            
        case WM_DESTROY:
            if (g_installer_data.title_font) DeleteObject(g_installer_data.title_font);
            if (g_installer_data.normal_font) DeleteObject(g_installer_data.normal_font);
            if (g_installer_data.bg_brush) DeleteObject(g_installer_data.bg_brush);
            PostQuitMessage(0);
            break;
            
        default:
            return DefWindowProc(hwnd, msg, wParam, lParam);
    }
    return 0;
}

int gui_installer_show(HINSTANCE hInstance, Installer *installer) {
    g_installer_data.installer = installer;
    strcpy_s(g_installer_data.server_host, sizeof(g_installer_data.server_host), "127.0.0.1");
    g_installer_data.server_port = 8000;
    strcpy_s(g_installer_data.install_path, MAX_PATH, installer->install_path);
    g_installer_data.current_page = PAGE_WELCOME;
    
    INITCOMMONCONTROLSEX icex;
    icex.dwSize = sizeof(INITCOMMONCONTROLSEX);
    icex.dwICC = ICC_PROGRESS_CLASS;
    InitCommonControlsEx(&icex);
    
    WNDCLASSEXA wc = {0};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.lpfnWndProc = installer_window_proc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "SafeMatrixInstallerClass";
    wc.hbrBackground = CreateSolidBrush(COLOR_BG_LIGHT);
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(1));
    wc.hIconSm = LoadIcon(hInstance, MAKEINTRESOURCE(1));
    
    if (!RegisterClassExA(&wc)) {
        return -1;
    }
    
    HWND hwnd = CreateWindowExA(
        0,
        "SafeMatrixInstallerClass",
        "SafeMatrix Agent - Installation",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        CW_USEDEFAULT, CW_USEDEFAULT,
        730, 540,
        NULL, NULL, hInstance, NULL
    );
    
    if (!hwnd) {
        return -1;
    }
    
    g_installer_data.hwnd = hwnd;
    
    RECT rect;
    GetWindowRect(hwnd, &rect);
    int x = (GetSystemMetrics(SM_CXSCREEN) - (rect.right - rect.left)) / 2;
    int y = (GetSystemMetrics(SM_CYSCREEN) - (rect.bottom - rect.top)) / 2;
    SetWindowPos(hwnd, NULL, x, y, 0, 0, SWP_NOSIZE | SWP_NOZORDER);
    
    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);
    
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    return 0;
}