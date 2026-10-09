CREATE TABLE IF NOT EXISTS master_cards (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(50) NOT NULL,
    card_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('CREDIT', 'DEBIT')),
    network VARCHAR(20) NOT NULL CHECK (network IN ('VISA', 'MASTERCARD', 'RUPAY', 'AMEX')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_cards (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    master_card_id INT REFERENCES master_cards(id) ON DELETE RESTRICT,
    cardholder_label VARCHAR(50) NOT NULL DEFAULT 'Self',
    custom_nickname VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, master_card_id, cardholder_label)
);

CREATE TABLE IF NOT EXISTS merchant_offers (
    id SERIAL PRIMARY KEY,
    merchant_name VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    offer_headline VARCHAR(255) NOT NULL,
    coupon_code VARCHAR(50),
    min_spend NUMERIC(10, 2) DEFAULT 0.00,
    max_discount NUMERIC(10, 2),
    discount_percentage NUMERIC(5, 2),
    valid_days INT[] NOT NULL,
    valid_from_time TIME DEFAULT '00:00:00',
    valid_to_time TIME DEFAULT '23:59:59',
    expires_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offer_card_applicability (
    offer_id INT REFERENCES merchant_offers(id) ON DELETE CASCADE,
    master_card_id INT REFERENCES master_cards(id) ON DELETE CASCADE,
    PRIMARY KEY (offer_id, master_card_id)
);

INSERT INTO users (id, name, email) VALUES (1, 'Admin Dev', 'dev@example.com') ON CONFLICT DO NOTHING;

INSERT INTO master_cards (id, bank_name, card_name, card_type, network) VALUES
(1, 'HDFC Bank', 'Millennia Credit Card', 'CREDIT', 'VISA'),
(2, 'ICICI Bank', 'Sapphiro Credit Card', 'CREDIT', 'MASTERCARD'),
(3, 'SBI Card', 'Cashback Credit Card', 'CREDIT', 'VISA'),
(4, 'Axis Bank', 'MyZone Credit Card', 'CREDIT', 'RUPAY'),
(5, 'HDFC Bank', 'Salary Platinum Debit Card', 'DEBIT', 'VISA'),
(6, 'Axis Bank', 'Liberty Debit Card', 'DEBIT', 'MASTERCARD')
ON CONFLICT DO NOTHING;

INSERT INTO merchant_offers (id, merchant_name, category, offer_headline, coupon_code, min_spend, max_discount, valid_days, expires_on)
VALUES 
(1, 'BookMyShow', 'MOVIES', 'Buy 1 Get 1 Free on Movie Tickets (Up to ₹500 off)', 'BMSBOGO', 400.00, 500.00, ARRAY[5,6,0], '2028-12-31'),
(2, 'Zepto', 'GROCERY', 'Flat ₹150 off on groceries above ₹599', 'ZEPTO150', 599.00, 150.00, ARRAY[0,1,2,3,4,5,6], '2028-12-31'),
(3, 'Swiggy', 'FOOD', 'Flat ₹120 off on Weekend Orders above ₹499', 'WEEKEND120', 499.00, 120.00, ARRAY[5,6,0], '2028-12-31')
ON CONFLICT DO NOTHING;

INSERT INTO offer_card_applicability (offer_id, master_card_id) VALUES
(1, 2),
(1, 4),
(2, 3),
(2, 1),
(3, 5),
(3, 6)
ON CONFLICT DO NOTHING;

SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('master_cards_id_seq', (SELECT COALESCE(MAX(id), 1) FROM master_cards));
SELECT setval('merchant_offers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM merchant_offers));
