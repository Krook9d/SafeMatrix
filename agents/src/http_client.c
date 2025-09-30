#include "http_client.h"
#include "logger.h"
#include <stdio.h>
#include <string.h>

int http_client_init(HttpClient *client, const char *server_host, int server_port) {
    memset(client, 0, sizeof(HttpClient));
    
    strcpy_s(client->server_host, sizeof(client->server_host), server_host);
    client->server_port = server_port;
    
    // Initialize WinHTTP
    client->session = WinHttpOpen(
        L"SafeMatrix Agent/1.0",
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0
    );
    
    if (!client->session) {
        LOG_ERROR("WinHttpOpen failed: %d", GetLastError());
        return -1;
    }
    
    // Set timeouts (in milliseconds)
    int timeout = 180000; // 180 seconds
    WinHttpSetOption(client->session, WINHTTP_OPTION_CONNECT_TIMEOUT, &timeout, sizeof(timeout));
    WinHttpSetOption(client->session, WINHTTP_OPTION_SEND_TIMEOUT, &timeout, sizeof(timeout));
    WinHttpSetOption(client->session, WINHTTP_OPTION_RECEIVE_TIMEOUT, &timeout, sizeof(timeout));
    
    // Convert host to wide string
    wchar_t host_wide[256];
    MultiByteToWideChar(CP_UTF8, 0, server_host, -1, host_wide, 256);
    
    // Connect to server
    client->connection = WinHttpConnect(
        client->session,
        host_wide,
        (INTERNET_PORT)server_port,
        0
    );
    
    if (!client->connection) {
        LOG_ERROR("WinHttpConnect failed: %d", GetLastError());
        WinHttpCloseHandle(client->session);
        return -1;
    }
    
    LOG_INFO("HTTP client initialized for %s:%d", server_host, server_port);
    return 0;
}

void http_client_close(HttpClient *client) {
    if (client->connection) {
        WinHttpCloseHandle(client->connection);
        client->connection = NULL;
    }
    if (client->session) {
        WinHttpCloseHandle(client->session);
        client->session = NULL;
    }
}

int http_client_post(HttpClient *client, const char *path, const char *json_data,
                     char *response, size_t response_size) {
    if (!client->connection) {
        LOG_ERROR("HTTP client not initialized");
        return -1;
    }
    
    // Convert path to wide string
    wchar_t path_wide[512];
    MultiByteToWideChar(CP_UTF8, 0, path, -1, path_wide, 512);
    
    // Open request
    HINTERNET request = WinHttpOpenRequest(
        client->connection,
        L"POST",
        path_wide,
        NULL,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        0
    );
    
    if (!request) {
        LOG_ERROR("WinHttpOpenRequest failed: %d", GetLastError());
        return -1;
    }
    
    // Set headers
    LPCWSTR headers = L"Content-Type: application/json\r\n";
    
    // Send request
    BOOL result = WinHttpSendRequest(
        request,
        headers,
        (DWORD)-1L,
        (LPVOID)json_data,
        (DWORD)strlen(json_data),
        (DWORD)strlen(json_data),
        0
    );
    
    if (!result) {
        LOG_ERROR("WinHttpSendRequest failed: %d", GetLastError());
        WinHttpCloseHandle(request);
        return -1;
    }
    
    // Receive response
    result = WinHttpReceiveResponse(request, NULL);
    if (!result) {
        LOG_ERROR("WinHttpReceiveResponse failed: %d", GetLastError());
        WinHttpCloseHandle(request);
        return -1;
    }
    
    // Check status code
    DWORD status_code = 0;
    DWORD status_code_size = sizeof(status_code);
    WinHttpQueryHeaders(request,
        WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        NULL,
        &status_code,
        &status_code_size,
        NULL
    );
    
    // Read response data
    DWORD bytes_available = 0;
    DWORD bytes_read = 0;
    char *ptr = response;
    size_t remaining = response_size - 1;
    
    while (WinHttpQueryDataAvailable(request, &bytes_available) && bytes_available > 0) {
        if (bytes_available > remaining) {
            bytes_available = (DWORD)remaining;
        }
        
        if (WinHttpReadData(request, ptr, bytes_available, &bytes_read)) {
            ptr += bytes_read;
            remaining -= bytes_read;
        } else {
            break;
        }
        
        if (remaining == 0) break;
    }
    *ptr = '\0';
    
    WinHttpCloseHandle(request);
    
    LOG_INFO("POST %s - Status: %d, Response size: %zu bytes", path, status_code, strlen(response));
    
    return (status_code >= 200 && status_code < 300) ? 0 : -1;
}

int http_client_get(HttpClient *client, const char *path, char *response, size_t response_size) {
    if (!client->connection) {
        LOG_ERROR("HTTP client not initialized");
        return -1;
    }
    
    wchar_t path_wide[512];
    MultiByteToWideChar(CP_UTF8, 0, path, -1, path_wide, 512);
    
    HINTERNET request = WinHttpOpenRequest(
        client->connection,
        L"GET",
        path_wide,
        NULL,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        0
    );
    
    if (!request) {
        LOG_ERROR("WinHttpOpenRequest failed: %d", GetLastError());
        return -1;
    }
    
    BOOL result = WinHttpSendRequest(
        request,
        WINHTTP_NO_ADDITIONAL_HEADERS,
        0,
        WINHTTP_NO_REQUEST_DATA,
        0,
        0,
        0
    );
    
    if (!result) {
        LOG_ERROR("WinHttpSendRequest failed: %d", GetLastError());
        WinHttpCloseHandle(request);
        return -1;
    }
    
    result = WinHttpReceiveResponse(request, NULL);
    if (!result) {
        LOG_ERROR("WinHttpReceiveResponse failed: %d", GetLastError());
        WinHttpCloseHandle(request);
        return -1;
    }
    
    DWORD status_code = 0;
    DWORD status_code_size = sizeof(status_code);
    WinHttpQueryHeaders(request,
        WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        NULL,
        &status_code,
        &status_code_size,
        NULL
    );
    
    DWORD bytes_available = 0;
    DWORD bytes_read = 0;
    char *ptr = response;
    size_t remaining = response_size - 1;
    
    while (WinHttpQueryDataAvailable(request, &bytes_available) && bytes_available > 0) {
        if (bytes_available > remaining) bytes_available = (DWORD)remaining;
        
        if (WinHttpReadData(request, ptr, bytes_available, &bytes_read)) {
            ptr += bytes_read;
            remaining -= bytes_read;
        } else {
            break;
        }
        
        if (remaining == 0) break;
    }
    *ptr = '\0';
    
    WinHttpCloseHandle(request);
    
    return (status_code >= 200 && status_code < 300) ? 0 : -1;
}

int http_client_test_connection(HttpClient *client) {
    char response[1024];
    int result = http_client_get(client, "/api/v1/health/opensearch", response, sizeof(response));
    
    if (result == 0) {
        LOG_INFO("Connection test successful");
    } else {
        LOG_ERROR("Connection test failed");
    }
    
    return result;
}
