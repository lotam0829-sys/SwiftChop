import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Charge a saved card using Paystack's recurring charge API.
 * Uses the authorization_code from a previously saved card.
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { authorization_code, email, amount, order_id, metadata } = await req.json();

    if (!authorization_code || !email || !amount || !order_id) {
      return new Response(
        JSON.stringify({ error: 'authorization_code, email, amount, and order_id are required' }),
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

    const reference = `SC-${order_id.slice(0, 8)}-${Date.now()}`;

    console.log('Charging saved card:', { email, amount, order_id, reference });

    const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code,
        email,
        amount: amount * 100, // Convert naira to kobo
        reference,
        metadata: {
          order_id,
          ...metadata,
        },
      }),
    });

    const result = await response.json();

    if (!result.status || result.data?.status !== 'success') {
      console.error('Saved card charge failed:', result);
      return new Response(
        JSON.stringify({ error: result.data?.gateway_response || result.message || 'Charge failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Saved card charge successful:', reference);

    // The webhook will also handle this, but confirm immediately for faster UX
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin
      .from('orders')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', order_id)
      .eq('status', 'awaiting_payment');

    return new Response(
      JSON.stringify({
        success: true,
        reference: result.data.reference,
        status: result.data.status,
        gateway_response: result.data.gateway_response,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Charge saved card error:', err);
    return new Response(
      JSON.stringify({ error: `Paystack: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
