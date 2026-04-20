import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Paystack Webhook Edge Function
 * 
 * Listens for Paystack events:
 * - charge.success: Confirm order payment, capture card authorization for saved cards
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

    // ==================== CHARGE SUCCESS ====================
    // Confirm order payment + capture card authorization for saved cards
    if (event === 'charge.success') {
      console.log('Charge success received:', data.reference, 'Status:', data.status);

      const orderId = data.metadata?.order_id;
      const authorization = data.authorization;
      const customerEmail = data.customer?.email;

      // 1. Confirm order payment (transition awaiting_payment -> pending)
      if (orderId) {
        const { error: confirmErr } = await supabaseAdmin
          .from('orders')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .eq('status', 'awaiting_payment');

        if (confirmErr) {
          console.error('Failed to confirm order payment:', confirmErr.message);
        } else {
          console.log('Order confirmed via webhook:', orderId);
        }
      }

      // 2. Capture card authorization for saved cards
      if (authorization && authorization.reusable && customerEmail) {
        const cardData = {
          authorization_code: authorization.authorization_code,
          card_type: authorization.card_type || 'unknown',
          last4: authorization.last4 || '****',
          exp_month: authorization.exp_month || '',
          exp_year: authorization.exp_year || '',
          bank: authorization.bank || 'Unknown Bank',
          brand: authorization.brand || authorization.card_type || 'Card',
          signature: authorization.signature || '',
          channel: authorization.channel || 'card',
          saved_at: new Date().toISOString(),
        };

        console.log('Capturing reusable card:', cardData.brand, cardData.last4, 'for', customerEmail);

        // Find user by email
        const { data: users, error: userErr } = await supabaseAdmin
          .from('user_profiles')
          .select('id, saved_cards')
          .eq('email', customerEmail)
          .limit(1);

        if (!userErr && users && users.length > 0) {
          const user = users[0];
          const existingCards = Array.isArray(user.saved_cards) ? user.saved_cards : [];

          // Check if this card (by signature or last4+brand) is already saved
          const isDuplicate = existingCards.some((c: any) =>
            (c.signature && c.signature === cardData.signature) ||
            (c.last4 === cardData.last4 && c.brand === cardData.brand && c.exp_month === cardData.exp_month && c.exp_year === cardData.exp_year)
          );

          if (!isDuplicate) {
            const updatedCards = [...existingCards, cardData];
            const { error: saveErr } = await supabaseAdmin
              .from('user_profiles')
              .update({ saved_cards: updatedCards })
              .eq('id', user.id);

            if (saveErr) {
              console.error('Failed to save card:', saveErr.message);
            } else {
              console.log('Card saved for user:', user.id, cardData.brand, cardData.last4);
            }
          } else {
            console.log('Card already saved (duplicate), skipping:', cardData.last4);
          }
        } else {
          console.log('User not found for email:', customerEmail, userErr?.message);
        }
      }

      return new Response(
        JSON.stringify({ received: true, order_id: orderId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== TRANSFER EVENTS ====================
    if (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') {
      const transferCode = data.transfer_code;
      const reference = data.reference;
      const amount = data.amount ? Math.round(data.amount / 100) : 0;

      if (!transferCode && !reference) {
        console.log('No transfer_code or reference found in webhook');
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newStatus = event === 'transfer.success' ? 'completed' : 'failed';
      console.log(`Transfer ${event}: code=${transferCode}, ref=${reference}, amount=${amount}, new_status=${newStatus}`);

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
        return new Response(JSON.stringify({ received: true, matched: false }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payment = payments[0];

      if (payment.status === 'completed' && newStatus !== 'completed') {
        console.log(`Skipping status downgrade: ${payment.status} -> ${newStatus}`);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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
