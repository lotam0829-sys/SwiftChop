import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Refund Order Edge Function
 * 
 * Initiates a Paystack refund when a restaurant declines an order.
 * The customer is refunded the full amount charged.
 * 
 * Expected body: { order_id: string }
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({ error: 'Paystack secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the order to get the total amount
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total, status, customer_id')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      console.error('Order not found:', orderErr?.message);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only refund cancelled orders
    if (order.status !== 'cancelled') {
      return new Response(
        JSON.stringify({ error: `Order status is "${order.status}" — can only refund cancelled orders` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing refund for order ${order.order_number}, amount: ${order.total}`);

    // Find the Paystack transaction reference for this order
    // The reference format is: SC-{first8chars of orderId}-{timestamp}
    // We need to list recent transactions and find the matching one
    const orderIdPrefix = order_id.slice(0, 8);

    // Search Paystack transactions by metadata
    const listResponse = await fetch(
      `https://api.paystack.co/transaction?perPage=20&status=success`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const listResult = await listResponse.json();

    let transactionReference: string | null = null;

    if (listResult.status && listResult.data) {
      // Find the transaction matching this order
      for (const txn of listResult.data) {
        const ref = txn.reference || '';
        const metaOrderId = txn.metadata?.order_id;
        
        if (metaOrderId === order_id || ref.includes(`SC-${orderIdPrefix}`)) {
          transactionReference = ref;
          break;
        }
      }
    }

    if (!transactionReference) {
      console.log('No Paystack transaction found for this order. Customer may not have paid yet.');
      
      // Send push notification to customer about cancellation (no charge)
      const { data: customer } = await supabaseAdmin
        .from('user_profiles')
        .select('push_token, username')
        .eq('id', order.customer_id)
        .single();

      if (customer?.push_token) {
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: customer.push_token,
              sound: 'default',
              title: 'Order Declined',
              body: `Your order ${order.order_number} was declined by the restaurant. No charge was made.`,
              data: { type: 'order_declined', order_id },
              priority: 'high',
              channelId: 'order-updates',
            }),
          });
        } catch (pushErr) {
          console.error('Push notification failed:', pushErr);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          refunded: false, 
          message: 'Order declined. No payment found to refund — customer was not charged.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initiate refund via Paystack
    console.log(`Initiating Paystack refund for reference: ${transactionReference}`);

    const refundResponse = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: transactionReference,
        merchant_note: `Order ${order.order_number} declined by restaurant`,
      }),
    });

    const refundResult = await refundResponse.json();
    console.log('Paystack refund result:', JSON.stringify(refundResult));

    if (!refundResult.status) {
      console.error('Paystack refund failed:', refundResult.message);
      return new Response(
        JSON.stringify({ 
          error: `Refund failed: ${refundResult.message || 'Unknown error'}. Please contact support.`,
          paystack_message: refundResult.message,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notification to customer about successful refund
    const { data: customer } = await supabaseAdmin
      .from('user_profiles')
      .select('push_token, username')
      .eq('id', order.customer_id)
      .single();

    if (customer?.push_token) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customer.push_token,
            sound: 'default',
            title: 'Refund Initiated',
            body: `Your payment of \u20A6${order.total.toLocaleString()} for order ${order.order_number} is being refunded. It may take 3-5 business days to reflect.`,
            data: { type: 'order_refund', order_id, amount: order.total },
            priority: 'high',
            channelId: 'order-updates',
          }),
        });
        console.log('Refund notification sent to customer');
      } catch (pushErr) {
        console.error('Refund notification failed:', pushErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        refunded: true, 
        amount: order.total,
        reference: refundResult.data?.transaction?.reference,
        message: `Refund of \u20A6${order.total.toLocaleString()} initiated successfully.` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Refund error:', err);
    return new Response(
      JSON.stringify({ error: `Refund: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
