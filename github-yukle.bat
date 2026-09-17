@echo off
chcp 65001 >nul
title Okey Oyununu GitHub'a Yukle
color 0A

echo =========================================================
echo    🎲 OKEY & 101 OKEY - GITHUB'A YUKLEME ARACI
echo =========================================================
echo.
echo Hedef Repo: https://github.com/ismetbayin71-dotcom/ofisoyun.git
echo.
echo Dosyalar gonderiliyor...
echo (Eger tarayici acilirsa lutfen "Authorize Git Credential Manager" butonuna tiklayin)
echo.

cd /d "C:\Users\İsmet\Desktop\OKEY"

"C:\Users\İsmet\.mingit\cmd\git.exe" push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =========================================================
    echo  [BASARILI] Tum dosyalar GitHub'a basariyla yuklendi!
    echo =========================================================
    echo.
    echo Simdi GitHub'da repo sayfanizi acin:
    echo 1. Settings ^> Pages sekmesine gidin.
    echo 2. Source kismindan "GitHub Actions" secin.
    echo 3. Siteniz 1-2 dakika icinde yayinda olacaktir!
) else (
    echo.
    echo [HATA] Bir sorun olustu. Lutfen ekrandaki mesaji kontrol edin.
)

echo.
pause
