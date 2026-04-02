Write-Host "Installing frontend dependencies..."
Set-Location -Path (Join-Path $PSScriptRoot '..\frontend')
npm install

Write-Host "Installing backend dependencies..."
Set-Location -Path (Join-Path $PSScriptRoot '..\backend')
npm install

Write-Host "Done."
