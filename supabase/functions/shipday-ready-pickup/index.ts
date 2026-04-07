import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Shipday Ready for Pickup Edge Function
 * 
 * When a restaurant marks an order as "Ready for Pickup" in SwiftChop,
 * this function calls the Shipday API to notify the assigned driver.
 * 
 * PUT https://api.shipday.com/orders/{orderId}/meta
 * Body: { readyToPickup: true }
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SHIPDAY_API_KEY = Deno.env.get('SHIPDAY_API_KEY');
    if (!SHIPDAY_API_KEY) {
      console.error('SHIPDAY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Shipday API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the order to get the Shipday order ID
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, shipday_order_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError?.message);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use shipday_order_id if available, otherwise try order_number
    const shipdayId = order.shipday_order_id;
    if (!shipdayId) {
      console.log('No Shipday order ID found, cannot notify ready for pickup');
      return new Response(
        JSON.stringify({ error: 'Order has not been dispatched to Shipday yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Notifying Shipday that order ${shipdayId} is ready for pickup`);

    // Call Shipday "Ready to Pickup" API
    const shipdayResponse = await fetch(`https://api.shipday.com/orders/${shipdayId}/meta`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${SHIPDAY_API_KEY}`,
      },
      body: JSON.stringify({ readyToPickup: true }),
    });

    const responseText = await shipdayResponse.text();
    console.log('Shipday ready-for-pickup response:', shipdayResponse.status, responseText);

    if (!shipdayResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Shipday API error: ${responseText}` }),
        { status: shipdayResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Shipday notified: order ready for pickup' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Shipday ready pickup error:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
