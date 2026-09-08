import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { money } from "@/core/money/money";
import {
  createImpulseReflection,
  checkReflectionStatus,
  resolveReflection,
  totalSavedBySelfControl,
  getSelfControlStats,
  loadLocalReflections,
  saveLocalReflections,
  type ImpulseReflection,
} from "./impulse-lock";

describe("impulse-lock", () => {
  const baseTime = new Date("2026-09-08T10:00:00.000Z");

  it("creates a reflection with 24 hours lock by default", () => {
    const refl = createImpulseReflection({
      householdId: "hh-1",
      itemName: "Fone de Ouvido Bluetooth",
      amount: money(35000),
      reason: "Oferta relâmpago que vi no feed",
      now: baseTime,
    });

    expect(refl.householdId).toBe("hh-1");
    expect(refl.itemName).toBe("Fone de Ouvido Bluetooth");
    expect(refl.amount.amount).toBe(35000);
    expect(refl.status).toBe("IN_PROGRESS");
    expect(refl.createdAt).toBe("2026-09-08T10:00:00.000Z");
    expect(refl.unlockAt).toBe("2026-09-09T10:00:00.000Z");
  });

  it("handles fallback defaults when optional parameters are omitted", () => {
    const refl = createImpulseReflection({
      householdId: "hh-2",
      itemName: "   ",
      amount: money(-5000),
      durationHours: 12,
    });
    expect(refl.itemName).toBe("Item sem nome");
    expect(refl.reason).toBe("Desejo de compra sob reflexão");
    expect(refl.amount.amount).toBe(0);
    expect(refl.id.startsWith("refl_")).toBe(true);

    const emptyStats = getSelfControlStats([]);
    expect(emptyStats.totalReflections).toBe(0);
    expect(emptyStats.abandonmentRate).toBe(0);
  });

  it("calculates progress and lock status accurately before and after 24h", () => {
    const refl = createImpulseReflection({
      householdId: "hh-1",
      itemName: "Tênis",
      amount: money(40000),
      now: baseTime,
    });

    // 6 hours later: still locked, 18h remaining
    const tPlus6h = new Date("2026-09-08T16:00:00.000Z");
    const progress6h = checkReflectionStatus(refl, tPlus6h);
    expect(progress6h.isLocked).toBe(true);
    expect(progress6h.remainingHours).toBe(18);
    expect(progress6h.remainingMinutes).toBe(0);
    expect(progress6h.percentElapsed).toBe(25);

    // 24 hours later: unlocked!
    const tPlus24h = new Date("2026-09-09T10:00:00.000Z");
    const progress24h = checkReflectionStatus(refl, tPlus24h);
    expect(progress24h.isLocked).toBe(false);
    expect(progress24h.remainingHours).toBe(0);
    expect(progress24h.remainingMinutes).toBe(0);
    expect(progress24h.percentElapsed).toBe(100);
  });

  it("resolves reflection with ABANDONED (self-control win) and notes", () => {
    const refl = createImpulseReflection({
      householdId: "hh-1",
      itemName: "Relógio Smartwatch",
      amount: money(80000),
      now: baseTime,
    });

    const resolved = resolveReflection(
      refl,
      "ABANDONED",
      "Percebi que meu relógio atual faz tudo o que preciso",
      new Date("2026-09-09T11:00:00.000Z"),
    );

    expect(resolved.status).toBe("ABANDONED");
    expect(resolved.resolvedAt).toBe("2026-09-09T11:00:00.000Z");
    expect(resolved.reflectionNote).toBe(
      "Percebi que meu relógio atual faz tudo o que preciso",
    );
  });

  it("resolves reflection with PURCHASED (conscious buy)", () => {
    const refl = createImpulseReflection({
      householdId: "hh-1",
      itemName: "Mochila escolar",
      amount: money(15000),
      now: baseTime,
    });

    const resolved = resolveReflection(refl, "PURCHASED");
    expect(resolved.status).toBe("PURCHASED");
    expect(resolved.resolvedAt).toBeDefined();
  });

  it("calculates total saved by self control and stats", () => {
    const list: ImpulseReflection[] = [
      {
        id: "1",
        householdId: "hh-1",
        itemName: "Sapato",
        amount: money(25000),
        reason: "Promoção",
        createdAt: baseTime.toISOString(),
        unlockAt: baseTime.toISOString(),
        status: "ABANDONED",
      },
      {
        id: "2",
        householdId: "hh-1",
        itemName: "Monitor Gamer",
        amount: money(120000),
        reason: "Impulso",
        createdAt: baseTime.toISOString(),
        unlockAt: baseTime.toISOString(),
        status: "ABANDONED",
      },
      {
        id: "3",
        householdId: "hh-1",
        itemName: "Livro Técnico",
        amount: money(8000),
        reason: "Estudos",
        createdAt: baseTime.toISOString(),
        unlockAt: baseTime.toISOString(),
        status: "PURCHASED",
      },
      {
        id: "4",
        householdId: "hh-1",
        itemName: "Jaqueta",
        amount: money(30000),
        reason: "Frio",
        createdAt: baseTime.toISOString(),
        unlockAt: baseTime.toISOString(),
        status: "IN_PROGRESS",
      },
    ];

    const totalSaved = totalSavedBySelfControl(list);
    // 250 + 1200 = 1450
    expect(totalSaved.amount).toBe(145000);

    const stats = getSelfControlStats(list);
    expect(stats.totalReflections).toBe(4);
    expect(stats.abandonedCount).toBe(2);
    expect(stats.purchasedCount).toBe(1);
    expect(stats.inProgressCount).toBe(1);
    expect(stats.totalSaved.amount).toBe(145000);
    // Abandonment rate: 2 abandoned out of (2 + 1) completed = 2/3 = 0.67
    expect(stats.abandonmentRate).toBe(0.67);
  });

  describe("localStorage persistence helpers", () => {
    beforeEach(() => {
      const store: Record<string, string> = {};
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("saves and loads reflections cleanly from localStorage", () => {
      const refl = createImpulseReflection({
        householdId: "hh-test",
        itemName: "Curso Online",
        amount: money(50000),
        now: baseTime,
      });

      saveLocalReflections("hh-test", [refl]);
      const loaded = loadLocalReflections("hh-test");
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.itemName).toBe("Curso Online");
    });

    it("handles corrupted or empty localStorage data gracefully", () => {
      localStorage.setItem("cc_impulse_reflections_hh-corrupt", "{invalid json");
      expect(loadLocalReflections("hh-corrupt")).toEqual([]);

      localStorage.setItem("cc_impulse_reflections_hh-notarray", JSON.stringify({ a: 1 }));
      expect(loadLocalReflections("hh-notarray")).toEqual([]);
    });
  });
});
