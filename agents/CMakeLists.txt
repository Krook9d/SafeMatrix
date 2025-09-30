cmake_minimum_required(VERSION 3.15)
project(SafeMatrixAgent C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Add source files
set(SOURCES
    src/main.c
    src/config.c
    src/logger.c
    src/http_client.c
    src/inventory.c
    src/service.c
    src/installer.c
    src/utils.c
    src/json.c
    src/tray.c
    src/gui_installer.c
)

set(HEADERS
    include/config.h
    include/logger.h
    include/http_client.h
    include/inventory.h
    include/service.h
    include/installer.h
    include/utils.h
    include/json.h
    include/tray.h
    include/gui_installer.h
)

# Add Windows resources
if(MSVC)
    set(RESOURCES resources/app.rc)
    list(APPEND SOURCES ${RESOURCES})
endif()

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/include)

# Create executable
add_executable(safematrix-agent ${SOURCES} ${HEADERS})

# Link Windows libraries
target_link_libraries(safematrix-agent
    ws2_32      # Winsock
    winhttp     # WinHTTP
    advapi32    # Registry and Services
    ole32       # COM/OLE
    oleaut32    # OLE Automation
    wbemuuid    # WMI
    iphlpapi    # Network adapters
    userenv     # User environment
    shell32     # Shell functions
    comctl32    # Common Controls
    gdi32       # GDI
    user32      # User32
)

# Compiler flags for Windows
if(MSVC)
    target_compile_options(safematrix-agent PRIVATE /W4)
    # Use Windows subsystem (no console window)
    set_target_properties(safematrix-agent PROPERTIES
        LINK_FLAGS_RELEASE "/SUBSYSTEM:WINDOWS /ENTRY:WinMainCRTStartup"
        LINK_FLAGS_DEBUG "/SUBSYSTEM:WINDOWS /ENTRY:WinMainCRTStartup"
    )
else()
    target_compile_options(safematrix-agent PRIVATE -Wall -Wextra)
    # For MinGW, also use Windows subsystem
    set_target_properties(safematrix-agent PROPERTIES
        LINK_FLAGS "-mwindows"
    )
endif()

# Set output directory
set_target_properties(safematrix-agent PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# Install target
install(TARGETS safematrix-agent
    RUNTIME DESTINATION bin
)
