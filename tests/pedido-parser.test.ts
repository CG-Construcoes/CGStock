import { describe, it, expect } from 'vitest'
import { parsePedidoSheet, resolvePedidoProduct, scoreNameMatch } from '@/lib/pedido-parser'

const PEDIDO_HEADER = [
  'Item', 'Sol', 'Sit', 'Especificação', 'Insumo-Sub', 'Ec', 'Unid', 'Quantidade',
  'PrUnit Inicial', '% Desc', 'PrUnit Insumo', '% IPI', 'Total do Item',
  'Entrega Pedido', 'Entrega Solicitação', 'OrçEmp',
]

describe('parsePedidoSheet — planilha de pedido exportada do Informakon', () => {
  it('extrai itens com código Insumo-Sub, quantidade e PrUnit Insumo', () => {
    const rows = [
      PEDIDO_HEADER,
      ['001', '80      /003', 'AR', 'INTERRUPTOR DUPLO 10A 4X2"', '028651-000', '', 'UN', 1, 5.2, 0, 5.2, 0, 5.2, 46311, 46297, ''],
      ['005', '25      /001', 'AR', 'PISO PRÉ-MOLDADO 16 FACES', '005662-000', '', 'M2', 181, 45, 0, 45, 0, 8145, 46311, 46274, ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', 8190.2, '', '', ''], // rodapé total
    ]
    const items = parsePedidoSheet(rows)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ productCode: '028651-000', quantity: 1, unitCost: 5.2, unitCode: 'UN' })
    expect(items[1]).toMatchObject({ productCode: '005662-000', quantity: 181, unitCost: 45, unitCode: 'M2', totalValue: 8145 })
  })

  it('usa PrUnit Inicial quando PrUnit Insumo está vazio', () => {
    const rows = [
      PEDIDO_HEADER,
      ['001', '', 'AR', 'ITEM X', '000001-000', '', 'UN', 2, 10.5, 0, '', 0, '', '', '', ''],
    ]
    const items = parsePedidoSheet(rows)
    expect(items[0].unitCost).toBe(10.5)
  })

  it('aceita números no formato pt-BR (vírgula)', () => {
    const rows = [
      PEDIDO_HEADER,
      ['001', '', 'AR', 'ITEM Y', '000002-000', '', 'KG', '1.234,50', '3,25', 0, '3,25', 0, '4.014,08', '', '', ''],
    ]
    const items = parsePedidoSheet(rows)
    expect(items[0].quantity).toBe(1234.5)
    expect(items[0].unitCost).toBe(3.25)
  })

  it('descarta linhas sem código (vazias/rodapé) e mantém quantidade zero p/ preenchimento', () => {
    const rows = [
      PEDIDO_HEADER,
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['002', '', 'AR', 'VALIDO', '000003-000', '', 'UN', 0, 1, 0, 1, 0, 0, '', '', ''],
      ['003', '', 'AR', 'VALIDO 2', '000004-000', '', 'UN', 3, 1, 0, 1, 0, 3, '', '', ''],
    ]
    const items = parsePedidoSheet(rows)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ productCode: '000003-000', quantity: 0 })
    expect(items[1]).toMatchObject({ productCode: '000004-000', quantity: 3 })
  })

  it('retorna vazio para planilha que não é pedido', () => {
    const rows = [['Código', 'Descrição do Material'], ['001', 'ABC']]
    expect(parsePedidoSheet(rows)).toEqual([])
  })
})

const LISTA_HEADER = [
  'Código', 'Tipo', 'Descrição do Material', 'Unid.', 'Categoria',
  'Classificação', 'Quantidade', 'Preço Unit. (R$)', 'Valor Total (R$)',
]

describe('parsePedidoSheet — lista de materiais (catálogo)', () => {
  it('reconhece o formato "Lista de Materiais" mesmo sem quantidades', () => {
    const rows = [
      ['Relatório de Materiais'],
      [],
      LISTA_HEADER,
      ['023824', 'Insumo', 'CABO COBRE FLEXIVEL 450/750V 1,5MM PRETO', 'M', 'Fios e cabos', 'Insumo', null, null, null],
      ['024555', 'Insumo', 'CABO FLEX 2,5MM AZUL', 'M', 'Fios e cabos', 'Insumo', null, 12.5, null],
      [null, null, 'TOTAL GERAL', null, null, null, null, null, null],
    ]
    const items = parsePedidoSheet(rows)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      productCode: '023824',
      productName: 'CABO COBRE FLEXIVEL 450/750V 1,5MM PRETO',
      quantity: 0,
      unitCode: 'M',
      categoryName: 'Fios e cabos',
    })
    expect(items[1].unitCost).toBe(12.5)
  })

  it('encontra o cabeçalho além da 15ª linha (relatórios com capa longa)', () => {
    const rows: unknown[][] = Array.from({ length: 20 }, () => ['relatório', ''])
    rows.push(LISTA_HEADER, ['001', 'X', 'ITEM A', 'UN', 'Cat', 'Insumo', 2, 1, 2])
    expect(parsePedidoSheet(rows)).toHaveLength(1)
  })
})

describe('resolvePedidoProduct — multi-fonte MGA/CV', () => {
  const catalogo = [
    { id: 'p-mga', code: '000209-000', name: 'BATENTE DE PEROBA PARA PORTA 1FL.' },
    { id: 'p-cv', code: '000209-000-CV', name: 'ANEL DE VEDAÇÃO PARA VASO SANITÁRIO' },
    { id: 'p-so', code: '005266-000', name: 'INTERRUPTOR 3 TECLAS PARALELOS' },
  ]

  it('escolhe o produto da fonte certa pela especificação do pedido', () => {
    const item = { productCode: '000209-000', productName: 'ANEL DE VEDAÇÃO PARA VASO SANITÁRIO - FORNECIMENTO CG', quantity: 1, unitCost: 10.5, unitCode: 'UN', totalValue: 10.5, categoryName: null }
    expect(resolvePedidoProduct(item, catalogo)?.id).toBe('p-cv')
  })

  it('casa direto quando só existe um candidato', () => {
    const item = { productCode: '005266-000', productName: 'QUALQUER', quantity: 1, unitCost: 1, unitCode: 'UN', totalValue: 1, categoryName: null }
    expect(resolvePedidoProduct(item, catalogo)?.id).toBe('p-so')
  })

  it('não casa quando nome diverge de todos os candidatos', () => {
    const item = { productCode: '000209-000', productName: 'CABO FLEXÍVEL 750V', quantity: 1, unitCost: 1, unitCode: 'UN', totalValue: 1, categoryName: null }
    expect(resolvePedidoProduct(item, catalogo)).toBeNull()
  })

  it('casa código sem sub-insumo por prefixo quando o nome confirma', () => {
    const catalogo2 = [
      { id: 'p1', code: '023824-000-CV', name: 'CABO COBRE FLEXIVEL 450/750V 1,5MM PRETO' },
    ]
    const item = { productCode: '023824', productName: 'CABO COBRE FLEXIVEL 450/750V 1,5MM PRETO', quantity: 0, unitCost: null, unitCode: 'M', totalValue: null, categoryName: null }
    expect(resolvePedidoProduct(item, catalogo2)?.id).toBe('p1')
  })

  it('não casa código sem sub-insumo quando o nome diverge', () => {
    const catalogo2 = [
      { id: 'p1', code: '023824-999', name: 'PARAFUSO SEXTAVADO 1/2' },
    ]
    const item = { productCode: '023824', productName: 'CABO COBRE FLEXIVEL 450/750V', quantity: 0, unitCost: null, unitCode: 'M', totalValue: null, categoryName: null }
    expect(resolvePedidoProduct(item, catalogo2)).toBeNull()
  })

  it('scoreNameMatch mede sobreposição de palavras significativas', () => {
    expect(scoreNameMatch('ANEL DE VEDAÇÃO PARA VASO SANITÁRIO', 'ANEL DE VEDAÇÃO PARA VASO SANITÁRIO')).toBe(1)
    expect(scoreNameMatch('ANEL DE VEDAÇÃO', 'BATENTE DE PEROBA')).toBeLessThan(0.4)
  })
})
