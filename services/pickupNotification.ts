import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Notify a customer that their pickup order is ready for collection.
 * Calls the notify-pickup-ready edge function which sends a push notification.
 */
export async function notifyPickupReady(orderId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('notify-pickup-ready', {
    body: { orderId },
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const textContent = await error.context?.text();
        errorMessage = textContent || error.message;
      } catch {
        errorMessage = error.message || 'Failed to send notification';
      }
    }
    return { success: false, error: errorMessage };
  }

  return { success: true, error: null };
}
