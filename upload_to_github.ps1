# Temporarily add Git and GitHub CLI to the current session's path
$gitPath = "C:\Program Files\Git\cmd"
$ghPath = "C:\Program Files\GitHub CLI"
if ($env:Path -notlike "*$gitPath*") { $env:Path += ";$gitPath" }
if ($env:Path -notlike "*$ghPath*") { $env:Path += ";$ghPath" }

Write-Host "Checking Git and GitHub CLI installation..." -ForegroundColor Green
git --version
gh --version

# Config git local user if not configured
$gitUser = git config user.name
if (-not $gitUser) {
    Write-Host "Configuring local git user name..." -ForegroundColor Cyan
    git config user.name "intelli-IPS-user"
    git config user.email "user@intelli-ips.local"
}

# Check git repository status
if (-not (Test-Path .git)) {
    Write-Host "Initializing Git repository..." -ForegroundColor Cyan
    git init
    git branch -m main
}

Write-Host "Staging files..." -ForegroundColor Cyan
git add .

Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit"

Write-Host "Logging into GitHub..." -ForegroundColor Yellow
Write-Host "A browser window will open for authentication." -ForegroundColor Yellow
gh auth login

Write-Host "Creating GitHub repository and pushing code..." -ForegroundColor Cyan
gh repo create "intelli-IPS" --public --source=. --remote=origin --push

Write-Host "Successfully uploaded project to GitHub!" -ForegroundColor Green
