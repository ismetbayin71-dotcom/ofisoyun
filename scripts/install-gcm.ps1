$dest = "$env:USERPROFILE\.gcm.zip"
$gcmUrl = "https://github.com/git-ecosystem/git-credential-manager/releases/download/v2.6.1/gcm-win-x86-2.6.1.zip"
$gitDir = "$env:USERPROFILE\.mingit\cmd"

Write-Host "Git Credential Manager indiriliyor..."
Invoke-WebRequest -Uri $gcmUrl -OutFile $dest -UseBasicParsing

Write-Host "GCM arşivden çıkarılıyor..."
Expand-Archive -Path $dest -DestinationPath $gitDir -Force

Remove-Item $dest -Force
& "$gitDir\git.exe" config --global credential.helper "$gitDir\git-credential-manager.exe"
Write-Host "GCM başarıyla kuruldu!"
