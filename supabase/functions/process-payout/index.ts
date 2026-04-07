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
    // In Paystack test mode, use 'test-bank' for test accounts
    const isTestKey = paystackSecret.startsWith('sk_test_');
    let effectiveBankCode = bankCode;
    if (isTestKey && (bankCode === '001' || accountNumber === '0000000000')) {
      effectiveBankCode = 'test-bank';
      console.log(`Test mode: mapping bank_code '${bankCode}' -> 'test-bank' for transfer recipient`);
    }

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
        bank_code: effectiveBankCode,
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
      // Use Geoapify route distance if available, fallback to webhook distance, then 0
      let orderDistance = distance_km || 0;

      // If distance is 0, try to calculate via Geoapify
      if (orderDistance <= 0) {
        try {
          const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY');
          if (geoapifyKey) {
            // Fetch restaurant and customer coordinates
            const { data: restGeo } = await supabaseAdmin
              .from('restaurants')
              .select('latitude, longitude')
              .eq('id', order.restaurant_id)
              .single();
            const { data: custGeo } = await supabaseAdmin
              .from('user_profiles')
              .select('latitude, longitude')
              .eq('id', order.customer_id)
              .single();

            if (restGeo?.latitude && restGeo?.longitude && custGeo?.latitude && custGeo?.longitude) {
              const waypoints = `${restGeo.latitude},${restGeo.longitude}|${custGeo.latitude},${custGeo.longitude}`;
              const routeResp = await fetch(
                `https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=drive&apiKey=${geoapifyKey}`
              );
              if (routeResp.ok) {
                const routeData = await routeResp.json();
                const route = routeData?.features?.[0]?.properties;
                if (route?.distance) {
                  orderDistance = parseFloat((route.distance / 1000).toFixed(2));
                  console.log(`Geoapify payout distance: ${orderDistance}km`);
                }
              }
            }
          }
        } catch (geoErr) {
          console.error('Geoapify distance calc in payout failed:', geoErr);
        }
      }
      const riderPayAmount = RIDER_BASE_PAY + Math.round(orderDistance * RIDER_PER_KM_PAY);

      console.log(`Rider pay calculation: base=${RIDER_BASE_PAY} + ${orderDistance}km * ${RIDER_PER_KM_PAY} = ${riderPayAmount} kobo`);

      let riderId: string | null = null;
      let riderProfile: any = null;

      // Fetch all approved riders once for matching
      const { data: allRiders } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('role', 'rider')
        .eq('is_approved', true);

      const riders = allRiders || [];
      console.log(`Found ${riders.length} approved riders for matching`);

      // Helper: extract last 10 digits from any phone format
      function normalizePhone(phone: string): string {
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        // Return last 10 digits (Nigerian local number)
        return digits.slice(-10);
      }

      // Strategy 1: Match by phone number (last 10 digits)
      if (order.shipday_carrier_phone) {
        const carrierLast10 = normalizePhone(order.shipday_carrier_phone);
        console.log(`Matching rider by phone - carrier last10: ${carrierLast10} (raw: ${order.shipday_carrier_phone})`);

        riderProfile = riders.find((r: any) => {
          if (!r.phone) return false;
          const riderLast10 = normalizePhone(r.phone);
          const match = riderLast10 === carrierLast10;
          if (match) console.log(`Phone match found: rider ${r.username} (${r.phone}) last10=${riderLast10}`);
          return match;
        }) || null;
      }

      // Strategy 2: Match by carrier name
      if (!riderProfile && order.shipday_carrier_name) {
        const carrierNameLower = order.shipday_carrier_name.toLowerCase().trim();
        console.log(`Matching rider by name: ${carrierNameLower}`);
        riderProfile = riders.find((r: any) => {
          if (!r.username) return false;
          const rName = r.username.toLowerCase().trim();
          return rName === carrierNameLower ||
                 rName.includes(carrierNameLower) ||
                 carrierNameLower.includes(rName);
        }) || null;
        if (riderProfile) console.log(`Name match found: ${riderProfile.username}`);
      }

      // Strategy 3: If only one approved rider, use them
      if (!riderProfile && riders.length === 1) {
        riderProfile = riders[0];
        console.log(`Fallback: single approved rider: ${riderProfile.username} (${riderProfile.id})`);
      }

      if (riderProfile) {
        riderId = riderProfile.id;
        console.log(`Rider identified: ${riderProfile.username} (${riderId})`);
      }

      if (riderId && riderProfile) {
        const riderPayNaira = Math.round(riderPayAmount / 100);
        let transferDone = false;

        // Strategy A: Use existing Paystack subaccount (preferred — created during onboarding)
        if (riderProfile.paystack_subaccount_code) {
          console.log(`Rider has Paystack subaccount: ${riderProfile.paystack_subaccount_code}`);
          // Subaccount exists — initiate direct transfer using bank details
        }

        // Strategy B: Create transfer recipient from bank details and transfer
        if (riderProfile.bank_account_number) {
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

              transferDone = true;

              // Save bank_code if not stored
              if (!riderProfile.bank_code && bankCode) {
                await supabaseAdmin
                  .from('user_profiles')
                  .update({ bank_code: bankCode })
                  .eq('id', riderId);
              }

              // Create Paystack subaccount if rider doesn't have one yet
              if (!riderProfile.paystack_subaccount_code) {
                try {
                  const subResp = await fetch('https://api.paystack.co/subaccount', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${paystackSecret}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      business_name: riderProfile.bank_account_name || riderProfile.username || 'Rider',
                      bank_code: bankCode,
                      account_number: riderProfile.bank_account_number,
                      percentage_charge: 0,
                    }),
                  });
                  const subResult = await subResp.json();
                  if (subResult.status && subResult.data?.subaccount_code) {
                    await supabaseAdmin
                      .from('user_profiles')
                      .update({ paystack_subaccount_code: subResult.data.subaccount_code })
                      .eq('id', riderId);
                    console.log(`Created missing Paystack subaccount for rider: ${subResult.data.subaccount_code}`);
                  }
                } catch (subErr) {
                  console.error('Failed to create rider subaccount retroactively:', subErr);
                }
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
          }
        }

        // If transfer was not done for any reason, still record a pending payment
        if (!transferDone) {
          console.log(`Recording pending rider payment for rider ${riderId}`);
          await supabaseAdmin
            .from('rider_payments')
            .insert({
              order_id: order.id,
              rider_id: riderId,
              amount: riderPayNaira,
              distance_km: orderDistance,
              status: 'pending',
            });
          console.log(`Recorded pending rider payment: ₦${riderPayNaira}`);
        }
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
