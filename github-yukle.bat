@echo off
cls
cd /d "%USERPROFILE%\Desktop\OKEY"
echo ===================================================
echo   OKEY PROJESI GITHUB'A YUKLENIYOR...
echo ===================================================
echo.
echo Hedef: https://github.com/ismetbayin71-dotcom/ofisoyun.git
echo.
echo Dosyalar gonderiliyor...
echo (Tarayici acilirsa 'Authorize Git Credential Manager' butonuna tiklayin)
echo.

"%USERPROFILE%\.mingit\cmd\git.exe" push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo  [BASARILI] Tum dosyalar GitHub'a yuklendi!
    echo ===================================================
    echo.
    echo Simdi GitHub repo sayfanizi acip:
    echo 1. Settings - Pages sekmesine gidin.
    echo 2. Source kismindan 'GitHub Actions' secin.
    echo.
) else (
    echo.
    echo [HATA] Yukleme sirasinda bir sorun olustu.
    echo.
)

pause
