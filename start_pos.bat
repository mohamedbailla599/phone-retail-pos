@echo off
title Bighrissen Phone POS - Lancement en cours...
setlocal enabledelayedexpansion

echo =======================================================
echo          BIGHRISSEN PHONE POS - CAISSE COMMERCE
echo =======================================================
echo.

:: 1. Verifier si Docker Desktop est installe et actif
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Demarrage du moteur Docker...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo [ATTENTION] Docker Desktop introuvable dans le dossier par defaut.
        echo Veuillez verifier que Docker Desktop est bien lance.
    )

    echo Attente de l'initialisation de Docker...
    set /a attempts=0
    :wait_docker_loop
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% equ 0 goto docker_ready
    set /a attempts+=1
    echo   En attente de Docker... (!attempts!/20)
    if !attempts! lss 20 goto wait_docker_loop
    echo.
    echo [ERREUR] Le moteur Docker n'a pas pu demarrer apres 60 secondes.
    echo Veuillez ouvrir Docker Desktop manuellement puis relancer ce raccourci.
    pause
    exit /b 1
)

:docker_ready
echo [1/3] Moteur Docker operationnel !

:: 2. Se positionner dans le dossier du projet et lancer les conteneurs
cd /d "%~dp0"
echo [2/3] Demarrage des services Bighrissen POS...
docker compose up -d
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Impossible de demarrer les conteneurs Docker.
    echo Verifiez que le port 80 n'est pas utilise par un autre programme (ex: IIS).
    pause
    exit /b 1
)

:: 3. Attente que le serveur Nginx / Caisse reponde
echo [3/3] Verification de l'accessibilite de la caisse...
timeout /t 3 /nobreak >nul

:: 4. Ouvrir l'application en mode bureau autonome (sans barre d'adresse ni onglets)
echo.
echo Lancement de l'application de caisse...
where msedge >nul 2>&1
if %errorlevel% equ 0 (
    start msedge --app=http://localhost
    goto finish
)

where chrome >nul 2>&1
if %errorlevel% equ 0 (
    start chrome --app=http://localhost
    goto finish
)

:: Navigateur par defaut si ni Edge ni Chrome n'est disponible
start http://localhost

:finish
echo.
echo Caisse Bighrissen Phone prete !
timeout /t 2 /nobreak >nul
exit /b 0
