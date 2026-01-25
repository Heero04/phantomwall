@echo off
echo Creating Lambda deployment package...

cd /d "%~dp0"
cd lambda\alert-indexer

if exist "..\..\alert-indexer.zip" del "..\..\alert-indexer.zip"

powershell -command "Compress-Archive -Path 'index.py' -DestinationPath '..\..\alert-indexer.zip'"

if exist "..\..\alert-indexer.zip" (
    echo ✅ Lambda package created successfully: alert-indexer.zip
) else (
    echo ❌ Failed to create Lambda package
)

cd ..\..
echo Package location: %cd%\alert-indexer.zip