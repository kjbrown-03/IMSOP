# =====================================================================
# IMSOP - Setup acces SSH distant depuis telephone via Tailscale
# =====================================================================
# A LANCER EN POWERSHELL ADMIN :
#   1. Menu Demarrer -> tape "PowerShell"
#   2. Clic droit sur "Windows PowerShell" -> "Executer en tant qu'admin"
#   3. cd C:\Users\USER\Downloads\IMSOP
#   4. powershell -ExecutionPolicy Bypass -File .\setup-remote-access.ps1
# =====================================================================

$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-OK($msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "    [!]  $msg" -ForegroundColor Yellow
}

# Verifier admin
$currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERREUR : Ce script doit etre lance en PowerShell ADMIN." -ForegroundColor Red
    exit 1
}

# ---- 1. OpenSSH Server ----
Write-Step "Installation OpenSSH Server"
$sshCap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
if ($sshCap.State -eq 'Installed') {
    Write-OK "OpenSSH.Server deja installe"
} else {
    Write-Host "    Installation en cours (peut prendre 1-2 min)..."
    Add-WindowsCapability -Online -Name $sshCap.Name | Out-Null
    Write-OK "OpenSSH.Server installe"
}

# ---- 2. Demarrer sshd + auto-start ----
Write-Step "Demarrage service sshd"
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
$svc = Get-Service sshd
Write-OK "sshd Status=$($svc.Status) StartType=$($svc.StartType)"

# ---- 3. Firewall ----
Write-Step "Regle firewall OpenSSH-Server-In-TCP"
$rule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
if ($null -eq $rule) {
    New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' `
        -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
    Write-OK "Regle firewall creee"
} else {
    Write-OK "Regle firewall existe deja (Enabled=$($rule.Enabled))"
}

# ---- 4. Shell par defaut = PowerShell ----
Write-Step "Configuration shell par defaut = PowerShell"
$pwshPath = (Get-Command powershell).Source
New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell `
    -Value $pwshPath -PropertyType String -Force | Out-Null
Write-OK "DefaultShell = $pwshPath"

# ---- 5. Tailscale ----
Write-Step "Installation Tailscale (via winget)"
$tsCmd = Get-Command tailscale -ErrorAction SilentlyContinue
if ($tsCmd) {
    Write-OK "Tailscale deja installe : $($tsCmd.Source)"
} else {
    try {
        winget install --id tailscale.tailscale -e --accept-source-agreements --accept-package-agreements
        Write-OK "Tailscale installe"
        Write-Warn "Ferme et rouvre PowerShell pour que 'tailscale' soit dans le PATH"
    } catch {
        Write-Warn "winget a echoue. Telecharge manuellement : https://tailscale.com/download/windows"
    }
}

# ---- Recap ----
Write-Step "Prochaines etapes"
Write-Host ""
Write-Host "  1. Ouvre un NOUVEAU PowerShell (pas admin necessaire) et lance :" -ForegroundColor White
Write-Host "       tailscale up" -ForegroundColor Yellow
Write-Host "     -> ca ouvre le navigateur : cree un compte Tailscale (gratuit)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Recupere l'IP Tailscale du PC :" -ForegroundColor White
Write-Host "       tailscale ip -4" -ForegroundColor Yellow
Write-Host "     -> tu obtiens une IP genre 100.x.y.z (note-la)" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Sur ton telephone :" -ForegroundColor White
Write-Host "       a) Installe l'app 'Tailscale' + connecte-toi (meme compte)" -ForegroundColor Gray
Write-Host "       b) Installe 'Termius' (App Store / Play Store)" -ForegroundColor Gray
Write-Host "       c) Dans Termius, ajoute un Host :" -ForegroundColor Gray
Write-Host "            Hostname : 100.x.y.z  (l'IP de l'etape 2)" -ForegroundColor Gray
Write-Host "            Username : USER" -ForegroundColor Gray
Write-Host "            Port     : 22" -ForegroundColor Gray
Write-Host "            Password : ton mot de passe Windows" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Connecte-toi depuis le telephone, puis :" -ForegroundColor White
Write-Host "       cd C:\Users\USER\Downloads\IMSOP" -ForegroundColor Yellow
Write-Host "       claude" -ForegroundColor Yellow
Write-Host ""
Write-Host "Termine. Tu peux fermer cette fenetre." -ForegroundColor Green
