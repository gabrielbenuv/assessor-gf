import { prisma } from "./prisma";

const LIMITE = 12; // quantas mensagens recentes manter no contexto

export interface TurnoMemoria {
  role: "user" | "assistant";
  conteudo: string;
}

/** Carrega as últimas mensagens da sessão (ordem cronológica). */
export async function carregarHistorico(sessao: string): Promise<TurnoMemoria[]> {
  const msgs = await prisma.mensagem.findMany({
    where: { sessao },
    orderBy: { createdAt: "desc" },
    take: LIMITE,
  });
  return msgs.reverse().map((m) => ({ role: m.role as "user" | "assistant", conteudo: m.conteudo }));
}

/** Salva um turno de conversa. */
export async function salvarTurno(sessao: string, role: "user" | "assistant", conteudo: string) {
  if (!conteudo) return;
  await prisma.mensagem.create({ data: { sessao, role, conteudo } });
}

/** Limpa o histórico de uma sessão (ex: botão "limpar" no simulador). */
export async function limparHistorico(sessao: string) {
  await prisma.mensagem.deleteMany({ where: { sessao } });
}
