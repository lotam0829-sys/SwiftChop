import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, any>) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        channelId: 'order-updates',
      }),
    });
    const result = await response.json();
    console.log('Push notification result:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('Push notification error:', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_id, restaurant_name, status, delivery_address')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError?.message);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify this is a pickup order
    const isPickup = order.delivery_address?.startsWith('PICKUP:');
    if (!isPickup) {
      return new Response(
        JSON.stringify({ error: 'This is not a pickup order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch customer push token
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('push_token, username')
      .eq('id', order.customer_id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError.message);
      return new Response(
        JSON.stringify({ error: 'Customer profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.push_token) {
      return new Response(
        JSON.stringify({ error: 'Customer has no push token. They may not have notifications enabled.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send pickup ready notification
    const title = 'Your Order is Ready! 🎉';
    const body = `Your pickup order from ${order.restaurant_name} is ready for collection. Head over to pick it up!`;

    await sendPushNotification(
      profile.push_token,
      title,
      body,
      {
        orderId: order.id,
        type: 'pickup_ready',
        status: 'ready_for_pickup',
      }
    );

    console.log(`Pickup ready notification sent for order ${order.order_number}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Customer has been notified' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Notify pickup ready error:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
