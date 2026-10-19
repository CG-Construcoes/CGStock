"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PlayCircle,
  Search,
  X,
  HelpCircle,
  ArrowRight,
  Package,
  Box,
  Zap,
  ArrowDownToLine,
  ClipboardList,
  ScanLine,
  AlertTriangle,
  HardHat,
  Printer,
  FolderSync,
  ShieldCheck,
  BarChart3,
  RotateCcw,
  SlidersHorizontal,
  ArrowRightLeft,
  Building2,
  BookOpen,
  Sparkles,
} from "lucide-react"

const sections = [
  { id: "intro", title: "Visão Geral" },
  { id: "tutorials", title: "Tutoriais Passo a Passo" },
  { id: "modules", title: "Guia das Telas do App" },
  { id: "roles", title: "Funções e Permissões" },
  { id: "faq", title: "FAQ / Dúvidas Frequentes" },
]

type TutorialItem = {
  id: string
  category: "Operações" | "Estoque & Etiquetas" | "Inventário" | "Equipe & Importação"
  title: string
  summary: string
  href: string
  ctaLabel: string
  keywords: string
  steps: string[]
  tip: string
}

type FaqItem = {
  id: string
  category: "Acesso & Obras" | "Estoque & Produtos" | "Entradas & Saídas" | "Inventário & Coletor" | "Equipe & Etiquetas"
  question: string
  answer: string
  keywords: string
  relatedHref?: string
  relatedLabel?: string
}

const TUTORIALS: TutorialItem[] = [
  {
    id: "t-quick-issue",
    category: "Operações",
    title: "Como registrar uma Saída Rápida bipando o capacete/crachá do colaborador?",
    summary: "Entregue ferramentas, EPIs ou materiais para um funcionário em poucos segundos usando a câmera do celular.",
    href: "/quick-issue",
    ctaLabel: "Abrir Registrar Saída",
    keywords: "saida rapida entrega colaborador funcionario capacete cracha qr code camera bipar epi material",
    steps: [
      "No menu lateral (ou no botão 'Ações' do celular), toque em 'Registrar Saída'.",
      "Selecione o Almoxarifado / Obra de onde o material está saindo.",
      "Identifique o colaborador: toque no botão da Câmera para ler o QR Code colado no capacete/crachá dele, ou pesquise pelo nome/matrícula.",
      "Adicione os materiais que estão sendo entregues, escolha a localização (ex: Estoque Geral) e informe a quantidade de cada item.",
      "Toque em 'Finalizar Entrega Rápida'. O saldo é baixado na hora e fica registrado no nome do colaborador.",
    ],
    tip: "Dica: Se o colaborador ainda não estiver na lista, você pode cadastrá-lo rapidamente em 'Funcionários' e já gerar a etiqueta do capacete dele.",
  },
  {
    id: "t-receipt",
    category: "Operações",
    title: "Como dar Entrada em uma Mercadoria (Nota Fiscal / Recebimento)?",
    summary: "Registre materiais que chegaram na obra ou no almoxarifado central.",
    href: "/receipts/new",
    ctaLabel: "Ir para Nova Entrada",
    keywords: "entrada mercadoria nota fiscal nf recebimento fornecedor chegou material somar estoque",
    steps: [
      "Acesse o menu 'Entradas' e toque no botão '+ Nova Entrada'.",
      "Selecione o Fornecedor, o Almoxarifado de destino e informe o número da Nota Fiscal / Documento (opcional).",
      "Na seção de itens, busque cada produto recebido, informe a quantidade que chegou, o valor unitário e a localização onde será guardado.",
      "Salve o recebimento e, na tela de detalhes da entrada, toque em 'Confirmar e Atualizar Estoque'.",
      "Pronto! As quantidades são somadas imediatamente ao saldo da obra.",
    ],
    tip: "Dica: Enquanto a entrada estiver como 'Rascunho', você pode conferir os itens com calma antes de somar ao estoque.",
  },
  {
    id: "t-request",
    category: "Operações",
    title: "Como criar, aprovar e entregar uma Requisição de Material?",
    summary: "Fluxo completo para pedidos internos de material, com separação total ou parcial.",
    href: "/requests",
    ctaLabel: "Abrir Requisições",
    keywords: "requisicao pedido solicitar aprovar atender separar entregar parcial material",
    steps: [
      "Para pedir: acesse 'Requisições' > '+ Nova Requisição', escolha o almoxarifado, a prioridade e adicione os itens desejados.",
      "Para aprovar/atender: na lista de 'Requisições', toque sobre o pedido para abrir os detalhes.",
      "Se o pedido estiver aguardando aprovação, toque em 'Aprovar'. Em seguida, toque em 'Atender / Separar Material'.",
      "Informe a quantidade real que está sendo entregue de cada item (pode ser total ou parcial) e de qual localização está saindo.",
      "Confirme o atendimento. O estoque será abatido automaticamente e o status mudará para 'Atendida' ou 'Parcialmente Atendida'.",
    ],
    tip: "Dica: Se faltar parte do material no momento, entregue o que tem disponível agora; a requisição continuará aberta para entregar o restante depois.",
  },
  {
    id: "t-return",
    category: "Operações",
    title: "Como registrar uma Devolução de Material ao estoque?",
    summary: "Devolva materiais ou ferramentas que sobraram da frente de serviço de volta para o almoxarifado.",
    href: "/returns/new",
    ctaLabel: "Nova Devolução",
    keywords: "devolucao devolver sobra material voltou ferramenta retornar estoque",
    steps: [
      "Acesse o menu 'Devoluções' e toque em '+ Nova Devolução'.",
      "Selecione o Almoxarifado, o colaborador que está devolvendo e (se houver) a requisição de origem.",
      "Adicione os produtos devolvidos, a quantidade em bom estado e a localização onde serão guardados novamente.",
      "Confirme o recebimento da devolução para que o saldo retorne imediatamente ao estoque da obra.",
    ],
    tip: "Dica: Toda devolução gera um registro no extrato de Movimentações para manter o histórico transparente.",
  },
  {
    id: "t-adjustment",
    category: "Estoque & Etiquetas",
    title: "Como fazer um Ajuste Manual de Estoque (sobra, perda ou correção)?",
    summary: "Corrija diferenças pontuais de quantidade informando o motivo para auditoria.",
    href: "/adjustments/new",
    ctaLabel: "Abrir Ajuste Manual",
    keywords: "ajuste manual corrigir saldo errado diferenca perda quebra avaria sobra",
    steps: [
      "Acesse 'Ajuste Manual' no menu lateral (seção Operações).",
      "Escolha o Almoxarifado, a Localização e pesquise o Produto que precisa de correção.",
      "Selecione o tipo de ajuste: 'Entrada por Ajuste' (para acrescentar saldo) ou 'Saída por Ajuste' (para baixar perda/avaria).",
      "Digite a quantidade do ajuste e descreva o motivo (ex: 'Material avariado na chuva' ou 'Sobra identificada na conferência').",
      "Toque em 'Confirmar Ajuste'. O saldo é atualizado na hora e o motivo fica salvo no extrato.",
    ],
    tip: "Dica: Para conferências gerais da obra inteira, prefira usar o módulo de 'Inventário' com o Coletor.",
  },
  {
    id: "t-transfer",
    category: "Estoque & Etiquetas",
    title: "Como transferir materiais entre Obras / Almoxarifados?",
    summary: "Mova produtos de uma obra para outra ou entre prateleiras com rastreabilidade.",
    href: "/transfers/new",
    ctaLabel: "Nova Transferência",
    keywords: "transferencia transferir mandar outra obra outro almoxarifado mudar localizacao",
    steps: [
      "Acesse a tela de 'Transferências' (/transfers) e toque em '+ Nova Transferência'.",
      "Selecione o Almoxarifado e Local de Origem (de onde o material vai sair) e o Almoxarifado e Local de Destino (para onde vai).",
      "Escolha os produtos e informe as quantidades que serão transferidas.",
      "Ao concluir a transferência, o sistema baixa automaticamente da origem e soma no destino em uma única operação segura.",
    ],
    tip: "Dica: Você precisa ter permissão de acesso tanto na obra de origem quanto na obra de destino para transferir entre elas.",
  },
  {
    id: "t-products-labels",
    category: "Estoque & Etiquetas",
    title: "Como cadastrar Produtos e imprimir Etiquetas com QR Code em lote?",
    summary: "Cadastre itens na sua obra e imprima folhas de etiquetas prontas para recortar e colar nas prateleiras.",
    href: "/products",
    ctaLabel: "Ir para Produtos",
    keywords: "cadastrar produto novo imprimir etiqueta qr code codigo de barras prateleira lote tesoura folha",
    steps: [
      "Acesse o menu 'Produtos'. Para cadastrar um item novo, toque em '+ Novo Produto', preencha nome, categoria, unidade, estoque mínimo e localização padrão.",
      "Para imprimir etiquetas: na lista de 'Produtos', marque as caixinhas de seleção ao lado dos produtos desejados (ou marque o topo da tabela para selecionar todos da página).",
      "Toque no botão 'Imprimir Etiquetas' que aparece na barra de ações.",
      "Escolha o formato (Grade de 9 ou 12 etiquetas por folha A4 com linhas pontilhadas para tesoura, ou Etiqueta Térmica) e a quantidade de cópias.",
      "Toque em 'Imprimir Agora'.",
    ],
    tip: "Dica: Na janela de impressão do navegador, desmarque a opção 'Cabeçalhos e rodapés' para aproveitar 100% da folha sem gerar página em branco.",
  },
  {
    id: "t-inventory",
    category: "Inventário",
    title: "Como fazer um Inventário completo (Coletor no Celular + Divergências)?",
    summary: "Conte o estoque fisicamente pelo celular (mesmo sem internet) e aprove os ajustes de divergência.",
    href: "/inventory",
    ctaLabel: "Ir para Inventários",
    keywords: "inventario contagem fisica coletor celular offline divergencia aprovar rejeitar concluir estoque",
    steps: [
      "1. Criar o Inventário: Acesse 'Inventários' > '+ Novo Inventário', escolha a Obra/Almoxarifado, selecione as localizações que serão contadas e inicie o inventário.",
      "2. Contar no Coletor: Pelo celular, abra o menu 'Coletor', selecione o inventário em andamento e a localização. Bipe o código do produto ou pesquise pelo nome e digite a quantidade contada fisicamente.",
      "3. Enviar Coleta: Ao terminar de contar a prateleira/local, toque em 'Finalizar e Enviar Coleta' (se estiver sem internet no galpão, os dados ficam salvos no aparelho e sincronizam assim que o sinal voltar).",
      "4. Analisar Divergências: No painel do inventário, toque em 'Encerrar Coletas'. O sistema comparará o saldo do sistema com a contagem física e listará apenas o que deu diferença.",
      "5. Concluir: Revise cada divergência (Aprovar ajuste de estoque ou Rejeitar) e toque em 'Concluir Inventário'. Ao voltar na seta, você retorna direto para a lista inicial de inventários.",
    ],
    tip: "Dica: No painel global de 'Divergências' no menu lateral, você acompanha todas as diferenças encontradas nas obras em um só lugar.",
  },
  {
    id: "t-employees",
    category: "Equipe & Importação",
    title: "Como cadastrar/importar Colaboradores e imprimir Etiquetas de Capacete?",
    summary: "Gerencie a equipe de campo e imprima os adesivos com QR Code para colar no capacete ou crachá.",
    href: "/admin/employees",
    ctaLabel: "Abrir Funcionários",
    keywords: "funcionario colaborador equipe campo capacete etiqueta cracha qr code importar planilha matricula cpf",
    steps: [
      "Acesse o menu 'Mais' > 'Funcionários'.",
      "Para cadastrar 1 colaborador: toque em '+ Novo Funcionário', preencha Nome, Matrícula, CPF, Telefone e Obra.",
      "Para importar vários de uma vez: toque em 'Importar Planilha' e envie o arquivo Excel (.xlsx) com Código/Matrícula e Nome/Razão Social.",
      "Para imprimir etiquetas de capacete: selecione os funcionários na lista e toque em 'Imprimir Etiquetas / Crachás'.",
      "Escolha entre 'Etiqueta de Capacete (12 por folha A4)' ou 'Crachá Individual (9 por folha A4)' — ambos já vêm com linhas guias para recorte com tesoura.",
    ],
    tip: "Importante: Funcionários de campo NÃO têm login e senha no sistema — eles servem apenas para receber materiais via leitura de QR Code na Entrega Rápida.",
  },
  {
    id: "t-import",
    category: "Equipe & Importação",
    title: "Como importar uma Planilha de Estoque (.xlsx) para uma Obra?",
    summary: "Carregue ou atualize os produtos e saldos de um almoxarifado via planilha Excel.",
    href: "/import",
    ctaLabel: "Ir para Importar",
    keywords: "importar planilha excel xlsx estoque obra saldo lote limpar base",
    steps: [
      "Acesse 'Mais' > 'Importar'.",
      "Selecione primeiro o 'Almoxarifado de Destino' (ex: Almoxarifado Central, Mahay Residence, Obra do Metrô DF, Ousy).",
      "Selecione ou arraste a planilha Excel (.xlsx) com as colunas: Material, Especificação, Unidade, Quantidade, Pr. Unitário / Valor.",
      "Você será levado para a tela de Pré-visualização do Lote: confira os itens identificados e clique em 'Executar Importação'.",
      "O sistema criará os produtos que ainda não existem naquela obra e ajustará os saldos em estoque diretamente, sem poluir o histórico de movimentações.",
    ],
    tip: "Dica: Caso precise zerar completamente o estoque de uma obra antes de reimportar, use o botão 'Limpar Dados deste Almoxarifado' confirmando o código da obra.",
  },
]

const FAQ_ITEMS: FaqItem[] = [
  // Acesso & Obras
  {
    id: "faq-login-cpf",
    category: "Acesso & Obras",
    question: "Posso entrar no sistema usando meu CPF em vez do e-mail?",
    answer:
      "Sim! Na tela de login você pode digitar tanto o seu e-mail corporativo quanto o seu CPF (com ou sem pontos e traço). No seu primeiro acesso com a senha inicial padrão (123456), o sistema abrirá automaticamente uma tela pedindo para você criar sua senha pessoal definitiva.",
    keywords: "login entrar cpf email senha inicial primeiro acesso 123456 redefinir trocar",
    relatedHref: "/change-password",
    relatedLabel: "Trocar Senha",
  },
  {
    id: "faq-switch-warehouse",
    category: "Acesso & Obras",
    question: "Como faço para alternar entre as Obras / Almoxarifados?",
    answer:
      "No topo da tela (ou nos filtros de Produtos, Estoque e Movimentações), há um seletor de Almoxarifado. Ao escolher uma obra específica, todas as telas passam a mostrar apenas os produtos, saldos e indicadores daquela obra. Se o seu usuário for exclusivo de uma única obra, o sistema já filtra sua obra automaticamente.",
    keywords: "trocar alternar obra almoxarifado filtro topo ver outra obra",
    relatedHref: "/stock",
    relatedLabel: "Ver Estoque por Obra",
  },
  {
    id: "faq-isolated-products",
    category: "Acesso & Obras",
    question: "Por que os produtos de uma obra não misturam com os de outra?",
    answer:
      "Cada Almoxarifado / Obra possui seu próprio catálogo e saldo isolado. Assim, um item importado ou cadastrado na Obra A não interfere no saldo nem no custo médio da Obra B. Quem tem acesso a 'Todas as Obras' pode visualizar o consolidado geral ou filtrar obra por obra.",
    keywords: "produtos separados isolados obra misturar almoxarifado",
  },
  {
    id: "faq-forgot-password",
    category: "Acesso & Obras",
    question: "Esqueci minha senha ou preciso resetar a senha de um almoxarife. Como fazer?",
    answer:
      "Um usuário com permissão de gestão de usuários (Admin / Enc. ADM / Almoxarife Geral) deve ir em 'Mais' > 'Usuários', clicar nos três pontinhos (ou em Editar) ao lado do usuário e definir uma nova senha temporária marcando 'Exige troca no login'.",
    keywords: "esqueci senha resetar recuperar bloquear usuario almoxarife",
    relatedHref: "/admin/users",
    relatedLabel: "Gerenciar Usuários",
  },

  // Estoque & Produtos
  {
    id: "faq-fix-stock",
    category: "Estoque & Produtos",
    question: "O saldo de um produto está diferente da prateleira física. Como corrigir?",
    answer:
      "Você tem duas formas seguras: 1) Para corrigir 1 ou poucos itens rapidamente, vá em 'Ajuste Manual' (/adjustments/new), escolha Entrada ou Saída por Ajuste e informe o motivo. 2) Para conferir o almoxarifado inteiro, crie um 'Inventário', conte pelo 'Coletor' no celular e aprove as divergências.",
    keywords: "saldo errado diferente corrigir consertar quantidade ajuste manual inventario",
    relatedHref: "/adjustments/new",
    relatedLabel: "Fazer Ajuste Manual",
  },
  {
    id: "faq-delete-product",
    category: "Estoque & Produtos",
    question: "Tentei excluir um produto mas o sistema não permitiu. Por quê?",
    answer:
      "Produtos que já possuem saldo ou histórico de movimentações (entradas, saídas, requisições) não podem ser apagados individualmente para proteger a auditoria da obra. Se o item não for mais utilizado, edite o produto e mude o Status para 'Inativo'.",
    keywords: "excluir apagar deletar produto erro nao deixa inativo",
    relatedHref: "/products",
    relatedLabel: "Ir para Produtos",
  },
  {
    id: "faq-low-stock",
    category: "Estoque & Produtos",
    question: "Como funcionam os alertas de 'Estoque Baixo' e 'Sem Estoque'?",
    answer:
      "Quando o saldo disponível de um produto fica igual a zero, ele é marcado como 'Sem Estoque' (vermelho). Quando o saldo é maior que zero mas fica abaixo ou igual ao 'Estoque Mínimo' configurado no cadastro do produto, ele recebe o alerta 'Estoque Baixo' (amarelo). Você pode clicar direto nos cards do topo da tela de Estoque para filtrar apenas esses itens!",
    keywords: "estoque baixo critico zerado sem estoque alerta minimo comprar",
    relatedHref: "/stock?status=LOW",
    relatedLabel: "Ver Itens com Estoque Baixo",
  },
  {
    id: "faq-unit-cards",
    category: "Estoque & Produtos",
    question: "Por que a tela de Estoque separa os totais por Unidade (UN, KG, M, L)?",
    answer:
      "Porque não faz sentido matemático somar quilos de prego com metros de cabo e litros de tinta em um único número. Por isso, o CGStock mostra cards separados com o total físico exato de cada unidade de medida daquela obra.",
    keywords: "unidades soma total un kg m litro cards estoque",
  },

  // Entradas & Saídas
  {
    id: "faq-quick-issue-vs-request",
    category: "Entradas & Saídas",
    question: "Qual a diferença entre 'Registrar Saída (Entrega Rápida)' e 'Requisição'?",
    answer:
      "A 'Registrar Saída' (/quick-issue) é feita na hora no balcão do almoxarifado: o colaborador chega, você bipa o QR Code do capacete dele e entrega o material imediatamente. Já a 'Requisição' (/requests) é um pedido formal que pode ser criado antes, passar por aprovação e depois ser separado e entregue total ou parcialmente.",
    keywords: "diferenca saida rapida entrega requisicao pedido balcao",
    relatedHref: "/quick-issue",
    relatedLabel: "Ir para Registrar Saída",
  },
  {
    id: "faq-partial-request",
    category: "Entradas & Saídas",
    question: "Posso entregar menos material do que foi pedido em uma Requisição?",
    answer:
      "Sim! Na tela de atendimento da requisição, informe apenas a quantidade que você está entregando agora. O sistema baixará somente essa quantidade do estoque e deixará a requisição com status 'Parcialmente Atendida' até que o restante seja entregue.",
    keywords: "entregar menos parcial metade requisicao falta estoque",
  },
  {
    id: "faq-import-movements",
    category: "Entradas & Saídas",
    question: "As importações de planilha aparecem na tela de Movimentações?",
    answer:
      "Não. A carga e sincronização de planilhas Excel (.xlsx) atualiza diretamente o cadastro e os saldos base do almoxarifado sem gerar lançamentos na tela de Movimentações. Assim, o Extrato de Movimentações fica limpo e mostra apenas as operações reais do dia a dia (entradas de NF, saídas rápidas, requisições, devoluções, transferências e ajustes manuais).",
    keywords: "importacao planilha aparece movimentacoes extrato historico",
    relatedHref: "/movements",
    relatedLabel: "Ver Movimentações",
  },

  // Inventário & Coletor
  {
    id: "faq-collector-offline",
    category: "Inventário & Coletor",
    question: "O Coletor de Inventário funciona sem internet no fundo do galpão ou da obra?",
    answer:
      "Sim! Abra a tela do 'Coletor' enquanto ainda tiver conexão para carregar a lista de produtos da obra. Depois, mesmo que o Wi-Fi ou 4G caia durante a caminhada pelo almoxarifado, todas as contagens ficam salvas na memória do celular e são enviadas automaticamente quando a conexão voltar.",
    keywords: "coletor offline sem internet wifi 4g sincronizar celular inventario",
    relatedHref: "/collector",
    relatedLabel: "Abrir Coletor",
  },
  {
    id: "faq-divergence-zero",
    category: "Inventário & Coletor",
    question: "No inventário, se eu contar apenas alguns itens, os outros vão aparecer como divergência?",
    answer:
      "Não! O sistema considera na análise de divergências apenas os itens que foram efetivamente bipados/contados com quantidade maior que zero na coleta. Itens que você não contou permanecem com seu saldo normal sem gerar falsas divergências.",
    keywords: "divergencia itens nao contados zero parcial inventario",
    relatedHref: "/divergences",
    relatedLabel: "Ver Divergências",
  },

  // Equipe & Etiquetas
  {
    id: "faq-employee-vs-user",
    category: "Equipe & Etiquetas",
    question: "Qual a diferença entre 'Funcionários' e 'Usuários' no menu Mais?",
    answer:
      "'Funcionários' (/admin/employees) são todos os colaboradores operacionais da obra (pedreiros, serventes, eletricistas, encarregados) que possuem QR Code no capacete/crachá para retirar materiais, mas NÃO fazem login no sistema. Já 'Usuários' (/admin/users) são os almoxarifes, auxiliares e gestores que possuem login e senha para operar o CGStock.",
    keywords: "diferenca funcionarios usuarios colaboradores login senha capacete",
    relatedHref: "/admin/employees",
    relatedLabel: "Ver Funcionários",
  },
  {
    id: "faq-print-cut-lines",
    category: "Equipe & Etiquetas",
    question: "Como imprimir etiquetas de produtos ou de capacete sem sair página em branco e com linha para tesoura?",
    answer:
      "Tanto na impressão de Etiquetas de Produtos (9 ou 12 por folha) quanto na de Etiquetas de Capacete/Crachás (12 ou 9 por folha), o sistema já desenha linhas pontilhadas com ícone de tesoura ao redor de cada etiqueta e dimensiona a página A4 exata. Na janela de impressão do navegador, basta desmarcar 'Cabeçalhos e rodapés' e manter Margens como 'Padrão' ou 'Nenhuma'.",
    keywords: "imprimir etiqueta cracha capacete pagina em branco tesoura recortar folha a4",
    relatedHref: "/admin/employees/print-badges",
    relatedLabel: "Imprimir Etiquetas de Capacete",
  },
]

const MODULE_GUIDES = [
  {
    title: "Dashboard (Painel Geral)",
    href: "/dashboard",
    icon: BarChart3,
    description: "Resumo imediato da obra selecionada: total de produtos, estoque baixo, requisições pendentes, divergências de inventário e gráfico de Entradas vs Saídas dos últimos 7 dias.",
  },
  {
    title: "Produtos & Etiquetas",
    href: "/products",
    icon: Package,
    description: "Catálogo de materiais de cada almoxarifado. Permite busca rápida por código/nome, cadastro de novos itens e impressão em lote de etiquetas QR Code (9 ou 12 por folha).",
  },
  {
    title: "Estoque e Saldos",
    href: "/stock",
    icon: Box,
    description: "Consulta de saldo físico, reservado e disponível por obra, com somatórios separados por unidade de medida (UN, KG, M, L) e filtros rápidos de Estoque Baixo e Sem Estoque.",
  },
  {
    title: "Registrar Saída (Entrega Rápida)",
    href: "/quick-issue",
    icon: Zap,
    description: "Tela otimizada para celular: abre a câmera, lê o QR Code do capacete do colaborador e registra a saída de EPIs, ferramentas e materiais na hora.",
  },
  {
    title: "Entradas (Recebimentos)",
    href: "/receipts",
    icon: ArrowDownToLine,
    description: "Registro de chegada de materiais e Notas Fiscais de fornecedores, somando os itens recebidos ao estoque da obra.",
  },
  {
    title: "Requisições e Devoluções",
    href: "/requests",
    icon: ClipboardList,
    description: "Controle de pedidos internos de materiais (com atendimento parcial ou total) e retorno de materiais que sobraram na obra.",
  },
  {
    title: "Ajuste Manual e Transferências",
    href: "/adjustments/new",
    icon: SlidersHorizontal,
    description: "Correção pontual justificada de saldos (sobras/perdas) e transferência rastreável de materiais entre obras ou localizações.",
  },
  {
    title: "Inventários, Coletor e Divergências",
    href: "/inventory",
    icon: ScanLine,
    description: "Ciclo completo de auditoria física: abertura de contagem, coleta pelo celular (funciona offline) e aprovação de divergências.",
  },
  {
    title: "Funcionários (Equipe de Campo)",
    href: "/admin/employees",
    icon: HardHat,
    description: "Base dos colaboradores da obra com geração automática de QR Code, importação via planilha Excel e impressão de etiquetas para capacete.",
  },
  {
    title: "Importar / Limpar Base da Obra",
    href: "/import",
    icon: FolderSync,
    description: "Importação em lote de planilhas de estoque (.xlsx) por almoxarifado e ferramenta segura de limpeza de base mediante confirmação de código.",
  },
]

const ROLE_GUIDES = [
  {
    role: "ADMIN / ENC. ADM",
    badge: "Acesso Total",
    scope: "Todas as Obras (inclusive futuras)",
    permissions: "Controle completo do sistema: estoque, entradas, saídas, inventários, relatórios, importação de planilhas, gestão de almoxarifados, cadastro de usuários e matriz de permissões.",
  },
  {
    role: "ALMOXARIFE GERAL / GESTOR",
    badge: "Gestão + Todas as Obras",
    scope: "Todas as Obras",
    permissions: "Entrada e saída em estoque de todas as obras, cadastro de produtos e colaboradores, emissão de relatórios e permissão para cadastrar e gerenciar usuários do sistema.",
  },
  {
    role: "ALMOXARIFE / AUX. ALMOXARIFADO",
    badge: "Operação da Obra",
    scope: "Obra(s) vinculada(s) ao usuário",
    permissions: "Entrada e saída em estoque da sua obra (entregas rápidas, recebimentos, requisições, devoluções, ajustes), cadastro de produtos e colaboradores de campo (com impressão de etiquetas) e emissão de relatórios.",
  },
  {
    role: "CONFERENTE / SOLICITANTE",
    badge: "Específico",
    scope: "Obra(s) vinculada(s) ao usuário",
    permissions: "Conferente realiza contagens físicas no Coletor de Inventário; Solicitante cria e acompanha requisições de material.",
  },
]

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function HelpContent() {
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTutorialCat, setSelectedTutorialCat] = useState<string>("TODOS")
  const [selectedFaqCat, setSelectedFaqCat] = useState<string>("TODOS")
  const [openTutorials, setOpenTutorials] = useState<Record<string, boolean>>({
    "t-quick-issue": true,
  })
  const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({
    "faq-login-cpf": true,
    "faq-fix-stock": true,
  })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: "-100px 0px -75% 0px" }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 90,
        behavior: "smooth",
      })
    }
  }

  const normalizedQuery = useMemo(() => normalizeText(searchQuery.trim()), [searchQuery])
  const queryTerms = useMemo(
    () => normalizedQuery.split(/\s+/).filter(Boolean),
    [normalizedQuery]
  )

  const matchesSearch = (text: string) => {
    if (queryTerms.length === 0) return true
    const norm = normalizeText(text)
    return queryTerms.every((term) => norm.includes(term))
  }

  const filteredTutorials = useMemo(() => {
    return TUTORIALS.filter((t) => {
      const catMatch = selectedTutorialCat === "TODOS" || t.category === selectedTutorialCat
      const textMatch = matchesSearch(
        `${t.title} ${t.summary} ${t.keywords} ${t.steps.join(" ")} ${t.tip}`
      )
      return catMatch && textMatch
    })
  }, [selectedTutorialCat, queryTerms])

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((f) => {
      const catMatch = selectedFaqCat === "TODOS" || f.category === selectedFaqCat
      const textMatch = matchesSearch(`${f.question} ${f.answer} ${f.keywords}`)
      return catMatch && textMatch
    })
  }, [selectedFaqCat, queryTerms])

  const filteredModules = useMemo(() => {
    return MODULE_GUIDES.filter((m) =>
      matchesSearch(`${m.title} ${m.description}`)
    )
  }, [queryTerms])

  const toggleTutorial = (id: string) => {
    setOpenTutorials((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleFaq = (id: string) => {
    setOpenFaqs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAllFaqs = (open: boolean) => {
    const next: Record<string, boolean> = {}
    if (open) {
      filteredFaqs.forEach((f) => {
        next[f.id] = true
      })
    }
    setOpenFaqs(next)
  }

  const isSearching = queryTerms.length > 0
  const totalResults =
    filteredTutorials.length + filteredFaqs.length + filteredModules.length

  const tutorialCategories = [
    "TODOS",
    "Operações",
    "Estoque & Etiquetas",
    "Inventário",
    "Equipe & Importação",
  ]

  const faqCategories = [
    "TODOS",
    "Acesso & Obras",
    "Estoque & Produtos",
    "Entradas & Saídas",
    "Inventário & Coletor",
    "Equipe & Etiquetas",
  ]

  return (
    <div className="space-y-6">
      {/* Barra de Pesquisa Global da Central de Ajuda */}
      <Card className="border-primary/25 bg-card shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>Como podemos ajudar você hoje?</span>
            </div>
            {isSearching && (
              <span className="text-xs text-muted-foreground">
                Encontrados <strong>{totalResults}</strong> resultados para{" "}
                <strong className="text-foreground">&ldquo;{searchQuery}&rdquo;</strong>
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquise uma dúvida ou função (ex: bipar capacete, imprimir etiqueta, inventário, senha, planilha...)"
              className="pl-11 pr-10 h-12 text-sm sm:text-base bg-background border-border focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sugestões rápidas de pesquisa */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground mr-1">Buscas rápidas:</span>
            {[
              "Saída no capacete",
              "Imprimir etiquetas",
              "Inventário no celular",
              "Ajuste manual",
              "Primeiro acesso / Senha",
              "Importar planilha",
            ].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSearchQuery(tag)}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navegação Rápida no Celular (Pills Horizontais) */}
      <div className="flex md:hidden gap-2 overflow-x-auto pb-1 no-scrollbar">
        {sections.map(({ id, title }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={cn(
              "px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors shrink-0",
              activeSection === id
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {title}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start relative">
        {/* Sidebar de Navegação Desktop (Scrollspy) */}
        <Card className="hidden md:block w-64 sticky top-24 shrink-0 bg-card border-border shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground mb-3">
                Índice do Manual
              </h3>
              <nav className="flex flex-col space-y-1">
                {sections.map(({ id, title }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollTo(id)}
                    className={cn(
                      "text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === id
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {title}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Atalhos Diretos
              </p>
              <div className="flex flex-col gap-1 text-xs">
                <Link
                  href="/quick-issue"
                  className="px-2.5 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>Registrar Saída</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link
                  href="/stock"
                  className="px-2.5 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>Estoque e Saldos</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link
                  href="/collector"
                  className="px-2.5 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>Coletor Mobile</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link
                  href="/admin/employees"
                  className="px-2.5 py-1.5 rounded-md hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>Etiquetas de Capacete</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo Principal */}
        <div className="flex-1 space-y-12 pb-20 min-w-0 w-full">
          {isSearching && totalResults === 0 && (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="p-8 text-center space-y-3">
                <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-bold text-foreground">
                  Nenhum resultado encontrado para &ldquo;{searchQuery}&rdquo;
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Tente pesquisar por palavras mais simples, como{" "}
                  <strong>saída</strong>, <strong>etiqueta</strong>,{" "}
                  <strong>capacete</strong>, <strong>inventário</strong> ou{" "}
                  <strong>senha</strong>.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedTutorialCat("TODOS")
                    setSelectedFaqCat("TODOS")
                  }}
                >
                  Limpar pesquisa e mostrar tudo
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 1. VISÃO GERAL */}
          {!isSearching && (
            <section id="intro" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold border-b border-border pb-2 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary shrink-0" />
                Visão Geral do Sistema
              </h2>
              <p className="text-foreground leading-relaxed text-sm sm:text-base">
                Bem-vindo ao <strong>CGStock</strong>, a plataforma de Gestão de Almoxarifados e Obras da{" "}
                <strong>CG Construções</strong>. O sistema foi desenhado para funcionar de forma simples e rápida tanto no{" "}
                <strong>celular</strong> (no balcão ou andando pelo galpão) quanto no <strong>computador</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    1. Isolamento por Obra
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cada obra possui seu próprio estoque isolado. Ao selecionar sua obra no topo, você vê e movimenta apenas os itens dela.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <HardHat className="h-4 w-4 text-primary shrink-0" />
                    2. Bipe no Capacete
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cada colaborador de campo tem um QR Code para colar no capacete ou crachá. Na Entrega Rápida, basta bipar com a câmera do celular.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    3. Rastreabilidade Total
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Toda entrada, saída, devolução ou ajuste fica registrado com data, hora e responsável no extrato de Movimentações.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 2. TUTORIAIS PASSO A PASSO */}
          {(!isSearching || filteredTutorials.length > 0) && (
            <section id="tutorials" className="scroll-mt-24 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
                  <PlayCircle className="h-6 w-6 shrink-0" />
                  Tutoriais Passo a Passo ({filteredTutorials.length})
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Toque em qualquer operação abaixo para ver o passo a passo numerado e o botão de atalho direto para a tela.
              </p>

              {/* Filtro de Categorias dos Tutoriais */}
              <div className="flex flex-wrap gap-1.5">
                {tutorialCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedTutorialCat(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      selectedTutorialCat === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {cat === "TODOS" ? "Todos os Tutoriais" : cat}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-1">
                {filteredTutorials.map((tutorial) => {
                  const isOpen = isSearching || !!openTutorials[tutorial.id]
                  return (
                    <div
                      key={tutorial.id}
                      className="border border-border rounded-lg overflow-hidden bg-card shadow-2xs transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTutorial(tutorial.id)}
                        className="w-full flex items-start sm:items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {tutorial.category}
                            </Badge>
                            <span className="font-bold text-sm sm:text-base text-foreground">
                              {tutorial.title}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {tutorial.summary}
                          </p>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="p-4 pt-3 border-t border-border bg-muted/20 space-y-4 text-sm">
                          <div className="space-y-3">
                            {tutorial.steps.map((step, idx) => {
                              const isLast = idx === tutorial.steps.length - 1
                              return (
                                <div key={idx} className="flex gap-3 items-start">
                                  <div
                                    className={cn(
                                      "font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs",
                                      isLast
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-primary/15 text-primary"
                                    )}
                                  >
                                    {isLast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                                  </div>
                                  <p className="text-foreground/90 leading-relaxed">{step}</p>
                                </div>
                              )
                            })}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
                            <p className="text-xs text-muted-foreground italic">
                              {tutorial.tip}
                            </p>
                            <Link href={tutorial.href} className="shrink-0">
                              <Button size="sm" variant="outline" className="gap-1.5 w-full sm:w-auto">
                                {tutorial.ctaLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* 3. GUIA DAS TELAS DO APP */}
          {(!isSearching || filteredModules.length > 0) && (
            <section id="modules" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold border-b border-border pb-2 text-primary">
                Guia das Telas do App
              </h2>
              <p className="text-sm text-muted-foreground">
                Resumo direto do que cada módulo do sistema faz. Clique em qualquer card para abrir a tela correspondente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredModules.map((mod) => (
                  <Link key={mod.title} href={mod.href} className="group block">
                    <div className="h-full border border-border rounded-lg p-4 bg-card hover:border-primary/50 hover:bg-muted/30 transition-colors space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                            <mod.icon className="h-4 w-4" />
                          </div>
                          <span>{mod.title}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 4. FUNÇÕES E PERMISSÕES */}
          {!isSearching && (
            <section id="roles" className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold border-b border-border pb-2 text-primary">
                Funções e Permissões de Acesso
              </h2>
              <p className="text-sm text-muted-foreground">
                O CGStock adapta automaticamente os menus e botões de acordo com a função de cada usuário e a obra vinculada a ele:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {ROLE_GUIDES.map((r) => (
                  <div
                    key={r.role}
                    className="border border-border rounded-lg p-4 bg-card space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-foreground">{r.role}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {r.badge}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-primary">
                      Obras: {r.scope}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {r.permissions}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 5. FAQ / DÚVIDAS FREQUENTES */}
          {(!isSearching || filteredFaqs.length > 0) && (
            <section id="faq" className="scroll-mt-24 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
                  <HelpCircle className="h-6 w-6 shrink-0" />
                  FAQ — Perguntas Frequentes ({filteredFaqs.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => expandAllFaqs(true)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Expandir todas
                  </button>
                  <span className="text-muted-foreground text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => expandAllFaqs(false)}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Recolher todas
                  </button>
                </div>
              </div>

              {/* Filtro de Categorias do FAQ */}
              <div className="flex flex-wrap gap-1.5">
                {faqCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedFaqCat(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      selectedFaqCat === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {cat === "TODOS" ? "Todas as Dúvidas" : cat}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-1">
                {filteredFaqs.map((faq) => {
                  const isOpen = isSearching || !!openFaqs[faq.id]
                  return (
                    <div
                      key={faq.id}
                      className="border border-border rounded-lg overflow-hidden bg-card shadow-2xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full flex items-start sm:items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 min-w-0">
                          <Badge
                            variant="secondary"
                            className="w-fit text-[10px] font-semibold shrink-0"
                          >
                            {faq.category}
                          </Badge>
                          <span className="font-bold text-sm sm:text-base text-foreground">
                            {faq.question}
                          </span>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="p-4 pt-3 border-t border-border bg-muted/20 space-y-3">
                          <p className="text-sm text-foreground/90 leading-relaxed">
                            {faq.answer}
                          </p>
                          {faq.relatedHref && faq.relatedLabel && (
                            <div className="pt-1">
                              <Link
                                href={faq.relatedHref}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                              >
                                {faq.relatedLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
