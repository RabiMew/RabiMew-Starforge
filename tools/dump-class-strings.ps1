param([string]$Jar, [string[]]$Classes)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead($Jar)
foreach($n in $Classes){
  $e=$z.GetEntry($n)
  if(-not $e){ Write-Output "MISSING $n"; continue }
  $s=$e.Open(); $b=New-Object byte[] $e.Length; [void]$s.Read($b,0,$b.Length); $s.Close()
  $t=[System.Text.Encoding]::UTF8.GetString($b)
  $m=[regex]::Matches($t,'[ -~]{4,}') | ForEach-Object {$_.Value}
  Write-Output "===== $n"
  $m | Select-Object -Unique | ForEach-Object {Write-Output $_}
}
$z.Dispose()
