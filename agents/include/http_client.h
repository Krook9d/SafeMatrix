#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include <windows.h>
#include <winhttp.h>

typedef struct {
    HINTERNET session;
    HINTERNET connection;
    char server_host[256];
    int server_port;
} HttpClient;

// Initialize HTTP client
int http_client_init(HttpClient *client, const char *server_host, int server_port);

// Close HTTP client
void http_client_close(HttpClient *client);

// Send POST request
int http_client_post(HttpClient *client, const char *path, const char *json_data, 
                     char *response, size_t response_size);

// Send GET request
int http_client_get(HttpClient *client, const char *path, char *response, size_t response_size);

// Test connection to server
int http_client_test_connection(HttpClient *client);

#endif // HTTP_CLIENT_H
