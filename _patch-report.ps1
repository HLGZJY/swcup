$ErrorActionPreference = 'Stop'
$p = 'F:\swcup2026\miniapp-user\src\pages\report\index.vue'
# 2026-07-01 fix: PS 5.1 ReadAllText 在无 BOM 文件上会用 ANSI/UTF-8 fallback 丢中文
# 强制走 ReadAllBytes + UTF8 解码
$orig = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($p))
Write-Host ("Loaded: {0} bytes" -f $orig.Length)
$NL = "`r`n"
