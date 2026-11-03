<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:600px;margin:24px auto;padding:24px">
<h1>{{ $campaign->headline }}</h1>
<p>{!! nl2br(e($campaign->message)) !!}</p>
<p><strong>Offer code: {{ $campaign->offer->code }}</strong></p>
<p><a href="{{ rtrim(config('app.frontend_url', config('app.url')), '/') }}/checkout">Shop now</a></p>
<hr><p style="font-size:12px;color:#64748b">Erry Imprints · <a href="{{ $unsubscribeUrl }}">Unsubscribe</a></p>
</body></html>
