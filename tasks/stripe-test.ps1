param([string]$KeyName = 'STRIPE_SECRET_KEY')
# Creates and immediately expires one Checkout Session (no charge) to prove the key can take tips.
function Get-EnvVal($name) { $l = Select-String -Path 'C:\Hecate-Umbra\.env' -Pattern ("^\s*" + [regex]::Escape($name) + "\s*=") | Select-Object -First 1; if ($l) { $l.Line.Split('=',2)[1].Trim().Trim('"').Trim("'") } }
$k = Get-EnvVal $KeyName
$h = @{ Authorization = "Bearer $k"; 'Stripe-Version' = '2024-06-20' }
$body = 'mode=payment&success_url=https%3A%2F%2Fgarter.black%2F&cancel_url=https%3A%2F%2Fgarter.black%2F&line_items[0][quantity]=1&line_items[0][price_data][currency]=aud&line_items[0][price_data][unit_amount]=1000&line_items[0][price_data][product_data][name]=Permission%20check'
try {
  $s = Invoke-RestMethod -Method POST -Uri 'https://api.stripe.com/v1/checkout/sessions' -Headers $h -ContentType 'application/x-www-form-urlencoded' -Body $body
  "$KeyName checkout.create OK livemode=$($s.livemode) methods=$($s.payment_method_types -join ',')"
  $e = Invoke-RestMethod -Method POST -Uri ("https://api.stripe.com/v1/checkout/sessions/" + $s.id + "/expire") -Headers $h
  "expired=$($e.status)"
} catch { "$KeyName checkout.create FAILED: " + $_.ErrorDetails.Message }
try {
  $pi = Invoke-RestMethod -Method POST -Uri 'https://api.stripe.com/v1/payment_intents' -Headers $h -ContentType 'application/x-www-form-urlencoded' -Body 'amount=1000&currency=aud&automatic_payment_methods[enabled]=true&description=Permission%20check'
  "$KeyName pi.create OK"; $c = Invoke-RestMethod -Method POST -Uri ("https://api.stripe.com/v1/payment_intents/" + $pi.id + "/cancel") -Headers $h; "pi.cancel=$($c.status)"
} catch { "$KeyName pi.create FAILED: " + $_.ErrorDetails.Message }
try { $w = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/webhook_endpoints?limit=20' -Headers $h; "webhooks: " + (($w.data | % { $_.url }) -join ' | ') } catch { "webhook list FAILED: " + $_.ErrorDetails.Message }
