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




// =================== RESIDENTS LOGIN =================== //

// RESIDENT LOGIN (POST)
app.post('/api/residents/login', async (req, res) => {
  const { email, password } = req.body;
  const dab = await db();
  const residentsCollection = dab.collection('residents');

  if (!email || !password) {
    return res.status(400).json({ error: 'Validation failed', message: 'Email and password are required.' });
  }

  try {
    // Find resident by email (case-insensitive for email)
    const resident = await residentsCollection.findOne({ email: String(email).trim().toLowerCase() });

    if (!resident) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
    }

    // Hash the provided password using MD5 to compare with the stored hash
    const hashedPasswordAttempt = md5(password);

    if (resident.password_hash !== hashedPasswordAttempt) { // Ensure your stored field is named 'password_hash'
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
    }

    // Login successful
    // IMPORTANT: Do NOT send the password_hash back to the client
    const { password_hash, ...residentDataToReturn } = resident; // Destructure to remove password_hash

    // Here you would typically generate a session token (e.g., JWT)
    // For simplicity, I'm just returning resident data.
    // In a real app, replace this with token generation and set it in a cookie or response header.
    // Example (conceptual, needs JWT library like jsonwebtoken):
    // const token = jwt.sign({ id: resident._id, email: resident.email }, 'YOUR_SECRET_KEY', { expiresIn: '1h' });
    // res.json({ message: 'Login successful', resident: residentDataToReturn, token: token });

    res.json({ message: 'Login successful', resident: residentDataToReturn });

  } catch (error) {
    console.error("Error during resident login:", error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred during login.' });
  }
});

// ========================= RESIDENTS =================== //

// ADD NEW RESIDENT (POST) - UPDATED with Password & MD5 Hashing
app.post('/api/residents', async (req, res) => {
  const dab = await db();
  const residentsCollection = dab.collection('residents');

  const {
    // Personal Info
    first_name, middle_name, last_name, sex, age, date_of_birth,
    civil_status, occupation_status, place_of_birth, citizenship, is_pwd,
    // Address Info
    address_house_number, address_street, address_subdivision_zone,
    address_city_municipality, years_lived_current_address,
    // Contact Info
    contact_number, email,
    // NEW: Password
    password, // Plain text password from client
    // Voter Info
    is_registered_voter, precinct_number,
    voter_registration_proof_base64, voter_registration_proof_name,
    // Proofs
    residency_proof_base64, residency_proof_name,
    // Household Info
    is_household_head, household_member_ids,
  } = req.body;

  // --- Basic Validation ---
  if (!first_name || !last_name || !sex || !date_of_birth || !email || !password) {
    return res.status(400).json({ error: 'Validation failed', message: 'First name, last name, sex, date of birth, email, and password are required.' });
  }
  // Add more specific validations for other fields as needed

  // Check if email already exists (assuming email should be unique for login)
  try {
    const existingResident = await residentsCollection.findOne({ email: email.toLowerCase() });
    if (existingResident) {
      return res.status(409).json({ error: 'Conflict', message: 'Email address already in use.' });
    }
  } catch (dbError) {
      console.error("Database error checking existing email:", dbError);
      return res.status(500).json({ error: "Database error", message: "Could not verify email availability."});
  }


  // Hash the password using MD5
  const hashedPassword = md5(password);

  try {
    const newResidentDocument = {
      // Personal Info
      first_name: String(first_name).trim(),
      middle_name: middle_name ? String(middle_name).trim() : null,
      last_name: String(last_name).trim(),
      sex: String(sex),
      age: age ? parseInt(age) : null,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      civil_status: String(civil_status),
      occupation_status: String(occupation_status),
      place_of_birth: place_of_birth ? String(place_of_birth).trim() : null,
      citizenship: citizenship ? String(citizenship).trim() : null,
      is_pwd: Boolean(is_pwd),

      // Address Info
      address_house_number: address_house_number ? String(address_house_number).trim() : null,
      address_street: address_street ? String(address_street).trim() : null,
      address_subdivision_zone: address_subdivision_zone ? String(address_subdivision_zone).trim() : null,
      address_city_municipality: address_city_municipality ? String(address_city_municipality).trim() : 'Manila City',
      years_lived_current_address: years_lived_current_address ? parseInt(years_lived_current_address) : null,

      // Contact Info
      contact_number: contact_number ? String(contact_number).trim() : null,
      email: String(email).trim().toLowerCase(), // Store email in lowercase for case-insensitive login

      // Store the MD5 hashed password
      password_hash: hashedPassword, // Or just 'password: hashedPassword' if you prefer

      // Voter Info
      is_registered_voter: Boolean(is_registered_voter),
      precinct_number: is_registered_voter && precinct_number ? String(precinct_number).trim() : null,
      voter_registration_proof_data: is_registered_voter && voter_registration_proof_base64 ? voter_registration_proof_base64 : null,
      // voter_registration_proof_name: is_registered_voter && voter_registration_proof_name ? voter_registration_proof_name : null, // Store if needed

      // Proofs
      residency_proof_data: residency_proof_base64 ? residency_proof_base64 : null,
      // residency_proof_name: residency_proof_name ? residency_proof_name : null, // Store if needed

      // Household Info
      is_household_head: Boolean(is_household_head),
      household_member_ids: (is_household_head && Array.isArray(household_member_ids))
        ? household_member_ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
        : [],

      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await residentsCollection.insertOne(newResidentDocument);
    // It's good practice to not send the password hash back in the response
    const insertedResident = await residentsCollection.findOne(
        { _id: result.insertedId },
        { projection: { password_hash: 0 } } // Exclude password_hash from response
    );

    res.status(201).json({ message: 'Resident added successfully', resident: insertedResident });
  } catch (error) {
    console.error("Error adding new resident:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not add resident.' });
  }
});

// GET ALL RESIDENTS (GET) - Updated for new schema
app.get('/api/residents', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  const dab = await db();
  const residentsCollection = dab.collection('residents');

  let query = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
    query = {
      $or: [
        { first_name: { $regex: searchRegex } },
        { middle_name: { $regex: searchRegex } },
        { last_name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } }, // Updated field name
        { contact_number: { $regex: searchRegex } }, // Updated field name
        { address_house_number: { $regex: searchRegex } }, // Updated field name
        { address_street: { $regex: searchRegex } }, // Updated field name
        { address_subdivision_zone: { $regex: searchRegex } }, // Updated field name
        { address_city_municipality: { $regex: searchRegex } }, // New searchable address field
        { citizenship: { $regex: searchRegex } }, // New searchable field
        { place_of_birth: { $regex: searchRegex } }, // New searchable field
        { precinct_number: { $regex: searchRegex } }, // New searchable field
      ],
    };
  }

  // Define the projection to select fields to return
  // Exclude large Base64 fields by default to keep payload size manageable for listings
  // Only include them if specifically requested or for a GET /api/residents/:id endpoint
  const projection = {
    // Personal Info
    first_name: 1,
    middle_name: 1,
    last_name: 1,
    sex: 1,
    age: 1,
    date_of_birth: 1, // Consider formatting this for display if needed client-side
    civil_status: 1,
    occupation_status: 1,
    // place_of_birth: 1, // Can be long, consider for detail view
    // citizenship: 1,
    is_pwd: 1,
    is_household_head: 1,

    // Voter Info
    is_registered_voter: 1,
    precinct_number: 1,
    // voter_registration_proof_data: 0, // Exclude by default from list view

    // Address Info
    address_house_number: 1,
    address_street: 1,
    address_subdivision_zone: 1,
    address_city_municipality: 1,
    years_lived_current_address: 1,
    // residency_proof_data: 0, // Exclude by default from list view

    // Contact Info
    contact_number: 1,
    email: 1,

    // Household List (consider if needed for list view, could be many IDs)
    // household_member_ids: 1,

    created_at: 1, // Useful for sorting or display
    updated_at: 1,
    _id: 1, // Always include _id
    // 'action' field seems custom, if it's from your old schema and you still need it,
    // you might need to re-evaluate how it's populated or if it's still relevant.
    // For now, I'm removing it as it's not in the new schema directly.
    // If you still want a default "action" field if it's null:
    // action: { $ifNull: [ "$action", "" ] } // This would require 'action' to exist or be set elsewhere.
  };

  try {
    const residents = await residentsCollection
      .find(query)
      .project(projection)
      .skip(skip)
      .limit(itemsPerPage)
      .sort({ created_at: -1 }) // Optional: sort by creation date descending
      .toArray();

    const totalResidents = await residentsCollection.countDocuments(query);

    res.json({
      residents: residents,
      total: totalResidents, // Renamed for clarity, or use totalResidents
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(totalResidents / itemsPerPage),
    });
  } catch (error) {
    console.error("Error fetching residents:", error);
    res.status(500).json({ error: "Failed to fetch residents", message: error.message });
  }
});

// GET RESIDENTS BY SEARCH QUERY (GET /api/residents/search?q=searchTerm)
// This endpoint is generic and can be used by various parts of your application.
app.get('/api/residents/search', async (req, res) => {
  const searchQuery = req.query.q || ''; // 'q' is a common query parameter for search
  const limitResults = parseInt(req.query.limit) || 15; // Allow a limit, default to 15

  if (!searchQuery || searchQuery.trim() === '') {
    return res.json({ residents: [] }); // Return empty if no search query
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');

  try {
    const searchRegex = new RegExp(searchQuery.trim(), 'i'); // 'i' for case-insensitive

    // Define the fields you want to search across.
    // Ensure these field names EXACTLY match your MongoDB schema for the 'residents' collection.
    const query = {
      $or: [
        { first_name: { $regex: searchRegex } },
        { last_name: { $regex: searchRegex } },
        { middle_name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { contact_number: { $regex: searchRegex } },
        // Add other relevant string fields you want to include in the search
        // For example, if you stored a combined name field:
        // { full_name_searchable: { $regex: searchRegex } }, 
        { address_street: { $regex: searchRegex } },
        { address_subdivision_zone: { $regex: searchRegex } },
        { address_city_municipality: { $regex: searchRegex } },
      ],
    };

    // --- Debugging: Log the constructed query ---
    // console.log("Executing Resident Search with Query:", JSON.stringify(query));
    // console.log("Search Term:", searchQuery);
    // --- End Debugging ---

    const residents = await residentsCollection
      .find(query)
      .project({ // Select fields you want to return for the search results
        _id: 1,
        first_name: 1,
        last_name: 1,
        middle_name: 1,
        email: 1, // Useful for display or contact
        sex: 1,   // Often useful for context in search results
        // Add any other concise fields relevant for search result display
        // Avoid large fields like Base64 image data here
      })
      .limit(limitResults) // Limit the number of results
      .sort({ last_name: 1, first_name: 1 }) // Optional: sort results
      .toArray();

    // --- Debugging: Log the results from DB ---
    // console.log("Residents found:", residents.length);
    // if (residents.length > 0) {
    //   console.log("First resident found:", residents[0]);
    // }
    // --- End Debugging ---

    res.json({ residents: residents }); // The Vue component expects an object with a 'residents' array

  } catch (error) {
    console.error("Error searching residents:", error);
    res.status(500).json({ error: "Failed to search residents", message: error.message });
  }
});


// GET ELIGIBLE RESIDENTS FOR HOUSEHOLD SEARCH (LIMITED RESULTS) - REVISED
app.get('/api/residents/eligible-for-household-search', async (req, res) => {
  const searchKey = req.query.searchKey || '';
  const limitResults = 5;

  if (!searchKey || searchKey.trim().length < 2) {
    return res.json({ searchResults: [] });
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const { ObjectId } = require('mongodb'); // Import ObjectId constructor

  try {
    // --- Step 1: Get all IDs of residents who are already members of any household ---
    const householdHeadsAndMembers = await residentsCollection.aggregate([
      {
        $match: {
          is_household_head: true,
          household_member_ids: { $exists: true, $ne: [], $not: {$size: 0} } // Ensure it exists and is not empty
        }
      },
      { $unwind: '$household_member_ids' }, // Unwind the array
      {
        $group: {
          _id: null,
          // Collect all member IDs. These might be strings or ObjectIds depending on how they are stored.
          allMemberIdsAsStringOrObjectId: { $addToSet: '$household_member_ids' }
        }
      }
    ]).toArray();

    let memberObjectIds = [];
    if (householdHeadsAndMembers.length > 0 && householdHeadsAndMembers[0].allMemberIdsAsStringOrObjectId) {
      // Convert all collected IDs to ObjectId for consistent comparison
      memberObjectIds = householdHeadsAndMembers[0].allMemberIdsAsStringOrObjectId
        .map(id => {
          if (typeof id === 'string' && ObjectId.isValid(id)) {
            return new ObjectId(id); // Convert valid string to ObjectId
          } else if (id instanceof ObjectId) {
            return id; // Already an ObjectId
          }
          return null; // Invalid ID format, will be filtered out
        })
        .filter(id => id !== null); // Remove any nulls from invalid conversions
    }

    // --- Debugging ---
    // console.log("Search Key:", searchKey);
    // console.log("Collected Member ObjectIDs for $nin:", JSON.stringify(memberObjectIds));
    // --- End Debugging ---

    const searchRegex = new RegExp(searchKey, 'i');
    
    let query = {
      is_household_head: false,
      _id: { $nin: memberObjectIds }, // Now using an array of ObjectIds
      $or: [
        { first_name: { $regex: searchRegex } },
        { last_name: { $regex: searchRegex } },
        { middle_name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
      ]
    };
    // console.log("Final Query:", JSON.stringify(query));

    const searchResults = await residentsCollection
      .find(query)
      .project({
        _id: 1,
        first_name: 1,
        last_name: 1,
        middle_name: 1,
        sex: 1,
      })
      .limit(limitResults)
      .sort({ last_name: 1, first_name: 1 })
      .toArray();

    res.json({ searchResults });

  } catch (error) {
    console.error('Error searching eligible residents for household:', error);
    res.status(500).json({ error: 'Failed to search eligible residents', message: error.message });
  }
});

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

// UPDATE RESIDENT BY ID (PUT)
app.put('/api/residents/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();
  const residentsCollection = dab.collection('residents');

  // Destructure all expected fields from req.body
  const {
    is_household_head, first_name, middle_name, last_name, sex, age, date_of_birth,
    civil_status, occupation_status, place_of_birth, citizenship, is_pwd,
    is_registered_voter, precinct_number, 
    // Base64 fields - these might be absent if not updated
    voter_registration_proof_data, 
    residency_proof_data,
    address_house_number, address_street, address_subdivision_zone, address_city_municipality,
    years_lived_current_address, contact_number, email, 
    household_member_ids
  } = req.body;

  // --- Perform Validation (CRUCIAL!) ---
  // (Your existing validation logic here for fields that are always present or required for an update)
  // Example:
  // if (first_name !== undefined && (typeof first_name !== 'string' || first_name.trim() === '')) {
  //   return res.status(400).json({ error: 'Validation failed', message: 'First name, if provided, cannot be empty.' });
  // }
  // ... more validation ...

  const updateFields = {}; // Object to build $set operator

  // Helper to add field to updateFields if it's defined in req.body
  const addIfDefined = (key, value, transform = v => v) => {
    if (value !== undefined) {
      updateFields[key] = transform(value);
    }
  };

  // Add non-file fields to the update object
  addIfDefined('is_household_head', is_household_head, Boolean);
  addIfDefined('first_name', first_name, v => String(v).trim());
  addIfDefined('middle_name', middle_name, v => v ? String(v).trim() : null); // Allow null for optional fields
  addIfDefined('last_name', last_name, v => String(v).trim());
  addIfDefined('sex', sex, String);
  addIfDefined('age', age, v => (v !== null && v !== undefined) ? parseInt(v, 10) : null);
  addIfDefined('date_of_birth', date_of_birth, v => v ? new Date(v) : null);
  addIfDefined('civil_status', civil_status, String);
  addIfDefined('occupation_status', occupation_status, String);
  addIfDefined('place_of_birth', place_of_birth, v => String(v).trim());
  addIfDefined('citizenship', citizenship, v => String(v).trim());
  addIfDefined('is_pwd', is_pwd, Boolean);
  
  addIfDefined('is_registered_voter', is_registered_voter, Boolean);
  // Only update precinct_number if is_registered_voter is true or if precinct_number is explicitly set to null
  if (req.body.is_registered_voter === true) {
    addIfDefined('precinct_number', precinct_number, v => v ? String(v).trim() : null);
  } else if (req.body.is_registered_voter === false) { // If voter status is changed to false
    updateFields['precinct_number'] = null;
    // Also clear voter proof if changing to not a voter
    if (req.body.voter_registration_proof_data === undefined) { // If client isn't sending a new one, explicitly clear it
        updateFields['voter_registration_proof_data'] = null;
    }
  } else if (req.body.precinct_number !== undefined) { // If voter status isn't changing but precinct is sent
    addIfDefined('precinct_number', precinct_number, v => v ? String(v).trim() : null);
  }


  addIfDefined('address_house_number', address_house_number, v => String(v).trim());
  addIfDefined('address_street', address_street, v => String(v).trim());
  addIfDefined('address_subdivision_zone', address_subdivision_zone, v => String(v).trim());
  addIfDefined('address_city_municipality', address_city_municipality, v => String(v).trim());
  addIfDefined('years_lived_current_address', years_lived_current_address, v => (v !== null && v !== undefined) ? parseInt(v, 10) : null);
  
  addIfDefined('contact_number', contact_number, v => String(v).trim());
  addIfDefined('email', email, v => String(v).trim().toLowerCase());
  
  addIfDefined('household_member_ids', household_member_ids, v => Array.isArray(v) ? v : []);

  // --- Handle Base64 File Fields Conditionally ---
  // Only update if new data is provided (can be a new Base64 string or explicitly null to clear)
  if (req.body.hasOwnProperty('voter_registration_proof_data')) {
    // If is_registered_voter is true and data is provided, or if data is explicitly null
    if ((req.body.is_registered_voter === true && voter_registration_proof_data !== undefined) || voter_registration_proof_data === null) {
        updateFields['voter_registration_proof_data'] = voter_registration_proof_data; // This will be null if client sent null
    } else if (req.body.is_registered_voter === false) { // If becoming not a voter, ensure it's nulled
        updateFields['voter_registration_proof_data'] = null;
    }
    // If is_registered_voter is true but voter_registration_proof_data is undefined, we don't touch it.
  }

  if (req.body.hasOwnProperty('residency_proof_data')) {
    updateFields['residency_proof_data'] = residency_proof_data; // This will be null if client sent null
  }

  // Always update the 'updated_at' timestamp
  updateFields['updated_at'] = new Date();

  if (Object.keys(updateFields).length === 1 && updateFields.hasOwnProperty('updated_at')) {
    // Only updated_at would be changed, meaning no actual data change from client
    // You might choose to not even hit the DB or return a specific "no changes" message
     const currentResident = await residentsCollection.findOne({ _id: new ObjectId(id) });
     if (!currentResident) return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
     return res.json({ message: 'No changes detected.', resident: currentResident });
  }


  try {
    const result = await residentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
    }

    // Fetch and return the updated document to ensure client has the latest state
    const updatedResident = await residentsCollection.findOne({ _id: new ObjectId(id) });
    res.json({ message: 'Resident updated successfully', resident: updatedResident });

  } catch (error) {
    console.error('Error updating resident:', error);
    if (error.code === 11000) { // Duplicate key
        return res.status(409).json({ error: 'Conflict', message: 'Update violates a unique constraint (e.g., email already exists).' });
    }
    res.status(500).json({ error: 'Database error', message: 'Could not update resident.' });
  }
});





// ======================= HOUSEHOLD ======================= //

// GET ALL HOUSEHOLDS (formatted list of household heads)
app.get('/api/households', async (req, res) => {
  // Pagination (optional, but good practice for potentially long lists)
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  // Search (optional, can search by head's name or household number)
  const search = req.query.search || '';

  const dab = await db();
  const residentsCollection = dab.collection('residents');

  try {
    let query = {
      is_household_head: true // Only fetch residents who are household heads
    };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { last_name: { $regex: searchRegex } },          // Search by head's last name
        { first_name: { $regex: searchRegex } },         // Search by head's first name
        { address_house_number: { $regex: searchRegex } } // Search by household number
      ];
    }

    // Fetch household heads with necessary fields for transformation
    const householdHeads = await residentsCollection
      .find(query)
      .project({ // Select only the fields needed
        _id: 1, // ID of the household head (can be useful)
        last_name: 1,
        first_name: 1, // In case last_name is not unique for display
        address_house_number: 1,
        household_member_ids: 1 // For counting members
      })
      .skip(skip)
      .limit(itemsPerPage)
      .sort({ last_name: 1, first_name: 1 }) // Sort by head's name
      .toArray();

    // Transform the data
    const formattedHouseholds = householdHeads.map(head => ({
      household_id: head._id, // The ID of the resident who is the head
      household_name: `${head.last_name}'s Household`,
      household_number: head.address_house_number || 'N/A', // Use 'N/A' if not available
      number_of_members: Array.isArray(head.household_member_ids) ? head.household_member_ids.length : 0,
      head_first_name: head.first_name, // Include for clarity if needed
      head_last_name: head.last_name,   // Include for clarity if needed
    }));

    const totalHouseholds = await residentsCollection.countDocuments(query);

    res.json({
      households: formattedHouseholds,
      total: totalHouseholds,
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(totalHouseholds / itemsPerPage),
    });

  } catch (error) {
    console.error('Error fetching households:', error);
    res.status(500).json({ error: 'Failed to fetch households', message: error.message });
  }
});




// ======================= DOCUMENT REQUEST ======================= //

// ADD NEW DOCUMENT (POST)
app.post('/api/documents', async (req, res) => {
  const dab = await db();

  const requiredFields = ['residentId', 'Address', 'type', 'YearsInBarangay', 'status', 'description', 'PurposeOfDocument', 'ContactNumber'];
  if (requiredFields.some(field => !req.body[field])) {
    res.json({ error: 'Missing required fields' });
    return;
  }

  const documentsCollection = dab.collection('documents');
  const documentToInsert = {
    residentId: req.body.residentId,
    Address: req.body.Address,
    type: req.body.type,
    YearsInBarangay: parseInt(req.body.YearsInBarangay),
    status: req.body.status,
    description: req.body.description,
    PurposeOfDocument: req.body.PurposeOfDocument,
    ContactNumber: req.body.ContactNumber,
    date_added: new Date(),
  };

  await documentsCollection.insertOne(documentToInsert);
  res.json({ message: 'Document added successfully' });
});

// GET ALL DOCUMENTS (GET)
app.get('/api/documents', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

  const dab = await db();
  const documentsCollection = dab.collection('documents');

  const query = search
    ? {
        $or: [
          { Address: { $regex: new RegExp(search, 'i') } },
          { type: { $regex: new RegExp(search, 'i') } },
          { status: { $regex: new RegExp(search, 'i') } },
          { description: { $regex: new RegExp(search, 'i') } },
          { PurposeOfDocument: { $regex: new RegExp(search, 'i') } },
          { ContactNumber: { $regex: new RegExp(search, 'i') } },
        ]
      }
    : {};

  const documents = await documentsCollection
    .find(query, {
      projection: {
        residentId: 1,
        Address: 1,
        type: 1,
        YearsInBarangay: 1,
        status: 1,
        description: 1,
        PurposeOfDocument: 1,
        ContactNumber: 1,
        action: { $ifNull: [ "$action", "" ] }
      }
    })
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .toArray();

  const totalDocuments = await documentsCollection.countDocuments(query);

  res.json({
    documents,
    totalDocuments
  });
});

// GET DOCUMENT BY ID (GET)
app.get('/api/documents/:id', async (req, res) => {
  const dab = await db();
  const documentsCollection = dab.collection('documents');
  const document = await documentsCollection.findOne({ _id: new ObjectId(req.params.id) });
  res.json({ document });
});

// DELETE DOCUMENT BY ID (DELETE)
app.delete('/api/documents/:id', async (req, res) => {
  const dab = await db();
  const documentsCollection = dab.collection('documents');
  await documentsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ message: 'Document deleted successfully' });
});

// UPDATE DOCUMENT BY ID (PUT)
app.put('/api/documents/:id', async (req, res) => {
  const dab = await db();
  const documentsCollection = dab.collection('documents');

  const updateData = { ...req.body };
  if (updateData.residentId) updateData.residentId = updateData.residentId;
  if (updateData.YearsInBarangay) updateData.YearsInBarangay = parseInt(updateData.YearsInBarangay);

  await documentsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: updateData }
  );

  res.json({ message: 'Document updated successfully' });
});


// ====================== ADMINS CRUD =========================== //

// ADD NEW ADMIN (POST)
app.post('/api/admins', async (req, res) => {

  const dab = await db();

  const requiredFields = [
    { field: 'username', value: req.body.username, format: /^[a-zA-Z0-9._%+-]+$/ },
    { field: 'password', value: req.body.password, format: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$/ },
    { field: 'name', value: req.body.name, format: /^[a-zA-Z\s]+$/ },
    { field: 'email', value: req.body.email, format: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
    { field: 'role', value: req.body.role, format: /^(Admin|Staff|Resident)$/ },
  ];

  const errors = requiredFields.filter(({ field, value, format }) => !format.test(value)).map(({ field }) => ({ field, message: `${field} is invalid format` }));

  if (errors.length > 0) {
    res.json({error: 'Invalid field format: ' + errors.map(error => error.message).join(', ')});
    return;
  }

  const adminsCollection = dab.collection('admins');
  await adminsCollection.insertOne({...req.body, password: md5(req.body.password)});

  res.json({message: 'Admin added successfully'});
})

// GET ALL ADMINS (GET)
app.get('/api/admins', async (req, res) => {

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

  const dab = await db();
  const adminsCollection = dab.collection('admins');
  const query = search ? {
    $or: [
      { username: { $regex: new RegExp(search, 'i') } },
      { name: { $regex: new RegExp(search, 'i') } },
      { email: { $regex: new RegExp(search, 'i') } },
      { role: { $regex: new RegExp(search, 'i') } },
    ]
  } : {};
  const admins = await adminsCollection.find(query, {
    projection: {
      username: 1,
      name: 1,
      email: 1,
      role: 1,
      _id: 1,
      action: { $ifNull: [ "$action", "" ] }
    }
  })
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .toArray();
  const totalAdmins = await adminsCollection.countDocuments(query);
  res.json({
    admins: admins,
    totalAdmins: totalAdmins
  });
})

// GET ADMIN BY ID (GET)
app.get('/api/admins/:id', async (req, res) => {
  const dab = await db();
  const adminsCollection = dab.collection('admins');
  const admin = await adminsCollection.findOne(
    { _id: new ObjectId(req.params.id) },
    {
      projection: {
        password: 0,
      }
    }
  );
  res.json({admin});
})

// DELETE ADMIN BY ID (DELETE)
app.delete('/api/admins/:id', async (req, res) => {
  const dab = await db();
  const adminsCollection = dab.collection('admins');
  await adminsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({message: 'Admin deleted successfully'});
})

// UPDATE ADMIN BY ID (PUT)
app.put('/api/admins/:id', async (req, res) => {

  const dab = await db();

  const adminsCollection = dab.collection('admins');

  const { username, name, email, role, password } = req.body;

  const requiredFields = [
    { field: 'username', value: username, format: /^[a-zA-Z0-9_]+$/ },
    { field: 'name', value: name, format: /^[a-zA-Z\s]+$/ },
    { field: 'email', value: email, format: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
    { field: 'role', value: role, format: /^(Admin|User)$/ },
  ];

  if (password) {
    requiredFields.push({ field: 'password', value: password, format: /^[a-zA-Z0-9_]+$/ });
  }

  const errors = requiredFields.filter(({ field, value, format }) => !format.test(value)).map(({ field }) => ({ field, message: `${field} is invalid format` }));

  if (errors.length > 0) {
    res.json({ error: 'Invalid field format: ' + errors.map(error => error.message).join(', ') });
    return;
  }

  const data = { ...req.body };
  if (data.password) data.password = md5(data.password);

  await adminsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: data }
  );

  res.json({message: 'Admin updated successfully'});
})





// ====================== OFFICIALS CRUD =========================== //

// ADD NEW OFFICIAL (POST)
app.post('/api/officials', async (req, res) => {

  const dab = await db();

  const requiredFields = [
    { field: 'picture', value: req.body.picture, format: /^.*$/ }, // Assuming any string is acceptable
    { field: 'zone', value: req.body.zone, format: /^[a-zA-Z0-9\s]+$/ }, // Assuming zone is a number
    { field: 'brgy', value: req.body.brgy, format: /^[a-zA-Z\s]+$/ },
    { field: 'designation', value: req.body.designation, format: /^(PB|K|A|G|A|W|A|D|SEC|TREAS)$/ },
    { field: 'name', value: req.body.name, format: /^[a-zA-Z\s]+$/ },
    { field: 'blood_type', value: req.body.blood_type, format: /^(A|B|AB|O)[+-]$/ },
  ];

  const errors = requiredFields.filter(({ field, value, format }) => !format.test(value)).map(({ field }) => ({ field, message: `${field} is invalid format` }));

  if (errors.length > 0) {
    res.json({ error: 'Invalid field format: ' + errors.map(error => error.message).join(', ') });
    return;
  }

  const officialsCollection = dab.collection('officials');
  try {
    await officialsCollection.insertOne(req.body);
  } catch (error) {
    res.json({ error: 'Error adding official: ' + error.message });
    return;
  }

  res.json({ message: 'Official added successfully' });
})

// GET ALL OFFICIALS (GET)
app.get('/api/officials', async (req, res) => {

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

  const dab = await db();
  const officialsCollection = dab.collection('officials');
  const query = search ? {
    $or: [
      { picture: { $regex: new RegExp(search, 'i') } },
      { zone: { $regex: new RegExp(search, 'i') } },
      { brgy: { $regex: new RegExp(search, 'i') } },
      { designation: { $regex: new RegExp(search, 'i') } },
      { name: { $regex: new RegExp(search, 'i') } },
      { blood_type: { $regex: new RegExp(search, 'i') } },
    ]
  } : {};
  const officials = await officialsCollection.find(query, {
    projection: {
      // picture: 1,
      zone: 1,
      brgy: 1,
      designation: 1,
      name: 1,
      blood_type: 1,
      _id: 1,
      action: { $ifNull: [ "$action", "" ] }
    }
  })
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .toArray();
  const totalOfficials = await officialsCollection.countDocuments(query);
  res.json({
    officials: officials,
    totalOfficials: totalOfficials
  });
})

// GET OFFICIAL BY ID (GET)
app.get('/api/officials/:id', async (req, res) => {
  const dab = await db();
  const officialsCollection = dab.collection('officials');
  const official = await officialsCollection.findOne(
    { _id: new ObjectId(req.params.id) }
  );
  res.json({ official });
})

// DELETE OFFICIAL BY ID (DELETE)
app.delete('/api/officials/:id', async (req, res) => {
  const dab = await db();
  const officialsCollection = dab.collection('officials');
  await officialsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ message: 'Official deleted successfully' });
})

// UPDATE OFFICIAL BY ID (PUT)
app.put('/api/officials/:id', async (req, res) => {

  const dab = await db();

  const officialsCollection = dab.collection('officials');

  const { picture, zone, brgy, designation, name, blood_type } = req.body;

  const requiredFields = [
    { field: 'picture', value: picture, format: /^.*$/ },
    { field: 'zone', value: zone, format: /^\d+$/ },
    { field: 'brgy', value: brgy, format: /^[a-zA-Z\s]+$/ },
    { field: 'designation', value: designation, format: /^(PB|K|A|G|A|W|A|D|SEC|TREAS)$/ },
    { field: 'name', value: name, format: /^[a-zA-Z\s]+$/ },
    { field: 'blood_type', value: blood_type, format: /^(A|B|AB|O)[+-]$/ },
  ];

  const errors = requiredFields.filter(({ field, value, format }) => !format.test(value)).map(({ field }) => ({ field, message: `${field} is invalid format` }));

  if (errors.length > 0) {
    res.json({ error: 'Invalid field format: ' + errors.map(error => error.message).join(', ') });
    return;
  }

  await officialsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );

  res.json({ message: 'Official updated successfully' });
})




// =================== NOTIFICATION MODULE CRUD =========================== //

// GET ALL NOTIFICATIONS (with search and pagination)
app.get('/api/notifications', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  const dab = await db();
  const notificationsCollection = dab.collection('notifications');

  let query = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query = {
      $or: [
        { name: { $regex: searchRegex } },
        { content: { $regex: searchRegex } },
        { by: { $regex: searchRegex } },
      ],
    };
  }

  try {
    const notifications = await notificationsCollection
      .find(query)
      .sort({ date: -1 }) // Sort by date descending (newest first)
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    const totalNotifications = await notificationsCollection.countDocuments(query);

    res.json({
      notifications: notifications,
      total: totalNotifications,
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(totalNotifications / itemsPerPage),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications", message: error.message });
  }
});

// ADD NEW NOTIFICATION (POST)
app.post('/api/notifications', async (req, res) => {
  const { name, content, date, by } = req.body;
  const dab = await db();
  const notificationsCollection = dab.collection('notifications');

  // Basic Validation
  if (!name || !content || !date || !by) {
    return res.status(400).json({ error: 'Validation failed', message: 'Name, content, date, and by (admin name) are required.' });
  }
  if (typeof name !== 'string' || typeof content !== 'string' || typeof by !== 'string') {
    return res.status(400).json({ error: 'Validation failed', message: 'Name, content, and by must be strings.' });
  }
  // Validate date format (optional, but good)
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'Validation failed', message: 'Invalid date format for notification date.' });
  }


  try {
    const newNotification = {
      name: String(name).trim(),
      content: String(content).trim(),
      date: parsedDate, // Store as Date object
      by: String(by).trim(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await notificationsCollection.insertOne(newNotification);
    // Send back the inserted document, as it will have the _id and created/updated_at
    const insertedNotification = await notificationsCollection.findOne({ _id: result.insertedId });


    res.status(201).json({ message: 'Notification added successfully', notification: insertedNotification });
  } catch (error) {
    console.error("Error adding notification:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not add notification.' });
  }
});


// GET NOTIFICATION BY ID (GET)
app.get('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();
  const notificationsCollection = dab.collection('notifications');

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const notification = await notificationsCollection.findOne({ _id: new ObjectId(id) });
    if (!notification) {
      return res.status(404).json({ error: 'Not found', message: 'Notification not found.' });
    }
    res.json({ notification });
  } catch (error) {
    console.error("Error fetching notification by ID:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not fetch notification.' });
  }
});

// UPDATE NOTIFICATION BY ID (PUT)
app.put('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const { name, content, date, by } = req.body;
  const dab = await db();
  const notificationsCollection = dab.collection('notifications');

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // Basic Validation for update
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'Validation failed', message: 'Name, if provided, cannot be empty.' });
  }
  if (content !== undefined && (typeof content !== 'string' || content.trim() === '')) {
    return res.status(400).json({ error: 'Validation failed', message: 'Content, if provided, cannot be empty.' });
  }
  if (by !== undefined && (typeof by !== 'string' || by.trim() === '')) {
    return res.status(400).json({ error: 'Validation failed', message: 'Author (by), if provided, cannot be empty.' });
  }
  let parsedDate;
  if (date !== undefined) {
    parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Validation failed', message: 'Invalid date format for notification date, if provided.' });
    }
  }


  try {
    const updateFields = {};
    if (name !== undefined) updateFields.name = String(name).trim();
    if (content !== undefined) updateFields.content = String(content).trim();
    if (parsedDate) updateFields.date = parsedDate;
    if (by !== undefined) updateFields.by = String(by).trim();

    if (Object.keys(updateFields).length === 0) {
      // If no fields to update are provided, you might return a specific message or the current doc
      const currentNotification = await notificationsCollection.findOne({ _id: new ObjectId(id) });
      if (!currentNotification) return res.status(404).json({ error: 'Not found', message: 'Notification not found.' });
      return res.json({ message: 'No changes provided.', notification: currentNotification });
    }

    updateFields.updated_at = new Date(); // Always update this

    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Notification not found.' });
    }
    
    const updatedNotification = await notificationsCollection.findOne({ _id: new ObjectId(id) });
    res.json({ message: 'Notification updated successfully', notification: updatedNotification });

  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not update notification.' });
  }
});

// DELETE NOTIFICATION BY ID (DELETE)
app.delete('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();
  const notificationsCollection = dab.collection('notifications');

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const result = await notificationsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Notification not found.' });
    }
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not delete notification.' });
  }
});



// ====================== BORROW ASSETS CRUD (REVISED for Resident Borrower) =========================== //
// Ensure ObjectId is imported: import { ObjectId } from 'mongodb';

// ADD NEW BORROW ASSET TRANSACTION (POST)
app.post('/api/borrowed-assets', async (req, res) => {
  const dab = await db();
  const {
    borrower_resident_id, // ID of the resident borrowing
    borrower_display_name,  // Name of the resident (for convenience, sent by frontend)
    borrow_datetime,
    borrowed_from_personnel,
    item_borrowed,
    status,
    notes,
  } = req.body;

  // Validation
  if (!borrower_resident_id || !borrower_display_name || !borrow_datetime || !borrowed_from_personnel || !item_borrowed || !status) {
    return res.status(400).json({ error: 'Missing required fields. Borrower, item, date, personnel, and status are required.' });
  }
  if (!ObjectId.isValid(borrower_resident_id)) {
    return res.status(400).json({ error: 'Invalid borrower resident ID format.' });
  }

  try {
    const newTransaction = {
      borrower_resident_id: new ObjectId(borrower_resident_id),
      borrower_display_name: String(borrower_display_name).trim(), // Store for easy display
      borrow_datetime: new Date(borrow_datetime),
      borrowed_from_personnel: String(borrowed_from_personnel).trim(),
      item_borrowed: String(item_borrowed),
      status: String(status).trim(),
      date_returned: null,
      return_condition: null,
      notes: notes ? String(notes).trim() : null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const collection = dab.collection('borrowed_assets');
    const result = await collection.insertOne(newTransaction);
    const insertedDoc = await collection.findOne({ _id: result.insertedId }); // Fetch to include _id
    res.status(201).json({ message: 'Asset borrowing transaction added successfully', transaction: insertedDoc });
  } catch (error) {
    console.error('Error adding borrow asset transaction:', error);
    res.status(500).json({ error: 'Error adding transaction: ' + error.message });
  }
});

// GET ALL BORROWED ASSETS TRANSACTIONS (GET) - WITH BORROWER NAME LOOKUP
app.get('/api/borrowed-assets', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  
  // Base match stage for search (applied after lookup if searching on borrower's actual name)
  let searchMatchStage = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    searchMatchStage = { // This will be part of the main aggregation pipeline
        $or: [
            // Search on fields from borrowed_assets collection directly
            { borrower_display_name: { $regex: searchRegex } }, // Search on the stored display name
            { item_borrowed: { $regex: searchRegex } },
            { status: { $regex: searchRegex } },
            { borrowed_from_personnel: { $regex: searchRegex } },
            // Search on looked-up borrower fields
            { "borrower_details.first_name": { $regex: searchRegex } },
            { "borrower_details.last_name": { $regex: searchRegex } },
        ]
    };
  }

  try {
    const aggregationPipeline = [
      { // Optional: initial match on borrowed_assets fields if not searching resident details
        $match: search ? {} : {} // If search is complex and needs pre-filtering before lookup
      },
      {
        $lookup: {
          from: 'residents', // The collection to join
          localField: 'borrower_resident_id', // Field from the borrowed_assets input
          foreignField: '_id', // Field from the residents collection
          as: 'borrower_details_array' // Output array field
        }
      },
      { // $lookup returns an array, so $unwind or $addFields to get the single borrower object
        $addFields: {
          borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] }
        }
      },
      { // Now apply searchMatchStage which can include borrower_details fields
        $match: searchMatchStage
      },
      {
        $project: { // Define the output structure
          _id: 1,
          borrow_datetime: 1,
          borrowed_from_personnel: 1,
          item_borrowed: 1,
          status: 1,
          date_returned: 1,
          return_condition: 1,
          notes: 1,
          created_at: 1,
          borrower_resident_id: 1,
          // Include borrower's full name from the lookup
          borrower_name: { 
            $concat: [
              "$borrower_details.first_name", 
              " ", 
              { $ifNull: ["$borrower_details.middle_name", ""] }, // Handle if middle_name is null
              { $cond: { if: { $eq: [{ $ifNull: ["$borrower_details.middle_name", ""] }, ""] }, then: "", else: " " } }, // Add space only if middle_name exists
              "$borrower_details.last_name"
            ]
          },
          // borrower_display_name: 1, // Can also return the stored display name
        }
      },
      { $sort: { borrow_datetime: -1 } },
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const transactions = await collection.aggregate(aggregationPipeline).toArray();

    // For total count, we need a separate aggregation without skip/limit but with the match stages
    const countPipeline = [
        // ... (same $lookup, $addFields, $match as above) ...
         {
            $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array'}
        },
        {
            $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } }
        },
        {
            $match: searchMatchStage // Apply the same search criteria
        },
        { $count: 'total' }
    ];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalTransactions = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      transactions: transactions,
      total: totalTransactions,
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(totalTransactions / itemsPerPage),
    });
  } catch (error) {
    console.error('Error fetching borrowed assets:', error);
    res.status(500).json({ error: "Failed to fetch transactions." });
  }
});


// GET BORROWED ASSET TRANSACTION BY ID (GET) - WITH BORROWER NAME LOOKUP
app.get('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  try {
    const aggregationPipeline = [
      { $match: { _id: new ObjectId(id) } },
      {
        $lookup: {
          from: 'residents',
          localField: 'borrower_resident_id',
          foreignField: '_id',
          as: 'borrower_details_array'
        }
      },
      {
        $addFields: {
          borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] }
        }
      },
      {
        $project: {
          // Select fields from borrowed_assets
          borrow_datetime: 1, borrowed_from_personnel: 1, item_borrowed: 1, status: 1,
          date_returned: 1, return_condition: 1, notes: 1, created_at: 1, updated_at: 1,
          borrower_resident_id: 1, borrower_display_name: 1, // Keep stored display name
          // Add borrower's actual details from lookup
          borrower_first_name: '$borrower_details.first_name',
          borrower_last_name: '$borrower_details.last_name',
          borrower_middle_name: '$borrower_details.middle_name',
          borrower_contact_number: '$borrower_details.contact_number', // Example additional field
          borrower_address_street: '$borrower_details.address_street', // Example
        }
      }
    ];
    const result = await collection.aggregate(aggregationPipeline).toArray();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.json({ transaction: result[0] });
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    res.status(500).json({ error: "Failed to fetch transaction." });
  }
});

// UPDATE BORROWED ASSET TRANSACTION BY ID (PUT)
app.put('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  const {
    borrower_resident_id, // Expecting ID
    borrower_display_name,  // Expecting Name
    borrow_datetime,
    borrowed_from_personnel,
    item_borrowed,
    status,
    date_returned,
    return_condition,
    notes,
  } = req.body;

  const updateFields = {};
  // Only update borrower_resident_id and borrower_display_name if they are explicitly provided
  if (borrower_resident_id !== undefined) {
    if (!ObjectId.isValid(borrower_resident_id)) return res.status(400).json({ error: 'Invalid borrower resident ID format for update.' });
    updateFields.borrower_resident_id = new ObjectId(borrower_resident_id);
  }
  if (borrower_display_name !== undefined) updateFields.borrower_display_name = String(borrower_display_name).trim();
  
  if (borrow_datetime !== undefined) updateFields.borrow_datetime = new Date(borrow_datetime);
  if (borrowed_from_personnel !== undefined) updateFields.borrowed_from_personnel = String(borrowed_from_personnel).trim();
  if (item_borrowed !== undefined) updateFields.item_borrowed = String(item_borrowed);
  if (status !== undefined) updateFields.status = String(status).trim();
  if (date_returned !== undefined) updateFields.date_returned = date_returned ? new Date(date_returned) : null;
  if (return_condition !== undefined) updateFields.return_condition = return_condition ? String(return_condition).trim() : null;
  if (notes !== undefined) updateFields.notes = notes ? String(notes).trim() : null;

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update provided.' });
  }
  updateFields.updated_at = new Date();

  try {
    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    // Fetch the updated doc with looked-up borrower details for the response
    const updatedTransactionResult = await collection.aggregate([
        { $match: { _id: new ObjectId(id) } },
        { $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array' }},
        { $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } }},
        // Project fields similar to GET by ID
    ]).toArray();

    res.json({ message: 'Transaction updated successfully', transaction: updatedTransactionResult[0] || null });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Error updating transaction: ' + error.message });
  }
});

// DELETE BORROWED ASSET TRANSACTION BY ID (DELETE)
app.delete('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Error deleting transaction: ' + error.message });
  }
});











// ====================== COMPLAINT REQUESTS CRUD (REVISED) =========================== //

// ADD NEW COMPLAINT REQUEST (POST)
app.post('/api/complaints', async (req, res) => {
  const dab = await db();
  const {
    complainant_resident_id,
    complainant_display_name,
    complainant_address,
    contact_number,
    date_of_complaint,
    time_of_complaint,
    person_complained_against_name, // Name (can be manual or from resident search)
    person_complained_against_resident_id, // Optional ObjectId
    status,
    notes_description,
  } = req.body;

  // Validation
  if (!complainant_resident_id || !complainant_display_name || !complainant_address || !contact_number ||
      !date_of_complaint || !time_of_complaint || !person_complained_against_name || !status || !notes_description) {
    return res.status(400).json({ error: 'Missing required fields for complaint request.' });
  }
  if (!ObjectId.isValid(complainant_resident_id)) {
    return res.status(400).json({ error: 'Invalid complainant resident ID format.' });
  }
  if (person_complained_against_resident_id && !ObjectId.isValid(person_complained_against_resident_id)) {
    return res.status(400).json({ error: 'Invalid person complained against resident ID format.' });
  }

  try {
    const complaintDate = new Date(date_of_complaint);

    const newComplaint = {
      complainant_resident_id: new ObjectId(complainant_resident_id),
      complainant_display_name: String(complainant_display_name).trim(),
      complainant_address: String(complainant_address).trim(),
      contact_number: String(contact_number).trim(),
      date_of_complaint: complaintDate,
      time_of_complaint: String(time_of_complaint).trim(),
      person_complained_against_name: String(person_complained_against_name).trim(),
      person_complained_against_resident_id: person_complained_against_resident_id ? new ObjectId(person_complained_against_resident_id) : null,
      status: String(status).trim(),
      notes_description: String(notes_description).trim(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    const collection = dab.collection('complaints');
    const result = await collection.insertOne(newComplaint);
    const insertedDoc = await collection.findOne({ _id: result.insertedId });
    res.status(201).json({ message: 'Complaint request added successfully', complaint: insertedDoc });
  } catch (error) {
    console.error('Error adding complaint request:', error);
    res.status(500).json({ error: 'Error adding complaint: ' + error.message });
  }
});

// GET ALL COMPLAINT REQUESTS (GET)
app.get('/api/complaints', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  const dab = await db();
  const collection = dab.collection('complaints');
  
  let searchMatchStage = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    searchMatchStage = {
      $or: [
        { complainant_display_name: { $regex: searchRegex } },
        { "complainant_details.first_name": { $regex: searchRegex } },
        { "complainant_details.last_name": { $regex: searchRegex } },
        { person_complained_against_name: { $regex: searchRegex } }, // Search the stored name
        { "person_complained_details.first_name": { $regex: searchRegex } }, // Search looked-up name
        { "person_complained_details.last_name": { $regex: searchRegex } },
        { status: { $regex: searchRegex } },
        { notes_description: { $regex: searchRegex } },
      ],
    };
  }

  try {
    const aggregationPipeline = [
      { $match: {} }, // Initial match if needed
      { // Lookup complainant
        $lookup: {
          from: 'residents', localField: 'complainant_resident_id',
          foreignField: '_id', as: 'complainant_details_array'
        }
      },
      { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } } },
      { // Lookup person complained against (only if ID exists)
        $lookup: {
          from: 'residents', localField: 'person_complained_against_resident_id',
          foreignField: '_id', as: 'person_complained_details_array'
        }
      },
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } } },
      { $match: searchMatchStage },
      {
        $project: {
          _id: 1,
          complainant_name: { /* ... same as before ... */ 
            $ifNull: [
                { $concat: [ "$complainant_details.first_name", " ", { $ifNull: ["$complainant_details.middle_name", ""] }, { $cond: { if: { $eq: [{ $ifNull: ["$complainant_details.middle_name", ""] }, ""] }, then: "", else: " " } }, "$complainant_details.last_name"] }, 
                "$complainant_display_name"
            ]
          },
          // Display person complained against: use looked-up name if ID exists, else the stored name
          person_complained_against: {
            $ifNull: [
              { $concat: [ "$person_complained_details.first_name", " ", { $ifNull: ["$person_complained_details.middle_name", ""] }, { $cond: { if: { $eq: [{ $ifNull: ["$person_complained_details.middle_name", ""] }, ""] }, then: "", else: " " } }, "$person_complained_details.last_name"] },
              "$person_complained_against_name" // Fallback to manually entered/stored name
            ]
          },
          date_of_complaint: 1, status: 1, notes_description: 1, created_at: 1,
        }
      },
      { $sort: { date_of_complaint: -1, created_at: -1 } },
      { $skip: skip }, { $limit: itemsPerPage }
    ];

    const complaints = await collection.aggregate(aggregationPipeline).toArray();
    
    const countPipeline = [ // For total count, include lookups for accurate search filtering
        { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
        { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
        { $match: searchMatchStage },
        { $count: 'total' }
    ];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalComplaints = countResult.length > 0 ? countResult[0].total : 0;

    res.json({ complaints, total: totalComplaints, page, itemsPerPage, totalPages: Math.ceil(totalComplaints / itemsPerPage) });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: "Failed to fetch complaints." });
  }
});

// GET COMPLAINT REQUEST BY ID (GET)
app.get('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('complaints');
  try {
    const aggregationPipeline = [
      { $match: { _id: new ObjectId(id) } },
      { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
      { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
      { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
      { $project: { /* ... project all necessary fields, including from lookups ... */
          // Complaint fields
          complainant_resident_id: 1, complainant_display_name: 1, complainant_address: 1,
          contact_number: 1, date_of_complaint: 1, time_of_complaint: 1,
          person_complained_against_name: 1, person_complained_against_resident_id: 1,
          status: 1, notes_description: 1, created_at: 1, updated_at: 1,
          // Complainant details
          "complainant_details._id": 1, "complainant_details.first_name": 1, /* ... etc ... */
          // Person complained against details
          "person_complained_details._id": 1, "person_complained_details.first_name": 1, /* ... etc ... */
        }
      }
    ];
    const result = await collection.aggregate(aggregationPipeline).toArray();
    if (result.length === 0) return res.status(404).json({ error: 'Complaint not found.' });
    res.json({ complaint: result[0] });
  } catch (error) { console.error('Error fetching complaint by ID:', error); res.status(500).json({ error: "Failed to fetch complaint." }); }
});

// UPDATE COMPLAINT REQUEST BY ID (PUT)
app.put('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('complaints');
  const {
    complainant_resident_id, complainant_display_name, complainant_address, contact_number,
    date_of_complaint, time_of_complaint,
    person_complained_against_name, person_complained_against_resident_id, // New fields
    status, notes_description,
  } = req.body;

  const updateFields = {};
  // Complainant
  if (complainant_resident_id !== undefined) {
    if (!ObjectId.isValid(complainant_resident_id)) return res.status(400).json({ error: 'Invalid complainant ID for update.' });
    updateFields.complainant_resident_id = new ObjectId(complainant_resident_id);
  }
  if (complainant_display_name !== undefined) updateFields.complainant_display_name = String(complainant_display_name).trim();
  if (complainant_address !== undefined) updateFields.complainant_address = String(complainant_address).trim();
  if (contact_number !== undefined) updateFields.contact_number = String(contact_number).trim();
  
  // Complaint details
  if (date_of_complaint !== undefined) updateFields.date_of_complaint = new Date(date_of_complaint);
  if (time_of_complaint !== undefined) updateFields.time_of_complaint = String(time_of_complaint).trim();
  
  // Person Complained Against
  if (person_complained_against_name !== undefined) updateFields.person_complained_against_name = String(person_complained_against_name).trim();
  if (person_complained_against_resident_id !== undefined) { // Can be null to unset resident link
    updateFields.person_complained_against_resident_id = person_complained_against_resident_id && ObjectId.isValid(person_complained_against_resident_id)
      ? new ObjectId(person_complained_against_resident_id)
      : null;
  }
  
  if (status !== undefined) updateFields.status = String(status).trim();
  if (notes_description !== undefined) updateFields.notes_description = String(notes_description).trim();

  if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No fields to update.' });
  updateFields.updated_at = new Date();

  try {
    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Complaint not found.' });
    
    // Fetch updated doc with lookups for consistent response
    const updatedComplaintResult = await collection.aggregate([
        { $match: { _id: new ObjectId(id) } },
        { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
        { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
        // Project necessary fields
    ]).toArray();
    res.json({ message: 'Complaint updated successfully', complaint: updatedComplaintResult[0] || null });
  } catch (error) { console.error('Error updating complaint:', error); res.status(500).json({ error: 'Error updating complaint.' }); }
});

// DELETE COMPLAINT REQUEST BY ID (DELETE)
app.delete('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const dab = await db();
  const collection = dab.collection('complaints');
  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }
    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({ error: 'Error deleting complaint: ' + error.message });
  }
});

















// ====================== DOCUMENT REQUESTS CRUD =========================== //
// Ensure ObjectId is imported: import { ObjectId } from 'mongodb';

// ADD NEW DOCUMENT REQUEST (POST)
app.post('/api/document-requests', async (req, res) => {
  const dab = await db();
  const {
    request_type,
    requestor_resident_id,
    requestor_display_name,
    requestor_address,
    requestor_contact_number,
    date_of_request,
    purpose_of_request,
    requested_by_resident_id, // Optional ID of admin/official
    requested_by_display_name,  // Optional name of admin/official
    document_status, // Initial status, e.g., "Pending"
  } = req.body;

  // Basic Validation
  if (!request_type || !requestor_resident_id || !requestor_display_name || !requestor_address ||
      !requestor_contact_number || !date_of_request || !purpose_of_request || !document_status) {
    return res.status(400).json({ error: 'Missing required fields for document request.' });
  }
  if (!ObjectId.isValid(requestor_resident_id)) {
    return res.status(400).json({ error: 'Invalid requestor resident ID format.' });
  }
  if (requested_by_resident_id && !ObjectId.isValid(requested_by_resident_id)) {
    return res.status(400).json({ error: 'Invalid "requested by" resident ID format.' });
  }

  try {
    const newRequest = {
      request_type: String(request_type).trim(),
      requestor_resident_id: new ObjectId(requestor_resident_id),
      requestor_display_name: String(requestor_display_name).trim(),
      requestor_address: String(requestor_address).trim(),
      requestor_contact_number: String(requestor_contact_number).trim(),
      date_of_request: new Date(date_of_request),
      purpose_of_request: String(purpose_of_request).trim(),
      requested_by_resident_id: requested_by_resident_id ? new ObjectId(requested_by_resident_id) : null,
      requested_by_display_name: requested_by_display_name ? String(requested_by_display_name).trim() : null,
      document_status: String(document_status).trim(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    const collection = dab.collection('document_requests');
    const result = await collection.insertOne(newRequest);
    const insertedDoc = await collection.findOne({ _id: result.insertedId });
    res.status(201).json({ message: 'Document request added successfully', request: insertedDoc });
  } catch (error) {
    console.error('Error adding document request:', error);
    res.status(500).json({ error: 'Error adding document request: ' + error.message });
  }
});

// GET ALL DOCUMENT REQUESTS (GET) - WITH LOOKUPS
app.get('/api/document-requests', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  const dab = await db();
  const collection = dab.collection('document_requests');
  
  let searchMatchStage = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    searchMatchStage = {
      $or: [
        { request_type: { $regex: searchRegex } },
        { requestor_display_name: { $regex: searchRegex } },
        { "requestor_details.first_name": { $regex: searchRegex } },
        { "requestor_details.last_name": { $regex: searchRegex } },
        { purpose_of_request: { $regex: searchRegex } },
        { requested_by_display_name: { $regex: searchRegex } },
        { "requested_by_details.first_name": { $regex: searchRegex } },
        { "requested_by_details.last_name": { $regex: searchRegex } },
        { document_status: { $regex: searchRegex } },
      ],
    };
  }

  try {
    const aggregationPipeline = [
      { $match: {} }, // Initial match if needed
      { // Lookup requestor
        $lookup: {
          from: 'residents', localField: 'requestor_resident_id',
          foreignField: '_id', as: 'requestor_details_array'
        }
      },
      { $addFields: { requestor_details: { $arrayElemAt: ['$requestor_details_array', 0] } } },
      { // Lookup requested_by personnel (admin/official)
        $lookup: {
          from: 'residents', // Or 'admins', 'officials' if they are in separate collections
          localField: 'requested_by_resident_id',
          foreignField: '_id', as: 'requested_by_details_array'
        }
      },
      { $addFields: { requested_by_details: { $arrayElemAt: ['$requested_by_details_array', 0] } } },
      { $match: searchMatchStage },
      {
        $project: {
          _id: 1, request_type: 1,
          requestor_name: { /* ... same as complaint ... */ 
             $ifNull: [ { $concat: [ "$requestor_details.first_name", " ", { $ifNull: ["$requestor_details.middle_name", ""] }, { $cond: { if: { $eq: [{ $ifNull: ["$requestor_details.middle_name", ""] }, ""] }, then: "", else: " " } }, "$requestor_details.last_name"] }, "$requestor_display_name" ]
          },
          date_of_request: 1, purpose_of_request: 1, document_status: 1,
          requested_by_name: { /* ... same as complaint ... */ 
            $ifNull: [ { $concat: [ "$requested_by_details.first_name", " ", { $ifNull: ["$requested_by_details.middle_name", ""] }, { $cond: { if: { $eq: [{ $ifNull: ["$requested_by_details.middle_name", ""] }, ""] }, then: "", else: " " } }, "$requested_by_details.last_name"] }, "$requested_by_display_name" ]
          },
          created_at: 1,
        }
      },
      { $sort: { date_of_request: -1, created_at: -1 } },
      { $skip: skip }, { $limit: itemsPerPage }
    ];

    const requests = await collection.aggregate(aggregationPipeline).toArray();
    
    const countPipeline = [
        { $lookup: { from: 'residents', localField: 'requestor_resident_id', foreignField: '_id', as: 'requestor_details_array' }},
        { $addFields: { requestor_details: { $arrayElemAt: ['$requestor_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'requested_by_resident_id', foreignField: '_id', as: 'requested_by_details_array' }},
        { $addFields: { requested_by_details: { $arrayElemAt: ['$requested_by_details_array', 0] } }},
        { $match: searchMatchStage },
        { $count: 'total' }
    ];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalRequests = countResult.length > 0 ? countResult[0].total : 0;

    res.json({ requests, total: totalRequests, page, itemsPerPage, totalPages: Math.ceil(totalRequests / itemsPerPage) });
  } catch (error) {
    console.error('Error fetching document requests:', error);
    res.status(500).json({ error: "Failed to fetch document requests." });
  }
});

// GET DOCUMENT REQUEST BY ID (GET)
app.get('/api/document-requests/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('document_requests');
  try {
    const aggregationPipeline = [
      { $match: { _id: new ObjectId(id) } },
      { $lookup: { from: 'residents', localField: 'requestor_resident_id', foreignField: '_id', as: 'requestor_details_array' }},
      { $addFields: { requestor_details: { $arrayElemAt: ['$requestor_details_array', 0] } }},
      { $lookup: { from: 'residents', localField: 'requested_by_resident_id', foreignField: '_id', as: 'requested_by_details_array' }},
      { $addFields: { requested_by_details: { $arrayElemAt: ['$requested_by_details_array', 0] } }},
      { $project: { /* ... project all fields including from lookups ... */
            request_type: 1, requestor_resident_id: 1, requestor_display_name: 1, requestor_address: 1,
            requestor_contact_number: 1, date_of_request: 1, purpose_of_request: 1,
            requested_by_resident_id: 1, requested_by_display_name: 1, document_status: 1,
            created_at: 1, updated_at: 1,
            "requestor_details": "$requestor_details", // Send whole object or specific fields
            "requested_by_details": "$requested_by_details",
        }
      }
    ];
    const result = await collection.aggregate(aggregationPipeline).toArray();
    if (result.length === 0) return res.status(404).json({ error: 'Document request not found.' });
    res.json({ request: result[0] });
  } catch (error) { console.error('Error fetching document request by ID:', error); res.status(500).json({ error: "Failed to fetch request." }); }
});

// UPDATE DOCUMENT REQUEST BY ID (PUT)
app.put('/api/document-requests/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('document_requests');
  const {
    request_type, requestor_resident_id, requestor_display_name, requestor_address, requestor_contact_number,
    date_of_request, purpose_of_request,
    requested_by_resident_id, requested_by_display_name,
    document_status,
  } = req.body;

  const updateFields = {};
  if (request_type !== undefined) updateFields.request_type = String(request_type).trim();
  if (requestor_resident_id !== undefined) {
    if (!ObjectId.isValid(requestor_resident_id)) return res.status(400).json({ error: 'Invalid requestor ID for update.' });
    updateFields.requestor_resident_id = new ObjectId(requestor_resident_id);
  }
  if (requestor_display_name !== undefined) updateFields.requestor_display_name = String(requestor_display_name).trim();
  if (requestor_address !== undefined) updateFields.requestor_address = String(requestor_address).trim();
  if (requestor_contact_number !== undefined) updateFields.requestor_contact_number = String(requestor_contact_number).trim();
  if (date_of_request !== undefined) updateFields.date_of_request = new Date(date_of_request);
  if (purpose_of_request !== undefined) updateFields.purpose_of_request = String(purpose_of_request).trim();
  if (requested_by_resident_id !== undefined) {
    updateFields.requested_by_resident_id = requested_by_resident_id && ObjectId.isValid(requested_by_resident_id)
      ? new ObjectId(requested_by_resident_id) : null;
  }
  if (requested_by_display_name !== undefined) updateFields.requested_by_display_name = requested_by_display_name ? String(requested_by_display_name).trim() : null;
  if (document_status !== undefined) updateFields.document_status = String(document_status).trim();

  if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No fields to update.' });
  updateFields.updated_at = new Date();

  try {
    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Document request not found.' });
    
    const updatedRequestResult = await collection.aggregate([ /* ... same lookup as GET by ID ... */ 
        { $match: { _id: new ObjectId(id) } },
        { $lookup: { from: 'residents', localField: 'requestor_resident_id', foreignField: '_id', as: 'requestor_details_array' }},
        { $addFields: { requestor_details: { $arrayElemAt: ['$requestor_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'requested_by_resident_id', foreignField: '_id', as: 'requested_by_details_array' }},
        { $addFields: { requested_by_details: { $arrayElemAt: ['$requested_by_details_array', 0] } }},
        // Project necessary fields
    ]).toArray();
    res.json({ message: 'Document request updated successfully', request: updatedRequestResult[0] || null });
  } catch (error) { console.error('Error updating request:', error); res.status(500).json({ error: 'Error updating request.' }); }
});

// DELETE DOCUMENT REQUEST BY ID (DELETE)
app.delete('/api/document-requests/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('document_requests');
  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Request not found.' });
    res.json({ message: 'Document request deleted successfully' });
  } catch (error) { console.error('Error deleting request:', error); res.status(500).json({ error: 'Error deleting request.' }); }
});

















// ======================== DASHBOARD STATISTICS ======================== //

// ----- Express.js API for Dashboard Metrics -----
// Ensure you have 'app' (Express app instance) and 'db' (DB connection function)
// and ObjectId from mongodb if needed for other parts, though not directly here.

app.get('/api/dashboard', async (req, res) => {
  const dab = await db();
  const residentsCollection = dab.collection('residents');

  try {
    // 1. Number of population
    const totalPopulation = await residentsCollection.countDocuments({});

    // 2. Number of households (household heads)
    // 3. Number of families (same as households for this context)
    const totalHouseholds = await residentsCollection.countDocuments({ is_household_head: true });

    // 4. Number of registered voters
    const totalRegisteredVoters = await residentsCollection.countDocuments({ is_registered_voter: true });

    // 5. Age brackets
    // For age calculation, we'll approximate for simplicity in aggregation.
    // More precise age calculation can be done but adds complexity.
    // $dateFromString is available from MongoDB 4.0. Ensure date_of_birth is stored as ISODate for best results.
    // If date_of_birth is already a Date object in MongoDB, the $project stage for age is simpler.
    
    const ageBracketsAggregation = await residentsCollection.aggregate([
      {
        $match: { date_of_birth: { $exists: true, $ne: null } } // Ensure date_of_birth exists
      },
      {
        $project: {
          age: {
            $floor: { // Calculate age in years
              $divide: [
                { $subtract: [new Date(), "$date_of_birth"] }, // Difference in milliseconds
                365.25 * 24 * 60 * 60 * 1000 // Milliseconds in an average year
              ]
            }
          }
        }
      },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 6, 13, 18, 36, 51, 66], // Lower bounds for 0-5, 6-12, 13-17, 18-35, 36-50, 51-65
          default: "66+", // For ages 66 and above
          output: {
            count: { $sum: 1 }
          }
        }
      },
      {
        $project: { // Remap _id (bucket lower bound) to descriptive bracket names
            _id: 0, // Exclude the original _id from $bucket
            bracket: {
                $switch: {
                    branches: [
                        { case: { $eq: ["$_id", 0] }, then: "0-5" },
                        { case: { $eq: ["$_id", 6] }, then: "6-12" },
                        { case: { $eq: ["$_id", 13] }, then: "13-17" },
                        { case: { $eq: ["$_id", 18] }, then: "18-35" },
                        { case: { $eq: ["$_id", 36] }, then: "36-50" },
                        { case: { $eq: ["$_id", 51] }, then: "51-65" },
                        { case: { $eq: ["$_id", "66+"] }, then: "66+" },
                    ],
                    default: "Unknown"
                }
            },
            count: 1
        }
      },
      { $sort: { count: -1 } } // Optional: sort brackets by count or define a specific order later
    ]).toArray();

    // Ensure all brackets are present in the result, even if count is 0
    const allBracketNames = ["0-5", "6-12", "13-17", "18-35", "36-50", "51-65", "66+"];
    const ageBracketsMap = new Map(ageBracketsAggregation.map(item => [item.bracket, item.count]));
    const completeAgeBrackets = allBracketNames.map(name => ({
        bracket: name,
        count: ageBracketsMap.get(name) || 0
    }));


    res.json({
      totalPopulation,
      totalHouseholds, // Also used for families
      totalRegisteredVoters,
      ageBrackets: completeAgeBrackets,
    });

  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics", message: error.message });
  }
});

// Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// Helper function
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString("hex"); // 32 bytes = 64 hex chars
}