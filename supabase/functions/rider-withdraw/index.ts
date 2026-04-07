import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Rider Withdraw Edge Function
 * 
 * Initiates a Paystack transfer from business balance to rider's bank account.
 * Records the withdrawal in rider_payments with payment_type = 'withdrawal'.
 */

function generateReference(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `withdraw_${ts}_${rand}`.toLowerCase().substring(0, 50);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rider_id, amount } = await req.json();

    if (!rider_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'rider_id and a positive amount are required' }),
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

    // 1. Fetch rider profile with bank details
    const { data: rider, error: riderErr } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', rider_id)
      .eq('role', 'rider')
      .single();

    if (riderErr || !rider) {
      return new Response(
        JSON.stringify({ error: 'Rider profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rider.bank_account_number || !rider.bank_code) {
      return new Response(
        JSON.stringify({ error: 'Bank details not configured. Please update your bank information.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Calculate available balance (completed deliveries minus successful withdrawals)
    const { data: deliveries } = await supabaseAdmin
      .from('rider_payments')
      .select('amount, payment_type, status')
      .eq('rider_id', rider_id);

    const totalEarned = (deliveries || [])
      .filter((p: any) => p.payment_type === 'delivery' && (p.status === 'completed' || p.status === 'pending'))
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const totalWithdrawn = (deliveries || [])
      .filter((p: any) => p.payment_type === 'withdrawal' && p.status === 'completed')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const availableBalance = totalEarned - totalWithdrawn;

    if (amount > availableBalance) {
      return new Response(
        JSON.stringify({ 
          error: `Insufficient balance. Available: \u20A6${availableBalance.toLocaleString()}, Requested: \u20A6${amount.toLocaleString()}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Create Paystack Transfer Recipient
    const isTestKey = paystackSecret.startsWith('sk_test_');
    let effectiveBankCode = rider.bank_code;
    if (isTestKey && (rider.bank_code === '001' || rider.bank_account_number === '0000000000')) {
      effectiveBankCode = 'test-bank';
    }

    console.log(`Creating transfer recipient for ${rider.username}: bank_code=${effectiveBankCode}, account=${rider.bank_account_number}`);

    const recipientResp = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: rider.bank_account_name || rider.username || 'Rider',
        account_number: rider.bank_account_number,
        bank_code: effectiveBankCode,
        currency: 'NGN',
      }),
    });

    const recipientResult = await recipientResp.json();
    if (!recipientResult.status || !recipientResult.data?.recipient_code) {
      console.error('Recipient creation failed:', JSON.stringify(recipientResult));
      return new Response(
        JSON.stringify({ error: `Failed to create transfer recipient: ${recipientResult.message || 'Unknown error'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipientCode = recipientResult.data.recipient_code;
    console.log(`Transfer recipient created: ${recipientCode}`);

    // 4. Initiate Transfer
    const reference = generateReference();
    const amountInKobo = amount * 100;

    const transferResp = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountInKobo,
        recipient: recipientCode,
        reason: `SwiftChop earnings withdrawal`,
        reference,
        metadata: {
          rider_id: rider.id,
          rider_name: rider.username,
          balance_before: availableBalance,
          balance_after: availableBalance - amount,
          withdrawal_type: 'manual',
        },
      }),
    });

    const transferResult = await transferResp.json();
    console.log('Transfer result:', JSON.stringify(transferResult));

    const transferSuccess = transferResult.status;
    const transferCode = transferResult.data?.transfer_code || null;
    const transferStatus = transferResult.data?.status || 'failed';

    // 5. Record withdrawal in rider_payments
    const { error: insertErr } = await supabaseAdmin
      .from('rider_payments')
      .insert({
        rider_id: rider.id,
        order_id: rider_id, // self-ref for withdrawals
        amount: amount,
        status: transferStatus === 'success' ? 'completed' : transferStatus === 'pending' || transferStatus === 'otp' ? 'processing' : 'failed',
        payment_type: 'withdrawal',
        paystack_transfer_code: transferCode,
        paystack_reference: reference,
        metadata: {
          balance_before: availableBalance,
          balance_after: availableBalance - amount,
          recipient_code: recipientCode,
          bank_name: rider.bank_name,
          account_last4: rider.bank_account_number?.slice(-4),
        },
      });

    if (insertErr) {
      console.error('Failed to record withdrawal:', insertErr.message);
    }

    // 6. Send push notification
    if (rider.push_token) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: rider.push_token,
            sound: 'default',
            title: 'Withdrawal Initiated',
            body: `Your withdrawal of \u20A6${amount.toLocaleString()} is being processed. Check your bank app shortly.`,
            data: { type: 'withdrawal', amount },
            priority: 'high',
            channelId: 'order-updates',
          }),
        });
      } catch (pushErr) {
        console.error('Push notification failed:', pushErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: transferSuccess,
        transfer_code: transferCode,
        status: transferStatus,
        reference,
        amount,
        balance_before: availableBalance,
        balance_after: availableBalance - amount,
        message: transferSuccess 
          ? `Withdrawal of \u20A6${amount.toLocaleString()} initiated successfully.`
          : `Transfer failed: ${transferResult.message || 'Unknown error'}`,
      }),
      { status: transferSuccess ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Rider withdraw error:', err);
    return new Response(
      JSON.stringify({ error: `Withdrawal: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
