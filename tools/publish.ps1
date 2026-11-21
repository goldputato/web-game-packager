# 一键发布到 GitHub
#
# 用法：在仓库根目录右键「使用 PowerShell 运行」，或执行
#     powershell -ExecutionPolicy Bypass -File tools/publish.ps1
#
# 令牌只在本地内存中使用：不写文件、不进 remote URL、不进命令行历史。
# 发布结束后令牌即失效（进程退出），GitHub 上随时可撤销。

$ErrorActionPreference = "Stop"

$RepoName  = "web-game-packager"
$Desc      = "把网页游戏打包成单文件 Windows EXE，并可全量汉化（WorkBuddy skill / Electron portable build）"
$Topics    = @("electron","webgame","packager","localization","chinese","threejs","webgpu","skill","workbuddy","portable-app")
$Branch    = "main"

function Write-Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "   $t" -ForegroundColor Green }
function Write-Warn($t) { Write-Host "   $t" -ForegroundColor Yellow }

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path ".git")) {
    throw "不是 git 仓库：$root"
}

Write-Step "读取令牌"
Write-Host "   需要 classic PAT（勾选 repo）或 fine-grained（Contents + Administration 读写）"

if ($env:GH_TOKEN) {
    $token = $env:GH_TOKEN
} else {
    $sec  = Read-Host "   粘贴 GitHub token（输入不可见）" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($token)) { throw "令牌为空" }

$headers = @{
    Authorization          = "token $token"
    "User-Agent"           = "web-game-packager-publish"
    Accept                 = "application/vnd.github+json"
}

Write-Step "校验身份"
try {
    $me = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -TimeoutSec 30
    Write-Ok "登录为 $($me.login)"
} catch {
    throw "令牌无效或网络不可达：$($_.Exception.Message)"
}

Write-Step "创建仓库 $($me.login)/$RepoName"
$payload = @{
    name        = $RepoName
    description = $Desc
    private     = $false
    has_issues  = $true
    has_wiki    = $false
} | ConvertTo-Json

try {
    $repo = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post `
        -Headers $headers -Body $payload -ContentType "application/json" -TimeoutSec 30
    Write-Ok "已创建 $($repo.html_url)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) {
        Write-Warn "仓库已存在，直接推送"
    } else {
        throw "创建失败（HTTP $code）：$($_.Exception.Message)"
    }
}

Write-Step "设置 topics"
try {
    $t = @{ names = $Topics } | ConvertTo-Json
    Invoke-RestMethod -Uri "https://api.github.com/repos/$($me.login)/$RepoName/topics" -Method Put `
        -Headers $headers -Body $t -ContentType "application/json" -TimeoutSec 30 | Out-Null
    Write-Ok ($Topics -join ", ")
} catch {
    Write-Warn "topics 设置失败（不影响发布）：$($_.Exception.Message)"
}

Write-Step "推送代码"
$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))

git remote remove origin 2>$null | Out-Null
git remote add origin "https://github.com/$($me.login)/$RepoName.git"
git -c credential.helper= -c http.extraheader="AUTHORIZATION: basic $b64" push -u origin "HEAD:$Branch" --quiet
if ($LASTEXITCODE -ne 0) { throw "git push 失败（检查令牌是否有 repo / Contents 写权限）" }
Write-Ok "已推送到 $Branch"

# 清掉 remote 里的任何凭据痕迹（这里本就没有）
git remote set-url origin "https://github.com/$($me.login)/$RepoName.git"

Write-Step "完成"
Write-Host "   仓库：https://github.com/$($me.login)/$RepoName" -ForegroundColor Green
Write-Host "   现在可以在该页面点 Star、编辑 About、或直接发 Release。" -ForegroundColor DarkGray
Write-Host "   令牌未被保存；如需撤销，访问 https://github.com/settings/tokens" -ForegroundColor DarkGray
