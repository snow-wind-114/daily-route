param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\icons")
)

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $arc = New-Object System.Drawing.RectangleF(
    $Rectangle.X,
    $Rectangle.Y,
    $diameter,
    $diameter
  )
  $path.AddArc($arc, 180, 90)
  $arc.X = $Rectangle.Right - $diameter
  $path.AddArc($arc, 270, 90)
  $arc.Y = $Rectangle.Bottom - $diameter
  $path.AddArc($arc, 0, 90)
  $arc.X = $Rectangle.X
  $path.AddArc($arc, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-AppIcon {
  param(
    [int]$Size,
    [string]$Path
  )

  $scale = $Size / 512
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $accent = [System.Drawing.ColorTranslator]::FromHtml("#2f6fed")
  $accentSoft = [System.Drawing.ColorTranslator]::FromHtml("#dce8ff")
  $white = [System.Drawing.Color]::White
  $graphics.Clear($accent)

  $calendarArea = New-Object System.Drawing.RectangleF(
    (116 * $scale),
    (124 * $scale),
    (280 * $scale),
    (278 * $scale)
  )
  $calendarPath = New-RoundedRectanglePath $calendarArea (52 * $scale)
  $graphics.FillPath((New-Object System.Drawing.SolidBrush($white)), $calendarPath)

  $headerArea = New-Object System.Drawing.RectangleF(
    (116 * $scale),
    (124 * $scale),
    (280 * $scale),
    (78 * $scale)
  )
  $headerPath = New-RoundedRectanglePath $headerArea (52 * $scale)
  $graphics.FillPath(
    (New-Object System.Drawing.SolidBrush($accentSoft)),
    $headerPath
  )
  $graphics.FillRectangle(
    (New-Object System.Drawing.SolidBrush($accentSoft)),
    (116 * $scale),
    (176 * $scale),
    (280 * $scale),
    (26 * $scale)
  )

  $ringBrush = New-Object System.Drawing.SolidBrush($white)
  foreach ($x in @(184, 304)) {
    $graphics.FillRectangle(
      $ringBrush,
      ($x * $scale),
      (92 * $scale),
      (24 * $scale),
      (82 * $scale)
    )
  }

  $accentBrush = New-Object System.Drawing.SolidBrush($accent)
  $softBrush = New-Object System.Drawing.SolidBrush($accentSoft)
  $graphics.FillRectangle(
    $accentBrush,
    (164 * $scale),
    (240 * $scale),
    (80 * $scale),
    (36 * $scale)
  )
  $graphics.FillRectangle(
    $softBrush,
    (268 * $scale),
    (240 * $scale),
    (80 * $scale),
    (36 * $scale)
  )
  $graphics.FillRectangle(
    $softBrush,
    (164 * $scale),
    (306 * $scale),
    (184 * $scale),
    (22 * $scale)
  )
  $graphics.FillRectangle(
    $softBrush,
    (164 * $scale),
    (348 * $scale),
    (120 * $scale),
    (22 * $scale)
  )

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
New-AppIcon -Size 192 -Path (Join-Path $OutputDirectory "icon-192.png")
New-AppIcon -Size 512 -Path (Join-Path $OutputDirectory "icon-512.png")
New-AppIcon -Size 512 -Path (Join-Path $OutputDirectory "icon-maskable-512.png")

Write-Host "Generated icons in $OutputDirectory"
