#ifndef LOGGER_H
#define LOGGER_H

#include <stdio.h>

typedef enum {
    LOG_DEBUG,
    LOG_INFO,
    LOG_WARNING,
    LOG_ERROR
} LogLevel;

// Initialize logger
int logger_init(const char *log_file);

// Close logger
void logger_close(void);

// Log message
void logger_log(LogLevel level, const char *format, ...);

// Convenience macros
#define LOG_DEBUG(fmt, ...) logger_log(LOG_DEBUG, fmt, ##__VA_ARGS__)
#define LOG_INFO(fmt, ...) logger_log(LOG_INFO, fmt, ##__VA_ARGS__)
#define LOG_WARNING(fmt, ...) logger_log(LOG_WARNING, fmt, ##__VA_ARGS__)
#define LOG_ERROR(fmt, ...) logger_log(LOG_ERROR, fmt, ##__VA_ARGS__)

#endif // LOGGER_H
