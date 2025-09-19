package service

import (
	"fmt"
	"log"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
	"golang.org/x/sys/windows/svc/eventlog"

	"safematrix-agent/internal/api"
	"safematrix-agent/internal/config"
	"safematrix-agent/internal/inventory"
)

const serviceName = "SafeMatrixAgent"

// SafeMatrixService implements the Windows service
type SafeMatrixService struct {
	config    *config.Config
	stopCh    chan bool
	logger    *log.Logger
}

// NewSafeMatrixService creates a new service instance
func NewSafeMatrixService() *SafeMatrixService {
	cfg, err := config.Load()
	if err != nil {
		cfg = config.DefaultConfig()
	}

	return &SafeMatrixService{
		config: cfg,
		stopCh: make(chan bool),
	}
}

// Execute implements the Windows service interface
func (s *SafeMatrixService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (ssec bool, errno uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	// Initialize logging
	elog, err := eventlog.Open(serviceName)
	if err != nil {
		return
	}
	defer elog.Close()

	elog.Info(1, fmt.Sprintf("%s service started", serviceName))

	// Start the monitoring in the background
	go s.startMonitoring(elog)

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

	// Service loop
loop:
	for {
		select {
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				elog.Info(1, fmt.Sprintf("%s service stopping", serviceName))
				s.stopCh <- true
				break loop
			case svc.Pause:
				// We don't support pause/continue, so we ignore it.
			case svc.Continue:
				// We don't support pause/continue, so we ignore it.
			default:
				elog.Error(1, fmt.Sprintf("unexpected control request #%d", c))
			}
		}
	}

	changes <- svc.Status{State: svc.StopPending}
	return
}

// startMonitoring starts the continuous monitoring process
func (s *SafeMatrixService) startMonitoring(elog *eventlog.Log) {
	elog.Info(1, "Starting SafeMatrix monitoring...")

	// Perform initial scan
	s.performScan(elog)

	// Setup 5-minute ticker for automatic scanning
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			elog.Info(1, "Stopping SafeMatrix monitoring...")
			return
		case <-ticker.C:
			s.performScan(elog)
		}
	}
}

// performScan performs a security scan
func (s *SafeMatrixService) performScan(elog *eventlog.Log) {
	elog.Info(1, "Starting security scan...")

	// Collect inventory
	hostInfo, err := inventory.CollectInventory()
	if err != nil {
		elog.Error(1, fmt.Sprintf("Inventory collection failed: %v", err))
		return
	}

	// Send to server
	client := api.NewClient(s.config.GetServerURL())

	// Register host
	hostID, err := client.RegisterHost(hostInfo)
	if err != nil {
		elog.Error(1, fmt.Sprintf("Host registration failed: %v", err))
		return
	}

	// Submit inventory
	err = client.SubmitInventory(hostID, hostInfo)
	if err != nil {
		elog.Error(1, fmt.Sprintf("Inventory submission failed: %v", err))
		return
	}

	elog.Info(1, fmt.Sprintf("Security scan completed: %d software items scanned", len(hostInfo.Software)))

}

// RunService runs the application as a Windows service
func RunService(isDebug bool) error {
	service := NewSafeMatrixService()

	if isDebug {
		// Run in debug mode (console)
		return debug.Run(serviceName, service)
	} else {
		// Run as Windows service
		return svc.Run(serviceName, service)
	}
}

// IsWindowsService checks if running as a Windows service
func IsWindowsService() bool {
	isService, err := svc.IsWindowsService()
	return err == nil && isService
}
