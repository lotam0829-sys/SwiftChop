import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, amount, order_id, subaccount, metadata } = await req.json();

    if (!email || !amount || !order_id) {
      return new Response(
        JSON.stringify({ error: 'email, amount, and order_id are required' }),
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

    // Platform fee: flat ₦200 service fee (in kobo) goes to main account
    // The rest goes to the restaurant subaccount
    const platformFeeKobo = 20000; // ₦200 in kobo

    const body: Record<string, any> = {
      email,
      amount: amount * 100, // Convert naira to kobo
      reference: `SC-${order_id.slice(0, 8)}-${Date.now()}`,
      callback_url: 'https://swiftchop.app/payment/callback',
      metadata: {
        order_id,
        ...metadata,
      },
    };

    // Add split payment if subaccount exists
    if (subaccount) {
      body.subaccount = subaccount;
      body.transaction_charge = platformFeeKobo;
      body.bearer = 'account'; // Customer bears Paystack charges
    }

    console.log('Initializing Paystack transaction:', { email, amount, order_id, subaccount: !!subaccount });

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!result.status) {
      console.error('Paystack initialize failed:', result);
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to initialize payment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Paystack transaction initialized:', result.data.reference);

    return new Response(
      JSON.stringify({
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        reference: result.data.reference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Paystack initialize error:', err);
    return new Response(
      JSON.stringify({ error: `Paystack: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
