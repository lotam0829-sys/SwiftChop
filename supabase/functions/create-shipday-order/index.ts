import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SHIPDAY_API_URL = 'https://api.shipday.com/orders';

Deno.serve(async (req: Request) => {
  // CORS preflight
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

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to read order data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the order with items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError?.message);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the restaurant address
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('name, address')
      .eq('id', order.restaurant_id)
      .single();

    // Build Shipday order payload
    // Prices are stored as integers in Naira (not kobo), so no division needed
    const shipdayPayload = {
      orderNumber: order.order_number,
      customerName: order.customer_name || 'SwiftChop Customer',
      customerAddress: order.delivery_address,
      customerEmail: user.email || '',
      customerPhoneNumber: order.customer_phone || '+2340000000000',
      restaurantName: restaurant?.name || order.restaurant_name,
      restaurantAddress: restaurant?.address || 'Lagos, Nigeria',
      expectedDeliveryDate: new Date().toISOString().split('T')[0],
      expectedPickupTime: new Date(Date.now() + 20 * 60000).toISOString().split('T')[1]?.split('.')[0] || '00:00:00',
      expectedDeliveryTime: new Date(Date.now() + 45 * 60000).toISOString().split('T')[1]?.split('.')[0] || '00:00:00',
      orderItem: (order.order_items || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        detail: '',
      })),
      tips: 0,
      tax: 0,
      discountAmount: 0,
      deliveryFee: order.delivery_fee / 100, // Convert from Naira integer to Shipday's decimal format
      totalOrderCost: order.total / 100,
      deliveryInstruction: order.delivery_note || '',
      paymentMethod: order.payment_method === 'cash' ? 'cash' : 'credit_card',
    };

    console.log('Sending to Shipday:', JSON.stringify(shipdayPayload));

    // Call Shipday Insert Order API
    const shipdayResponse = await fetch(SHIPDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${SHIPDAY_API_KEY}`,
      },
      body: JSON.stringify(shipdayPayload),
    });

    const shipdayResult = await shipdayResponse.text();
    console.log('Shipday response:', shipdayResponse.status, shipdayResult);

    if (!shipdayResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Shipday: ${shipdayResult}` }),
        { status: shipdayResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let shipdayData: any;
    try {
      shipdayData = JSON.parse(shipdayResult);
    } catch {
      shipdayData = { success: true, response: shipdayResult };
    }

    const shipdayOrderId = shipdayData.orderId || shipdayData.id || null;

    // Extract tracking URL from Shipday response if available
    // Shipday may return a trackingLink or trackingUrl field
    let trackingUrl = shipdayData.trackingLink || shipdayData.trackingUrl || shipdayData.tracking_url || null;

    // Only store valid HTTP URLs
    if (trackingUrl && !trackingUrl.startsWith('http')) {
      trackingUrl = null;
    }

    // Extract distance from Shipday response (km between pickup and delivery)
    const shipdayDistance = shipdayData.distance ?? null;

    // Update order with Shipday data
    const updatePayload: Record<string, any> = {
      shipday_order_id: shipdayOrderId,
      updated_at: new Date().toISOString(),
    };

    // Only set tracking URL if we have a valid one
    if (trackingUrl) {
      updatePayload.shipday_tracking_url = trackingUrl;
    }

    // If Shipday returned an actual distance, recalculate and update delivery fee
    if (shipdayDistance && shipdayDistance > 0) {
      // Pricing formula: baseFee (500) + ceil(km) * perKmRate (150), clamped [500, 5000]
      const baseFee = 500;
      const perKmRate = 150;
      const minFee = 500;
      const maxFee = 5000;
      const recalcFee = Math.min(maxFee, Math.max(minFee, baseFee + Math.ceil(shipdayDistance) * perKmRate));

      // Update delivery fee and total based on actual distance
      const feeDiff = recalcFee - (order.delivery_fee || 0);
      if (feeDiff !== 0) {
        updatePayload.delivery_fee = recalcFee;
        updatePayload.total = (order.total || 0) + feeDiff;
        console.log(`Delivery fee adjusted: ${order.delivery_fee} -> ${recalcFee} (distance: ${shipdayDistance}km)`);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      console.error('Order update error:', updateError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        shipdayOrderId,
        trackingUrl,
        shipdayResponse: shipdayData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
