@echo off

set WD=%~dp0
del "xpi/unread-badge@streiff.net.zip"
cd src
"C:\Program Files\7-Zip\7z.exe" a "../xpi/unread-badge@streiff.net.zip" .
cd ..
cd xpi
del "unread-badge@streiff.net.xpi"
rename "unread-badge@streiff.net.zip" "unread-badge@streiff.net.xpi"
cd ..
