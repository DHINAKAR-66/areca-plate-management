require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const seedPlateSizes = async () => {
  const sizes = [
    { size: '6', price: 1.50 },
    { size: '8', price: 2.50 },
    { size: '10', price: 4.00 },
    { size: '12', price: 6.00 }
  ]

  console.log('Starting plate sizes seed...')
  const client = await pool.connect()

  try {
    for (const item of sizes) {
      await client.query(
        `INSERT INTO plate_sizes (size, price) 
         VALUES ($1, $2) 
         ON CONFLICT (size) DO NOTHING`,
        [item.size, item.price]
      )
      console.log(`Ensured plate size ${item.size} inch (₹${item.price.toFixed(2)}) exists.`)
    }
    console.log('Seed completed successfully.')
  } catch (err) {
    console.error('Error seeding plate sizes:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seedPlateSizes()
