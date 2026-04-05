import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Map Shipday webhook events to internal order statuses
function mapShipdayStatus(event: string, orderStatus: string): string | null {
  const eventMap: Record<string, string> = {
    'ORDER_INSERTED': 'pending',
    'ORDER_ASSIGNED': 'confirmed',
    'ORDER_ACCEPTED_AND_STARTED': 'preparing',
    'ORDER_PIKEDUP': 'on_the_way',
    'ORDER_ONTHEWAY': 'on_the_way',
    'ORDER_COMPLETED': 'delivered',
    'ORDER_FAILED': 'cancelled',
    'ORDER_INCOMPLETE': 'cancelled',
  };

  if (eventMap[event]) return eventMap[event];

  const statusMap: Record<string, string> = {
    'NOT_ASSIGNED': 'pending',
    'NOT_ACCEPTED': 'pending',
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

// Build push notification content based on order status
function getNotificationContent(status: string, restaurantName: string, orderNumber: string): { title: string; body: string } | null {
  const messages: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: 'Order Confirmed! ✅',
      body: `${restaurantName} has accepted your order ${orderNumber}. A rider will be assigned shortly.`,
    },
    preparing: {
      title: 'Being Prepared 👨‍🍳',
      body: `Your order from ${restaurantName} is now being prepared. Hang tight!`,
    },
    on_the_way: {
      title: 'On the Way! 🛵',
      body: `Your rider has picked up your order from ${restaurantName} and is heading to you.`,
    },
    delivered: {
      title: 'Order Delivered! 🎉',
      body: `Your order from ${restaurantName} has been delivered. Enjoy your meal! Leave a review to help others.`,
    },
    cancelled: {
      title: 'Order Cancelled ❌',
      body: `Unfortunately your order ${orderNumber} from ${restaurantName} has been cancelled.`,
    },
  };

  return messages[status] || null;
}

// Send push notification via Expo's push service
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
    const body = await req.json();
    console.log('Shipday webhook received:', JSON.stringify(body));

    const { event, order_status, order, carrier } = body;

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

    if (carrier?.name) updatePayload.shipday_carrier_name = carrier.name;
    if (carrier?.phone) updatePayload.shipday_carrier_phone = carrier.phone;

    if (order?.eta) {
      const etaDate = new Date(order.eta);
      const now = new Date();
      const diffMinutes = Math.max(0, Math.round((etaDate.getTime() - now.getTime()) / 60000));
      updatePayload.shipday_eta = `${diffMinutes} min`;
    }

    if (order?.id) updatePayload.shipday_order_id = order.id;

    const trackingLink = order?.trackingLink || order?.tracking_link || order?.trackingUrl || body?.trackingLink;
    if (trackingLink && typeof trackingLink === 'string' && trackingLink.startsWith('http')) {
      updatePayload.shipday_tracking_url = trackingLink;
    }

    console.log(`Updating order ${order.order_number} to status: ${newStatus}`, JSON.stringify(updatePayload));

    // Update order by order_number
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('order_number', order.order_number)
      .select('id, status, order_number, customer_id, restaurant_name')
      .single();

    if (updateError) {
      console.error('Order update error:', updateError.message);
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

    // === PUSH NOTIFICATION ===
    if (updatedOrder?.customer_id) {
      try {
        // Fetch customer push token
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('push_token, username, email')
          .eq('id', updatedOrder.customer_id)
          .single();

        if (profileError) {
          console.error('Failed to fetch customer profile:', profileError.message);
        } else if (profile?.push_token) {
          const notification = getNotificationContent(
            newStatus,
            updatedOrder.restaurant_name || 'Restaurant',
            updatedOrder.order_number || ''
          );

          if (notification) {
            console.log(`Sending push to ${profile.push_token.substring(0, 20)}...`);
            await sendPushNotification(
              profile.push_token,
              notification.title,
              notification.body,
              {
                orderId: updatedOrder.id,
                status: newStatus,
                type: 'order_update',
              }
            );
          }
        } else {
          console.log('Customer has no push token registered');
        }
      } catch (pushErr) {
        // Push notification failure should not fail the webhook
        console.error('Push notification process error:', pushErr);
      }
    }

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
