param(
  [string]$OutputPath = (
    Join-Path $PSScriptRoot "..\android\app\src\main\res\drawable-nodpi\widget_preview.png"
  )
)

Add-Type -AssemblyName System.Drawing

$width = 640
$height = 330
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::White)

$ink = [System.Drawing.ColorTranslator]::FromHtml("#172033")
$muted = [System.Drawing.ColorTranslator]::FromHtml("#778195")
$blue = [System.Drawing.ColorTranslator]::FromHtml("#2f6fed")
$red = [System.Drawing.ColorTranslator]::FromHtml("#c94646")
$line = [System.Drawing.ColorTranslator]::FromHtml("#e9edf3")
$border = [System.Drawing.ColorTranslator]::FromHtml("#dfe5ee")

$borderPen = New-Object System.Drawing.Pen($border, 2)
$graphics.DrawRectangle($borderPen, 1, 1, $width - 3, $height - 3)

$bold = New-Object System.Drawing.Font("Microsoft YaHei", 20, [System.Drawing.FontStyle]::Bold)
$small = New-Object System.Drawing.Font("Microsoft YaHei", 11)
$label = New-Object System.Drawing.Font("Microsoft YaHei", 10, [System.Drawing.FontStyle]::Bold)
$body = New-Object System.Drawing.Font("Microsoft YaHei", 11)
$softBrush = New-Object System.Drawing.SolidBrush($muted)
$inkBrush = New-Object System.Drawing.SolidBrush($ink)
$blueBrush = New-Object System.Drawing.SolidBrush($blue)
$redBrush = New-Object System.Drawing.SolidBrush($red)
$linePen = New-Object System.Drawing.Pen($line, 2)

$graphics.DrawString("11月22日 星期日", $bold, $inkBrush, 22, 18)
$graphics.DrawString("6 项", $small, $softBrush, 555, 27)
$graphics.DrawLine($linePen, 22, 72, 618, 72)
$graphics.DrawLine($linePen, 340, 88, 340, 306)

$graphics.DrawString("定期", $label, $blueBrush, 22, 90)
$graphics.DrawString("09:00  高数课", $body, $inkBrush, 22, 122)
$graphics.DrawString("14:30  项目会议", $body, $inkBrush, 22, 160)
$graphics.DrawString("19:00  晚自习", $body, $inkBrush, 22, 198)

$graphics.DrawString("今日截止", $label, $redBrush, 360, 90)
$graphics.DrawString("16:00  提交报告", $body, $inkBrush, 360, 122)
$graphics.DrawString("20:00  缴纳费用", $body, $inkBrush, 360, 158)
$graphics.DrawLine($linePen, 360, 196, 610, 196)
$graphics.DrawString("打卡", $label, $redBrush, 360, 214)
$graphics.DrawString("3项 · 已打卡1", $body, $inkBrush, 360, 246)

$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Generated widget preview: $OutputPath"
