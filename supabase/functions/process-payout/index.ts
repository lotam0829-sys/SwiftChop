import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Process Payout Edge Function
 * 
 * Called after an order is delivered (by shipday-webhook).
 * 1. Calculates platform fee from restaurant's order subtotal
 * 2. Creates Paystack Transfer Recipient for restaurant owner
 * 3. Creates Paystack Transfer Recipient for rider
 * 4. Initiates Paystack Transfer to restaurant (subtotal - platform fee)
 * 5. Initiates Paystack Transfer to rider (base + per-km rate)
 * 6. Records rider payment in rider_payments table
 */

const PLATFORM_FEE_PERCENT = 10; // 10% platform commission on food subtotal
const RIDER_BASE_PAY = 100000; // ₦1,000 in kobo
const RIDER_PER_KM_PAY = 15000; // ₦150/km in kobo

function generateReference(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`.toLowerCase().substring(0, 50);
}

async function resolveBankCode(
  paystackSecret: string,
  bankName: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.paystack.co/bank?currency=NGN', {
      headers: { 'Authorization': `Bearer ${paystackSecret}` },
    });
    const result = await response.json();
    if (!result.status || !result.data) return null;

    const nameLower = bankName.toLowerCase().trim();
    
    // Exact match first
    const exact = result.data.find((b: any) => b.name.toLowerCase() === nameLower);
    if (exact) return exact.code;

    // Partial match: check if bank name contains Paystack bank name or vice versa
    const partial = result.data.find((b: any) => {
      const bName = b.name.toLowerCase();
      return nameLower.includes(bName) || bName.includes(nameLower);
    });
    if (partial) return partial.code;

    // Special case: "Test Bank (Paystack)" -> code 001
    if (nameLower.includes('test bank')) return '001';

    return null;
  } catch (err) {
    console.error('Bank code resolution error:', err);
    return null;
  }
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
    console.error('Failed to create transfer recipient:', JSON.stringify(result));
    return null;
  } catch (err) {
    console.error('Transfer recipient error:', err);
    return null;
  }
}

async function initiateTransfer(
  paystackSecret: string,
  amount: number,
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
    console.error('Transfer initiation failed:', JSON.stringify(result));
    return null;
  } catch (err) {
    console.error('Transfer error:', err);
    return null;
  }
}

async function getBankCodeForProfile(
  profile: any,
  paystackSecret: string
): Promise<string | null> {
  // 1. Use stored bank_code if available
  if (profile.bank_code) {
    console.log(`Using stored bank_code: ${profile.bank_code}`);
    return profile.bank_code;
  }

  // 2. Fallback: resolve from bank_name via Paystack API
  if (profile.bank_name) {
    console.log(`Resolving bank code from name: ${profile.bank_name}`);
    const code = await resolveBankCode(paystackSecret, profile.bank_name);
    if (code) {
      console.log(`Resolved bank code: ${code} for ${profile.bank_name}`);
      return code;
    }
    console.error(`Could not resolve bank code for: ${profile.bank_name}`);
  }

  return null;
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
    const platformFee = Math.round(order.subtotal * (PLATFORM_FEE_PERCENT / 100));
    const restaurantPayout = order.subtotal - platformFee;

    console.log(`Platform fee: ${platformFee}, Restaurant payout: ${restaurantPayout}`);

    // 3. Fetch restaurant and owner profile
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('owner_id')
      .eq('id', order.restaurant_id)
      .single();

    let restaurantOwner: any = null;
    if (restaurant?.owner_id) {
      const { data: ownerData } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', restaurant.owner_id)
        .single();
      restaurantOwner = ownerData;
    }

    // === RESTAURANT PAYOUT ===
    if (restaurantOwner?.bank_account_number) {
      const bankCode = await getBankCodeForProfile(restaurantOwner, paystackSecret);

      if (bankCode) {
        const recipient = await createTransferRecipient(
          paystackSecret,
          restaurantOwner.bank_account_name || restaurantOwner.username || 'Restaurant',
          restaurantOwner.bank_account_number,
          bankCode
        );

        if (recipient && restaurantPayout > 0) {
          const ref = generateReference('rest_pay');
          // DB stores prices in naira (e.g. 3500 = ₦3,500), Paystack expects kobo
          const amountInKobo = restaurantPayout * 100;
          const transfer = await initiateTransfer(
            paystackSecret,
            amountInKobo,
            recipient.recipient_code,
            `Payment for order ${order.order_number}`,
            ref
          );

          results.restaurant_payout = {
            amount_naira: restaurantPayout,
            amount_kobo: amountInKobo,
            platform_fee: platformFee,
            transfer_code: transfer?.transfer_code || null,
            status: transfer?.status || 'failed',
            reference: ref,
          };

          // Save bank_code back to profile if not already stored
          if (!restaurantOwner.bank_code && bankCode) {
            await supabaseAdmin
              .from('user_profiles')
              .update({ bank_code: bankCode })
              .eq('id', restaurantOwner.id);
          }

          console.log('Restaurant payout result:', JSON.stringify(results.restaurant_payout));
        }
      } else {
        console.error(`Could not resolve bank code for restaurant owner ${restaurantOwner.id} (bank_name: ${restaurantOwner.bank_name})`);
      }
    } else {
      console.log('Restaurant owner has no bank details, skipping restaurant payout');
    }

    // === RIDER PAYOUT ===
    const isPickupOrder = order.delivery_address?.startsWith('PICKUP:');
    if (!isPickupOrder) {
      const orderDistance = distance_km || 0;
      const riderPayAmount = RIDER_BASE_PAY + Math.round(orderDistance * RIDER_PER_KM_PAY);

      console.log(`Rider pay calculation: base=${RIDER_BASE_PAY} + ${orderDistance}km * ${RIDER_PER_KM_PAY} = ${riderPayAmount} kobo`);

      let riderId: string | null = null;
      let riderProfile: any = null;

      // Strategy 1: Match rider by Shipday carrier phone
      if (order.shipday_carrier_phone) {
        const rawPhone = order.shipday_carrier_phone.replace(/[\s\-()]/g, '');
        // Get last 10 digits for matching
        const last10 = rawPhone.slice(-10);
        console.log(`Looking for rider by phone, raw: ${rawPhone}, last10: ${last10}`);

        const { data: riders } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('role', 'rider')
          .eq('is_approved', true);

        if (riders && riders.length > 0) {
          // Try to match by last 10 digits of phone
          riderProfile = riders.find((r: any) => {
            if (!r.phone) return false;
            const rPhone = r.phone.replace(/[\s\-()]/g, '');
            const rLast10 = rPhone.slice(-10);
            return rLast10 === last10 || rPhone === rawPhone;
          });

          // Fallback: if only one approved rider exists, use them
          if (!riderProfile && riders.length === 1) {
            riderProfile = riders[0];
            console.log(`Single approved rider found, using: ${riderProfile.username} (${riderProfile.id})`);
          }

          // Fallback: match by Shipday carrier name
          if (!riderProfile && order.shipday_carrier_name) {
            const carrierNameLower = order.shipday_carrier_name.toLowerCase().trim();
            riderProfile = riders.find((r: any) => {
              if (!r.username) return false;
              return r.username.toLowerCase().trim() === carrierNameLower ||
                     r.username.toLowerCase().includes(carrierNameLower) ||
                     carrierNameLower.includes(r.username.toLowerCase().trim());
            });
            if (riderProfile) {
              console.log(`Matched rider by name: ${riderProfile.username}`);
            }
          }
        }
      }

      // Strategy 2: If no carrier phone, try by carrier name only
      if (!riderProfile && order.shipday_carrier_name) {
        const carrierNameLower = order.shipday_carrier_name.toLowerCase().trim();
        const { data: riders } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('role', 'rider')
          .eq('is_approved', true);

        if (riders) {
          riderProfile = riders.find((r: any) => {
            if (!r.username) return false;
            return r.username.toLowerCase().includes(carrierNameLower) ||
                   carrierNameLower.includes(r.username.toLowerCase().trim());
          });

          // Last resort: if only one rider exists
          if (!riderProfile && riders.length === 1) {
            riderProfile = riders[0];
            console.log(`Fallback: single approved rider: ${riderProfile.username}`);
          }
        }
      }

      if (riderProfile) {
        riderId = riderProfile.id;
        console.log(`Rider identified: ${riderProfile.username} (${riderId})`);
      }

      if (riderId && riderProfile?.bank_account_number) {
        const bankCode = await getBankCodeForProfile(riderProfile, paystackSecret);

        if (bankCode) {
          const recipient = await createTransferRecipient(
            paystackSecret,
            riderProfile.bank_account_name || riderProfile.username || 'Rider',
            riderProfile.bank_account_number,
            bankCode
          );

          if (recipient) {
            const ref = generateReference('rider_pay');
            const transfer = await initiateTransfer(
              paystackSecret,
              riderPayAmount,
              recipient.recipient_code,
              `Delivery payment for order ${order.order_number}`,
              ref
            );

            const riderPayNaira = Math.round(riderPayAmount / 100);

            // Record rider payment in DB
            const { error: riderPayError } = await supabaseAdmin
              .from('rider_payments')
              .insert({
                order_id: order.id,
                rider_id: riderId,
                amount: riderPayNaira,
                distance_km: orderDistance,
                status: transfer?.status === 'success' ? 'completed' : 'pending',
                paystack_transfer_code: transfer?.transfer_code || null,
                paystack_reference: ref,
              });

            if (riderPayError) {
              console.error('Failed to record rider payment:', riderPayError.message);
            } else {
              console.log(`Rider payment recorded: ₦${riderPayNaira}`);
            }

            // Save bank_code if not stored
            if (!riderProfile.bank_code && bankCode) {
              await supabaseAdmin
                .from('user_profiles')
                .update({ bank_code: bankCode })
                .eq('id', riderId);
            }

            results.rider_payout = {
              rider_id: riderId,
              rider_name: riderProfile.username,
              amount_kobo: riderPayAmount,
              amount_naira: riderPayNaira,
              distance_km: orderDistance,
              transfer_code: transfer?.transfer_code || null,
              status: transfer?.status || 'failed',
              reference: ref,
            };

            // Send push notification to rider
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
                    title: 'Payment Received!',
                    body: `You earned \u20A6${riderPayNaira.toLocaleString()} for delivering order ${order.order_number}.`,
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
          console.error(`Could not resolve bank code for rider ${riderId} (bank_name: ${riderProfile.bank_name})`);
          // Still record a pending payment even without transfer
          const riderPayNaira = Math.round(riderPayAmount / 100);
          await supabaseAdmin
            .from('rider_payments')
            .insert({
              order_id: order.id,
              rider_id: riderId,
              amount: riderPayNaira,
              distance_km: orderDistance,
              status: 'pending',
            });
          console.log(`Recorded pending rider payment: ₦${riderPayNaira} (bank code resolution failed)`);
        }
      } else if (riderId) {
        // Rider found but no bank details
        console.log(`Rider ${riderId} has no bank details, recording pending payment`);
        const riderPayNaira = Math.round(riderPayAmount / 100);
        await supabaseAdmin
          .from('rider_payments')
          .insert({
            order_id: order.id,
            rider_id: riderId,
            amount: riderPayNaira,
            distance_km: orderDistance,
            status: 'pending',
          });
      } else {
        console.log('No rider could be identified for this order, skipping rider payout');
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
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
