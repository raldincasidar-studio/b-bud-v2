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

// ADD NEW RESIDENT (POST) - Storing Base64 directly in DB
app.post('/api/residents', async (req, res) => {
  const dab = await db(); // Your database connection

  const {
    // Personal Info
    is_household_head,
    first_name,
    middle_name,
    last_name,
    sex,
    age,
    date_of_birth,
    civil_status,
    occupation_status,
    place_of_birth,
    citizenship,
    is_pwd,

    // Voter Info
    is_registered_voter,
    precinct_number,
    voter_registration_proof_base64, // Base64 string
    // voter_registration_proof_name, // Name might still be useful for context, optional to store

    // Address Info
    address_house_number,
    address_street,
    address_subdivision_zone,
    address_city_municipality,
    years_lived_current_address,

    // Contact Info
    contact_number,
    email,

    // Proofs
    residency_proof_base64, // Base64 string
    // residency_proof_name,   // Name might still be useful for context, optional to store

    // Household List
    household_member_ids,
  } = req.body;

  // --- Validation (largely the same as before) ---
  const validationErrors = [];

  const validateRequiredString = (field, value, regex, message) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      validationErrors.push({ field, message: `${field} is required.` });
    } else if (regex && !regex.test(String(value))) {
      validationErrors.push({ field, message: message || `${field} has an invalid format.` });
    }
  };

  const validateOptionalString = (field, value, regex, message) => {
    if (value !== undefined && value !== null && String(value).trim() !== '' && regex && !regex.test(String(value))) {
      validationErrors.push({ field, message: message || `${field} has an invalid format.` });
    }
  };
  
  const validateEnum = (field, value, allowedValues) => {
    if (value === undefined || value === null || String(value).trim() === '') {
        validationErrors.push({ field, message: `${field} is required.`});
    } else if (!allowedValues.includes(String(value))) {
        validationErrors.push({ field, message: `${field} must be one of: ${allowedValues.join(', ')}.` });
    }
  };

  const validateBase64 = (field, value) => {
    if (value && typeof value === 'string') {
        const matches = value.match(/^data:(.+?);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            validationErrors.push({ field, message: `${field} is not a valid Base64 data URL.` });
        }
    }
    // If not provided, it's optional, so no error
  };

  // Personal Info
  validateRequiredString('first_name', first_name, /^[a-zA-Z\s.'-]+$/, 'First name can only contain letters, spaces, periods, apostrophes, and hyphens.');
  validateOptionalString('middle_name', middle_name, /^[a-zA-Z\s.'-]*$/, 'Middle name can only contain letters, spaces, periods, apostrophes, and hyphens.');
  validateRequiredString('last_name', last_name, /^[a-zA-Z\s.'-]+$/, 'Last name can only contain letters, spaces, periods, apostrophes, and hyphens.');
  validateEnum('sex', sex, ['Male', 'Female', 'Other']);
  if (age !== null && age !== undefined && (typeof age !== 'number' || age < 0 || !Number.isInteger(age))) {
    validationErrors.push({ field: 'age', message: 'Age must be a non-negative integer.' });
  }
  validateRequiredString('date_of_birth', date_of_birth, /^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format.');
  validateEnum('civil_status', civil_status, ['Single', 'Married', 'Divorced', 'Widowed', 'Separated']);
  validateEnum('occupation_status', occupation_status, ['Employed', 'Unemployed', 'Student', 'Retired', 'Other']);
  validateRequiredString('place_of_birth', place_of_birth, /^.{2,}$/);
  validateRequiredString('citizenship', citizenship, /^[a-zA-Z\s]+$/);

  // Address Info
  validateRequiredString('address_house_number', address_house_number, /^.{1,}$/);
  validateRequiredString('address_street', address_street, /^.{2,}$/);
  validateRequiredString('address_subdivision_zone', address_subdivision_zone, /^.{2,}$/);
  validateRequiredString('address_city_municipality', address_city_municipality, /^[a-zA-Z\s.,-]+$/);
  if (years_lived_current_address !== null && years_lived_current_address !== undefined && (typeof years_lived_current_address !== 'number' || years_lived_current_address < 0 || !Number.isInteger(years_lived_current_address))) {
    validationErrors.push({ field: 'years_lived_current_address', message: 'Years lived must be a non-negative integer.' });
  }

  // Contact Info
  validateRequiredString('contact_number', contact_number, /^\+?[0-9\s-]{7,15}$/);
  validateRequiredString('email', email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address format.');

  // Voter Info Specific
  if (is_registered_voter === true) {
    validateRequiredString('precinct_number', precinct_number, /^[a-zA-Z0-9\s-]+$/, 'Precinct number is required.');
    validateBase64('voter_registration_proof_base64', voter_registration_proof_base64);
  } else if (precinct_number && String(precinct_number).trim() !== '') {
     validationErrors.push({ field: 'precinct_number', message: 'Precinct number should only be provided if registered voter.' });
  }

  // Validate Residency Proof Base64
  validateBase64('residency_proof_base64', residency_proof_base64);


  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: validationErrors.map(err => ({ field: err.field, message: err.message })),
      message: 'Validation errors: ' + validationErrors.map(e => `${e.field}: ${e.message}`).join('; ')
    });
  }

  // --- Prepare document for MongoDB ---
  // (Ensuring snake_case for DB and correct data types)
  const residentDocument = {
    is_household_head: Boolean(is_household_head),
    first_name: String(first_name).trim(),
    middle_name: middle_name ? String(middle_name).trim() : null,
    last_name: String(last_name).trim(),
    sex: String(sex),
    age: (age !== null && age !== undefined) ? parseInt(age, 10) : null,
    date_of_birth: new Date(date_of_birth),
    civil_status: String(civil_status),
    occupation_status: String(occupation_status),
    place_of_birth: String(place_of_birth).trim(),
    citizenship: String(citizenship).trim(),
    is_pwd: Boolean(is_pwd),

    is_registered_voter: Boolean(is_registered_voter),
    precinct_number: (is_registered_voter && precinct_number) ? String(precinct_number).trim() : null,
    // Store Base64 string directly. The schema suggested 'TEXT or JSON'.
    // If it's just one Base64 string, a TEXT type (string in Mongo) is fine.
    // If you intend to store multiple Base64 proofs, this should be an array.
    voter_registration_proof_data: (is_registered_voter && voter_registration_proof_base64) ? voter_registration_proof_base64 : null,


    address_house_number: String(address_house_number).trim(),
    address_street: String(address_street).trim(),
    address_subdivision_zone: String(address_subdivision_zone).trim(),
    address_city_municipality: String(address_city_municipality).trim(),
    years_lived_current_address: (years_lived_current_address !== null && years_lived_current_address !== undefined) ? parseInt(years_lived_current_address, 10) : null,

    contact_number: String(contact_number).trim(),
    email: String(email).trim().toLowerCase(),

    residency_proof_data: residency_proof_base64 ? residency_proof_base64 : null,

    household_member_ids: Array.isArray(household_member_ids) ? household_member_ids : [],

    created_at: new Date(),
    updated_at: new Date(),
  };

  // Optional: If you still want to store the original file names for context
  // if (req.body.voter_registration_proof_name && residentDocument.voter_registration_proof_data) {
  //   residentDocument.voter_registration_proof_name = req.body.voter_registration_proof_name;
  // }
  // if (req.body.residency_proof_name && residentDocument.residency_proof_data) {
  //   residentDocument.residency_proof_name = req.body.residency_proof_name;
  // }

  try {
    const residentsCollection = dab.collection('residents');
    const result = await residentsCollection.insertOne(residentDocument);

    if (result.insertedId) {
      res.status(201).json({ message: 'Resident added successfully', residentId: result.insertedId });
    } else {
      throw new Error('Failed to insert resident.');
    }
  } catch (error) {
    console.error('Error adding resident to DB:', error);
    if (error.code === 11000) {
        return res.status(409).json({ error: 'Conflict', message: 'A resident with this email or other unique identifier already exists.' });
    }
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

// SEARCH FOR RESIDENT
app.get('/api/residents/search', async (req, res) => {
  const search = req.query.q?.toString().trim() || '';

  if (search.length < 2) {
    return res.json({ residents: [] });
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');

  const query = {
    $or: [
      { firstName: { $regex: new RegExp(search, 'i') } },
      { middleName: { $regex: new RegExp(search, 'i') } },
      { lastName: { $regex: new RegExp(search, 'i') } },
      { emailAddress: { $regex: new RegExp(search, 'i') } },
      { contactNo: { $regex: new RegExp(search, 'i') } },
      { block: { $regex: new RegExp(search, 'i') } },
      { lot: { $regex: new RegExp(search, 'i') } },
      { subdivision: { $regex: new RegExp(search, 'i') } }
    ]
  };

  const residents = await residentsCollection.find(query, {
    projection: {
      _id: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      gender: 1,
      dateOfBirth: 1,
    }
  })
    .limit(5)
    .toArray();

  console.log(residents);

  const formattedResidents = residents.map(resident => ({
    id: resident._id,
    name: `${resident.firstName} ${resident.middleName || ''} ${resident.lastName}`.trim()
  }));

  res.json({ residents: formattedResidents });
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