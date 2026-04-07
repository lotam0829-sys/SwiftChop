import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, business_name, bank_code, account_number, percentage_charge } = await req.json();

    if (!user_id || !business_name || !bank_code || !account_number) {
      return new Response(
        JSON.stringify({ error: 'user_id, business_name, bank_code, and account_number are required' }),
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

    // In Paystack test mode, bank_code must be 'test-bank' for test accounts
    // Map common test codes to 'test-bank'
    const isTestKey = paystackSecret.startsWith('sk_test_');
    let effectiveBankCode = bank_code;
    if (isTestKey && (bank_code === '001' || account_number === '0000000000')) {
      effectiveBankCode = 'test-bank';
      console.log(`Test mode detected: mapping bank_code '${bank_code}' -> 'test-bank'`);
    }

    // Create subaccount on Paystack
    console.log(`Creating subaccount: business_name=${business_name}, bank_code=${effectiveBankCode}, account=${account_number}`);
    const response = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_name,
        bank_code: effectiveBankCode,
        account_number,
        percentage_charge: percentage_charge || 0,
      }),
    });

    const result = await response.json();

    if (!result.status) {
      console.error('Paystack create subaccount failed:', result);
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to create subaccount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subaccountCode = result.data.subaccount_code;
    console.log('Paystack subaccount created:', subaccountCode);

    // Store subaccount_code in database using service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update user_profiles
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ paystack_subaccount_code: subaccountCode })
      .eq('id', user_id);

    if (profileError) {
      console.error('Failed to update user_profiles:', profileError);
    }

    // Check if this user is a restaurant owner — update restaurants table too
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user_id)
      .single();

    if (userProfile?.role === 'restaurant') {
      const { error: restError } = await supabaseAdmin
        .from('restaurants')
        .update({ paystack_subaccount_code: subaccountCode })
        .eq('owner_id', user_id);

      if (restError) {
        console.error('Failed to update restaurants:', restError);
      }
    }

    // For riders, the subaccount_code is already stored in user_profiles
    // No additional table update needed — rider payments use user_profiles.paystack_subaccount_code
    if (userProfile?.role === 'rider') {
      console.log('Rider subaccount created successfully:', subaccountCode);
    }

    return new Response(
      JSON.stringify({
        subaccount_code: subaccountCode,
        business_name: result.data.business_name,
        settlement_bank: result.data.settlement_bank,
        account_number: result.data.account_number,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Paystack create subaccount error:', err);
    return new Response(
      JSON.stringify({ error: `Paystack: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
