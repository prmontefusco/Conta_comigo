import { describe, expect, it } from "vitest";
import { instant } from "@/core/date/calendar-date";
import { aReserve, brl } from "@/modules/shared/testing/builders";
import {
  applyContribution,
  applyWithdrawal,
  emergencyCoverage,
  goalProgress,
  monthsOfRunway,
  progressOf,
  protectedTotal,
  reservedTotal,
  type Goal,
  type Reserve,
} from "./reserve";

const NOW = instant("2026-09-01T10:00:00.000Z");
const AUDIT = { createdAt: NOW, updatedAt: NOW, createdBy: "user-1" };

describe("gestão de reservas e metas (reserve)", () => {
  const rEmergencia = aReserve({
    id: "res-emergencia",
    name: "Reserva de Emergência",
    purpose: "EMERGENCY",
    currentAmount: brl(9000),
    targetAmount: brl(18000),
    isProtected: true,
    archived: false,
  });

  const rViagem = aReserve({
    id: "res-viagem",
    name: "Viagem de Férias",
    purpose: "TRAVEL",
    currentAmount: brl(3000),
    targetAmount: brl(5000),
    isProtected: false, // Desprotegida: livre para remanejar
    archived: false,
  });

  const rArquivada = aReserve({
    id: "res-antiga",
    name: "Carro Antigo",
    purpose: "VEHICLE",
    currentAmount: brl(2000),
    isProtected: true,
    archived: true, // Não deve somar
  });

  const reserves: Reserve[] = [rEmergencia, rViagem, rArquivada];

  it("calcula o total de reservas protegidas excluindo as desprotegidas e arquivadas", () => {
    // Apenas rEmergencia (9000) é protegida e ativa
    expect(protectedTotal(reserves)).toEqual(brl(9000));
  });

  it("calcula o total reservado geral excluindo apenas as arquivadas", () => {
    // 9000 (emergência) + 3000 (viagem) = 12000
    expect(reservedTotal(reserves)).toEqual(brl(12000));
  });

  describe("progresso de reserva (progressOf)", () => {
    it("mede o progresso quando há valor alvo definido", () => {
      const progress = progressOf(rEmergencia);
      expect(progress.current).toEqual(brl(9000));
      expect(progress.target).toEqual(brl(18000));
      expect(progress.missing).toEqual(brl(9000));
      expect(progress.ratio).toBe(0.5);
      expect(progress.belowTarget).toBe(true);
    });

    it("lida com reservas sem valor alvo estabelecido", () => {
      const semAlvo = aReserve({
        currentAmount: brl(1500),
        targetAmount: undefined,
      });
      const progress = progressOf(semAlvo);
      expect(progress.missing).toEqual(brl(0));
      expect(progress.ratio).toBeNull();
      expect(progress.belowTarget).toBe(false);
    });

    it("limita o ratio em 1.0 quando o valor acumulado supera o alvo", () => {
      const superada = aReserve({
        currentAmount: brl(6000),
        targetAmount: brl(5000),
      });
      const progress = progressOf(superada);
      expect(progress.missing).toEqual(brl(0));
      expect(progress.ratio).toBe(1);
      expect(progress.belowTarget).toBe(false);
    });
  });

  describe("progresso de meta vinculada (goalProgress)", () => {
    const goalViagem: Goal = {
      ...AUDIT,
      id: "goal-1",
      householdId: "household-a",
      name: "Viagem Praia",
      targetAmount: brl(6000),
      linkedReserveId: "res-viagem",
      status: "ACTIVE",
      visibility: "HOUSEHOLD",
    };

    it("vincula a reserva correspondente e calcula a contribuição mensal necessária", () => {
      // Alvo: 6000, Acumulado em res-viagem: 3000, Faltam: 3000 em 6 meses -> 500/mês
      const progress = goalProgress(goalViagem, reserves, 6);
      expect(progress.accumulated).toEqual(brl(3000));
      expect(progress.missing).toEqual(brl(3000));
      expect(progress.ratio).toBe(0.5);
      expect(progress.monthlyContributionNeeded).toEqual(brl(500));
    });

    it("trata metas sem reserva vinculada como acumulado zero", () => {
      const goalSemReserva: Goal = {
        ...goalViagem,
        linkedReserveId: undefined,
      };
      const progress = goalProgress(goalSemReserva, reserves);
      expect(progress.accumulated).toEqual(brl(0));
      expect(progress.missing).toEqual(brl(6000));
      expect(progress.ratio).toBe(0);
      expect(progress.monthlyContributionNeeded).toBeUndefined();
    });
  });

  describe("cobertura de emergência e runway", () => {
    it("avalia se uma emergência é coberta pelo fundo de emergência ativo", () => {
      // Reserva de emergência ativa tem 9000
      const cobriu = emergencyCoverage(reserves, brl(5000));
      expect(cobriu.covered).toBe(true);
      expect(cobriu.shortfall).toEqual(brl(0));

      const naoCobriu = emergencyCoverage(reserves, brl(15000));
      expect(naoCobriu.covered).toBe(false);
      expect(naoCobriu.shortfall).toEqual(brl(6000));
    });

    it("calcula quantos meses de despesas o fundo de emergência cobre (runway)", () => {
      // 9000 disponíveis / 3000 de despesa mensal = 3 meses de runway
      expect(monthsOfRunway(reserves, brl(3000))).toBe(3);
      // Se despesas mensais forem zero, o fôlego é infinito
      expect(monthsOfRunway(reserves, brl(0))).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe("aportes e resgates (contributions & withdrawals)", () => {
    it("aplica contribuição somando ao saldo atual", () => {
      const atualizada = applyContribution(rViagem, brl(1500));
      expect(atualizada.currentAmount).toEqual(brl(4500));
    });

    it("aplica resgate subtraindo do saldo e travando em zero em caso de saque maior", () => {
      const comSaque = applyWithdrawal(rViagem, brl(1000));
      expect(comSaque.currentAmount).toEqual(brl(2000));

      const zerada = applyWithdrawal(rViagem, brl(5000));
      expect(zerada.currentAmount).toEqual(brl(0));
    });
  });
});
