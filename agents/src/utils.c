#include "utils.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <ctype.h>
#include <shlobj.h>

void utils_get_timestamp(char *buffer, size_t size) {
    time_t now = time(NULL);
    struct tm timeinfo;
    localtime_s(&timeinfo, &now);
    strftime(buffer, size, "%Y-%m-%d %H:%M:%S", &timeinfo);
}

int utils_get_hostname(char *hostname, size_t size) {
    DWORD buffer_size = (DWORD)size;
    if (GetComputerNameA(hostname, &buffer_size)) {
        return 0;
    }
    strcpy_s(hostname, size, "unknown");
    return -1;
}

void utils_get_config_dir(char *path, size_t size) {
    char appdata[MAX_PATH];
    
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_COMMON_APPDATA, NULL, 0, appdata))) {
        _snprintf_s(path, size, _TRUNCATE, "%s\\SafeMatrix", appdata);
    } else {
        _snprintf_s(path, size, _TRUNCATE, "C:\\ProgramData\\SafeMatrix");
    }
}

int utils_create_directory(const char *path) {
    char temp_path[MAX_PATH];
    strcpy_s(temp_path, sizeof(temp_path), path);
    
    for (char *p = temp_path + 3; *p; p++) {
        if (*p == '\\' || *p == '/') {
            *p = '\0';
            CreateDirectoryA(temp_path, NULL);
            *p = '\\';
        }
    }
    
    return CreateDirectoryA(temp_path, NULL) ? 0 : (GetLastError() == ERROR_ALREADY_EXISTS ? 0 : -1);
}

char* utils_trim(char *str) {
    // Trim leading spaces
    while (isspace((unsigned char)*str)) str++;
    
    if (*str == 0) return str;
    
    // Trim trailing spaces
    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;
    
    end[1] = '\0';
    return str;
}

int utils_starts_with(const char *str, const char *prefix) {
    return strncmp(str, prefix, strlen(prefix)) == 0;
}

int utils_contains(const char *str, const char *substr) {
    return strstr(str, substr) != NULL;
}

void utils_to_lower(char *str) {
    for (; *str; str++) {
        *str = (char)tolower((unsigned char)*str);
    }
}

void utils_sleep_ms(int milliseconds) {
    Sleep(milliseconds);
}
