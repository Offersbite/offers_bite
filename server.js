const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@postgres:5432/cardperks',
});

// 1. Fetch available Master Cards
app.get('/api/cards/master', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM master_cards ORDER BY bank_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch User Household Wallet
app.get('/api/wallet/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const query = `
      SELECT uc.id, uc.cardholder_label, uc.custom_nickname, mc.bank_name, mc.card_name, mc.card_type, mc.network, mc.id as master_card_id
      FROM user_cards uc
      JOIN master_cards mc ON uc.master_card_id = mc.id
      WHERE uc.user_id = $1 AND uc.is_active = TRUE
      ORDER BY uc.cardholder_label, mc.bank_name;
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add Card to Wallet (CRUCIAL ENDPOINT)
app.post('/api/wallet/:userId', async (req, res) => {
  const { userId } = req.params;
  const { masterCardId, cardholderLabel, customNickname } = req.body;
  try {
    const query = `
      INSERT INTO user_cards (user_id, master_card_id, cardholder_label, custom_nickname)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, master_card_id, cardholder_label) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [userId, masterCardId, cardholderLabel || 'Self', customNickname || null]);
    res.status(201).json(result.rows[0] || { message: 'Already exists' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Delete Card from Wallet
app.delete('/api/wallet/:cardId', async (req, res) => {
  const { cardId } = req.params;
  try {
    await pool.query('DELETE FROM user_cards WHERE id = $1', [cardId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Match Engine: Active Offers for the User's Registered Cards
app.get('/api/offers/matched/:userId', async (req, res) => {
  const { userId } = req.params;
  const targetDay = req.query.day !== undefined ? parseInt(req.query.day) : new Date().getDay();

  try {
    const query = `
      SELECT DISTINCT 
        mo.id as offer_id,
        mo.merchant_name,
        mo.category,
        mo.offer_headline,
        mo.coupon_code,
        mo.min_spend,
        mo.max_discount,
        mo.valid_days,
        mc.bank_name,
        mc.card_name,
        uc.cardholder_label,
        uc.custom_nickname
      FROM merchant_offers mo
      JOIN offer_card_applicability oca ON mo.id = oca.offer_id
      JOIN user_cards uc ON oca.master_card_id = uc.master_card_id
      JOIN master_cards mc ON uc.master_card_id = mc.id
      WHERE uc.user_id = $1
        AND uc.is_active = TRUE
        AND $2 = ANY(mo.valid_days)
        AND mo.expires_on >= CURRENT_DATE
      ORDER BY mo.merchant_name;
    `;
    const result = await pool.query(query, [userId, targetDay]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CardPerks running on port ${PORT}`));
