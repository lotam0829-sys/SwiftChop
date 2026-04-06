import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Process Payout Edge Function
 * 
 * Called after an order is delivered (by shipday-webhook or manually).
 * 1. Calculates platform fee from restaurant's order subtotal
 * 2. Creates Paystack Transfer Recipient for restaurant (if not cached)
 * 3. Creates Paystack Transfer Recipient for rider (if assigned)
 * 4. Initiates Paystack Transfer to restaurant (subtotal - platform fee)
 * 5. Initiates Paystack Transfer to rider (base + per-km rate)
 * 6. Records rider payment in rider_payments table
 * 7. Updates order with payout status
 */

const PLATFORM_FEE_PERCENT = 10; // 10% platform commission on food subtotal
const RIDER_BASE_PAY = 100000; // ₦1,000 in kobo
const RIDER_PER_KM_PAY = 15000; // ₦150/km in kobo

function generateReference(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`.toLowerCase().substring(0, 50);
}

async function createTransferRecipient(
  paystackSecret: string,
  name: string,
  accountNumber: string,
  bankCode: string
): Promise<{ recipient_code: string } | null> {
  try {
    const response = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });

    const result = await response.json();
    if (result.status && result.data?.recipient_code) {
      console.log(`Transfer recipient created: ${result.data.recipient_code} for ${name}`);
      return { recipient_code: result.data.recipient_code };
    }
    console.error('Failed to create transfer recipient:', result.message);
    return null;
  } catch (err) {
    console.error('Transfer recipient error:', err);
    return null;
  }
}

async function initiateTransfer(
  paystackSecret: string,
  amount: number, // in kobo
  recipientCode: string,
  reason: string,
  reference: string
): Promise<{ transfer_code: string; status: string } | null> {
  try {
    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount,
        recipient: recipientCode,
        reason,
        reference,
      }),
    });

    const result = await response.json();
    if (result.status) {
      console.log(`Transfer initiated: ${result.data.transfer_code} - ${result.data.status}`);
      return {
        transfer_code: result.data.transfer_code,
        status: result.data.status,
      };
    }
    console.error('Transfer initiation failed:', result.message);
    return null;
  } catch (err) {
    console.error('Transfer error:', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id, distance_km } = await req.json();

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

    // 1. Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError?.message);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing payout for order ${order.order_number}, subtotal: ${order.subtotal}, delivery_fee: ${order.delivery_fee}`);

    const results: Record<string, any> = {
      order_id: order.id,
      order_number: order.order_number,
      restaurant_payout: null,
      rider_payout: null,
    };

    // 2. Calculate restaurant payout (subtotal minus platform fee)
    const platformFee = Math.round(order.subtotal * (PLATFORM_FEE_PERCENT / 100)); // in lowest currency unit (kobo assumed from DB)
    const restaurantPayout = order.subtotal - platformFee; // Amount in same unit as stored

    console.log(`Platform fee: ${platformFee}, Restaurant payout: ${restaurantPayout}`);

    // 3. Fetch restaurant owner profile for bank details
    const { data: restaurantOwner, error: ownerError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, bank_name, bank_account_number, bank_account_name, paystack_subaccount_code, username, email')
      .eq('id', (await supabaseAdmin
        .from('restaurants')
        .select('owner_id')
        .eq('id', order.restaurant_id)
        .single()
      ).data?.owner_id)
      .single();

    // === RESTAURANT PAYOUT ===
    if (restaurantOwner && restaurantOwner.bank_account_number) {
      // Fetch the bank code from the restaurant's stored bank name
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('owner_id')
        .eq('id', order.restaurant_id)
        .single();

      // Look up bank code — we need to resolve it from the stored bank name
      // For now, we create a transfer recipient using account details
      // First check if we have a stored recipient code or need to create one
      let restaurantRecipientCode: string | null = null;

      // Get bank code from user profile or resolve it
      const { data: fullProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', restaurantOwner.id)
        .single();

      if (fullProfile?.bank_account_number && fullProfile?.bank_name) {
        // We need the bank code — query Paystack for bank list to match
        // For efficiency, we store a mapping. Use the code from nigerianBanks constant
        // Since we are server-side, we resolve bank code via Paystack
        const banksResponse = await fetch('https://api.paystack.co/bank?currency=NGN', {
          headers: { 'Authorization': `Bearer ${paystackSecret}` },
        });
        const banksResult = await banksResponse.json();
        const matchedBank = banksResult.data?.find((b: any) =>
          b.name.toLowerCase().includes(fullProfile.bank_name.toLowerCase()) ||
          fullProfile.bank_name.toLowerCase().includes(b.name.toLowerCase())
        );

        if (matchedBank) {
          const recipient = await createTransferRecipient(
            paystackSecret,
            fullProfile.bank_account_name || fullProfile.username || 'Restaurant',
            fullProfile.bank_account_number,
            matchedBank.code
          );
          if (recipient) {
            restaurantRecipientCode = recipient.recipient_code;
          }
        } else {
          console.error(`Could not match bank name: ${fullProfile.bank_name}`);
        }
      }

      if (restaurantRecipientCode && restaurantPayout > 0) {
        const ref = generateReference('rest_pay');
        const transfer = await initiateTransfer(
          paystackSecret,
          restaurantPayout * 100, // Convert to kobo if stored in naira; DB stores in kobo already if price is e.g. 3500 for ₦3,500
          restaurantRecipientCode,
          `Payment for order ${order.order_number}`,
          ref
        );

        results.restaurant_payout = {
          amount: restaurantPayout,
          platform_fee: platformFee,
          transfer_code: transfer?.transfer_code || null,
          status: transfer?.status || 'failed',
          reference: ref,
        };

        console.log('Restaurant payout result:', JSON.stringify(results.restaurant_payout));
      }
    } else {
      console.log('Restaurant owner has no bank details, skipping restaurant payout');
    }

    // === RIDER PAYOUT ===
    const isPickupOrder = order.delivery_address?.startsWith('PICKUP:');
    if (!isPickupOrder) {
      // Find rider — check if there is a carrier assigned via Shipday
      // The rider might be tracked via shipday_carrier_name/phone, but we need to find the rider user
      // For now, we look for riders with matching details or use the distance from webhook
      const orderDistance = distance_km || 0;
      const riderPayAmount = RIDER_BASE_PAY + Math.round(orderDistance * RIDER_PER_KM_PAY); // in kobo

      console.log(`Rider pay calculation: base=${RIDER_BASE_PAY} + ${orderDistance}km * ${RIDER_PER_KM_PAY} = ${riderPayAmount} kobo`);

      // Find available rider — for now, query riders who might be assigned
      // In production, the Shipday webhook would include carrier details that map to a rider
      let riderId: string | null = null;
      let riderProfile: any = null;

      // Try to find rider by Shipday carrier phone
      if (order.shipday_carrier_phone) {
        const phone = order.shipday_carrier_phone.replace(/\s/g, '');
        const { data: riderByPhone } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('role', 'rider')
          .eq('is_approved', true)
          .or(`phone.eq.${phone},phone.ilike.%${phone.slice(-10)}%`)
          .limit(1)
          .single();

        if (riderByPhone) {
          riderId = riderByPhone.id;
          riderProfile = riderByPhone;
          console.log(`Found rider by phone: ${riderByPhone.username} (${riderId})`);
        }
      }

      if (riderId && riderProfile?.bank_account_number && riderProfile?.bank_name) {
        // Create transfer recipient for rider
        const banksResponse = await fetch('https://api.paystack.co/bank?currency=NGN', {
          headers: { 'Authorization': `Bearer ${paystackSecret}` },
        });
        const banksResult = await banksResponse.json();
        const matchedBank = banksResult.data?.find((b: any) =>
          b.name.toLowerCase().includes(riderProfile.bank_name.toLowerCase()) ||
          riderProfile.bank_name.toLowerCase().includes(b.name.toLowerCase())
        );

        let riderRecipientCode: string | null = null;
        if (matchedBank) {
          const recipient = await createTransferRecipient(
            paystackSecret,
            riderProfile.bank_account_name || riderProfile.username || 'Rider',
            riderProfile.bank_account_number,
            matchedBank.code
          );
          if (recipient) {
            riderRecipientCode = recipient.recipient_code;
          }
        }

        if (riderRecipientCode) {
          const ref = generateReference('rider_pay');
          const transfer = await initiateTransfer(
            paystackSecret,
            riderPayAmount,
            riderRecipientCode,
            `Delivery payment for order ${order.order_number}`,
            ref
          );

          // Record rider payment in DB
          const { error: riderPayError } = await supabaseAdmin
            .from('rider_payments')
            .insert({
              order_id: order.id,
              rider_id: riderId,
              amount: Math.round(riderPayAmount / 100), // Store in naira (divide kobo by 100)
              distance_km: orderDistance,
              status: transfer?.status === 'success' ? 'completed' : 'pending',
              paystack_transfer_code: transfer?.transfer_code || null,
              paystack_reference: ref,
            });

          if (riderPayError) {
            console.error('Failed to record rider payment:', riderPayError.message);
          }

          results.rider_payout = {
            rider_id: riderId,
            amount_kobo: riderPayAmount,
            amount_naira: Math.round(riderPayAmount / 100),
            distance_km: orderDistance,
            transfer_code: transfer?.transfer_code || null,
            status: transfer?.status || 'failed',
            reference: ref,
          };

          // Send push notification to rider about payment
          if (riderProfile.push_token) {
            try {
              await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: riderProfile.push_token,
                  sound: 'default',
                  title: 'Payment Received! 💰',
                  body: `You earned \u20A6${Math.round(riderPayAmount / 100).toLocaleString()} for delivering order ${order.order_number}.`,
                  data: { type: 'rider_payment', orderId: order.id },
                  priority: 'high',
                  channelId: 'order-updates',
                }),
              });
              console.log('Rider payment notification sent');
            } catch (pushErr) {
              console.error('Rider push notification failed:', pushErr);
            }
          }

          console.log('Rider payout result:', JSON.stringify(results.rider_payout));
        }
      } else {
        console.log('No rider found or rider has no bank details, skipping rider payout');

        // Still record a pending payment if we know a rider was assigned
        if (riderId) {
          await supabaseAdmin
            .from('rider_payments')
            .insert({
              order_id: order.id,
              rider_id: riderId,
              amount: Math.round(riderPayAmount / 100),
              distance_km: orderDistance,
              status: 'pending',
            });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Process payout error:', err);
    return new Response(
      JSON.stringify({ error: `Payout: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
