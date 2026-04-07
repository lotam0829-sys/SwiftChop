import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Rider Fetch Transfers Edge Function
 * 
 * Fetches a rider's complete financial summary from the database:
 * - Available balance (earned - withdrawn)
 * - Pending earnings
 * - Total earned all-time
 * - Recent payment history
 * - Paystack transfer statuses for individual payments
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rider_id } = await req.json();

    if (!rider_id) {
      return new Response(
        JSON.stringify({ error: 'rider_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all payments for this rider
    const { data: payments, error } = await supabaseAdmin
      .from('rider_payments')
      .select('*')
      .eq('rider_id', rider_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allPayments = payments || [];

    // Calculate balances
    const deliveryPayments = allPayments.filter((p: any) => p.payment_type === 'delivery' || !p.payment_type);
    const withdrawals = allPayments.filter((p: any) => p.payment_type === 'withdrawal');

    const totalEarned = deliveryPayments
      .filter((p: any) => p.status === 'completed' || p.status === 'pending')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const pendingEarnings = deliveryPayments
      .filter((p: any) => p.status === 'pending')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const completedEarnings = deliveryPayments
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const totalWithdrawn = withdrawals
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const processingWithdrawals = withdrawals
      .filter((p: any) => p.status === 'processing' || p.status === 'pending')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const availableBalance = totalEarned - totalWithdrawn - processingWithdrawals;

    // Today/week stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (now.getDay() * 86400000);

    const todayEarnings = deliveryPayments
      .filter((p: any) => new Date(p.created_at).getTime() >= todayStart)
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const weekEarnings = deliveryPayments
      .filter((p: any) => new Date(p.created_at).getTime() >= weekStart)
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const todayDeliveries = deliveryPayments
      .filter((p: any) => new Date(p.created_at).getTime() >= todayStart).length;

    const totalDeliveries = deliveryPayments.length;

    // If any payments have Paystack transfer codes, check their status
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    const updatedPayments = [];

    for (const payment of allPayments.slice(0, 50)) {
      // Check if payment has a transfer code and status is not final
      if (payment.paystack_transfer_code && paystackSecret && 
          (payment.status === 'pending' || payment.status === 'processing')) {
        try {
          const resp = await fetch(`https://api.paystack.co/transfer/${payment.paystack_transfer_code}`, {
            headers: { 'Authorization': `Bearer ${paystackSecret}` },
          });
          const result = await resp.json();
          if (result.status && result.data) {
            const newStatus = result.data.status === 'success' ? 'completed' 
              : result.data.status === 'failed' || result.data.status === 'reversed' ? 'failed'
              : payment.status;

            if (newStatus !== payment.status) {
              // Update in database
              await supabaseAdmin
                .from('rider_payments')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', payment.id);
              payment.status = newStatus;
            }
          }
        } catch (err) {
          // Non-blocking: continue with cached status
          console.log(`Status check failed for ${payment.paystack_transfer_code}:`, err);
        }
      }
      updatedPayments.push(payment);
    }

    return new Response(
      JSON.stringify({
        available_balance: Math.max(0, availableBalance),
        pending_earnings: pendingEarnings,
        completed_earnings: completedEarnings,
        total_earned: totalEarned,
        total_withdrawn: totalWithdrawn,
        processing_withdrawals: processingWithdrawals,
        today_earnings: todayEarnings,
        week_earnings: weekEarnings,
        today_deliveries: todayDeliveries,
        total_deliveries: totalDeliveries,
        payments: updatedPayments,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Rider fetch transfers error:', err);
    return new Response(
      JSON.stringify({ error: `Fetch: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
