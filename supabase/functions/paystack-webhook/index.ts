import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Paystack Webhook Edge Function
 * 
 * Listens for Paystack transfer events:
 * - transfer.success: Update rider_payments status to 'completed'
 * - transfer.failed: Update rider_payments status to 'failed'
 * - transfer.reversed: Update rider_payments status to 'failed'
 * 
 * Sends push notifications to riders on transfer completion/failure.
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Paystack webhook received:', JSON.stringify(body));

    const event = body.event;
    const data = body.data;

    if (!event || !data) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle transfer events
    if (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') {
      const transferCode = data.transfer_code;
      const reference = data.reference;
      const amount = data.amount ? Math.round(data.amount / 100) : 0; // Convert kobo to naira

      if (!transferCode && !reference) {
        console.log('No transfer_code or reference found in webhook');
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Determine new status
      const newStatus = event === 'transfer.success' ? 'completed' : 'failed';
      console.log(`Transfer ${event}: code=${transferCode}, ref=${reference}, amount=${amount}, new_status=${newStatus}`);

      // Find the payment record
      let query = supabaseAdmin
        .from('rider_payments')
        .select('id, rider_id, amount, payment_type, status')
        .limit(1);

      if (transferCode) {
        query = query.eq('paystack_transfer_code', transferCode);
      } else if (reference) {
        query = query.eq('paystack_reference', reference);
      }

      const { data: payments, error: findErr } = await query;

      if (findErr || !payments || payments.length === 0) {
        console.log(`Payment record not found for transfer_code=${transferCode}, reference=${reference}`);
        // Still return 200 so Paystack doesn't retry
        return new Response(JSON.stringify({ received: true, matched: false }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payment = payments[0];

      // Don't downgrade a 'completed' status
      if (payment.status === 'completed' && newStatus !== 'completed') {
        console.log(`Skipping status downgrade: ${payment.status} -> ${newStatus}`);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update the payment status
      const { error: updateErr } = await supabaseAdmin
        .from('rider_payments')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (updateErr) {
        console.error('Failed to update payment status:', updateErr.message);
      } else {
        console.log(`Payment ${payment.id} updated to ${newStatus}`);
      }

      // Send push notification to rider
      if (payment.rider_id) {
        const { data: rider } = await supabaseAdmin
          .from('user_profiles')
          .select('push_token, username')
          .eq('id', payment.rider_id)
          .single();

        if (rider?.push_token) {
          const isWithdrawal = payment.payment_type === 'withdrawal';
          const notifTitle = event === 'transfer.success'
            ? (isWithdrawal ? 'Withdrawal Complete' : 'Payment Received')
            : (isWithdrawal ? 'Withdrawal Failed' : 'Payment Failed');

          const notifBody = event === 'transfer.success'
            ? (isWithdrawal 
                ? `Your withdrawal of \u20A6${payment.amount.toLocaleString()} has been deposited to your bank account.`
                : `\u20A6${payment.amount.toLocaleString()} delivery payment has been deposited to your account.`)
            : (isWithdrawal
                ? `Your withdrawal of \u20A6${payment.amount.toLocaleString()} could not be processed. Please try again or contact support.`
                : `Delivery payment of \u20A6${payment.amount.toLocaleString()} failed. Please contact support.`);

          try {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: rider.push_token,
                sound: 'default',
                title: notifTitle,
                body: notifBody,
                data: { 
                  type: event === 'transfer.success' ? 'transfer_success' : 'transfer_failed',
                  payment_id: payment.id,
                  amount: payment.amount,
                },
                priority: 'high',
                channelId: 'order-updates',
              }),
            });
            console.log('Rider notification sent');
          } catch (pushErr) {
            console.error('Rider notification failed:', pushErr);
          }
        }
      }

      return new Response(
        JSON.stringify({ received: true, payment_id: payment.id, new_status: newStatus }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle charge.success for payment verification (future use)
    if (event === 'charge.success') {
      console.log('Charge success received:', data.reference);
      // Can be used to verify order payments
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown event - still acknowledge
    console.log(`Unhandled Paystack event: ${event}`);
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Paystack webhook error:', err);
    return new Response(
      JSON.stringify({ error: `Webhook: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
