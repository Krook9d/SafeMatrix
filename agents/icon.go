package main

import (
	_ "embed"
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/storage"
)

//go:embed assets/logo_safematrix.ico
var iconData []byte

// GetSafeMatrixIcon returns the SafeMatrix logo as a fyne resource
func GetSafeMatrixIcon() fyne.Resource {
	return fyne.NewStaticResource("logo_safematrix.ico", iconData)
}

// SetupAppIcon configures the application icon
func SetupAppIcon(app fyne.App) {
	if iconResource := GetSafeMatrixIcon(); iconResource != nil {
		app.SetIcon(iconResource)
	}
}
