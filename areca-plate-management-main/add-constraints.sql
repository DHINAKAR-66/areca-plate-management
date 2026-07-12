ALTER TABLE stock ADD CONSTRAINT stock_quantity_check CHECK (quantity >= 0);
ALTER TABLE production ADD CONSTRAINT production_quantity_check CHECK (quantity >= 0);
ALTER TABLE bill_items ADD CONSTRAINT bill_items_quantity_check CHECK (quantity >= 0);
