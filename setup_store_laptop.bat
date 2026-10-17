@echo off
title Bighrissen Phone POS - Installation Initiale
setlocal enabledelayedexpansion

echo ================================================================
echo       INSTALLATION ET CONFIGURATION INITIALE DU PC BOUTIQUE
echo                    BIGHRISSEN PHONE POS
echo ================================================================
echo.

:: 1. Verifier Docker
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker Desktop n'est pas lance ou pas encore installe.
    echo 1. Veuillez installer Docker Desktop avec le moteur WSL 2 active.
    echo 2. Lancez Docker Desktop et attendez qu'il affiche "Engine running".
    echo 3. Relancez ensuite ce script d'installation.
    pause
    exit /b 1
)

:: 2. Se positionner dans le dossier du projet
cd /d "%~dp0"
set PROJECT_DIR=%CD%

echo [1/4] Construction et demarrage des conteneurs (Base de donnees, Backend, Caisse)...
docker compose up --build -d
if %errorlevel% neq 0 (
    echo [ERREUR] La creation des conteneurs a echoue.
    pause
    exit /b 1
)

echo.
echo Initialisation et verification de la base de donnees et des identifiants...
docker compose exec -T backend python manage.py ensure_initial_setup

echo.
echo [2/4] Creation du raccourci sur le Bureau de l'oncle...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Bighrissen Phone POS.lnk')); $s.TargetPath = '%PROJECT_DIR%\start_pos.bat'; $s.WorkingDirectory = '%PROJECT_DIR%'; $s.WindowStyle = 7; $s.Description = 'Caisse et Gestion Bighrissen Phone'; $s.Save()"

echo.
echo [3/4] Configuration du demarrage automatique au demarrage de Windows...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $startupPath = [Environment]::GetFolderPath('Startup'); $s = $ws.CreateShortcut([System.IO.Path]::Combine($startupPath, 'Bighrissen Phone POS.lnk')); $s.TargetPath = '%PROJECT_DIR%\start_pos.bat'; $s.WorkingDirectory = '%PROJECT_DIR%'; $s.WindowStyle = 7; $s.Description = 'Demarrage automatique Caisse POS'; $s.Save()"

echo.
echo [4/4] Planification de la sauvegarde automatique quotidienne a 21h30...
schtasks /create /tn "BighrissenPOS_DailyBackup" /tr "\"%PROJECT_DIR%\backup_db.bat\"" /sc daily /st 21:30 /f >nul 2>&1
if %errorlevel% equ 0 (
    echo Sauvegarde automatique planifiee avec succes a 21:30 chaque soir !
) else (
    echo [NOTE] Pour activer la sauvegarde planifiee, executez ce script une fois en mode Administrateur.
)

echo.
echo ================================================================
echo           INSTALLATION TERMINEE AVEC SUCCES !
echo ================================================================
echo.
echo Identifiants de connexion initiaux :
echo   - Nom d'utilisateur : admin
echo   - Mot de passe      : admin
echo   - Operateurs actifs : Mohamed, Hassan
echo   - Adresse Caisse    : http://localhost
echo.
echo Le raccourci "Bighrissen Phone POS" est cree sur le bureau.
echo Vos donnees de boutique, catalogue et operateurs sont prets.
echo.
echo Voulez-vous lancer la caisse maintenant ? (O/N)
set /p launch_now=
if /i "%launch_now%"=="O" (
    start "" "%PROJECT_DIR%\start_pos.bat"
)

exit /b 0
