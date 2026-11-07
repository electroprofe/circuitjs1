# ==========================================
#   Script de Despliegue de CircuitJS1
# ==========================================

$ErrorActionPreference = "Stop"

# 1. Ir a la carpeta ts y compilar
Write-Host "`n--- 1. Compilando el proyecto ---" -ForegroundColor Cyan
Set-Location -Path ".\ts"

# Limpiar la variable NODE_OPTIONS por si da error con Electron
$env:NODE_OPTIONS=""

# Ejecutar la compilación
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] La compilación ha fallado. Revisa los errores de arriba." -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] Compilación terminada con éxito." -ForegroundColor Green
Set-Location -Path ".."

# 2. Preguntar si se quiere transferir a la Raspberry
Write-Host ""
$respuesta = Read-Host "¿Quieres copiar los archivos a la Raspberry Pi ahora? (S/N)"

if ($respuesta -match '^[sSyY]$') {
    
    # Preguntar IP y usuario (puedes cambiarlo por tu IP fija si no cambia nunca)
    $ip = Read-Host "Introduce la IP de la Raspberry (ej: 192.168.1.100)"
    $usuario = Read-Host "Introduce el usuario (ej: pi o javi)"

    Write-Host "`n--- 2. Copiando archivos a la Raspberry Pi ---" -ForegroundColor Cyan
    Write-Host "Destino: $usuario@$ip`:/var/www/circuitjs1/" -ForegroundColor Gray

    # Copiar todo el contenido de dist a la ruta de la raspberry
    # (Asegúrate de que tienes permisos en esa carpeta en la raspi)
    scp -r ".\ts\dist\*" "${usuario}@${ip}:/var/www/circuitjs1/"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[OK] ¡Transferencia completada con éxito!" -ForegroundColor Green
    } else {
        Write-Host "`n[ERROR] Hubo un problema al transferir los archivos." -ForegroundColor Red
    }
} else {
    Write-Host "`n[OK] Despliegue cancelado. Los archivos compilados están en .\ts\dist\" -ForegroundColor Yellow
}

Write-Host "`nProceso finalizado." -ForegroundColor Cyan