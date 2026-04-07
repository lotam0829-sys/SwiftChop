import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Notify Shipday that an order is ready for rider pickup.
 * Calls the Shipday "Ready to Pickup" API via edge function.
 */
export async function notifyShipdayReadyForPickup(orderId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('shipday-ready-pickup', {
    body: { orderId },
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const textContent = await error.context?.text();
        errorMessage = textContent || error.message;
      } catch {
        errorMessage = error.message || 'Failed to notify Shipday';
      }
    }
    return { success: false, error: errorMessage };
  }

  return { success: true, error: null };
}
