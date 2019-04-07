@echo off

set WD=%~dp0
del "xpi/unread-badge@streiff.net.zip"
cd src
"C:\Program Files\7-Zip\7z.exe" a "../xpi/unread-badge@streiff.net.zip" .
cd ..
