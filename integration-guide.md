# Integrating AkwaPay

Working code for six languages, plus the reasoning behind the parts people get wrong.

The reference for endpoints and fields is [merchant-api.md](./merchant-api.md). This document is about *building* against them: what to send, what to do with the answer, and which mistakes cost real money.

- [Before you write any code](#before-you-write-any-code)
- [The shape of every integration](#the-shape-of-every-integration)
- [Node.js / TypeScript](#nodejs--typescript)
- [Python](#python)
- [PHP](#php)
- [Java / Spring Boot](#java--spring-boot)
- [Go](#go)
- [Ruby on Rails](#ruby-on-rails)
- [Testing without spending money](#testing-without-spending-money)
- [The five mistakes that cost money](#the-five-mistakes-that-cost-money)

---

## Before you write any code

Four decisions, all of which are harder to change later than to get right now.

**Where your secret key lives.** Server-side only. Not in a mobile app, not in a `.js` bundle, not in a repository. If a key reaches a browser, assume it is compromised — anyone can read it and charge your customers.

**How you store `reference`.** It must be unique per account, and it is your only handle on the payment when something goes wrong at 2am. Put your own order ID in it. If you encode data into it, remember the format becomes load-bearing: change it and every in-flight payment becomes unroutable.

**Where fulfilment happens.** In the webhook handler. Not on the redirect, not in the client. This is the single most common integration bug and the most expensive one.

**What you do with `unknown`.** Treat it as pending. Never as failure, never as a reason to re-charge. See [the five mistakes](#the-five-mistakes-that-cost-money).

---

## The shape of every integration

Regardless of language:

```
1. POST /v1/payment_intents          server → AkwaPay
2. branch on next_action.type        your UI
3. customer approves                 their handset or a redirect
4. POST to your webhook              AkwaPay → server     ← fulfil here
5. GET /v1/payment_intents/{id}      server → AkwaPay     ← safety net
```

Step 5 exists because step 4 can fail. Endpoints go down, deploys drop requests, signatures get misconfigured. A poller that re-checks unresolved intents is the difference between a delayed payment and a lost one — and it is the part most integrations skip.

### Amounts

Integers in pesewas, everywhere. GHS 50.00 is `5000`. Sending `50.00` returns `400`. Floating-point money is how ledgers drift, so the API refuses to participate.

### Idempotency

Every mutating request needs an `Idempotency-Key`. Same key + same body replays the stored response. Same key + different body returns `409`, which almost always means a bug in your retry logic.

Use a fresh UUID per attempt and let the unique `reference` provide the real deduplication.

---

## Node.js / TypeScript

### Creating an intent

```ts
import { randomUUID } from 'node:crypto';

const AKWAPAY_BASE = 'https://api.akwapay.com/v1';

interface PaymentIntent {
  id: string;
  status: 'created' | 'requires_action' | 'processing' | 'succeeded' | 'failed' | 'unknown';
  amount: number;
  currency: string;
  reference: string;
  next_action: { type: string; url?: string; expires_at?: string; ussd_fallback?: string } | null;
  checkout_url: string;
  client_secret: string;
}

export async function createPayment(opts: {
  amountPesewas: number;
  reference: string;
  phone: string;
  network?: 'MTN' | 'TELECEL' | 'AIRTELTIGO';
  returnUrl: string;
  metadata?: Record<string, string>;
}): Promise<PaymentIntent> {
  const res = await fetch(`${AKWAPAY_BASE}/payment_intents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AKWAPAY_SECRET_KEY}`,
      'Idempotency-Key': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: opts.amountPesewas,      // integer pesewas — 5000 is GHS 50.00
      currency: 'GHS',
      reference: opts.reference,
      method: 'mobile_money',
      network: opts.network,           // omit and the customer picks at checkout
      customer: { phone: opts.phone },
      return_url: opts.returnUrl,
      metadata: opts.metadata,
    }),
    // Fail fast. Holding a request thread open indefinitely is how one slow
    // gateway takes down your checkout.
    signal: AbortSignal.timeout(20_000),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`AkwaPay ${res.status}: ${body?.error?.message ?? 'unknown error'}`);
  }
  return body as PaymentIntent;
}
```

### Branching on `next_action`

```ts
// Two identical requests can return different next_action types, because
// AkwaPay routes across gateways and fails over when one is degraded.
// Hardcoding either branch strands customers on the other.
switch (intent.next_action?.type) {
  case 'await_prompt':
    // Stay on the page. Tell them to check their handset. Poll.
    // Show ussd_fallback if present — a meaningful share of prompts never
    // arrive, and the USSD string rescues those payments.
    return { view: 'awaiting_prompt', ussd: intent.next_action.ussd_fallback };

  case 'redirect':
    return { view: 'redirect', url: intent.next_action.url! };

  case 'submit_otp':
    return { view: 'otp' };

  default:
    return { view: 'awaiting_prompt' };
}
```

Or skip the branch entirely and send the customer to `intent.checkout_url`, which handles all four.

### Verifying a webhook (Express)

```ts
import express from 'express';
import crypto from 'node:crypto';

const app = express();

// express.raw, NOT express.json. The HMAC is computed over the exact bytes we
// sent. Once a JSON middleware parses and re-serialises the body, key order
// and whitespace change and the signature can never match.
app.post('/hooks/akwapay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    if (!verify(req.body, req.get('X-AkwaPay-Signature') ?? '', process.env.AKWAPAY_WEBHOOK_SECRET!)) {
      return res.status(400).send('bad signature');
    }

    const event = JSON.parse(req.body.toString('utf8'));

    // Respond FIRST, process after. A handler that writes three tables and
    // calls two APIs before responding will time out under load and land you
    // in the retry queue for work you already did.
    res.status(200).send('ok');

    setImmediate(() => handleEvent(event).catch(console.error));
  });

function verify(rawBody: Buffer, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;

  // Reject old timestamps. This is what stops someone replaying a captured
  // `succeeded` event they sniffed once.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t));
  if (age > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody.toString('utf8')}`)
    .digest('hex');

  // Constant time. `===` on a signature leaks it a byte at a time.
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleEvent(event: any) {
  if (event.type !== 'payment_intent.succeeded') return;

  // At-least-once delivery. You WILL receive this twice.
  if (await alreadyProcessed(event.id)) return;

  // Ordering is not guaranteed either — discard anything older than what you
  // have already applied to this intent.
  if (await sequenceIsStale(event.data.id, event.sequence)) return;

  await fulfil(event.data.reference, event.data.amount);
  await markProcessed(event.id);
}
```

---

## Python

### Creating an intent

```python
import os, uuid, requests

AKWAPAY_BASE = "https://api.akwapay.com/v1"

def create_payment(amount_pesewas: int, reference: str, phone: str,
                   return_url: str, network: str | None = None,
                   metadata: dict | None = None) -> dict:
    payload = {
        "amount": amount_pesewas,     # integer pesewas — 5000 is GHS 50.00
        "currency": "GHS",
        "reference": reference,
        "method": "mobile_money",
        "customer": {"phone": phone},
        "return_url": return_url,
    }
    if network:
        payload["network"] = network
    if metadata:
        payload["metadata"] = metadata

    r = requests.post(
        f"{AKWAPAY_BASE}/payment_intents",
        headers={
            "Authorization": f"Bearer {os.environ['AKWAPAY_SECRET_KEY']}",
            "Idempotency-Key": str(uuid.uuid4()),
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=20,
    )

    body = r.json()
    if not r.ok:
        raise RuntimeError(f"AkwaPay {r.status_code}: {body.get('error', {}).get('message')}")
    return body
```

### Webhook (Flask)

```python
import hmac, hashlib, time
from flask import Flask, request, abort

app = Flask(__name__)

@app.post("/hooks/akwapay")
def akwapay_webhook():
    # request.get_data() gives the RAW bytes. Do not use request.json here —
    # re-serialising changes the bytes and the HMAC will never match.
    raw = request.get_data()

    if not verify(raw, request.headers.get("X-AkwaPay-Signature", "")):
        abort(400)

    event = request.get_json()

    # Queue it and return immediately. Anything slower than 10 seconds counts
    # as a failure and puts you in the retry schedule.
    enqueue_event(event)
    return "ok", 200


def verify(raw: bytes, header: str) -> bool:
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        t, v1 = parts["t"], parts["v1"]
    except (ValueError, KeyError):
        return False

    if abs(int(time.time()) - int(t)) > 300:
        return False

    expected = hmac.new(
        os.environ["AKWAPAY_WEBHOOK_SECRET"].encode(),
        f"{t}.".encode() + raw,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, v1)
```

### Webhook (Django)

```python
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse, HttpResponseBadRequest

@csrf_exempt          # AkwaPay has no CSRF token; the signature is the auth
def akwapay_webhook(request):
    if not verify(request.body, request.headers.get("X-AkwaPay-Signature", "")):
        return HttpResponseBadRequest("bad signature")

    enqueue_event(json.loads(request.body))
    return HttpResponse("ok")
```

---

## PHP

```php
<?php
function createPayment(array $opts): array {
    $payload = [
        'amount'     => $opts['amount_pesewas'],   // 5000 = GHS 50.00
        'currency'   => 'GHS',
        'reference'  => $opts['reference'],
        'method'     => 'mobile_money',
        'customer'   => ['phone' => $opts['phone']],
        'return_url' => $opts['return_url'],
    ];
    if (!empty($opts['network'])) $payload['network'] = $opts['network'];

    $ch = curl_init('https://api.akwapay.com/v1/payment_intents');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . getenv('AKWAPAY_SECRET_KEY'),
            'Idempotency-Key: ' . bin2hex(random_bytes(16)),
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);

    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $body = json_decode($res, true);
    if ($code >= 400) {
        throw new RuntimeException("AkwaPay {$code}: " . ($body['error']['message'] ?? 'unknown'));
    }
    return $body;
}
```

### Webhook

```php
<?php
// php://input is the RAW body. $_POST is parsed and will not verify.
$raw    = file_get_contents('php://input');
$header = $_SERVER['HTTP_X_AKWAPAY_SIGNATURE'] ?? '';

if (!verifyAkwaPay($raw, $header, getenv('AKWAPAY_WEBHOOK_SECRET'))) {
    http_response_code(400);
    exit('bad signature');
}

$event = json_decode($raw, true);

// Respond before processing — the budget is 10 seconds.
http_response_code(200);
echo 'ok';
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();

handleEvent($event);


function verifyAkwaPay(string $raw, string $header, string $secret): bool {
    $parts = [];
    foreach (explode(',', $header) as $p) {
        $kv = explode('=', $p, 2);
        if (count($kv) === 2) $parts[trim($kv[0])] = trim($kv[1]);
    }
    if (!isset($parts['t'], $parts['v1'])) return false;
    if (abs(time() - (int) $parts['t']) > 300) return false;

    $expected = hash_hmac('sha256', $parts['t'] . '.' . $raw, $secret);
    return hash_equals($expected, $parts['v1']);   // constant time
}
```

---

## Java / Spring Boot

```java
@Service
@RequiredArgsConstructor
public class AkwaPayService {

    private final WebClient.Builder webClientBuilder;

    @Value("${app.akwapay.secret-key}") private String secretKey;
    @Value("${app.akwapay.base-url}")   private String baseUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> createPayment(int amountPesewas, String reference,
                                             String phone, String network,
                                             String returnUrl) {
        var customer = new HashMap<String, Object>();
        customer.put("phone", phone);

        var body = new HashMap<String, Object>();
        body.put("amount", amountPesewas);   // integer pesewas, never a decimal
        body.put("currency", "GHS");
        body.put("reference", reference);
        body.put("method", "mobile_money");
        body.put("customer", customer);
        body.put("return_url", returnUrl);
        if (network != null && !network.isBlank()) body.put("network", network);

        return (Map<String, Object>) webClientBuilder.build()
                .post().uri(baseUrl + "/payment_intents")
                .header("Authorization", "Bearer " + secretKey)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(20))
                .block();
    }
}
```

### Webhook controller

```java
@PostMapping("/api/webhooks/akwapay")
public ResponseEntity<String> webhook(
        @RequestHeader(value = "X-AkwaPay-Signature", required = false) String signature,
        HttpServletRequest request) {

    byte[] rawBody;
    try {
        // MUST be the raw bytes. If any filter upstream has already consumed
        // the stream — a request logger, ContentCachingRequestFilter — this
        // returns empty and every signature check fails. Test that early.
        rawBody = request.getInputStream().readAllBytes();
    } catch (Exception e) {
        return ResponseEntity.status(400).body("Failed to read body");
    }

    if (signature == null || !verifySignature(rawBody, signature)) {
        return ResponseEntity.status(400).body("Invalid signature");
    }

    // ... parse, dedupe on event id, fulfil ...
    return ResponseEntity.ok("OK");
}

private boolean verifySignature(byte[] rawBody, String header) {
    try {
        String t = null, v1 = null;
        for (var part : header.split(",")) {
            var kv = part.trim().split("=", 2);
            if (kv.length != 2) continue;
            if ("t".equals(kv[0]))       t  = kv[1].trim();
            else if ("v1".equals(kv[0])) v1 = kv[1].trim();
        }
        if (t == null || v1 == null) return false;

        long timestamp = Long.parseLong(t);
        if (Math.abs(Instant.now().getEpochSecond() - timestamp) > 300) return false;

        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
        mac.update(rawBody);

        var expected = HexFormat.of().formatHex(mac.doFinal());

        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                v1.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
        return false;
    }
}
```

Whitelist the webhook path in your security config — AkwaPay sends no JWT, the signature is the authentication:

```java
.requestMatchers("/api/webhooks/akwapay").permitAll()
```

---

## Go

```go
package akwapay

import (
    "bytes"
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "strconv"
    "strings"
    "time"

    "github.com/google/uuid"
)

type Intent struct {
    ID          string          `json:"id"`
    Status      string          `json:"status"`
    Amount      int64           `json:"amount"`
    Reference   string          `json:"reference"`
    NextAction  *NextAction     `json:"next_action"`
    CheckoutURL string          `json:"checkout_url"`
}

type NextAction struct {
    Type         string `json:"type"`
    URL          string `json:"url,omitempty"`
    USSDFallback string `json:"ussd_fallback,omitempty"`
}

func CreatePayment(ctx context.Context, amountPesewas int64, reference, phone, network, returnURL string) (*Intent, error) {
    payload := map[string]any{
        "amount":     amountPesewas, // integer pesewas
        "currency":   "GHS",
        "reference":  reference,
        "method":     "mobile_money",
        "customer":   map[string]string{"phone": phone},
        "return_url": returnURL,
    }
    if network != "" {
        payload["network"] = network
    }

    b, _ := json.Marshal(payload)
    req, err := http.NewRequestWithContext(ctx, http.MethodPost,
        "https://api.akwapay.com/v1/payment_intents", bytes.NewReader(b))
    if err != nil {
        return nil, err
    }
    req.Header.Set("Authorization", "Bearer "+os.Getenv("AKWAPAY_SECRET_KEY"))
    req.Header.Set("Idempotency-Key", uuid.NewString())
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{Timeout: 20 * time.Second}
    res, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer res.Body.Close()

    if res.StatusCode >= 400 {
        return nil, fmt.Errorf("akwapay returned %d", res.StatusCode)
    }

    var intent Intent
    if err := json.NewDecoder(res.Body).Decode(&intent); err != nil {
        return nil, err
    }
    return &intent, nil
}

// Verify checks an AkwaPay webhook signature against the raw request body.
func Verify(raw []byte, header, secret string) bool {
    var t, v1 string
    for _, p := range strings.Split(header, ",") {
        kv := strings.SplitN(strings.TrimSpace(p), "=", 2)
        if len(kv) != 2 {
            continue
        }
        switch kv[0] {
        case "t":
            t = kv[1]
        case "v1":
            v1 = kv[1]
        }
    }
    if t == "" || v1 == "" {
        return false
    }

    ts, err := strconv.ParseInt(t, 10, 64)
    if err != nil {
        return false
    }
    if age := time.Now().Unix() - ts; age > 300 || age < -300 {
        return false
    }

    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(t + "."))
    mac.Write(raw)
    expected := hex.EncodeToString(mac.Sum(nil))

    return hmac.Equal([]byte(expected), []byte(v1))
}
```

---

## Ruby on Rails

```ruby
class AkwapayService
  BASE = "https://api.akwapay.com/v1"

  def self.create_payment(amount_pesewas:, reference:, phone:, return_url:, network: nil)
    body = {
      amount: amount_pesewas,        # integer pesewas
      currency: "GHS",
      reference: reference,
      method: "mobile_money",
      customer: { phone: phone },
      return_url: return_url
    }
    body[:network] = network if network.present?

    res = Faraday.post("#{BASE}/payment_intents") do |req|
      req.headers["Authorization"]   = "Bearer #{ENV.fetch('AKWAPAY_SECRET_KEY')}"
      req.headers["Idempotency-Key"] = SecureRandom.uuid
      req.headers["Content-Type"]    = "application/json"
      req.body                       = body.to_json
      req.options.timeout            = 20
    end

    parsed = JSON.parse(res.body)
    raise "AkwaPay #{res.status}: #{parsed.dig('error', 'message')}" unless res.success?
    parsed
  end
end
```

```ruby
class AkwapayWebhooksController < ApplicationController
  # The signature is the authentication; there is no CSRF token to check.
  skip_before_action :verify_authenticity_token

  def create
    # request.raw_post is the unparsed body. params would be re-serialised.
    raw = request.raw_post

    return head :bad_request unless verify(raw, request.headers["X-AkwaPay-Signature"].to_s)

    AkwapayEventJob.perform_later(JSON.parse(raw))
    head :ok
  end

  private

  def verify(raw, header)
    parts = header.split(",").map { |p| p.split("=", 2) }.to_h
    return false unless parts["t"] && parts["v1"]
    return false if (Time.now.to_i - parts["t"].to_i).abs > 300

    expected = OpenSSL::HMAC.hexdigest("SHA256",
                                       ENV.fetch("AKWAPAY_WEBHOOK_SECRET"),
                                       "#{parts['t']}.#{raw}")

    ActiveSupport::SecurityUtils.secure_compare(expected, parts["v1"])
  end
end
```

---

## Testing without spending money

Use an `sk_test_` key. Test and live are separated at the database level, so test charges cannot touch real rails and live events will never reach a test webhook endpoint.

In test mode `http://localhost` is accepted as a webhook URL — but our servers still cannot reach your laptop. Use ngrok or similar to receive real deliveries:

```bash
ngrok http 8080
# register the https URL it prints
```

Verify signature checking against a **real delivery**, not a hand-crafted request. Most signature bugs are body-mangling bugs introduced by middleware, and a synthetic test bypasses the exact middleware that breaks it.

---

## The five mistakes that cost money

**1. Fulfilling on the redirect.** The customer's browser returning to your `return_url` means their browser finished a redirect. Nothing more. Anyone who reads your JavaScript can visit that URL directly. Fulfil in the webhook handler.

**2. Treating `unknown` as failure.** It means we asked a gateway to move money and got no clear answer. The money may or may not have left the customer's wallet. We never guess and never re-charge; we poll until it resolves. If you show "payment failed" and let them retry, you will double-debit real people.

**3. Parsing the body before verifying.** The HMAC covers the exact bytes we sent. Any middleware that parses and re-serialises JSON changes key order and whitespace, and the signature will never match. Read the raw body first.

**4. No poller.** Webhooks fail — endpoints go down, deploys drop requests, secrets get misconfigured. Without a background job that re-checks unresolved intents against `GET /v1/payment_intents/{id}`, a single lost webhook is a permanently lost payment. Build the poller before you launch, not after your first incident.

**5. Hardcoding `next_action.type`.** Mobile money does not always mean a push prompt. AkwaPay routes across gateways and fails over automatically, so two identical requests can return different action types minutes apart. Branch on the field, or use `checkout_url` and let us handle it.

---

## Going live

- [ ] Business verification approved
- [ ] Settlement account added and name-verified
- [ ] Webhook endpoint registered over HTTPS, signature verified against a real delivery
- [ ] Handler is idempotent on `event.id` and discards stale `sequence` values
- [ ] Handler responds in under 10 seconds, processing happens afterwards
- [ ] `unknown` is treated as pending
- [ ] A poller re-checks unresolved intents on a schedule
- [ ] Fulfilment triggers on the webhook, not the browser redirect
- [ ] Secret key is server-side only and absent from your repository
