import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import {
  calculateFinancialHealthScore,
  calculateIncomeCommitmentPillar,
  calculateEmergencyReservePillar,
  calculatePunctualityPillar,
  calculateDebtTrajectoryPillar,
  evaluateBadges,
  type HealthScoreInput,
} from "./health-score";

describe("health-score", () => {
  describe("Pillars calculation", () => {
    it("calculates income commitment pillar across different ratios", () => {
      // <= 50% commitment: 300 pts
      const p1 = calculateIncomeCommitmentPillar(money(500000), money(200000));
      expect(p1.current).toBe(300);

      // 50% - 70%: 220 pts
      const p2 = calculateIncomeCommitmentPillar(money(500000), money(300000));
      expect(p2.current).toBe(220);

      // 70% - 90%: 120 pts
      const p3 = calculateIncomeCommitmentPillar(money(500000), money(400000));
      expect(p3.current).toBe(120);

      // > 90%: 40 pts
      const p4 = calculateIncomeCommitmentPillar(money(500000), money(480000));
      expect(p4.current).toBe(40);

      // Zero income
      const pZero = calculateIncomeCommitmentPillar(money(0), money(100000));
      expect(pZero.current).toBe(30);
    });

    it("calculates emergency reserve pillar across different months coverage", () => {
      const monthlyNeed = money(200000); // R$ 2.000/mo

      // 6+ months (R$ 12.000)
      const p6m = calculateEmergencyReservePillar(money(1500000), monthlyNeed);
      expect(p6m.current).toBe(250);

      // 3-6 months (R$ 8.000)
      const p4m = calculateEmergencyReservePillar(money(800000), monthlyNeed);
      expect(p4m.current).toBe(200);

      // 1-3 months (R$ 3.000)
      const p1m = calculateEmergencyReservePillar(money(300000), monthlyNeed);
      expect(p1m.current).toBe(140);

      // > 0 to 1 month (R$ 500)
      const pUnder1m = calculateEmergencyReservePillar(money(50000), monthlyNeed);
      expect(pUnder1m.current).toBe(70);

      // 0 reserve
      const p0 = calculateEmergencyReservePillar(money(0), monthlyNeed);
      expect(p0.current).toBe(15);
    });

    it("calculates punctuality pillar with overdue count", () => {
      expect(calculatePunctualityPillar(0).current).toBe(250);
      expect(calculatePunctualityPillar(1).current).toBe(150);
      expect(calculatePunctualityPillar(2).current).toBe(80);
      expect(calculatePunctualityPillar(5).current).toBe(20);
    });

    it("calculates debt trajectory pillar based on total debts", () => {
      // 0 debt: 200 pts
      expect(calculateDebtTrajectoryPillar(money(0)).current).toBe(200);

      // Under R$ 5.000: 140 pts
      expect(calculateDebtTrajectoryPillar(money(300000)).current).toBe(140);

      // Under R$ 30.000: 90 pts
      expect(calculateDebtTrajectoryPillar(money(1500000)).current).toBe(90);

      // Heavy debt: 30 pts
      expect(calculateDebtTrajectoryPillar(money(5000000)).current).toBe(30);
    });
  });

  describe("Badges evaluation", () => {
    it("unlocks badges when conditions are met", () => {
      const input: HealthScoreInput = {
        monthlyIncome: money(600000),
        monthlyEssentialOutflows: money(250000),
        reserveBalance: money(800000), // > 3 months
        overdueBillsCount: 0,
        totalDebtsBalance: money(0),
        impulseSavingsCount: 2,
        hasBudgetsConfigured: true,
      };

      const badges = evaluateBadges(input);
      expect(badges).toHaveLength(5);
      expect(badges.every((b) => b.unlocked)).toBe(true);
    });

    it("keeps badges locked when conditions are not met", () => {
      const input: HealthScoreInput = {
        monthlyIncome: money(300000),
        monthlyEssentialOutflows: money(280000),
        reserveBalance: money(0),
        overdueBillsCount: 3,
        totalDebtsBalance: money(1500000),
        impulseSavingsCount: 0,
        hasBudgetsConfigured: false,
      };

      const badges = evaluateBadges(input);
      expect(badges.every((b) => !b.unlocked)).toBe(true);
    });
  });

  describe("Consolidated Financial Health Score", () => {
    it("gives EXCELLENT rating for a high score profile", () => {
      const input: HealthScoreInput = {
        monthlyIncome: money(800000),
        monthlyEssentialOutflows: money(300000),
        reserveBalance: money(2000000),
        overdueBillsCount: 0,
        totalDebtsBalance: money(0),
      };

      const res = calculateFinancialHealthScore(input);
      expect(res.totalScore).toBe(1000);
      expect(res.tier).toBe("EXCELLENT");
      expect(res.tierLabel).toBe("Excelente");
    });

    it("gives CRITICAL rating for an overindebted profile", () => {
      const input: HealthScoreInput = {
        monthlyIncome: money(250000),
        monthlyEssentialOutflows: money(240000), // 96%
        reserveBalance: money(0),
        overdueBillsCount: 4,
        totalDebtsBalance: money(8000000),
      };

      const res = calculateFinancialHealthScore(input);
      expect(res.totalScore).toBeLessThan(400);
      expect(res.tier).toBe("CRITICAL");
      expect(res.tierLabel).toBe("Crítico");
      expect(res.topRecommendation).toContain("Liquide ou renegocie primeiro as contas em atraso");
    });

    it("gives ATTENTION and HEALTHY ratings with tailored recommendations", () => {
      // ATTENTION: no overdue, but low reserve
      const att = calculateFinancialHealthScore({
        monthlyIncome: money(400000),
        monthlyEssentialOutflows: money(300000),
        reserveBalance: money(50000), // < 1 month
        overdueBillsCount: 0,
        totalDebtsBalance: money(1000000),
      });
      expect(att.tier).toBe("ATTENTION");
      expect(att.topRecommendation).toContain("Escudo de Emergência");

      // HEALTHY: 1 month reserve, but debt needs amortizing
      const healthy = calculateFinancialHealthScore({
        monthlyIncome: money(500000),
        monthlyEssentialOutflows: money(250000),
        reserveBalance: money(300000),
        overdueBillsCount: 0,
        totalDebtsBalance: money(2000000),
      });
      expect(healthy.tier).toBe("HEALTHY");
      expect(healthy.topRecommendation).toContain("plano de amortização acelerada");
    });
  });
});
