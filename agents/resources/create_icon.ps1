# Script PowerShell pour créer l'icône à partir du SVG
# Nécessite ImageMagick installé

$svgPath = "logo.svg"
$icoPath = "icon.ico"

if (Get-Command magick -ErrorAction SilentlyContinue) {
    Write-Host "Converting SVG to ICO using ImageMagick..."
    magick convert $svgPath -define icon:auto-resize=256,128,64,48,32,16 $icoPath
    Write-Host "Icon created: $icoPath"
} else {
    Write-Host "ImageMagick not found!"
    Write-Host ""
    Write-Host "Please use one of these options:"
    Write-Host "1. Install ImageMagick: https://imagemagick.org/script/download.php"
    Write-Host "2. Use online converter: https://convertio.co/svg-ico/"
    Write-Host "3. Use Windows Paint 3D or GIMP"
    Write-Host ""
    Write-Host "Then save the icon as 'icon.ico' in this directory."
}

Read-Host "Press Enter to continue"
