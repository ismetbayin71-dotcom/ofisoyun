$url = "https://github.com/git-for-windows/git/releases/download/v2.48.1.windows.1/MinGit-2.48.1-64-bit.zip"
$dest = "$env:USERPROFILE\.mingit.zip"
$target = "$env:USERPROFILE\.mingit"

Write-Host "MinGit indiriliyor..."
Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing

Write-Host "Arşiv açılıyor..."
Expand-Archive -Path $dest -DestinationPath $target -Force

Remove-Item $dest -Force
Write-Host "Kurulum tamamlandı! Git versiyonu:"
& "$target\cmd\git.exe" --version

# Add to user PATH environment
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$target\cmd*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$target\cmd", "User")
    Write-Host "PATH güncellendi."
}
