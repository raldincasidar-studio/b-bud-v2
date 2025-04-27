const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const md5 = require("md5");
const crypto = require("crypto");
const path = require('path');
const moment = require('moment');
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = 'mongodb+srv://raldincasidar:dindin23@accounting-system.haaem.mongodb.net/?retryWrites=true&w=majority'



async function db() {
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    return client.db('bbud-backend');
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error;
  }
}

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Express.js + CORS boilerplate!" });
});



// ======================= EMPLOYEES ======================== //

app.post('/api/login', async (req, res) => {
  

  const { username, password } = req.body;

  const dab = await db();

  // validate username, password
  if (!username || !password) {
    res.json({error: 'Invalid username or password'});
    return;
  }

  // find user in mongodb
  const usersCollection = dab.collection('admins');
  const user = await usersCollection.findOne({username: username});

  console.log(user);

  if (!user) {
    res.json({error: 'Invalid username or password'});
    return;
  }

  if (user.password !== md5(password)) {
    res.json({error: 'Invalid username or password'});
    return;
  }


  const token = generateToken();

  // save token in mongodb
  await dab.collection('users').updateOne({username: username}, {$set: {token: token}});

  res.json({
    token: token,
    user: user
  });
})



// ========================= RESIDENTS =================== //

// ADD NEW RESIDENT (POST)
app.post('/api/residents', async (req, res) => {

  const dab = await db();

  // validate required fields
  const required_fields = ['firstName', 'lastName', 'gender', 'civilStatus', 'yearLived', 'occupation', 'isVoter', 'contactNo', 'emailAddress'];

  if (required_fields.some(field => !req.body[field])) {
    res.json({error: 'Missing required fields'});
    return;
  }

  const residentsCollection = dab.collection('residents');
  await residentsCollection.insertOne(req.body);

  res.json({message: 'Resident added successfully'});
})

// GET ALL RESIDENT (GET)
app.get('/api/residents', async (req, res) => {

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const query = search ? {
    $or: [
      { firstName: { $regex: new RegExp(search, 'i') } },
      { middleName: { $regex: new RegExp(search, 'i') } },
      { lastName: { $regex: new RegExp(search, 'i') } },
      { emailAddress: { $regex: new RegExp(search, 'i') } },
      { contactNo: { $regex: new RegExp(search, 'i') } },
      { block: { $regex: new RegExp(search, 'i') } },
      { lot: { $regex: new RegExp(search, 'i') } },
      { subdivision: { $regex: new RegExp(search, 'i') } },
    ]
  } : {};
  const residents = await residentsCollection.find(query, {
    projection: {
      firstName: 1,
      middleName: 1,
      lastName: 1,
      lot: 1,
      block: 1,
      subdivision: 1,
      civilStatus: 1,
      contactNo: 1,
      emailAddress: 1,
      _id: 1,
      // action: { $ifNull: [ "$action", "" ] }
    }
  })
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .toArray();
  const totalResidents = await residentsCollection.countDocuments(query);
  res.json({
    residents: residents,
    totalResidents: totalResidents
  });
})

// GET RESIDENT BY ID (GET)
app.get('/api/residents/:id', async (req, res) => {
  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const resident = await residentsCollection.findOne({ _id: new ObjectId(req.params.id) });
  res.json({resident});
})

// DELETE RESIDENT BY ID (DELETE)
app.delete('/api/residents/:id', async (req, res) => {
  const dab = await db();
  const residentsCollection = dab.collection('residents');
  await residentsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({message: 'Resident deleted successfully'});
})





// Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// Helper function
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString("hex"); // 32 bytes = 64 hex chars
}

function calculateCustomerBalance(user_id) {
  const stmt = db.prepare(`SELECT * FROM payments WHERE customer_id = ?`);
  const payments = stmt.all(user_id);


  const user = db.prepare('SELECT * FROM customers WHERE id = ?').get(user_id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(user.item_id);
  let balance = 0;
  let amount_per_month = 0;

  if (user.selected_terms == 3) amount_per_month = user.three_months_calc;
  if (user.selected_terms == 6) amount_per_month = user.six_months_calc;
  if (user.selected_terms == 12) amount_per_month = user.twelve_months_calc;
  if (user.selected_terms == 18) amount_per_month = user.eighteen_months_calc;
  if (user.selected_terms == 24) amount_per_month = user.twenty_four_months_calc;


  balance = (amount_per_month * user.selected_terms) + user.down_payment;
  console.log(balance, amount_per_month, user.selected_terms, user.down_payment);

  for (const payment of payments) {
    balance -= payment.amount;
  }

  return Number(balance).toFixed(2);
}

function getPastDues(startingDate, terms, payments, amount_per_month) {
  const missedDues = [];
  const now = new Date();
  const start = new Date(startingDate);

  for (let i = 0; i < terms; i++) {
    const dueMonth = new Date(start);
    dueMonth.setMonth(start.getMonth() + i);

    // Skip future months
    if (dueMonth > now) break;

    const monthStart = new Date(dueMonth.getFullYear(), dueMonth.getMonth(), 1);
    const monthEnd = new Date(dueMonth.getFullYear(), dueMonth.getMonth() + 1, 0); // end of the month

    // Sum all payments made in this calendar month
    const totalPaid = payments
      .filter(p => {
        const pd = new Date(p.pay_for_the_month_of);
        return pd >= monthStart && pd <= monthEnd;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid < amount_per_month) {
      missedDues.push({
        due_month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
        totalPaid,
      });
    }
  }

  return missedDues;
}
