// Human-readable text for the raw payment status codes our gateways / credit
// pipelines return (Flutterwave, Moolre, Paystack). Used by the deposit toast
// on /me and the inline mobile-money form so players never see a bare code like
// "missing-reference".

export function friendlyPaymentFailure(status: string | null | undefined): string {
  switch ((status ?? '').trim()) {
    case '':
      return 'Payment not completed. Please try again.'
    case 'failed':
      return 'The charge was declined. Check your balance and try again.'
    case 'abandoned':
      return 'The prompt was dismissed before you approved it. Try again.'
    case 'cancelled':
      return 'The payment was cancelled. Try again when you\'re ready.'
    case 'amount-mismatch':
      return 'The amount we received didn\'t match. Contact support with your reference.'
    case 'verify-failed':
      return 'We couldn\'t reach the gateway to confirm your payment. Try again in a moment.'
    case 'credit-failed':
      return 'Payment confirmed but we couldn\'t credit your wallet yet — it should land shortly. Contact support if it doesn\'t.'
    case 'missing-reference':
    case 'unknown-reference':
    case 'no-user':
      // Internal wiring problems — the charge couldn't be tied to a pending
      // deposit. If money actually left the wallet the webhook still credits it.
      return 'We couldn\'t match that payment to your deposit. If money left your wallet it will be credited shortly — otherwise please try again.'
    default:
      return `Payment didn't complete (${status}). Try again or contact support.`
  }
}
