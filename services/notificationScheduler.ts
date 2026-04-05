import * as Notifications from 'expo-notifications';

// Track scheduled notification IDs so we can cancel them
let restaurantReminderNotifId: string | null = null;
let cartReminderNotifId: string | null = null;

/**
 * Schedule a "Still hungry?" notification 5 minutes after user leaves a restaurant page.
 * Call this when the user navigates away from a restaurant detail screen.
 */
export async function scheduleRestaurantReminder(restaurantName: string) {
  // Cancel any existing restaurant reminder
  await cancelRestaurantReminder();

  try {
    restaurantReminderNotifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Still hungry for ${restaurantName}?`,
        body: `Come back and order your favourite dishes from ${restaurantName}. Your taste buds will thank you!`,
        data: { type: 'restaurant_reminder', restaurantName },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 300, // 5 minutes
      },
    });
  } catch (err) {
    console.log('Failed to schedule restaurant reminder:', err);
  }
}

/**
 * Cancel the restaurant interest reminder (e.g., when user places an order).
 */
export async function cancelRestaurantReminder() {
  if (restaurantReminderNotifId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(restaurantReminderNotifId);
    } catch {}
    restaurantReminderNotifId = null;
  }
}

/**
 * Schedule a cart abandonment reminder 5 minutes after the last cart change with no checkout.
 */
export async function scheduleCartReminder(restaurantName: string) {
  // Cancel any existing cart reminder first
  await cancelCartReminder();

  try {
    cartReminderNotifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't lose your appetite yet",
        body: `Complete your order from ${restaurantName}. Your food is waiting!`,
        data: { type: 'cart_reminder', restaurantName },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 300, // 5 minutes
      },
    });
  } catch (err) {
    console.log('Failed to schedule cart reminder:', err);
  }
}

/**
 * Cancel the cart abandonment reminder (e.g., when user checks out or clears cart).
 */
export async function cancelCartReminder() {
  if (cartReminderNotifId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(cartReminderNotifId);
    } catch {}
    cartReminderNotifId = null;
  }
}
