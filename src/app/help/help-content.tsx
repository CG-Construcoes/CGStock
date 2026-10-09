"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, CheckCircle2, PlayCircle } from "lucide-react"

const sections = [
  { id: "intro", title: "Visão Geral" },
  { id: "tutorials", title: "Tutoriais Passo a Passo" }, // <-- Nova seção
  { id: "dashboard", title: "Painel Geral (Dashboard)" },
  { id: "catalog", title: "Catálogo e Cadastros" },
  { id: "stock", title: "Gestão de Estoque" },
  { id: "operations", title: "Operações Diárias" },
  { id: "inventory", title: "Inventário e Coletor" },
  { id: "reports", title: "Relatórios" },
  { id: "admin", title: "Administração" },
  { id: "faq", title: "FAQ / Dúvidas Comuns" },
]

export function HelpContent() {
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const [openTutorial, setOpenTutorial] = useState<string | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: "-100px 0px -80% 0px" }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 100,
        behavior: "smooth",
      })
    }
  }

  const toggleTutorial = (id: string) => {
    setOpenTutorial(openTutorial === id ? null : id)
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start relative">
      {/* Sidebar de Navegação (Scrollspy) */}
      <Card className="hidden md:block w-72 sticky top-24 shrink-0 bg-card  border-border shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground mb-4">Índice</h3>
          <nav className="flex flex-col space-y-1">
            {sections.map(({ id, title }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={cn(
                  "text-left px-3 py-2 rounded-lg text-sm  ",
                  activeSection === id
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {title}
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>

      {/* Conteúdo Principal */}
      <div className="flex-1 space-y-16 pb-24 max-w-4xl">
        <section id="intro" className="scroll-mt-24 space-y-4">
          <h2 className="text-3xl font-bold border-b pb-2">Visão Geral</h2>
          <p className="text-foreground leading-relaxed text-lg">
            Bem-vindo ao <strong>CGStock</strong>, seu sistema profissional de Gestão de Almoxarifado.
            Ele foi desenvolvido com o conceito de <em>Imutabilidade Operacional</em>, o que significa que
            toda alteração no estoque gera um rastro inalterável, garantindo auditoria completa e zero fraudes.
          </p>
          <div className="bg-primary/5/50 dark:bg-primary/20 border border-primary/10 dark:border-primary rounded-md p-4 mt-4">
            <h4 className="font-semibold text-primary dark:text-primary">Conceito Chave: Movimentações</h4>
            <p className="text-sm text-primary/80 dark:text-primary/80 mt-1">
              Você nunca edita a quantidade de um produto diretamente. O estoque é sempre o resultado da soma matemática de todas as Entradas subtraída de todas as Saídas.
            </p>
          </div>
        </section>

        {/* TUTORIAIS */}
        <section id="tutorials" className="scroll-mt-24 space-y-4">
          <h2 className="text-3xl font-bold border-b pb-2 text-primary flex items-center gap-2">
            <PlayCircle className="h-6 w-6" />
            Tutoriais Passo a Passo
          </h2>
          <p className="text-muted-foreground">
            Aprenda na prática como realizar as operações mais comuns do dia a dia no sistema.
          </p>

          <div className="space-y-3 mt-4">
            {/* Tutorial 1 */}
            <div className="border border-border rounded-md overflow-hidden bg-card ">
              <button 
                onClick={() => toggleTutorial('t1')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 "
              >
                <span className="font-bold text-foreground">Como dar Entrada em uma Mercadoria (Nota Fiscal)?</span>
                {openTutorial === 't1' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {openTutorial === 't1' && (
                <div className="p-4 pt-0 border-t bg-muted/20 space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3 items-start pt-4">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</div>
                    <p>Acesse o menu <strong>Entradas</strong> na barra lateral.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                    <p>Clique no botão <strong>+ Nova Entrada</strong> no canto superior direito.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                    <p>Preencha os dados do Recebimento: selecione o <strong>Fornecedor</strong>, o <strong>Almoxarifado Destino</strong> e digite o número do <strong>Documento / NF</strong>.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</div>
                    <p>Clique em <strong>Adicionar Produto</strong>. Selecione o produto que chegou, a quantidade, o custo unitário e em qual prateleira (Localização) ele será guardado.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-emerald-100 text-emerald-700 font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="h-4 w-4" /></div>
                    <p>Clique em <strong>Finalizar e Atualizar Estoque</strong>. As quantidades serão imediatamente somadas ao estoque!</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tutorial 2 */}
            <div className="border border-border rounded-md overflow-hidden bg-card ">
              <button 
                onClick={() => toggleTutorial('t2')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 "
              >
                <span className="font-bold text-foreground">Como aprovar e entregar uma Requisição?</span>
                {openTutorial === 't2' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {openTutorial === 't2' && (
                <div className="p-4 pt-0 border-t bg-muted/20 space-y-4 text-sm text-muted-foreground">
                  <p className="pt-4">Quando um funcionário solicita material, a requisição entra com status <strong>Pendente</strong>. Veja como atendê-la:</p>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</div>
                    <p>Acesse o menu <strong>Requisições</strong> na barra lateral.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                    <p>Na lista, encontre a requisição pendente e clique no ícone de <strong>Visualizar (Olho)</strong>.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                    <p>Analise os itens pedidos. Clique no botão <strong>Atender Requisição</strong> (Geralmente verde no topo da tela).</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</div>
                    <p>Na tela de atendimento, você deve definir de <strong>qual Localização</strong> (Prateleira) está tirando os produtos. Você pode entregar a quantidade total solicitada ou apenas uma quantidade parcial.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-emerald-100 text-emerald-700 font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="h-4 w-4" /></div>
                    <p>Clique em <strong>Confirmar Entrega</strong>. O sistema abaterá os itens do estoque e a requisição mudará para Parcialmente Atendida ou Finalizada.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tutorial 3 */}
            <div className="border border-border rounded-md overflow-hidden bg-card ">
              <button 
                onClick={() => toggleTutorial('t3')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 "
              >
                <span className="font-bold text-foreground">Como usar o Coletor Offline (App) para Inventário?</span>
                {openTutorial === 't3' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {openTutorial === 't3' && (
                <div className="p-4 pt-0 border-t bg-muted/20 space-y-4 text-sm text-muted-foreground">
                  <p className="pt-4">O Coletor foi criado para que estoquistas possam contar prateleiras mesmo sem internet.</p>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</div>
                    <p>Um administrador precisa criar uma <strong>Auditoria (Inventário)</strong> no sistema, selecionando o Almoxarifado.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                    <p>O funcionário abre o menu <strong>Coletor (Scanner)</strong> pelo celular. Lá, ele seleciona o Inventário ativo e o corredor (Localização) que vai contar.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                    <p>Mesmo que a internet caia, ele pode usar a câmera para bipar o código de barras ou digitar manualmente a quantidade exata encontrada fisicamente.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</div>
                    <p>Quando ele voltar para a área com Wi-Fi/4G, basta clicar no ícone <strong>Nuvem/Sincronizar</strong> no topo da tela do Coletor.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-emerald-100 text-emerald-700 font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="h-4 w-4" /></div>
                    <p>O administrador poderá ver as diferenças entre o sistema e o físico na tela de <strong>Divergências</strong> e aplicar o ajuste com 1 clique.</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Tutorial 4 */}
            <div className="border border-border rounded-md overflow-hidden bg-card ">
              <button 
                onClick={() => toggleTutorial('t4')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 "
              >
                <span className="font-bold text-foreground">Como cadastrar um novo Produto?</span>
                {openTutorial === 't4' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {openTutorial === 't4' && (
                <div className="p-4 pt-0 border-t bg-muted/20 space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3 items-start pt-4">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</div>
                    <p>Acesse o menu <strong>Produtos</strong> e certifique-se de que a <em>Categoria</em> e a <em>Unidade de Medida</em> do item já existam no sistema.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                    <p>Clique em <strong>+ Novo Produto</strong>.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                    <p>Você pode deixar o Código Interno em branco para ser gerado automaticamente. Preencha o Código de Barras bipando com o leitor caso exista.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-primary/10 text-primary font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</div>
                    <p>Informe o <strong>Estoque Mínimo</strong> (para ser avisado quando acabar) e o <strong>Estoque Máximo</strong>.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="bg-emerald-100 text-emerald-700 font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="h-4 w-4" /></div>
                    <p>Salve! Lembre-se: O produto nascerá com <strong>0 (zero)</strong> em estoque. Para dar saldo inicial, você deve realizar uma Entrada ou um Ajuste de Estoque.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>

        <section id="dashboard" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Painel Geral (Dashboard)</h2>
          <p className="text-foreground leading-relaxed">
            O Dashboard é a sua torre de controle. Ele exibe em tempo real o valor total em estoque, a quantidade de itens únicos e alertas de produtos abaixo do estoque mínimo.
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong className="text-foreground">Gráficos de Movimentação:</strong> Mostram o volume de entradas vs saídas dos últimos dias.</li>
            <li><strong className="text-foreground">Atalhos Rápidos:</strong> Botões no topo para as ações mais frequentes (Nova Entrada, Nova Saída).</li>
          </ul>
        </section>

        <section id="catalog" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Catálogo e Cadastros</h2>
          <p className="text-foreground leading-relaxed">
            Para operar o sistema, você primeiro precisa organizar seus cadastros base.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="border rounded-md p-4 bg-card">
              <h3 className="font-bold">Categorias & Unidades</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Agrupe seus itens (ex: EPIs, Limpeza, Ferramentas) e crie Unidades de Medida (UN, KG, CX). 
                Eles são obrigatórios para cadastrar produtos.
              </p>
            </div>
            <div className="border rounded-md p-4 bg-card">
              <h3 className="font-bold">Localizações (Endereçamento)</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Onde a mercadoria fica física no almoxarifado? Ex: <em>Corredor A - Prateleira 2</em>.
              </p>
            </div>
          </div>
          <p className="text-foreground leading-relaxed mt-4">
            <strong>Cadastro de Produto:</strong> Informe código de barras, estoque mínimo e máximo, e amarre-o a uma Categoria e Unidade.
          </p>
        </section>

        <section id="stock" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Gestão de Estoque</h2>
          <p className="text-foreground leading-relaxed">
            O menu de <strong>Estoque</strong> exibe o saldo atual consolidado. Você pode pesquisar por nome ou código de barras e verificar rapidamente quanto há disponível em cada localização.
          </p>
          <h4 className="font-semibold text-lg mt-4">Movimentações (Extrato)</h4>
          <p className="text-muted-foreground">
            Funciona como um extrato bancário. Se um saldo está estranho, consulte o Extrato. Ele detalha quem, quando, onde e por que um item entrou ou saiu, sem possibilidade de exclusão daquele registro.
          </p>
        </section>

        <section id="operations" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Operações Diárias</h2>
          <p className="text-foreground leading-relaxed">
            Como você alimenta e retira materiais do sistema na prática:
          </p>
          
          <div className="space-y-4 mt-4">
            <div className="flex gap-4">
              <div className="w-1.5 bg-emerald-500 rounded-full"></div>
              <div>
                <h4 className="font-bold">1. Entradas (Recebimentos)</h4>
                <p className="text-sm text-muted-foreground mt-1">Usado quando o caminhão chega com mercadoria de um Fornecedor. É necessário informar Nota Fiscal (Documento) e os itens entram fisicamente na localização definida.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-1.5 bg-amber-500 rounded-full"></div>
              <div>
                <h4 className="font-bold">2. Requisições</h4>
                <p className="text-sm text-muted-foreground mt-1">O coração do fluxo. Um funcionário/setor solicita X unidades de um item. A requisição nasce <em>Pendente</em>. Um estoquista precisa <strong>Atender (Fulfill)</strong> a requisição. Ao atender, o sistema deduz a quantidade do estoque automaticamente.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-1.5 bg-red-500 rounded-full"></div>
              <div>
                <h4 className="font-bold">3. Saídas Avulsas</h4>
                <p className="text-sm text-muted-foreground mt-1">Usado para perdas, quebras, validade vencida ou doações. Diferente da requisição, aqui o material sai do estoque imediatamente após você salvar.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="inventory" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Inventário e Coletor</h2>
          <p className="text-foreground leading-relaxed">
            Processos para garantir a acurácia do seu almoxarifado.
          </p>
          <ul className="list-disc list-inside space-y-3 text-muted-foreground">
            <li>
              <strong className="text-foreground">Auditoria (Inventário):</strong> Você cria um lote de contagem de uma área inteira (Ex: Prateleira B). O sistema &quot;congela&quot; o saldo esperado daquele momento.
            </li>
            <li>
              <strong className="text-foreground">Coletor (App PWA):</strong> Os operários abrem o &quot;Coletor&quot; no celular. Podem ficar <strong>offline</strong>, usar a câmera para bipar códigos de barras e digitar a quantidade real encontrada na prateleira. Quando voltam para uma área com Wi-Fi, eles sincronizam os dados no botão superior.
            </li>
            <li>
              <strong className="text-foreground">Divergências:</strong> Se o sistema esperava 10 e o Coletor contou 8, o Admin do sistema visualiza as divergências e decide se aprova o <em>Ajuste Automático</em> (gera uma Movimentação de Saída por Ajuste) ou manda recontar.
            </li>
          </ul>
        </section>

        <section id="reports" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Relatórios</h2>
          <p className="text-foreground leading-relaxed">
            Exportações vitais para a contabilidade e gestão de compras.
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li><strong className="text-foreground">Curva ABC (Consumo):</strong> Quais os itens mais caros/consumidos da sua operação? Foque na negociação destes.</li>
            <li><strong className="text-foreground">Estoque Crítico:</strong> Lista imediata do que você precisa comprar hoje (Estoque Atual &lt; Estoque Mínimo).</li>
          </ul>
        </section>

        <section id="admin" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">Administração e Permissões</h2>
          <p className="text-foreground leading-relaxed">
            Módulo restrito para Administradores.
          </p>
          <p className="text-muted-foreground">
            No <strong>Gerenciamento de Usuários</strong>, você pode criar senhas e definir os níveis de acesso (Ex: O Perfil <em>VIEWER</em> só consegue ver relatórios e estoque, não consegue dar saídas. O <em>MANAGER</em> aprova inventários. O <em>OPERATOR</em> pode usar o Coletor).
          </p>
        </section>

        <section id="faq" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-bold border-b pb-2 text-primary">FAQ / Dúvidas Comuns</h2>
          <div className="space-y-4 mt-4">
            <div className="border border-border rounded-md p-4 bg-card">
              <h4 className="font-bold">1. O saldo de um produto está errado no sistema. Como corrigir?</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Como o CGStock trabalha com Imutabilidade Operacional, você não pode &quot;editar&quot; o saldo de um produto. Se houver uma diferença física, você deve ir em <strong>Inventário</strong> e criar um Ajuste (Entrada ou Saída por Ajuste) para justificar a sobra ou perda. Isso mantém o rastro de auditoria perfeito.
              </p>
            </div>
            
            <div className="border border-border rounded-md p-4 bg-card">
              <h4 className="font-bold">2. Como transfiro materiais de uma obra (almoxarifado) para outra?</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Acesse o menu de <strong>Transferências</strong>. Nele, você pode selecionar o Almoxarifado de Origem (onde o produto está) e o Almoxarifado de Destino (para onde vai). O sistema debita de um lado e credita do outro de forma segura e atrelada a um único documento.
              </p>
            </div>

            <div className="border border-border rounded-md p-4 bg-card">
              <h4 className="font-bold">3. Tentei excluir um produto mas o sistema não deixou. Por quê?</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Produtos que já sofreram movimentações de estoque (entradas, saídas, requisições) não podem ser excluídos para não quebrar o histórico contábil e de relatórios do passado. Nesses casos, você deve alterar o <strong>Status</strong> do produto para <em>Inativo</em> na tela de edição. Assim, ele não aparecerá mais nas buscas para novas operações.
              </p>
            </div>

            <div className="border border-border rounded-md p-4 bg-card">
              <h4 className="font-bold">4. Posso entregar menos material do que o funcionário pediu na Requisição?</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Sim! Ao atender uma Requisição, você verá a coluna &quot;Qtd. Aprovada/Entregue&quot;. Se o funcionário pediu 10 luvas, mas você só tem 5 em estoque (ou só quer liberar 5), basta preencher 5. A requisição ficará com status de <em>Parcialmente Atendida</em>.
              </p>
            </div>

            <div className="border border-border rounded-md p-4 bg-card">
              <h4 className="font-bold">5. O que significa &quot;Imutabilidade Operacional&quot;?</h4>
              <p className="text-sm text-muted-foreground mt-2">
                É a segurança do seu patrimônio. Significa que os registros passados de entradas e saídas nunca podem ser alterados ou apagados. Isso evita fraudes e erros invisíveis. Se um lançamento foi feito errado, deve-se fazer um lançamento de estorno ou ajuste, criando um rastro transparente que qualquer auditor ou gestor consegue entender depois.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
