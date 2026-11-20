# Builds the one-page target board (target-board.png): the feeling, the references and what each defines, the rules, and the blocked-in frame.
Add-Type -AssemblyName System.Drawing
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
$W = 2400; $H = 2050
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(247, 243, 234))
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(42, 38, 32))
$soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(110, 100, 86))
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 90, 40))
$fTitle = New-Object System.Drawing.Font 'Georgia', 40, ([System.Drawing.FontStyle]::Bold)
$fSub = New-Object System.Drawing.Font 'Georgia', 22, ([System.Drawing.FontStyle]::Italic)
$fHead = New-Object System.Drawing.Font 'Segoe UI Semibold', 17
$fBody = New-Object System.Drawing.Font 'Segoe UI', 14
$fRule = New-Object System.Drawing.Font 'Segoe UI', 15

$g.DrawString('Echelon landscape - target 01', $fTitle, $ink, 60, 40)
$g.DrawString('Nostalgia and tranquility: a remembered, lived-in place that is completely at peace. Stylised and saturated is welcome; realism is not the goal.', $fSub, $soft, 62, 110)

# the blocked-in frame
$frame = [System.Drawing.Image]::FromFile((Join-Path $d 'block-frame.png'))
$fw = $W - 120; $fh = [int]($frame.Height * $fw / $frame.Width)
$g.DrawImage($frame, 60, 170, $fw, $fh)
$g.DrawString('Blocked-in frame (masses only, the app''s window shape): camera low in a flowering meadow; a worn path to a small hamlet on a rise at the left, sheltered by trees; a calm open middle with hay huts; a forest edge closing the right; a blocky massif and a sloping peak, soft and far; low warm backlight and haze.', $fBody, $soft, (New-Object System.Drawing.RectangleF 60, (180 + $fh), $fw, 60))
$y0 = 180 + $fh + 80

# the references and what each defines
$refs = @(
  @('1-meaning-allingham.jpg', 'MEANING', 'A lived-in home you belong to: human scale, enclosure, a path to the door, smoke, warm earthy colour, flowers as fine flecks.'),
  @('2-light-seiser-buttercups.jpg', 'LIGHT AND COLOUR', 'Broken cloud, light rolling over the swells, eye level among the flowers, rich saturated greens and yellows.'),
  @('3-layout-seiser-wide.jpg', 'LAYOUT', 'Flowered floor, calm open middle with small huts, forest edge on one side, two characterful mountains, honest scale.'),
  @('4-quiet-woodland-carpet.jpg', 'THE WOOD', 'Enchantment: a carpet of blue, violet and white under the trees, lit in pools where the sun gets through.'),
  @('5-quiet-horse-evening.jpg', 'EVENING', 'Small slow life, gold backlight, long shadows, ridges dissolving into haze.'),
  @('6-quiet-lake-morning.jpg', 'MORNING', 'Mist on still water, rock islands with a few trees, the calmest place in the frame.')
)
$cw = [int](($W - 120 - 5 * 24) / 6); $ch = 250
for ($i = 0; $i -lt 6; $i++) {
  $x = 60 + $i * ($cw + 24); $im = [System.Drawing.Image]::FromFile((Join-Path $d ('refs\' + $refs[$i][0])))
  $s = [Math]::Max($cw / $im.Width, $ch / $im.Height); $sw = $cw / $s; $sh = $ch / $s
  $g.DrawImage($im, (New-Object System.Drawing.RectangleF $x, $y0, $cw, $ch), (New-Object System.Drawing.RectangleF (($im.Width - $sw) / 2), (($im.Height - $sh) / 2), $sw, $sh), 'Pixel'); $im.Dispose()
  $g.DrawString($refs[$i][1], $fHead, $accent, $x, $y0 + $ch + 10)
  $g.DrawString($refs[$i][2], $fBody, $ink, (New-Object System.Drawing.RectangleF $x, ($y0 + $ch + 42), $cw, 120))
}
$y1 = $y0 + $ch + 175

# the rules
$g.DrawString('RULES', $fHead, $accent, 60, $y1)
$rules = @(
  'Test every choice: does it feel remembered, lived-in and still - or built, new and busy?',
  'The hamlet is the heart: close enough to read as a home, wrapped in trees and hedges, a path to it, smoke rising, gardens.',
  'Wide layers that step back: flowering foreground, calm open middle, forest edge to one side, mountains soft and far. Sky and meadow leave room for the UI.',
  'Two mountains with their own silhouettes (a block and a slope), never a row of similar spikes. Haze between us and them.',
  'Flowers as fine flecks and carpets - buttercup yellow, white, pink; blue and violet gathered under the trees. Never a few big dots.',
  'Light is low, soft, often backlit, with visible air: mist at morning, broken cloud at midday, gold at evening. Never harsh.',
  'Life is small and slow: a grazing horse or cows, drifting mist, smoke, still water.',
  'Colour is warm and saturated: deep greens, buttercup yellow, terracotta roofs, cream walls, lilac-blue distance.'
)
$yy = $y1 + 40
foreach ($r in $rules) { $g.DrawString(([char]0x2022 + '  ' + $r), $fRule, $ink, (New-Object System.Drawing.RectangleF 70, $yy, ($W - 140), 40)); $yy += 38 }
$bmp.Save((Join-Path $d 'target-board.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$frame.Dispose(); $g.Dispose(); $bmp.Dispose(); "board $W x $H, rules end at $yy"
