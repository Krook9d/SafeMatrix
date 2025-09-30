#ifndef GUI_INSTALLER_H
#define GUI_INSTALLER_H

#include <windows.h>
#include "installer.h"

// Show installation wizard
int gui_installer_show(HINSTANCE hInstance, Installer *installer);

// Show progress dialog
void gui_installer_show_progress(HWND parent, const char *message);

// Show completion dialog
void gui_installer_show_complete(HWND parent, int success);

// Window procedure for installer
LRESULT CALLBACK installer_window_proc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);

#endif // GUI_INSTALLER_H
