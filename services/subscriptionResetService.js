/**
 * Monthly Token Reset Service
 * 
 * This service handles resetting user tokens on their renewal dates.
 * Run this periodically (daily cron job) to check for expired subscriptions
 * and reset tokens for monthly plans.
 * 
 * Usage:
 *   // Option 1: Call manually (e.g., via scheduled function)
 *   const { resetExpiredSubscriptions } = require('./subscriptionResetService');
 *   await resetExpiredSubscriptions();
 * 
 *   // Option 2: Set up cron job (see example at bottom)
 */

const Subscription = require('../models/Subscription');
const Usage = require('../models/Usage');

const PLAN_CONFIG = {
  free:  { price: 0,    tokenLimit: 10000,   billingCycle: 'lifetime' },
  basic: { price: 999,  tokenLimit: 100000,  billingCycle: 'monthly' },
  pro:   { price: 1999, tokenLimit: 500000,  billingCycle: 'monthly' },
};

/**
 * Reset tokens for subscriptions that have expired
 * Called once per day to check for monthly renewals
 */
const resetExpiredSubscriptions = async () => {
  try {
    console.log(`\n⏰ [${new Date().toISOString()}] Starting subscription reset check...`);

    // Find all subscriptions where:
    // 1. renewalDate has passed (today or earlier)
    // 2. Plan is not 'free'
    // 3. Status is 'active'
    const now = new Date();

    const expiredSubscriptions = await Subscription.find({
      renewalDate: { $lte: now },
      plan: { $ne: 'free' },
      status: 'active',
    });

    console.log(`   Found ${expiredSubscriptions.length} subscriptions to reset`);

    for (const subscription of expiredSubscriptions) {
      try {
        const planConfig = PLAN_CONFIG[subscription.plan];
        if (!planConfig) {
          console.warn(`   ⚠️  Unknown plan: ${subscription.plan}`);
          continue;
        }

        // Reset user tokens
        await Usage.findOneAndUpdate(
          { userId: subscription.userId },
          {
            totalTokens: 0, // Reset to 0
            lastResetDate: now,
          }
        );

        // Set new renewal date (30 days from now)
        const newRenewalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await Subscription.findByIdAndUpdate(
          subscription._id,
          { renewalDate: newRenewalDate }
        );

        console.log(`   ✅ Reset tokens for user ${subscription.userId} (${subscription.plan} plan)`);
      } catch (error) {
        console.error(`   ❌ Error resetting subscription ${subscription._id}:`, error.message);
      }
    }

    console.log(`✅ Subscription reset check complete\n`);
  } catch (error) {
    console.error(`❌ Error in resetExpiredSubscriptions:`, error.message);
  }
};

/**
 * Set up a daily cron job to reset expired subscriptions
 * Call this once during server startup
 */
const setupMonthlyResetCron = () => {
  try {
    const cron = require('node-cron');

    // Run every day at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      await resetExpiredSubscriptions();
    });

    console.log('✅ Monthly subscription reset cron job scheduled (daily at 2 AM)');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.warn('⚠️  node-cron not installed. Install with: npm install node-cron');
      console.warn('   Then add: const { setupMonthlyResetCron } = require(\'./services/subscriptionResetService\');');
      console.warn('   And call: setupMonthlyResetCron(); in server.js');
    } else {
      console.error('❌ Error setting up cron:', error.message);
    }
  }
};

module.exports = {
  resetExpiredSubscriptions,
  setupMonthlyResetCron,
};
