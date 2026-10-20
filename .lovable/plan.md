# Baixar relatório do dia (PDF)

## O que o gestor verá
- Na "Visão geral de hoje", um botão **Baixar relatório do dia**.
- Ao clicar, abre uma janela para escolher o **técnico** e o **dia** (padrão: hoje).
- Botão **Gerar PDF**: monta o arquivo e depois mostra **Baixar PDF**.
- Se não houver visitas concluídas naquele dia para o técnico, aparece um aviso.

## Conteúdo do PDF
- Capa: "Piscivel – Relatório diário", nome do técnico, data, total de visitas (concluídas / agendadas).
- Uma seção por visita (ordem do horário em que foi feita):
  - Cliente, piscina, endereço, horário da visita, status (ou motivo de remarcação).
  - Parâmetros da água (pH, cloro, alcalinidade, ácido cianúrico, dureza cálcica, temperatura) com indicação Equilibrado / Fora do padrão.
  - Produtos aplicados com quantidades, serviços realizados, observações.
  - Fotos: Antes, Depois, Casa de Máquinas e foto da observação (quando houver).
- Visitas sem relatório aparecem listadas como "Não realizada".

## Detalhes técnicos
- Geração no navegador com `pdf-lib` (sem servidor); imagens baixadas por links temporários do armazenamento privado `visit-photos` e convertidas para JPEG via canvas (reduzidas para ~1200px para o PDF não ficar pesado).
- Consulta: `schedules` do técnico no intervalo do dia + `visit_reports` + piscina/cliente. Permissões já cobertas pelo acesso de admin.
- Novo componente `src/components/DailyReportDialog.tsx` e helper `src/lib/daily-report.ts`; botão adicionado em `admin/index.tsx`.
- Download pelo padrão "gerar primeiro, depois botão de baixar" (funciona em celular).
- Verificação: gerar um PDF de teste e conferir as páginas.
