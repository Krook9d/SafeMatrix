#ifndef TRAY_H
#define TRAY_H

#include <windows.h>

#define TRAY_ICON_ID 1
#define WM_TRAYICON (WM_USER + 1)

// Menu IDs
#define ID_TRAY_ABOUT 1001
#define ID_TRAY_STATUS 1002
#define ID_TRAY_CONFIG 1003
#define ID_TRAY_SCAN 1004
#define ID_TRAY_EXIT 1005

// Initialize system tray
int tray_init(HINSTANCE hInstance);

// Add icon to system tray
int tray_add_icon(HWND hwnd);

// Remove icon from system tray
void tray_remove_icon(HWND hwnd);

// Show tray menu
void tray_show_menu(HWND hwnd);

// Message loop for tray
int tray_run(HINSTANCE hInstance);

// Window procedure
LRESULT CALLBACK tray_window_proc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);

#endif // TRAY_H
