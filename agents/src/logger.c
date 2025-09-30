#include "logger.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <time.h>
#include <windows.h>

static FILE *log_file = NULL;
static CRITICAL_SECTION log_mutex;
static int logger_initialized = 0;

static const char* log_level_strings[] = {
    "DEBUG",
    "INFO",
    "WARNING",
    "ERROR"
};

int logger_init(const char *log_file_path) {
    if (logger_initialized) {
        return 0;
    }
    
    InitializeCriticalSection(&log_mutex);
    
    errno_t err = fopen_s(&log_file, log_file_path, "a");
    if (err != 0 || log_file == NULL) {
        fprintf(stderr, "Failed to open log file: %s\n", log_file_path);
        return -1;
    }
    
    logger_initialized = 1;
    logger_log(LOG_INFO, "=== SafeMatrix Agent started ===");
    return 0;
}

void logger_close(void) {
    if (!logger_initialized) {
        return;
    }
    
    logger_log(LOG_INFO, "=== SafeMatrix Agent stopped ===");
    
    EnterCriticalSection(&log_mutex);
    if (log_file) {
        fclose(log_file);
        log_file = NULL;
    }
    LeaveCriticalSection(&log_mutex);
    
    DeleteCriticalSection(&log_mutex);
    logger_initialized = 0;
}

void logger_log(LogLevel level, const char *format, ...) {
    if (!logger_initialized && log_file == NULL) {
        // Fallback to stderr
        va_list args;
        va_start(args, format);
        vfprintf(stderr, format, args);
        fprintf(stderr, "\n");
        va_end(args);
        return;
    }
    
    EnterCriticalSection(&log_mutex);
    
    // Get timestamp
    char timestamp[64];
    utils_get_timestamp(timestamp, sizeof(timestamp));
    
    // Write to file
    fprintf(log_file, "[%s] [%s] ", timestamp, log_level_strings[level]);
    
    va_list args;
    va_start(args, format);
    vfprintf(log_file, format, args);
    va_end(args);
    
    fprintf(log_file, "\n");
    fflush(log_file);
    
    // Also write to console for errors
    if (level >= LOG_WARNING) {
        fprintf(stderr, "[%s] [%s] ", timestamp, log_level_strings[level]);
        va_start(args, format);
        vfprintf(stderr, format, args);
        va_end(args);
        fprintf(stderr, "\n");
    }
    
    LeaveCriticalSection(&log_mutex);
}
