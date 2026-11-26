// Campos das telas de autenticação (fundo sempre escuro, independente do tema).
// O Input base troca o fundo para `bg-background` no foco — no tema claro isso
// deixava o campo branco com texto branco. Fixamos fundo/texto em todos os estados
// e neutralizamos o autofill do navegador (que pinta o fundo de branco/amarelo).
export const authInputClass =
  "h-11 bg-[#45364d] focus-visible:bg-[#45364d] border-[#6b4c68] text-white caret-white focus-visible:ring-[#ffb597] placeholder:text-zinc-500 [color-scheme:dark] " +
  "autofill:shadow-[inset_0_0_0_1000px_#45364d] autofill:[-webkit-text-fill-color:#fff]"

export const authToggleClass = "text-zinc-400 hover:bg-white/10 hover:text-white"
