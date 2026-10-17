@echo off
setlocal enabledelayedexpansion

set BACKUP_DIR=C:\POS_Backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Obtenir un timestamp fiable AAAA-MM-JJ_HHMMSS via PowerShell
for /f "tokens=*" %%T in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmmss'"') do set TIMESTAMP=%%T

set BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.sql
set LOG_FILE=%BACKUP_DIR%\backup_log.txt

cd /d "%~dp0"

echo [%TIMESTAMP%] Demarrage de la sauvegarde automatique... >> "%LOG_FILE%"

:: Verifier si les conteneurs sont actifs
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [%TIMESTAMP%] ECHEC : Docker Desktop n'est pas actif. >> "%LOG_FILE%"
    exit /b 1
)

:: Sauvegarde PostgreSQL via le conteneur bighrissen_db
docker compose exec -T db pg_dump -U pos_user bighrissen_pos > "%BACKUP_FILE%" 2>> "%LOG_FILE%"

if %errorlevel% equ 0 (
    echo [%TIMESTAMP%] SUCCES : Sauvegarde locale creee : %BACKUP_FILE% >> "%LOG_FILE%"
    
    :: Copie automatique sur cle USB si une cle externe est branchee (D:, E:, F:, G:, H:)
    for %%D in (D E F G H) do (
        if exist "%%D:\" (
            if not exist "%%D:\POS_Backups" mkdir "%%D:\POS_Backups" 2>nul
            if exist "%%D:\POS_Backups" (
                copy /y "%BACKUP_FILE%" "%%D:\POS_Backups\" >nul 2>&1
                if !errorlevel! equ 0 (
                    echo [%TIMESTAMP%] SUCCES : Copie de securite sur Cle USB (%%D:\POS_Backups\) >> "%LOG_FILE%"
                )
            )
        )
    )

    :: Nettoyage des sauvegardes locales de plus de 30 jours
    forfiles /p "%BACKUP_DIR%" /m *.sql /d -30 /c "cmd /c del @path" 2>nul
) else (
    echo [%TIMESTAMP%] ECHEC : Erreur lors de l'export pg_dump. >> "%LOG_FILE%"
)

exit /b 0
