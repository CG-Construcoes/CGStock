import { describe, it, expect } from 'vitest'
import { parsePedidoSheet } from '@/lib/pedido-parser'

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

  it('descarta linhas sem código e sem nome (vazias/rodapé) e quantidade zero', () => {
    const rows = [
      PEDIDO_HEADER,
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['002', '', 'AR', 'VALIDO', '000003-000', '', 'UN', 0, 1, 0, 1, 0, 0, '', '', ''],
      ['003', '', 'AR', 'VALIDO 2', '000004-000', '', 'UN', 3, 1, 0, 1, 0, 3, '', '', ''],
    ]
    const items = parsePedidoSheet(rows)
    expect(items).toHaveLength(1)
    expect(items[0].productCode).toBe('000004-000')
  })

  it('retorna vazio para planilha que não é pedido', () => {
    const rows = [['Código', 'Descrição do Material'], ['001', 'ABC']]
    expect(parsePedidoSheet(rows)).toEqual([])
  })
})
