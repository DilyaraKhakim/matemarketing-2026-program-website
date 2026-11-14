$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskAccount = 'DilyaraKhakim'
$taskRepository = 'matemarketing-2026-program-website'
$taskDescription = 'Мобильный сайт программы конференции Матемаркетинг 2026: поиск докладов, личное расписание, сравнение выступлений и экспорт в календарь. Создан с помощью AI-инструментов.'
$taskFullName = "$taskAccount/$taskRepository"
$taskRemoteUrl = "https://github.com/$taskFullName.git"

$taskLogin = & gh api user --jq .login
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub is unavailable. Check network access; if authentication has expired, run: gh auth login --hostname github.com --web'
}
if ($taskLogin.Trim() -ne $taskAccount) {
    throw "Expected GitHub account $taskAccount; active account is $taskLogin."
}
& node verify_program.cjs
if ($LASTEXITCODE -ne 0) { throw 'Application verification failed.' }
$taskBranch = & git branch --show-current
if ($taskBranch -ne 'main') { throw 'Expected the main branch.' }
$taskFiles = @(
    '.gitignore', '.nojekyll', 'IMPORT_REPORT.json', 'Publish-GitHub.ps1',
    'README.md', 'TRACK_IMPORT_REPORT.json', 'app.js', 'build_site.py',
    'enhancements.css', 'enhancements.js', 'import_program.py', 'import_tracks.py',
    'index.html', 'mobile.js', 'program_6.csv', 'program_6.md', 'verify_program.cjs'
)
& git add -- @taskFiles
if ($LASTEXITCODE -ne 0) { throw 'Could not stage project files.' }
$taskStagedFiles = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect staged files.' }
foreach ($taskStaged in $taskStagedFiles) {
    if ($taskStaged -notin $taskFiles) { throw "Unexpected staged file: $taskStaged. Commit was not created." }
}
& git diff --cached --quiet
$taskDiffStatus = $LASTEXITCODE
if ($taskDiffStatus -gt 1) { throw 'Could not check staged changes.' }
if ($taskDiffStatus -eq 1) {
    & git commit -m 'Build mobile Matemarketing 2026 program'
    if ($LASTEXITCODE -ne 0) { throw 'Could not create commit.' }
}
$taskChanges = & git status --porcelain
if ($taskChanges) { throw 'Commit the pending changes before publishing.' }
$taskOrigin = & git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $taskOrigin -notin @($taskRemoteUrl, "git@github.com:$taskFullName.git")) {
    throw 'The existing origin points to another repository. It was not changed.'
}
& gh repo view $taskFullName --json name --jq .name 2>$null
if ($LASTEXITCODE -ne 0) {
    & gh repo create $taskFullName --public --description $taskDescription
    if ($LASTEXITCODE -ne 0) { throw 'Could not create repository; no push attempted.' }
}
& gh repo edit $taskFullName --description $taskDescription --add-topic 'matemarketing,conference,mobile-first,html,vanilla-javascript'
if ($LASTEXITCODE -ne 0) { throw 'Could not update repository About.' }
if (-not $taskOrigin) {
    & git remote add origin $taskRemoteUrl
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure origin.' }
}
& git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed. No force push was attempted.' }
Write-Host "Published source: https://github.com/$taskFullName"
