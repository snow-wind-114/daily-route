param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $ProjectRoot "icons\icon-512.png"
$resourceRoot = Join-Path $ProjectRoot "android\app\src\main\res"
$source = [System.Drawing.Image]::FromFile($sourcePath)

function Save-ScaledPng {
  param(
    [string]$Path,
    [int]$Width,
    [int]$Height,
    [double]$Scale = 1
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $targetWidth = [int]($Width * $Scale)
  $targetHeight = [int]($Height * $Scale)
  $left = [int](($Width - $targetWidth) / 2)
  $top = [int](($Height - $targetHeight) / 2)
  $graphics.DrawImage(
    $source,
    (New-Object System.Drawing.Rectangle($left, $top, $targetWidth, $targetHeight))
  )
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$launcherSizes = [ordered]@{
  "mipmap-mdpi" = 48
  "mipmap-hdpi" = 72
  "mipmap-xhdpi" = 96
  "mipmap-xxhdpi" = 144
  "mipmap-xxxhdpi" = 192
}

foreach ($entry in $launcherSizes.GetEnumerator()) {
  $directory = Join-Path $resourceRoot $entry.Key
  Save-ScaledPng (Join-Path $directory "ic_launcher.png") $entry.Value $entry.Value
  Save-ScaledPng (Join-Path $directory "ic_launcher_round.png") $entry.Value $entry.Value
}

$splashDirectories = @(
  "drawable",
  "drawable-land-mdpi",
  "drawable-land-hdpi",
  "drawable-land-xhdpi",
  "drawable-land-xxhdpi",
  "drawable-land-xxxhdpi",
  "drawable-port-mdpi",
  "drawable-port-hdpi",
  "drawable-port-xhdpi",
  "drawable-port-xxhdpi",
  "drawable-port-xxxhdpi"
)

foreach ($directoryName in $splashDirectories) {
  $path = Join-Path (Join-Path $resourceRoot $directoryName) "splash.png"
  if (-not (Test-Path -LiteralPath $path)) {
    continue
  }

  $existing = [System.Drawing.Image]::FromFile($path)
  $width = $existing.Width
  $height = $existing.Height
  $existing.Dispose()
  Save-ScaledPng $path $width $height 0.32
}

$source.Dispose()
Write-Host "Android icons and splash screens generated."
