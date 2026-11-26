-- AlterTable
ALTER TABLE `Warehouse` ADD COLUMN `engineerName` VARCHAR(191) NULL,
    ADD COLUMN `engineerEmail` VARCHAR(191) NULL;

-- Permissão: consulta de saldo de todos os almoxarifados (somente leitura)
INSERT IGNORE INTO `Permission` (`id`, `key`, `name`, `description`)
VALUES (UUID(), 'STOCK_VIEW_ALL', 'Consultar Saldo de Todos os Almoxarifados', 'Ver o saldo de estoque de todos os almoxarifados (somente leitura); operações continuam restritas aos almoxarifados com acesso');
