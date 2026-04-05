import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Map Shipday webhook events to our internal order statuses
function mapShipdayStatus(event: string, orderStatus: string): string | null {
  // Event-based mapping (higher priority)
  const eventMap: Record<string, string> = {
    'ORDER_ASSIGNED': 'confirmed',
    'ORDER_ACCEPTED_AND_STARTED': 'preparing',
    'ORDER_PIKEDUP': 'on_the_way',
    'ORDER_ONTHEWAY': 'on_the_way',
    'ORDER_COMPLETED': 'delivered',
    'ORDER_FAILED': 'cancelled',
    'ORDER_INCOMPLETE': 'cancelled',
  };

  if (eventMap[event]) return eventMap[event];

  // Fallback: order_status based mapping
  const statusMap: Record<string, string> = {
    'NOT_ASSIGNED': 'confirmed',
    'NOT_ACCEPTED': 'confirmed',
    'NOT_STARTED_YET': 'confirmed',
    'STARTED': 'preparing',
    'PICKED_UP': 'on_the_way',
    'READY_TO_DELIVER': 'on_the_way',
    'ALREADY_DELIVERED': 'delivered',
    'INCOMPLETE': 'cancelled',
    'FAILED_DELIVERY': 'cancelled',
  };

  return statusMap[orderStatus] || null;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    console.log('Shipday webhook received:', JSON.stringify(body));

    const {
      event,
      order_status,
      order,
      carrier,
      delivery_details,
    } = body;

    if (!order?.order_number) {
      console.error('Webhook missing order_number');
      return new Response(
        JSON.stringify({ error: 'Missing order_number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Map Shipday status to our internal status
    const newStatus = mapShipdayStatus(event, order_status);
    if (!newStatus) {
      console.log(`Ignoring event ${event} with status ${order_status}`);
      return new Response(
        JSON.stringify({ received: true, ignored: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Extract carrier info if available
    if (carrier?.name) {
      updatePayload.shipday_carrier_name = carrier.name;
    }
    if (carrier?.phone) {
      updatePayload.shipday_carrier_phone = carrier.phone;
    }

    // Extract ETA if available
    if (order?.eta) {
      const etaDate = new Date(order.eta);
      const now = new Date();
      const diffMinutes = Math.max(0, Math.round((etaDate.getTime() - now.getTime()) / 60000));
      updatePayload.shipday_eta = `${diffMinutes} min`;
    }

    // Extract Shipday order ID
    if (order?.id) {
      updatePayload.shipday_order_id = order.id;
      updatePayload.shipday_tracking_url = `https://app.shipday.com/track/${order.id}`;
    }

    console.log(`Updating order ${order.order_number} to status: ${newStatus}`, JSON.stringify(updatePayload));

    // Update order by order_number
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('order_number', order.order_number)
      .select('id, status, order_number')
      .single();

    if (updateError) {
      console.error('Order update error:', updateError.message);
      // Try with Shipday order ID as fallback
      if (order.id) {
        const { error: fallbackError } = await supabaseAdmin
          .from('orders')
          .update(updatePayload)
          .eq('shipday_order_id', order.id);

        if (fallbackError) {
          console.error('Fallback update error:', fallbackError.message);
          return new Response(
            JSON.stringify({ error: 'Failed to update order' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    console.log('Order updated successfully:', updatedOrder);

    return new Response(
      JSON.stringify({ received: true, status: newStatus, orderId: updatedOrder?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: `Webhook error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
