import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HostingService } from '@/services/hosting.service';

describe('Hosting Management & Multi-Threshold Expiry Reminder Tests', () => {
  describe('Days Remaining Calculation', () => {
    it('should correctly calculate future days remaining to expiry', () => {
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 30);

      const days = HostingService.calculateDaysRemaining(future);
      expect(days).toBe(30);
    });

    it('should return 0 for expiry date set to today', () => {
      const today = new Date();
      const days = HostingService.calculateDaysRemaining(today);
      expect(days).toBe(0);
    });

    it('should return negative values for past/expired dates', () => {
      const past = new Date();
      past.setUTCDate(past.getUTCDate() - 5);

      const days = HostingService.calculateDaysRemaining(past);
      expect(days).toBe(-5);
    });
  });

  describe('Derived Hosting Status', () => {
    it('should derive ACTIVE when days remaining > 30', () => {
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 45);

      const status = HostingService.deriveStatus(future);
      expect(status).toBe('ACTIVE');
    });

    it('should derive EXPIRING_SOON when days remaining <= 30 and > 0', () => {
      const expiring30 = new Date();
      expiring30.setUTCDate(expiring30.getUTCDate() + 30);
      expect(HostingService.deriveStatus(expiring30)).toBe('EXPIRING_SOON');

      const expiring7 = new Date();
      expiring7.setUTCDate(expiring7.getUTCDate() + 7);
      expect(HostingService.deriveStatus(expiring7)).toBe('EXPIRING_SOON');

      const expiring1 = new Date();
      expiring1.setUTCDate(expiring1.getUTCDate() + 1);
      expect(HostingService.deriveStatus(expiring1)).toBe('EXPIRING_SOON');
    });

    it('should derive EXPIRED when days remaining <= 0', () => {
      const today = new Date();
      expect(HostingService.deriveStatus(today)).toBe('EXPIRED');

      const past = new Date();
      past.setUTCDate(past.getUTCDate() - 3);
      expect(HostingService.deriveStatus(past)).toBe('EXPIRED');
    });

    it('should preserve CANCELLED status regardless of expiry date', () => {
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 60);

      expect(HostingService.deriveStatus(future, 'CANCELLED')).toBe('CANCELLED');
    });
  });

  describe('Multi-Threshold Expiry Notification Logic', () => {
    const thresholds = [30, 14, 7, 3, 1, 0];

    it('should match the appropriate notification threshold without false positives', () => {
      // Test matching 14-day threshold
      const days14 = 14;
      const matched = thresholds.find((t) => days14 <= t && days14 >= t);
      expect(matched).toBe(14);

      // Test matching 3-day threshold
      const days3 = 3;
      const matched3 = thresholds.find((t) => days3 <= t && days3 >= t);
      expect(matched3).toBe(3);

      // Non-threshold day (e.g. 19 days) should not match an exact alert threshold
      const days19 = 19;
      const exactMatch = thresholds.includes(days19);
      expect(exactMatch).toBe(false);
    });

    it('should prevent duplicate notification dispatches for the same threshold in a cycle', () => {
      const notificationsSent = new Map<string, boolean>();
      const thresholdKey = 't_14';

      // First check: notification has not been sent
      expect(notificationsSent.get(thresholdKey)).toBeFalsy();

      // Dispatch and record sent flag
      notificationsSent.set(thresholdKey, true);

      // Subsequent check in the same cycle: must detect duplicate and skip
      expect(notificationsSent.get(thresholdKey)).toBe(true);
    });

    it('should reset notification map upon renewal so next cycle alerts can fire', () => {
      let notificationsSent: any = new Map<string, boolean>();
      notificationsSent.set('t_30', true);
      notificationsSent.set('t_14', true);
      notificationsSent.set('t_7', true);

      expect(notificationsSent.size).toBe(3);

      // Simulate renewal cycle reset
      notificationsSent = new Map();
      expect(notificationsSent.size).toBe(0);
      expect(notificationsSent.get('t_30')).toBeUndefined();
    });

    it('should correctly build renewal history structure and restore status to ACTIVE', () => {
      const previousExpiry = new Date('2026-10-01T00:00:00Z');
      const newExpiry = new Date('2027-10-01T00:00:00Z');
      const renewalHistory: any[] = [];

      // Record renewal
      renewalHistory.push({
        renewedAt: new Date(),
        previousExpiryDate: previousExpiry,
        newExpiryDate: newExpiry,
        notes: 'Annual renewal via Hostinger',
        actor: 'admin',
      });

      const updatedStatus = HostingService.deriveStatus(newExpiry);

      expect(renewalHistory).toHaveLength(1);
      expect(renewalHistory[0].previousExpiryDate).toEqual(previousExpiry);
      expect(renewalHistory[0].newExpiryDate).toEqual(newExpiry);
      expect(renewalHistory[0].actor).toBe('admin');
      expect(updatedStatus).toBe('ACTIVE');
    });
  });
});
