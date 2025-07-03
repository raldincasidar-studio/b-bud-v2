// api\index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const md5 = require("md5");
const crypto = require("crypto");
const path = require('path');
const moment = require('moment');
const nodemailer = require('nodemailer');
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = 'mongodb+srv://raldincasidar:dindin23@accounting-system.haaem.mongodb.net/?retryWrites=true&w=majority'

// --- SMTP Configuration ---
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || 'carbonellharold15@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'ziwp tsie srvd eyzm'; // App Password for Gmail

const OTP_EXPIRY_MINUTES_LOGIN = 5; // OTP expiry for login
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 5;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});


const OTP_EXPIRY_MINUTES = 10; // OTP will be valid for 10 minutes

// Function to generate a random 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

let CLIENT_DB;

async function db() {
  CLIENT_DB = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await CLIENT_DB.connect();
    return CLIENT_DB.db('bbud-backend');
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error;
  }
}

// Middleware
app.use(cors({
  credentials: true,
  origin: ['http://localhost:3000', 'https://b-bud-new.vercel.app']
})); // Enable CORS for multiple origins
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Express.js + CORS boilerplate!" });
});




// ====================== HELPER TO CREATE CUSTOM ID ========================= //

/**
 * Generates a custom, sequential, 5-digit, zero-padded control ID for a MongoDB collection,
 * ensuring the ID is unique.
 *
 * @param {import('mongodb').Collection} collection - The MongoDB collection instance to work with.
 * @param {string} [last_id=null] - An optional starting ID (e.g., '00045'). If not provided,
 *   the function will find the highest existing ID in the collection.
 * @returns {Promise<string>} A promise that resolves to the next available, non-duplicate, 5-digit string ID.
 * @throws {Error} If the ID space (up to '99999') is exhausted.
 */
async function custom_control_id(collection, last_id = null) {
  let base_numeric_id = 0;

  // 1. Determine the starting point for our search.
  if (last_id) {
    // If a last_id is provided, use it as the base.
    const parsed_id = parseInt(last_id, 10);
    if (!isNaN(parsed_id)) {
      base_numeric_id = parsed_id;
    }
  } else {
    // If no last_id, find the document with the highest ID in the collection.
    // We sort by `_id` in descending order and take the first one.
    // NOTE: This assumes your custom ID is stored in the `_id` field.
    // If using a different field, change `{ _id: -1 }` to `{ yourField: -1 }`.
    const latest_doc = await collection.findOne({}, { sort: { control_id: -1 } });

    if (latest_doc && latest_doc._id) {
      const parsed_latest = parseInt(latest_doc.control_id, 10);
      if (!isNaN(parsed_latest)) {
        base_numeric_id = parsed_latest;
      }
    }
  }

  // 2. Start incrementing from the base ID to find the next available slot.
  let next_numeric_id = base_numeric_id + 1;

  while (true) {
    // 3. Format the number as a 5-digit string with leading zeros.
    const candidate_id = String(next_numeric_id).padStart(5, '0');

    // Safety check to prevent infinite loops and handle exhausted ID space.
    if (next_numeric_id > 99999) {
      throw new Error("ID space exhausted. Cannot generate an ID greater than 99999.");
    }

    // 4. Check if a document with this candidate ID already exists.
    // We only need to know if it exists, so we project only the _id field for efficiency.
    const doc_exists = await collection.findOne({ control_id: candidate_id }, { projection: { control_id: 1 } });

    if (!doc_exists) {
      // 5. If it doesn't exist, we've found our ID. Return it.
      return candidate_id;
    } else {
      // If it exists, increment and the loop will try the next number.
      next_numeric_id++;
    }
  }
}


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

  // Check for lockout
  if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      const timeLeft = Math.ceil((new Date(user.account_locked_until) - new Date()) / 60000);
      return res.json({ error: `Account locked. Try again in ${timeLeft} minutes.` });
  }

  // Check password
  if (user.password !== md5(password)) {
      let attempts = (user.login_attempts || 0) + 1;
      let update = { $set: { login_attempts: attempts } };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
          update.$set.account_locked_until = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
          update.$set.login_attempts = 0; // Reset attempts after locking
      }
      await usersCollection.updateOne({ _id: user._id }, update);
      
      if (update.$set.account_locked_until) {
          return res.json({ error: 'Account locked due to too many failed attempts.' });
      } else {
            return res.json({ error: 'Invalid username or password' });
      }
  }

 // --- ADD AUDIT LOG HERE ---
  await createAuditLog({
    userId: user._id,
    userName: user.name,
    description: `Admin '${user.name}' logged into the system.`,
    action: 'LOGIN',
    entityType: 'Admin',
    entityId: user._id.toString()
  });
  // --- END AUDIT LOG ---

  const token = generateToken();

  // save token in mongodb
  await dab.collection('users').updateOne({username: username}, {$set: {token: token}});

  res.json({
    token: token,
    user: user
  });
})











// =================== HELPER FUNCTIONS =================== //
const calculateAge = (dob) => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  if (isNaN(birthDate.getTime())) return 0; // Invalid date
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0; // Return 0 if negative (e.g. future date)
};


// =================== RESIDENTS LOGIN =================== //


// =================== RESIDENT LOGIN - STEP 1 (Email/Password & OTP Send) =================== //
app.post('/api/residents/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Validation failed', message: 'Email and password are required.' });
  }

  try {
    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const resident = await residentsCollection.findOne({ email: String(email).trim().toLowerCase() });

    if (!resident) {
      return res.status(401).json({ error: 'Invalid email or password.', message: 'Invalid email or password.' });
    }

    // Check for account lockout
    if (resident.account_locked_until && new Date(resident.account_locked_until) > new Date()) {
      const timeLeft = Math.ceil((new Date(resident.account_locked_until).getTime() - new Date().getTime()) / (60 * 1000));
      return res.status(403).json({
        error: `Account is locked due to multiple failed attempts. Please try again in approximately ${timeLeft} minute(s).`,
        message: `Account is locked due to multiple failed attempts. Please try again in approximately ${timeLeft} minute(s).`,
        lockedUntil: resident.account_locked_until
      });
    }

    // --- WARNING: MD5 IS INSECURE. REPLACE WITH BCRYPT ---
    const hashedPasswordAttempt = md5(password);
    const isPasswordMatch = (resident.password_hash === hashedPasswordAttempt);
    // // For bcrypt:
    // const isPasswordMatch = await bcrypt.compare(password, resident.password_hash);

    if (!isPasswordMatch) {
      let attempts = (resident.login_attempts || 0) + 1;
      let lockUntilDate = null;
      const updateFields = { login_attempts: attempts, updated_at: new Date() };

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        lockUntilDate = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        updateFields.account_locked_until = lockUntilDate;
        updateFields.login_attempts = 0; // Reset attempts after locking
      }
      await residentsCollection.updateOne({ _id: resident._id }, { $set: updateFields });

      if (lockUntilDate) {
        return res.status(403).json({
          error: `Account locked due to multiple failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
          message: `Account locked due to multiple failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
          lockedUntil: lockUntilDate
        });
      } else {
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
        return res.status(401).json({
            error: `Invalid email or password. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining before lockout.` : 'Account will be locked on next failed attempt.'}`,
            message: `Invalid email or password. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining before lockout.` : 'Account will be locked on next failed attempt.'}`
        });
      }
    }

    // --- Age Restriction for Login (16+ years old) ---
    const residentAge = calculateAge(resident.date_of_birth);
    if (residentAge < 16) {
      return res.status(403).json({ error: 'Access denied. Users must be 16 years old or older to log in.', message: 'Access denied. Users must be 16 years old or older to log in.' });
    }

    // --- Check Status (only 'Approved' can login) ---
    if (resident.status !== 'Approved') {
        let message = 'Login denied. Your account is not active.';
        if (resident.status === 'Pending') message = 'Login denied. Your account is pending approval.';
        if (resident.status === 'Declined') message = 'Login denied. Your account has been declined.';
        if (resident.status === 'Deactivated') message = 'Login denied. Your account has been deactivated.';
        return res.status(403).json({ error: message, message });
    }

    // --- Credentials VALID - Proceed to OTP step ---
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES_LOGIN * 60 * 1000);

    // IMPORTANT: In a production environment, HASH the OTP before storing it.
    // const hashedOtp = await bcrypt.hash(otp, saltRounds);
    await residentsCollection.updateOne(
      { _id: resident._id },
      { $set: {
          login_otp: otp, // Store plain OTP here for simplicity; HASH IT IN PRODUCTION (e.g., login_otp_hash: hashedOtp)
          login_otp_expiry: otpExpiry,
          login_attempts: 0, // Reset login attempts as password was correct
          account_locked_until: null, // Clear any previous lock
          updated_at: new Date()
        }
      }
    );

    // Send OTP email
    const mailOptions = {
      from: `"B-Bud System" <${SMTP_USER}>`,
      to: resident.email,
      subject: 'Your B-Bud Login Verification Code',
      html: `
        <p>Hello ${resident.first_name || 'User'},</p>
        <p>To complete your login, please use the following One-Time Password (OTP):</p>
        <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
        <p>This OTP is valid for ${OTP_EXPIRY_MINUTES_LOGIN} minutes.</p>
        <p>If you did not attempt to log in, please secure your account or contact support immediately.</p>
        <br><p>Thanks,<br>The B-Bud Team</p>`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Login OTP email sent to ${resident.email} (OTP: ${otp})`); // Log OTP for testing, REMOVE FOR PRODUCTION
      return res.status(200).json({
        message: `An OTP has been sent to your email address (${resident.email}). Please enter it to complete your login.`,
        otpRequired: true,
        // Do NOT send resident data yet
      });
    } catch (emailError) {
      console.error("Fatal Error: Could not send login OTP email:", emailError);
      // If OTP email cannot be sent, the user cannot log in with this flow.
      // This is a critical failure. You might want to log this prominently.
      await residentsCollection.updateOne( // Clear OTP if email failed, so they can try login again later
        { _id: resident._id },
        { $unset: { login_otp: "", login_otp_expiry: "" }}
      );
      return res.status(500).json({
        error: 'EmailSendingError',
        message: 'We encountered an issue sending the verification code to your email. Please try logging in again shortly. If the problem persists, contact support.'
      });
    }

  } catch (error) {
    console.error("Critical error during resident login process:", error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected server error occurred during login.' });
  }
});


// =================== RESIDENT LOGIN - STEP 2 (Verify OTP) =================== //
app.post('/api/residents/login/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Validation failed', message: 'Email and OTP are required.' });
  }
  if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Validation failed', message: 'OTP must be a 6-digit number.' });
  }


  try {
    const dab = await db();
    const residentsCollection = dab.collection('residents');

    // Find resident by email, OTP, and ensure OTP is not expired
    // IMPORTANT: If OTP is hashed in DB, query for email first, then compare hashed OTP.
    const resident = await residentsCollection.findOne({
      email: String(email).trim().toLowerCase(),
      login_otp: otp, // If OTP is hashed: Remove this line. Fetch by email, then use bcrypt.compare(otp, resident.login_otp_hash)
      login_otp_expiry: { $gt: new Date() }
    });

    if (!resident) {
      // Optionally, you could implement OTP attempt tracking here as well for the specific email
      // For now, a generic failure message is fine.
      return res.status(400).json({ error: 'InvalidOTP', message: 'Invalid or expired OTP. Please try logging in again to get a new OTP.' });
    }

    // --- If OTP was hashed, you would compare it here ---
    // const isOtpMatch = await bcrypt.compare(otp, resident.login_otp_hash);
    // if (!isOtpMatch) {
    //   return res.status(400).json({ error: 'InvalidOTP', message: 'Invalid or expired OTP. Please try again.' });
    // }

    // OTP Validated successfully, complete login.
    // Clear OTP fields from the database to prevent reuse.
    await residentsCollection.updateOne(
      { _id: resident._id },
      {
        $unset: { login_otp: "", login_otp_expiry: "" },
        $set: {
          login_attempts: 0, // Also reset main login attempts on full successful login
          account_locked_until: null,
          updated_at: new Date()
        }
      }
    );

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      userId: resident._id,
      userName: `${resident.first_name} ${resident.last_name}`,
      description: `Resident '${resident.first_name} ${resident.last_name}' logged into the system.`,
      action: "LOGIN",
      entityType: "Resident",
      entityId: resident._id.toString(),
    }, req)
    // --- END AUDIT LOG ---

    // Prepare resident data to return (excluding sensitive fields)
    const { password_hash, login_attempts, account_locked_until, login_otp, login_otp_expiry, ...residentDataToReturn } = resident;

    // IMPORTANT: Generate a session token (e.g., JWT) here and send it back to the client.
    // For this example, we're just sending resident data.
    // const token = jwt.sign({ id: resident._id, email: resident.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
        message: 'Login successful!',
        resident: residentDataToReturn,
        // token: token, // Send the token to the client
    });

  } catch (error) {
    console.error("Error during login OTP verification:", error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected server error occurred during OTP verification.' });
  }
});


// 1. REQUEST OTP FOR FORGOT PASSWORD
app.post('/api/residents/forgot-password/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res.status(400).json({ error: 'Invalid email format provided.' });
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const resident = await residentsCollection.findOne({ email: normalizedEmail });

    // Security: Always return a generic success message to prevent email enumeration
    // The actual OTP sending happens only if the resident exists.
    if (resident) {
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP and its expiry on the user document
      // In a production app, consider hashing the OTP or using a separate temporary collection/cache.
      await residentsCollection.updateOne(
        { _id: resident._id },
        { $set: { password_reset_otp: otp, password_reset_otp_expiry: otpExpiry, updated_at: new Date() } }
      );

      // Send OTP email
      const mailOptions = {
        from: `"B-Bud System" <${SMTP_USER}>`,
        to: normalizedEmail,
        subject: 'Your Password Reset OTP Code',
        html: `
          <p>Hello ${resident.first_name || 'User'},</p>
          <p>You requested a password reset. Your One-Time Password (OTP) is:</p>
          <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
          <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <br>
          <p>Thanks,<br>The B-Bud Team</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent to ${normalizedEmail}`);
      } catch (emailError) {
        console.error("Error sending OTP email:", emailError);
        // Even if email fails, don't reveal to user that their email was found.
        // Log this error for admin attention.
      }
    }
    // Generic success message
    res.json({ message: `If an account with email ${normalizedEmail} exists, an OTP has been sent. Please check your inbox (and spam folder).` });

  } catch (error) {
    console.error("Error processing forgot password request:", error);
    // Generic error message to the client in case of server issues
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});


// 2. VERIFY OTP AND RESET PASSWORD
app.post('/api/residents/forgot-password/verify-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const resident = await residentsCollection.findOne({
      email: normalizedEmail,
      password_reset_otp: otp, // Check if OTP matches
      password_reset_otp_expiry: { $gt: new Date() } // Check if OTP is not expired
    });

    if (!resident) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
    }

    // Hash the new password (using MD5 as per your previous request, but bcrypt is recommended)
    const hashedPassword = md5(newPassword); // WARNING: MD5 is insecure for passwords

    // Update the password and clear OTP fields
    await residentsCollection.updateOne(
      { _id: resident._id },
      {
        $set: { password_hash: hashedPassword, updated_at: new Date() },
        $unset: { password_reset_otp: "", password_reset_otp_expiry: "" } // Clear OTP fields
      }
    );

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      userId: resident._id,
      userName: `${resident.first_name} ${resident.last_name}`,
      description: `Resident '${resident.first_name} ${resident.last_name}' logged into the system.`,
      action: "LOGIN",
      entityType: "Resident",
      entityId: resident._id.toString(),
    }, req)
    // --- END AUDIT LOG ---

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });

  } catch (error) {
    console.error("Error verifying OTP and resetting password:", error);
    res.status(500).json({ error: 'An error occurred while resetting your password.' });
  }
});




















// ========================= RESIDENTS =================== //
// ========================= RESIDENTS =================== //

// Helper function to create a resident document from payload data.
// This reduces code duplication between head and member creation.
const createResidentDocument = (data, isHead = false, headAddress = null) => {
    const age = calculateAge(data.date_of_birth);
    let passwordHash = null;
    let email = data.email ? String(data.email).toLowerCase() : null;

    // Password is required for the head, and for members creating an account.
    if (data.password) {
        passwordHash = md5(data.password);

    }
    
    return {
        // Personal Info
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        last_name: data.last_name,
        sex: data.sex,
        date_of_birth: new Date(data.date_of_birth),
        age: age,
        civil_status: data.civil_status,
        citizenship: data.citizenship, // REVISION: Added field
        occupation_status: data.occupation_status,
        email: email,
        password_hash: passwordHash,
        contact_number: data.contact_number,
        relationship_to_head: isHead ? null : (data.relationship_to_head === 'Other' ? data.other_relationship : data.relationship_to_head),

        // Address Info (Use head's address if provided)
        address_house_number: headAddress ? headAddress.address_house_number : data.address_house_number,
        address_street: headAddress ? headAddress.address_street : data.address_street,
        address_subdivision_zone: headAddress ? headAddress.address_subdivision_zone : data.address_subdivision_zone,
        address_city_municipality: headAddress ? headAddress.address_city_municipality : data.address_city_municipality,
        years_at_current_address: isHead ? data.years_at_current_address : null, // REVISION: Added field (only for head)
        proof_of_residency_base64: isHead ? data.proof_of_residency_base64 : null, // REVISION: Added field (only for head)

        // Voter Info
        is_voter: data.is_voter || false,
        voter_id_number: data.is_voter ? data.voter_id_number : null,
        voter_registration_proof_base64: data.is_voter ? data.voter_registration_proof_base64 : null,

        // PWD Info
        is_pwd: data.is_pwd || false,
        pwd_id: data.is_pwd ? data.pwd_id : null,
        pwd_card_base64: data.is_pwd ? data.pwd_card_base64 : null,

        // REVISION: Senior Citizen Info now based on the flag, not just age
        is_senior_citizen: data.is_senior_citizen || false,
        senior_citizen_id: data.is_senior_citizen ? data.senior_citizen_id : null,
        senior_citizen_card_base64: data.is_senior_citizen ? data.senior_citizen_card_base64 : null,
        
        // System-set Fields
        is_household_head: isHead,
        household_member_ids: isHead ? [] : undefined, // Only heads have this array initially
        status: 'Pending',
        created_at: new Date(),
        updated_at: new Date(),
    };
};


// POST /api/residents - CREATE A NEW HOUSEHOLD (HEAD + MEMBERS) - REVISED
app.post('/api/residents', async (req, res) => {
    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const session = CLIENT_DB.startSession();

    try {
        let newHouseholdHead;

        await session.withTransaction(async () => {
            const headData = req.body;
            const membersToCreate = headData.household_members_to_create || [];

            // --- Step 1: Validate and Prepare the Household Head ---
            if (!headData.first_name || !headData.last_name || !headData.email || !headData.password) {
                throw new Error('Validation failed: Head requires first name, last_name, email, and password.');
            }
            const existingEmail = await residentsCollection.findOne({ email: headData.email.toLowerCase() }, { session });
            if (existingEmail) {
                throw new Error('Conflict: The email address for the Household Head is already in use.');
            }

            const headResidentDocument = createResidentDocument(headData, true);
            
            // --- UPDATE: Set created_at and initialize date_approved ---
            headResidentDocument.created_at = new Date();
            headResidentDocument.updated_at = new Date();
            headResidentDocument.date_approved = null;
            // --- END UPDATE ---

            const headInsertResult = await residentsCollection.insertOne(headResidentDocument, { session });
            const insertedHeadId = headInsertResult.insertedId;
            newHouseholdHead = { _id: insertedHeadId, ...headResidentDocument };

            // --- Step 2: Validate and Prepare Household Members ---
            const createdMemberIds = [];
            const processedEmails = new Set([headData.email.toLowerCase()]);

            for (const memberData of membersToCreate) {
                if (!memberData.first_name || !memberData.last_name || !memberData.relationship_to_head) {
                    throw new Error(`Validation failed for member: Missing required fields.`);
                }
                const memberAge = calculateAge(memberData.date_of_birth);
                
                if (memberAge >= 15 && (memberData.email || memberData.password)) {
                    if (!memberData.email || !memberData.password) {
                        throw new Error(`Validation failed for member ${memberData.first_name}: Email and password are both required if creating an account.`);
                    }
                    const memberEmail = memberData.email.toLowerCase();
                    if (processedEmails.has(memberEmail)) {
                        throw new Error(`Conflict: The email address '${memberEmail}' is duplicated in this request.`);
                    }
                    const existingMemberEmail = await residentsCollection.findOne({ email: memberEmail }, { session });
                    if (existingMemberEmail) {
                        throw new Error(`Conflict: The email address '${memberEmail}' is already in use.`);
                    }
                    processedEmails.add(memberEmail);
                } else {
                    memberData.email = null;
                    memberData.password = null;
                }
                
                const newMemberDoc = createResidentDocument(memberData, false, headData);

                // --- UPDATE: Set created_at and initialize date_approved ---
                newMemberDoc.created_at = new Date();
                newMemberDoc.updated_at = new Date();
                newMemberDoc.date_approved = null;
                // --- END UPDATE ---

                const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
                createdMemberIds.push(memberInsertResult.insertedId);
            }

            // --- Step 3: Link Members to the Head ---
            if (createdMemberIds.length > 0) {
                await residentsCollection.updateOne(
                    { _id: insertedHeadId },
                    { $set: { household_member_ids: createdMemberIds, updated_at: new Date() } },
                    { session }
                );
                newHouseholdHead.household_member_ids = createdMemberIds;
            }
        });

        await createAuditLog({
          userId: newHouseholdHead._id.toString(),
          userName: `${newHouseholdHead.first_name} ${newHouseholdHead.last_name}`,
          description: `Resident '${newHouseholdHead.first_name} ${newHouseholdHead.last_name}' created a new household.`,
          action: "REGISTER",
          entityType: "Resident",
          entityId: newHouseholdHead._id.toString(),
        }, req)

        res.status(201).json({
            message: 'Household registered successfully! All accounts are pending approval.',
            resident: newHouseholdHead
        });

    } catch (error) {
        console.error("Error during household registration transaction:", error);
        if (error.message.startsWith('Conflict:')) {
            return res.status(409).json({ error: 'Email Conflict', message: error.message });
        }
        if (error.message.startsWith('Validation failed:')) {
             return res.status(400).json({ error: 'Validation Error', message: error.message });
        }
        res.status(500).json({ error: 'Server Error', message: 'Could not complete registration.' });
    } finally {
        await session.endSession();
    }
});


// PATCH /api/residents/:id/status - APPROVE/DECLINE/DEACTIVATE A RESIDENT
// This route is CRUCIAL for the date_approved logic to work.
app.patch('/api/residents/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // reason is optional, for declines

        if (!status) {
            return res.status(400).json({ message: 'Status is required.' });
        }

        const dab = await db();
        const residentsCollection = dab.collection('residents');

        const updateData = {
            status: status,
            updated_at: new Date()
        };

        // --- UPDATE: Set date_approved only when status is 'Approved' ---
        if (status === 'Approved') {
            updateData.date_approved = new Date();
        }

        const result = await residentsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Resident not found.' });
        }

        // You can add audit logging and notifications here
        // await createAuditLog(...)

        res.status(200).json({ message: `Resident status updated to ${status}.` });

    } catch (error) {
        console.error("Error updating resident status:", error);
        res.status(500).json({ error: 'Server Error', message: 'Could not update resident status.' });
    }
});


// GET ALL RESIDENTS (GET) - Updated to handle all dashboard filters
app.get('/api/residents', async (req, res) => {
  try {
    const {
      search, status, is_voter, is_senior, is_pwd,
      occupation, minAge, maxAge, sortBy, sortOrder
    } = req.query;
    
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const filters = [];

    if (status) filters.push({ status: status });
    if (is_voter === 'true') filters.push({ is_registered_voter: true });
    if (is_pwd === 'true') filters.push({ is_pwd: true });
    if (is_senior === 'true') filters.push({ is_senior_citizen: true });
    if (occupation) filters.push({ occupation_status: occupation });
    
    if (minAge || maxAge) {
      const ageFilter = {};
      const now = new Date();
      if (maxAge) {
        const minBirthDate = new Date(now.getFullYear() - parseInt(maxAge) - 1, now.getMonth(), now.getDate());
        ageFilter.$gte = minBirthDate;
      }
      if (minAge) {
        const maxBirthDate = new Date(now.getFullYear() - parseInt(minAge), now.getMonth(), now.getDate());
        ageFilter.$lte = maxBirthDate;
      }
      filters.push({ date_of_birth: ageFilter });
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filters.push({
        $or: [
          { first_name: searchRegex }, { middle_name: searchRegex }, { last_name: searchRegex },
          { email: searchRegex }, { contact_number: searchRegex }, { address_street: searchRegex },
          { address_subdivision_zone: searchRegex }, { precinct_number: searchRegex },
        ],
      });
    }

    const finalQuery = filters.length > 0 ? { $and: filters } : {};

    // --- UPDATE: Use 'created_at' for 'date_added' sorting ---
    let sortOptions = { created_at: -1 }; 
    if (sortBy) {
        // Map frontend key 'date_added' to backend field 'created_at'
        const sortKey = sortBy === 'date_added' ? 'created_at' : sortBy;
        sortOptions = { [sortKey]: sortOrder === 'desc' ? -1 : 1 };
    }
    
    // --- UPDATE: Renamed 'created_at' to 'date_added' and included 'date_approved' ---
    const projection = {
        first_name: 1, middle_name: 1, last_name: 1, sex: 1,
        date_of_birth: 1, is_household_head: 1, address_house_number: 1,
        address_street: 1, address_subdivision_zone: 1, contact_number: 1,
        email: 1, status: 1, _id: 1,
        date_added: "$created_at", // Rename field in output
        date_approved: 1
    };
    
    const residents = await residentsCollection
      .find(finalQuery)
      .project(projection)
      .sort(sortOptions)
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    const totalResidents = await residentsCollection.countDocuments(finalQuery);

    res.json({
      residents: residents,
      total: totalResidents,
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(totalResidents / itemsPerPage),
    });

  } catch (error) {
    console.error("Error fetching residents:", error);
    res.status(500).json({ error: "Failed to fetch residents", message: error.message });
  }
});


// GET ALL APPROVED RESIDENTS (GET) - Updated to handle all dashboard filters
app.get('/api/residents/approved', async (req, res) => {
  try {
    const {
      search, is_voter, is_senior, is_pwd,
      occupation, minAge, maxAge, sortBy, sortOrder
    } = req.query;
    
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const residentsCollection = dab.collection('residents');

    // --- UPDATE: Simplified filter to only get Approved residents ---
    const filters = [ { status: 'Approved' } ];

    if (is_voter === 'true') filters.push({ is_registered_voter: true });
    if (is_pwd === 'true') filters.push({ is_pwd: true });
    if (is_senior === 'true') filters.push({ is_senior_citizen: true });
    if (occupation) filters.push({ occupation_status: occupation });
    
    if (minAge || maxAge) {
      const ageFilter = {};
      const now = new Date();
      if (maxAge) {
        const minBirthDate = new Date(now.getFullYear() - parseInt(maxAge) - 1, now.getMonth(), now.getDate());
        ageFilter.$gte = minBirthDate;
      }
      if (minAge) {
        const maxBirthDate = new Date(now.getFullYear() - parseInt(minAge), now.getMonth(), now.getDate());
        ageFilter.$lte = maxBirthDate;
      }
      filters.push({ date_of_birth: ageFilter });
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filters.push({
        $or: [
          { first_name: searchRegex }, { middle_name: searchRegex }, { last_name: searchRegex },
          { email: searchRegex }, { contact_number: searchRegex }, { address_street: searchRegex },
          { address_subdivision_zone: searchRegex }, { precinct_number: searchRegex },
        ],
      });
    }

    const finalQuery = { $and: filters };

    // --- UPDATE: Default sort is by 'date_approved' for this endpoint ---
    let sortOptions = { date_approved: -1 };
    if (sortBy) {
        const sortKey = sortBy === 'date_added' ? 'created_at' : sortBy;
        sortOptions = { [sortKey]: sortOrder === 'desc' ? -1 : 1 };
    }
    
    // --- UPDATE: Renamed 'created_at' to 'date_added' and included 'date_approved' ---
    const projection = {
        first_name: 1, middle_name: 1, last_name: 1, sex: 1,
        date_of_birth: 1, is_household_head: 1, address_house_number: 1,
        address_street: 1, address_subdivision_zone: 1, contact_number: 1,
        email: 1, status: 1, _id: 1,
        date_added: "$created_at", // Rename field in output
        date_approved: 1
    };
    
    const residents = await residentsCollection
      .find(finalQuery)
      .project(projection)
      .sort(sortOptions)
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    const totalResidents = await residentsCollection.countDocuments(finalQuery);

    res.json({
      residents: residents,
      total: totalResidents,
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
      .project({ // Select all fields for the search results
        _id: 1,
        first_name: 1,
        last_name: 1,
        middle_name: 1,
        email: 1, // Useful for display or contact
        sex: 1,   // Often useful for context in search results
        contact_number: 1,
        address_house_number: 1,
        address_street: 1,
        address_subdivision_zone: 1,
        address_city_municipality: 1,
        is_household_head: 1,
        created_at: 1,
        status: 1, // ADDED status
        date_of_birth: 1, // To allow age calculation on frontend if needed, or just for info
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
  try {
    const resident = await residentsCollection.findOne(
      { _id: new ObjectId(req.params.id) },
      // Ensure sensitive data is not returned unless necessary for a specific admin view
      { projection: { password_hash: 0, login_attempts: 0, account_locked_until: 0 } }
    );
    if (!resident) {
      return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
    }
    res.json({resident});
  } catch (error) {
    console.error("Error fetching resident by ID:", error);
    if (error.name === 'BSONTypeError') {
        return res.status(400).json({ error: 'Invalid ID format' });
    }
    res.status(500).json({ error: 'Server error', message: 'Could not fetch resident.' });
  }
});

// GET /api/residents/:residentId/household-details
// Fetches a resident's details and their household information (if any)

app.get('/api/residents/:residentId/household-details', async (req, res) => {
  const { residentId } = req.params;
  
  if (!ObjectId.isValid(residentId)) {
    return res.status(400).json({ error: 'Invalid Resident ID format' });
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const residentObjectId = new ObjectId(residentId);

  try {
    // 1. Fetch the primary resident's details
    const primaryResident = await residentsCollection.findOne({ _id: residentObjectId }, { projection: { password_hash: 0 } });

    if (!primaryResident) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    let householdHeadDetails = null;
    let householdMembersDetails = [];
    let isMemberOfAnotherHousehold = false;

    if (primaryResident.is_household_head) {
      // --- CASE 1: The resident IS a household head ---
      householdHeadDetails = primaryResident; // They are the head
      if (primaryResident.household_member_ids && primaryResident.household_member_ids.length > 0) {
        const memberObjectIds = primaryResident.household_member_ids
            .filter(id => ObjectId.isValid(id))
            .map(id => new ObjectId(id));
        
        if (memberObjectIds.length > 0) {
            householdMembersDetails = await residentsCollection.find({ _id: { $in: memberObjectIds } })
                .project({ password_hash: 0, voter_registration_proof_data: 0, residency_proof_data: 0 }) // Exclude sensitive/large fields
                .toArray();
        }
      }
    } else {
      // --- CASE 2: The resident is NOT a household head ---
      // Check if they are a member of another household
      const householdWhereTheyAreMember = await residentsCollection.findOne(
        { household_member_ids: residentObjectId }, // Find a head who has this resident as a member
        { projection: { password_hash: 0 } }
      );

      if (householdWhereTheyAreMember) {
        isMemberOfAnotherHousehold = true;
        householdHeadDetails = householdWhereTheyAreMember; // This is the head of their household

        // Fetch all members of that household (including the primary resident themselves)
        let allMemberIdsInThisHousehold = [residentObjectId]; // Start with the primary resident
        if (householdWhereTheyAreMember.household_member_ids && householdWhereTheyAreMember.household_member_ids.length > 0) {
            // Add other members, ensuring no duplicates and converting to ObjectId
             householdWhereTheyAreMember.household_member_ids.forEach(id => {
                if (ObjectId.isValid(id)) {
                    const memberObjId = new ObjectId(id);
                    if (!allMemberIdsInThisHousehold.some(existingId => existingId.equals(memberObjId))) {
                        allMemberIdsInThisHousehold.push(memberObjId);
                    }
                }
            });
        }
         // Also add the head of this household to the member list for display consistency if needed, or handle separately
        // For simplicity, we'll just list members as defined by the head's household_member_ids, plus the primary resident if they are a member.
        // The head's details are already in householdHeadDetails.

        const memberObjectIdsToFetch = householdWhereTheyAreMember.household_member_ids
            .filter(id => ObjectId.isValid(id))
            .map(id => new ObjectId(id));
        
        // Add the primary resident ID to this list if not already (should be covered by above)
        // but ensure the query includes them if they are part of this household
        const finalMemberIds = Array.from(new Set([...memberObjectIdsToFetch, residentObjectId].map(id => id.toString()))).map(idStr => new ObjectId(idStr));


        if (finalMemberIds.length > 0) {
             householdMembersDetails = await residentsCollection.find({ _id: { $in: finalMemberIds } })
                .project({ password_hash: 0, voter_registration_proof_data: 0, residency_proof_data: 0 })
                .toArray();
        }

      } else {
        // --- CASE 3: Not a head, and not a member of any other household ---
        // householdHeadDetails remains null, householdMembersDetails remains empty
      }
    }

    res.json({
      resident: primaryResident,
      isHouseholdHead: primaryResident.is_household_head,
      isMemberOfAnotherHousehold: isMemberOfAnotherHousehold,
      householdHead: householdHeadDetails, // Details of the head (either self or another)
      householdMembers: householdMembersDetails, // List of member details
    });

  } catch (error) {
    console.error("Error fetching resident household details:", error);
    res.status(500).json({ error: "Failed to fetch household details", message: error.message });
  }
});

// DELETE RESIDENT BY ID (DELETE)
app.delete("/api/residents/:id", async (req, res) => {
  const dab = await db()
  const residentsCollection = dab.collection("residents")

  try {
    // Get resident details before deletion for audit log
    const resident = await residentsCollection.findOne({ _id: new ObjectId(req.params.id) })
    if (!resident) {
      return res.status(404).json({ error: "Resident not found" })
    }

    await residentsCollection.deleteOne({ _id: new ObjectId(req.params.id) })

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Resident '${resident.first_name} ${resident.last_name}' was deleted from the system.`,
      action: "DELETE",
      entityType: "Resident",
      entityId: req.params.id,
    }, req)
    // --- END AUDIT LOG ---

    res.json({ message: "Resident deleted successfully" })
  } catch (error) {
    console.error("Error deleting resident:", error)
    res.status(500).json({ error: "Server error", message: "Could not delete resident." })
  }
})

// UPDATE RESIDENT BY ID (PUT) - REVISED
app.put('/api/residents/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const updatePayload = req.body;
  const updateFields = {};

  const currentResident = await residentsCollection.findOne({ _id: new ObjectId(id) });
  if (!currentResident) {
    return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
  }
  
  // REVISION: Expanded field lists to match the new form
  const simpleFields = [
    'first_name', 'middle_name', 'last_name', 'sex', 'civil_status',
    'occupation_status', 'citizenship', 'contact_number',
    'address_house_number', 'address_street', 'address_subdivision_zone'
  ];
  const booleanFields = ['is_voter', 'is_pwd', 'is_senior_citizen', 'is_household_head'];
  const numericFields = ['years_at_current_address'];
  
  // Process simple text fields
  simpleFields.forEach(field => {
    if (updatePayload.hasOwnProperty(field)) {
      updateFields[field] = updatePayload[field];
    }
  });

  // Process booleans
  booleanFields.forEach(field => {
    if (updatePayload.hasOwnProperty(field)) {
      updateFields[field] = Boolean(updatePayload[field]);
    }
  });

  // Process numbers
  numericFields.forEach(field => {
     if (updatePayload.hasOwnProperty(field)) {
        updateFields[field] = updatePayload[field] ? parseInt(updatePayload[field], 10) : null;
    }
  });

  // Process Date of Birth and Age
  if (updatePayload.hasOwnProperty('date_of_birth')) {
    updateFields.date_of_birth = updatePayload.date_of_birth ? new Date(updatePayload.date_of_birth) : null;
    updateFields.age = calculateAge(updateFields.date_of_birth);
  }

  // Process Email with uniqueness check
  if (updatePayload.hasOwnProperty('email')) {
    const newEmail = String(updatePayload.email).trim().toLowerCase();
    if (currentResident.email !== newEmail) {
        const existingEmailUser = await residentsCollection.findOne({ email: newEmail, _id: { $ne: new ObjectId(id) } });
        if (existingEmailUser) {
            return res.status(409).json({ error: 'Conflict', message: 'Email address already in use.' });
        }
    }
    updateFields.email = newEmail;
  }

  // REVISION: Process Voter, PWD, and Senior info with cleanup logic
  // Voter
  if (updatePayload.is_voter === true) {
      if (updatePayload.hasOwnProperty('voter_id_number')) updateFields.voter_id_number = updatePayload.voter_id_number;
      if (updatePayload.hasOwnProperty('voter_registration_proof_base64')) updateFields.voter_registration_proof_base64 = updatePayload.voter_registration_proof_base64;
  } else if (updatePayload.is_voter === false) {
      updateFields.voter_id_number = null;
      updateFields.voter_registration_proof_base64 = null;
  }

  // PWD
  if (updatePayload.is_pwd === true) {
      if (updatePayload.hasOwnProperty('pwd_id')) updateFields.pwd_id = updatePayload.pwd_id;
      if (updatePayload.hasOwnProperty('pwd_card_base64')) updateFields.pwd_card_base64 = updatePayload.pwd_card_base64;
  } else if (updatePayload.is_pwd === false) {
      updateFields.pwd_id = null;
      updateFields.pwd_card_base64 = null;
  }

  // Senior Citizen
  if (updatePayload.is_senior_citizen === true) {
      if (updatePayload.hasOwnProperty('senior_citizen_id')) updateFields.senior_citizen_id = updatePayload.senior_citizen_id;
      if (updatePayload.hasOwnProperty('senior_citizen_card_base64')) updateFields.senior_citizen_card_base64 = updatePayload.senior_citizen_card_base64;
  } else if (updatePayload.is_senior_citizen === false) {
      updateFields.senior_citizen_id = null;
      updateFields.senior_citizen_card_base64 = null;
  }
  
  // REVISION: Process Proof of Residency file
  if (updatePayload.hasOwnProperty('proof_of_residency_base64')) {
    updateFields.proof_of_residency_base64 = updatePayload.proof_of_residency_base64;
  }

  // Household Membership
  if (updatePayload.hasOwnProperty('is_household_head')) {
    if (updatePayload.is_household_head === false) {
      updateFields.household_member_ids = []; // Clear members if no longer a head
    } else if (updatePayload.hasOwnProperty('household_member_ids')) {
      updateFields.household_member_ids = Array.isArray(updatePayload.household_member_ids)
        ? updatePayload.household_member_ids.filter(memId => ObjectId.isValid(memId)).map(memId => new ObjectId(memId))
        : [];
    }
  }

  // Password Change
  if (updatePayload.newPassword) {
    if (String(updatePayload.newPassword).length < 6) {
        return res.status(400).json({ error: 'Validation failed', message: 'New password must be at least 6 characters.' });
    }
    // WARNING: MD5 IS INSECURE. REPLACE WITH BCRYPT
    updateFields.password_hash = md5(updatePayload.newPassword);
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(200).json({ message: 'No changes detected.', resident: currentResident });
  }

  updateFields.updated_at = new Date();

  try {
    await residentsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    const updatedResident = await residentsCollection.findOne({ _id: new ObjectId(id) }, { projection: { password_hash: 0 }});
    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Resident '${updatedResident.first_name} ${updatedResident.last_name}' information was updated.`,
      action: "UPDATE",
      entityType: "Resident",
      entityId: id,
    }, req)
    // --- END AUDIT LOG ---
    res.json({ message: 'Resident updated successfully', resident: updatedResident });
  } catch (error) {
    console.error('Error updating resident:', error);
    res.status(500).json({ error: 'Database error', message: 'Could not update resident.' });
  }
});

// NEW Endpoint: PATCH /api/residents/:id/status (Quick Status Update)
app.patch('/api/residents/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, voter_registration_proof_data } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Validation failed', message: 'Status is required.' });
  }

  const allowedStatusValues = ['Approved', 'Declined', 'Deactivated', 'Pending'];
  if (!allowedStatusValues.includes(status)) {
    return res.status(400).json({ error: 'Validation failed', message: `Invalid status value. Allowed: ${allowedStatusValues.join(', ')}` });
  }

  // Add validation for reason if declining
  if (status === 'Declined' && (!reason || reason.trim() === '')) {
      return res.status(400).json({ error: 'A reason is required to decline an account.' });
  }

  const dab = await db();
  const residentsCollection = dab.collection('residents');

  


  try {
    const updateFields = { status: status, updated_at: new Date() };
    if (status === 'Declined' && reason) {
        // You might want to store this in a specific field, e.g., 'status_reason'
        updateFields.status_reason = reason;
    }

    
  

  if (status === 'Approved') {
      // get currentResident
      const currentResident = await residentsCollection.findOne({ _id: new ObjectId(id) });
      if (!currentResident) {
          return res.status(404).json({ error: 'Resident not found.' });
      }

      // If approving, loop through and approve household members as well
      if (updateFields.status === 'Approved') {
          const householdMembers = await residentsCollection.find({ _id: { $in: currentResident.household_member_ids } }).toArray();
          await Promise.all(householdMembers.map(member => residentsCollection.updateOne({ _id: member._id }, { $set: { status: 'Approved', updated_at: new Date() } })));
      }
  }

    const result = await residentsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Resident not found.' });

     await createAuditLog({
        // TODO: Get acting admin's name from auth middleware
        description: `Status for resident with ID ${id} was changed to '${status}'.`,
        action: 'STATUS_CHANGE',
        entityType: 'Resident',
        entityId: id
      }, req);
    // --- END AUDIT LOG ---

    // Create notification if status changed to 'Approved'
    if (status === 'Approved') {
        const notificationData = {
            name: 'Account Approved',
            content: `Your account has been approved. You can now log in and access community features.`,
            by: 'System',
            type: 'Notification',
            target_audience: 'SpecificResidents',
            recipient_ids: [id],
            date: new Date()
        };
        await createNotification(dab, notificationData);
    }
    
    if (result.modifiedCount === 0 && result.upsertedCount === 0) { // Check if actual modification happened
        // Fetch current status to confirm it's indeed the same
        const currentResident = await residentsCollection.findOne({_id: new ObjectId(id)}, {projection: {status: 1}});
        if(currentResident && currentResident.status === status) {
            return res.json({ message: `Resident status is already ${status}.`, statusChanged: false });
        }
    }


    const name = `Resident status updated to ${status}`; // Notification name
    const content = `Resident status updated to ${status}.`; // Notification content
    const by = 'System Administrator'; // Notification creator (Admin/System)
    const type = 'Notification'; // Notification type
    const target_audience = 'SpecificResidents'; // Notification target audience
    const recipient_ids = [id]; // Notification recipient IDs
    const date = new Date();

    try {
      const dab = await db();
      const createdNotification = await createNotification(dab, {
          name, content, by, type, target_audience, recipient_ids, date // Pass all to helper
      });

      if (!createdNotification) {
          // createNotification returns null on internal failure or if no recipients for specific targeting
          return res.status(400).json({ error: 'Notification creation failed', message: 'Could not create notification. Check targeting or server logs.' });
      }
    } catch (error) {
        console.error('Error creating notification:', error);
        return res.status(500).json({ error: 'Server error', message: 'Could not create notification.' });
    }

    res.json({ message: `Resident status updated to ${status} successfully.`, statusChanged: true });
  } catch (error) {
    console.error("Error updating resident status:", error);
    res.status(500).json({ error: 'Server error', message: 'Could not update resident status.' });
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

  // --- ADD AUDIT LOG HERE ---
  await createAuditLog({
    description: `New document request created: ${req.body.type} for resident ID ${req.body.residentId}.`,
    action: "CREATE",
    entityType: "Document",
    entityId: result.insertedId.toString(),
  }, req)
  // --- END AUDIT LOG ---
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
app.delete("/api/documents/:id", async (req, res) => {
  const dab = await db()
  const documentsCollection = dab.collection("documents")

  try {
    // Get document details before deletion for audit log
    const document = await documentsCollection.findOne({ _id: new ObjectId(req.params.id) })
    if (!document) {
      return res.status(404).json({ error: "Document not found" })
    }

    await documentsCollection.deleteOne({ _id: new ObjectId(req.params.id) })

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Document request deleted: ${document.type} (ID: ${req.params.id}).`,
      action: "DELETE",
      entityType: "Document",
      entityId: req.params.id,
    }, req)
    // --- END AUDIT LOG ---

    res.json({ message: "Document deleted successfully" })
  } catch (error) {
    console.error("Error deleting document:", error)
    res.status(500).json({ error: "Server error", message: "Could not delete document." })
  }
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

  // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Document request updated: ${currentDocument.type} (ID: ${req.params.id}).`,
      action: "UPDATE",
      entityType: "Document",
      entityId: req.params.id,
    }, req)
    // --- END AUDIT LOG ---

  res.json({ message: 'Document updated successfully' });
});


// ====================== ADMINS CRUD =========================== //

// ADD NEW ADMIN (POST)
app.post('/api/admins', async (req, res) => {
  const dab = await db();

  // UPDATED: Validation rules for new name fields
  const nameRegex = /^[a-zA-Z\s'-]+$/; // Allows letters, spaces, hyphens, apostrophes
  const requiredFields = [
    { field: 'firstname', value: req.body.firstname, format: nameRegex },
    { field: 'lastname', value: req.body.lastname, format: nameRegex },
    { field: 'username', value: req.body.username, format: /^[a-zA-Z0-9._%+-]+$/ },
    { field: 'password', value: req.body.password, format: /^.{6,}$/ }, // Simplified to min 6 chars
    { field: 'email', value: req.body.email, format: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
    { field: 'role', value: req.body.role, format: /^(Super Admin|Admin)$/ },
  ];

  const errors = requiredFields
    .filter(({ value, format }) => !value || !format.test(value))
    .map(({ field }) => ({ field, message: `${field} is missing or has an invalid format` }));

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid field format: ' + errors.map(e => e.message).join(', ') });
  }

  // UPDATED: Construct the new admin object and create a 'fullname' field
  const { firstname, middlename, lastname, username, email, password, contact_number, role } = req.body;
  
  // Creates a full name, intelligently skipping the middle name if it's empty
  const name = [firstname, middlename, lastname].filter(Boolean).join(' ');

  const newAdminData = {
    firstname,
    middlename: middlename || '', // Ensure middlename is stored as an empty string if null/undefined
    lastname,
    name, // Store the combined fullname for easy searching/display
    username,
    email,
    contact_number,
    role,
    password: md5(password),
    createdAt: new Date(),
  };

  const adminsCollection = dab.collection('admins');

  // Check for Super Admin existence
  if (role === 'Super Admin') {
    const existingTechAdmin = await adminsCollection.findOne({ role: 'Super Admin' });
    if (existingTechAdmin) {
      return res.status(409).json({ error: 'A Super Admin account already exists.' });
    }
  }
  
  // Insert the new structured data
  await adminsCollection.insertOne(newAdminData);

  // --- ADD AUDIT LOG HERE ---
  await createAuditLog({
    description: `A new admin account was created: '${username}'.`,
    action: 'CREATE',
    entityType: 'Admin'
  }, req);
  // --- END AUDIT LOG ---

  res.json({ message: 'Admin added successfully' });
});

// GET ALL ADMINS (GET)
app.get('/api/admins', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

  const dab = await db();
  const adminsCollection = dab.collection('admins');

  // UPDATED: Search query to use the new 'fullname' field
  const query = search ? {
    $or: [
      { username: { $regex: new RegExp(search, 'i') } },
      { name: { $regex: new RegExp(search, 'i') } }, // Search the combined name field
      { email: { $regex: new RegExp(search, 'i') } },
      { role: { $regex: new RegExp(search, 'i') } },
    ]
  } : {};

  // UPDATED: Projection to return the new name fields
  const admins = await adminsCollection.find(query, {
    projection: {
      username: 1,
      firstname: 1,
      middlename: 1,
      lastname: 1,
      name: 1, // Return the full name for display
      email: 1,
      role: 1,
      _id: 1,
      createdAt: 1,
      action: { $ifNull: ["$action", ""] }
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
});

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
  res.json({ admin });
});

/// DELETE ADMIN BY ID (DELETE)
app.delete("/api/admins/:id", async (req, res) => {
  const dab = await db()
  const adminsCollection = dab.collection("admins")

  try {
    // Get admin details before deletion for audit log
    const admin = await adminsCollection.findOne({ _id: new ObjectId(req.params.id) })
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" })
    }

    // check if admin is Technical Admin
    if (admin.role === "Technical Admin") {
      return res.status(200).json({ error: "Cannot delete Technical Admin account." })
    }

    await adminsCollection.deleteOne({ _id: new ObjectId(req.params.id) })

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Admin account deleted: '${admin.username}' with role '${admin.role}'.`,
      action: "DELETE",
      entityType: "Admin",
      entityId: req.params.id,
    }, req)
    // --- END AUDIT LOG ---

    res.json({ message: "Admin deleted successfully" })
  } catch (error) {
    console.error("Error deleting admin:", error)
    res.status(500).json({ error: "Server error", message: "Could not delete admin." })
  }
})

// UPDATE ADMIN BY ID (PUT)
app.put('/api/admins/:id', async (req, res) => {
  const dab = await db();
  const adminsCollection = dab.collection('admins');

  // Fetch the current admin data first for the audit log
  const currentAdmin = await adminsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!currentAdmin) {
    return res.status(404).json({ error: 'Admin not found.' });
  }

  // --- VALIDATION ---
  const { firstname, lastname, username, email, password, contact_number } = req.body;
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  const requiredFields = [
    { field: 'firstname', value: firstname, format: nameRegex },
    { field: 'lastname', value: lastname, format: nameRegex },
    { field: 'username', value: username, format: /^[a-zA-Z0-9._%+-]+$/ },
    { field: 'email', value: email, format: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
  ];

  if (password) {
    // Only validate password if it's being changed
    requiredFields.push({ field: 'password', value: password, format: /^.{6,}$/ });
  }

  const errors = requiredFields
    .filter(({ value, format }) => !value || !format.test(value))
    .map(({ field }) => ({ field, message: `${field} is missing or invalid` }));

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid field format: ' + errors.map(e => e.message).join(', ') });
  }
  // --- END VALIDATION ---


  // --- DATA PREPARATION ---
  // Build the update object safely
  const setData = {
    firstname,
    middlename: req.body.middlename || '', // Ensure middlename is at least an empty string
    lastname,
    username,
    email,
    contact_number,
    // Generate the fullname for consistent searching
    name: [firstname, req.body.middlename, lastname].filter(Boolean).join(' '),
  };

  // Only add the password to the update object if it was provided
  if (password) {
    setData.password = md5(password);
  }
  // --- END DATA PREPARATION ---


  await adminsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: setData }
  );

  // --- ADD AUDIT LOG HERE ---
  // Using the fetched 'currentAdmin' makes the log more descriptive
  await createAuditLog({
    description: `Admin account updated: '${currentAdmin.username}' information was modified.`,
    action: "UPDATE",
    entityType: "Admin",
    entityId: req.params.id,
  }, req);
  // --- END AUDIT LOG ---

  res.json({ message: 'Admin updated successfully' });
});



// ====================== BARANGAY OFFICIALS CRUD (REVISED & COMPLETE) =========================== //

// --- Define Core Business Rules ---
const ALLOWED_DESIGNATIONS = ['Punong Barangay', 'Barangay Secretary', 'Treasurer', 'Sangguniang Barangay Member', 'SK Chairperson', 'SK Member'];
const UNIQUE_ROLES = ['Punong Barangay', 'Barangay Secretary', 'Treasurer', 'SK Chairperson'];

// 1. CREATE: POST /api/barangay-officials
app.post('/api/barangay-officials', async (req, res) => {
    const dab = await db();
    const collection = dab.collection('barangay_officials');
    const { 
        first_name, last_name, middle_name, sex, civil_status, religion, term_in_present_position,
        position, term_start, term_end, status, photo_url,
        // New Fields
        birth_date, birth_place, residence_address, residence_telephone_no, mobile_number,
        barangay_hall_telephone_number, email_address, highest_educational_attainment,
        educational_attainment_details, educational_attainment_status, occupation,
        honorarium, beneficiaries
    } = req.body;

    // --- Validation ---
    if (!first_name || !last_name || !position || !term_start || !status || !sex || !civil_status || !term_in_present_position || !birth_date || !residence_address || !mobile_number) {
        return res.status(200).json({ error: 'Missing required fields. Please complete all required information.' });
    }
    if (!ALLOWED_DESIGNATIONS.includes(position)) {
        return res.status(200).json({ error: 'Invalid position provided.' });
    }

    // --- Uniqueness Check ---
    if (status === 'Active' && UNIQUE_ROLES.includes(position)) {
        const existingOfficial = await collection.findOne({ position, status: 'Active' });
        if (existingOfficial) {
            return res.status(200).json({ error: `An active '${position}' already exists.` });
        }
    }

    try {
        const newOfficialDoc = {
            first_name: String(first_name).trim(),
            last_name: String(last_name).trim(),
            middle_name: middle_name ? String(middle_name).trim() : null,
            sex: String(sex),
            civil_status: String(civil_status),
            religion: religion ? String(religion).trim() : null,
            term_in_present_position: String(term_in_present_position),
            position: String(position),
            term_start: new Date(term_start),
            term_end: term_end ? new Date(term_end) : null,
            status: String(status),
            photo_url: photo_url || null,
            // New Fields
            birth_date: birth_date ? new Date(birth_date) : null,
            birth_place: birth_place ? String(birth_place).trim() : null,
            residence_address: residence_address ? String(residence_address).trim() : null,
            residence_telephone_no: residence_telephone_no ? String(residence_telephone_no).trim() : null,
            mobile_number: mobile_number ? String(mobile_number).trim() : null,
            barangay_hall_telephone_number: barangay_hall_telephone_number ? String(barangay_hall_telephone_number).trim() : null,
            email_address: email_address ? String(email_address).trim().toLowerCase() : null,
            highest_educational_attainment: highest_educational_attainment || null,
            educational_attainment_details: educational_attainment_details ? String(educational_attainment_details).trim() : null,
            educational_attainment_status: educational_attainment_status || null,
            occupation: occupation ? String(occupation).trim() : null,
            honorarium: honorarium || null,
            beneficiaries: beneficiaries || [],
            created_at: new Date(),
            updated_at: new Date(),
        };

        const result = await collection.insertOne(newOfficialDoc);

        await createAuditLog({
          description: `New barangay official added: '${first_name} ${last_name}' as ${position}.`,
          action: "CREATE",
          entityType: "BarangayOfficial",
          entityId: result.insertedId.toString(),
        }, req)

        res.status(201).json({ message: 'Barangay Official added successfully', officialId: result.insertedId });
    } catch (error) {
        console.error("Error adding official:", error);
        res.status(500).json({ error: 'Failed to add official.' });
    }
});

// 2. READ (List): GET /api/barangay-officials (No changes needed)
app.get('/api/barangay-officials', async (req, res) => {
    const search = req.query.search || '';
    const positionFilter = req.query.position || '';
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const collection = dab.collection('barangay_officials');
    
    let query = {};
    const andConditions = [];

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        andConditions.push({
            $or: [
                { first_name: { $regex: searchRegex } },
                { last_name: { $regex: searchRegex } },
                { middle_name: { $regex: searchRegex } },
                { position: { $regex: searchRegex } },
                { email_address: { $regex: searchRegex } },
            ]
        });
    }

    if (positionFilter) {
        andConditions.push({ position: positionFilter });
    }
    
    if (andConditions.length > 0) {
        query = { $and: andConditions };
    }

    try {
        const officialsFromDb = await collection.find(query)
            .sort({ position: 1, last_name: 1, first_name: 1 })
            .skip(skip)
            .limit(itemsPerPage)
            .toArray();
            
        // ✅ START: Automatic status update logic for the list
        const currentDate = new Date();
        const officials = officialsFromDb.map(official => {
            // Check if term dates exist and are valid
            if (official.term_start && official.term_end) {
                const termStart = new Date(official.term_start);
                const termEnd = new Date(official.term_end);

                // If current date is within the term, set status to "active"
                if (currentDate >= termStart && currentDate <= termEnd) {
                    // Return a new object with the updated status
                    return { ...official, status: 'Active' };
                } else {
                    return { ...official, status: 'Inactive' };

                }
            }
            // Otherwise, return the official as-is
            return official;
        });
        // ✅ END: Automatic status update logic

        const totalOfficials = await collection.countDocuments(query);

        res.json({ officials, totalOfficials });
    } catch (error) {
        console.error("Error fetching officials:", error);
        res.status(500).json({ error: 'Failed to fetch officials.' });
    }
});

// 3. READ (Single): GET /api/barangay-officials/:id
app.get('/api/barangay-officials/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format.' });
    const dab = await db();
    const collection = dab.collection('barangay_officials');
    try {
        const official = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!official) return res.status(404).json({ error: 'Official not found.' });

        // ✅ START: Automatic status update logic for a single record
        const currentDate = new Date();
        // Check if term dates exist and are valid
        if (official.term_start && official.term_end) {
            const termStart = new Date(official.term_start);
            const termEnd = new Date(official.term_end);

            // If current date is within the term, set status to "active"
            if (currentDate >= termStart && currentDate <= termEnd) {
                official.status = 'Active';
            } else {
                official.status = 'Inactive';
            }
        }
        // ✅ END: Automatic status update logic

        res.json({ official });
    } catch (error) {
        console.error("Error fetching official by ID:", error);
        res.status(500).json({ error: 'Failed to fetch official.' });
    }
});

// 4. UPDATE: PUT /api/barangay-officials/:id
app.put('/api/barangay-officials/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
    
    const dab = await db();
    const collection = dab.collection('barangay_officials');
    const { 
        first_name, last_name, middle_name, sex, civil_status, religion, term_in_present_position,
        position, term_start, term_end, status, photo_url,
        // New Fields
        birth_date, birth_place, residence_address, residence_telephone_no, mobile_number,
        barangay_hall_telephone_number, email_address, highest_educational_attainment,
        educational_attainment_details, educational_attainment_status, occupation,
        honorarium, beneficiaries
    } = req.body;

    // --- Validation ---
    if (!first_name || !last_name || !position || !term_start || !status || !sex || !civil_status || !term_in_present_position || !birth_date || !residence_address || !mobile_number) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!ALLOWED_DESIGNATIONS.includes(position)) {
        return res.status(400).json({ error: 'Invalid position provided.' });
    }

    // --- Uniqueness Check ---
    if (status === 'Active' && UNIQUE_ROLES.includes(position)) {
        const existingOfficial = await collection.findOne({
            position: position,
            status: 'Active',
            _id: { $ne: new ObjectId(id) }
        });
        if (existingOfficial) {
            return res.status(200).json({ error: `An active '${position}' already exists.` });
        }
    }

    try {
        const currentOfficial = await collection.findOne({ _id: new ObjectId(id) });
        if (!currentOfficial) {
          return res.status(404).json({ error: "Official not found." });
        }

        const updateFields = {
            first_name: String(first_name).trim(),
            last_name: String(last_name).trim(),
            middle_name: middle_name ? String(middle_name).trim() : null,
            sex: String(sex),
            civil_status: String(civil_status),
            religion: religion ? String(religion).trim() : null,
            term_in_present_position: String(term_in_present_position),
            position: String(position),
            term_start: new Date(term_start),
            term_end: term_end ? new Date(term_end) : null,
            status: String(status),
            photo_url: photo_url || null,
            // New Fields
            birth_date: birth_date ? new Date(birth_date) : null,
            birth_place: birth_place ? String(birth_place).trim() : null,
            residence_address: residence_address ? String(residence_address).trim() : null,
            residence_telephone_no: residence_telephone_no ? String(residence_telephone_no).trim() : null,
            mobile_number: mobile_number ? String(mobile_number).trim() : null,
            barangay_hall_telephone_number: barangay_hall_telephone_number ? String(barangay_hall_telephone_number).trim() : null,
            email_address: email_address ? String(email_address).trim().toLowerCase() : null,
            highest_educational_attainment: highest_educational_attainment || null,
            educational_attainment_details: educational_attainment_details ? String(educational_attainment_details).trim() : null,
            educational_attainment_status: educational_attainment_status || null,
            occupation: occupation ? String(occupation).trim() : null,
            honorarium: honorarium || null,
            beneficiaries: beneficiaries || [],
            updated_at: new Date(),
        };

        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Official not found.' });

        await createAuditLog({
          description: `Barangay official updated: '${currentOfficial.first_name} ${currentOfficial.last_name}' (${currentOfficial.position}).`,
          action: "UPDATE",
          entityType: "BarangayOfficial",
          entityId: id,
        }, req)

        res.json({ message: 'Barangay Official updated successfully' });
    } catch (error) {
        console.error("Error updating official:", error);
        res.status(500).json({ error: 'Failed to update official.' });
    }
});

// 5. DELETE: DELETE /api/barangay-officials/:id (No changes needed)
app.delete("/api/barangay-officials/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid ID format." })

  const dab = await db()
  const collection = dab.collection("barangay_officials")

  try {
    const official = await collection.findOne({ _id: new ObjectId(req.params.id) })
    if (!official) {
      return res.status(404).json({ error: "Official not found." })
    }

    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) })
    if (result.deletedCount === 0) return res.status(404).json({ error: "Official not found." })

    await createAuditLog({
      description: `Barangay official deleted: '${official.first_name} ${official.last_name}' (${official.position}).`,
      action: "DELETE",
      entityType: "BarangayOfficial",
      entityId: req.params.id,
    }, req)

    res.json({ message: "Official deleted successfully" })
  } catch (error) {
    console.error("Error deleting official:", error)
    res.status(500).json({ error: "Failed to delete official." })
  }
});



// =================== NOTIFICATION HELPER (UPDATED) =========================== //

/**
 * Creates and saves a new notification.
 * @param {Db} dbInstance - The MongoDB Db instance.
 * @param {object} notificationData - Data for the new notification.
 * @param {string} notificationData.name - Title of the notification.
 * @param {string} notificationData.content - Body of the notification.
 * @param {string} notificationData.by - Creator (Admin/System).
 * @param {string} notificationData.type - Type: 'News', 'Events', 'Alert'.
 * @param {string} [notificationData.target_audience='SpecificResidents'] - 'All', 'SpecificResidents', 'PWDResidents', 'SeniorResidents', 'VotersResidents'.
 * @param {string[]} [notificationData.recipient_ids=[]] - Array of resident ObjectId strings.
 * @param {Date|string} [notificationData.date=new Date()] - Effective date of notification.
 * @returns {Promise<object|null>} The created notification document or null on failure.
 */
async function createNotification(dbInstance, notificationData) {
  const notificationsCollection = dbInstance.collection('notifications');
  const residentsCollection = dbInstance.collection('residents');

  const {
    name,
    content,
    by,
    type,
    target_audience = 'SpecificResidents',
    recipient_ids = [],
    date = new Date(),
  } = notificationData;

  // Basic validation for core fields
  if (!name || !content || !by || !type) {
    console.error("Notification creation failed in helper: Missing required fields (name, content, by, type). Data:", notificationData);
    return null;
  }
  if (!['News', 'Events', 'Alert'].includes(type)) {
    console.error("Notification creation failed in helper: Invalid type. Data:", notificationData);
    return null;
  }

  let finalRecipientObjects = [];

  if (target_audience === 'SpecificResidents') {
    if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      finalRecipientObjects = recipient_ids
        .filter(id => ObjectId.isValid(id))
        .map(idStr => ({
          resident_id: new ObjectId(idStr),
          status: 'pending',
          read_at: null,
        }));
    }
  } else {
    // Handle group-based targeting ('All', 'PWDResidents', etc.)
    let recipientQuery = { status: 'Approved' }; // Base query: always target approved residents

    switch (target_audience) {
      case 'All':
        // The base query is already correct for 'All'
        break;
      case 'PWDResidents':
        // Correct based on your schema
        recipientQuery.is_pwd = true;
        break;
      case 'SeniorResidents':
        // Correct based on your schema
        recipientQuery.is_senior_citizen = true;
        break;
      case 'VotersResidents':
        // Correct based on your schema
        recipientQuery.is_voter = true;
        break;
      default:
        console.error(`Notification creation failed: Unknown target_audience '${target_audience}'.`);
        return null;
    }

    try {
      const targetResidents = await residentsCollection.find(recipientQuery, { projection: { _id: 1 } }).toArray();
      finalRecipientObjects = targetResidents.map(r => ({
        resident_id: r._id,
        status: 'pending',
        read_at: null,
      }));
    } catch (e) {
      console.error(`Error fetching residents for '${target_audience}' audience notification:`, e);
      return null;
    }
  }

  // Do not create a notification if 'SpecificResidents' was chosen but no one was selected.
  // For group targets, it's okay to create a notification for 0 people (e.g., no PWDs registered yet).
  if (target_audience === 'SpecificResidents' && finalRecipientObjects.length === 0) {
    console.warn("Attempted to create notification with 'SpecificResidents' targeting, but no valid recipients were provided.");
    return null;
  }


  const newNotificationDoc = {
    name: String(name).trim(),
    content: String(content).trim(),
    date: new Date(date),
    by: String(by).trim(),
    type: String(type).trim(),
    recipients: finalRecipientObjects,
    target_audience: target_audience,
    created_at: new Date(),
    updated_at: new Date(),
  };

  try {
    const result = await notificationsCollection.insertOne(newNotificationDoc);
    console.log(`Notification "${name}" (ID: ${result.insertedId}) created for ${finalRecipientObjects.length} recipient(s).`);
    return { _id: result.insertedId, ...newNotificationDoc };
  } catch (error) {
    console.error("Error inserting notification document in helper:", error);
    return null;
  }
}



// =================== NOTIFICATION MODULE CRUD =========================== //

// GET ALL NOTIFICATIONS (Admin view - with search, pagination, and type filter)
app.get('/api/notifications', async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const typeFilter = req.query.type || '';
  const skip = (page - 1) * itemsPerPage;

  try {
    const dab = await db();
    const notificationsCollection = dab.collection('notifications');

    let query = {};
    const andConditions = [];

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      andConditions.push({
        $or: [
          { name: { $regex: searchRegex } },
          { content: { $regex: searchRegex } },
          { by: { $regex: searchRegex } },
          { type: { $regex: searchRegex } },
        ],
      });
    }

    // UPDATED: Aligned types with frontend
    if (typeFilter && ['News', 'Events', 'Alert'].includes(typeFilter)) {
      andConditions.push({ type: typeFilter });
    }

    if (andConditions.length > 0) {
      query = { $and: andConditions };
    }

    const notifications = await notificationsCollection
      .find(query)
      .sort({ date: -1 })
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

// GET NOTIFICATIONS FOR A SPECIFIC RESIDENT (Resident's view)
app.get('/api/residents/:residentId/notifications', async (req, res) => {
    const { residentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;
    // Example filter: const readStatusFilter = req.query.status; // e.g., "read", "unread"

    if (!ObjectId.isValid(residentId)) {
        return res.status(400).json({ error: "Invalid resident ID format." });
    }
    const residentObjectId = new ObjectId(residentId);

    try {
        const dab = await db();
        const notificationsCollection = dab.collection('notifications');

        const matchConditions = { "recipients.resident_id": residentObjectId };
        // if (readStatusFilter === 'read') {
        //     matchConditions["recipients.status"] = 'read';
        // } else if (readStatusFilter === 'unread') {
        //     matchConditions["recipients.status"] = { $ne: 'read' };
        // }


        const notificationsPipeline = [
            { $match: matchConditions }, // Filter notifications for the specific resident
            { $sort: { date: -1 } }, // Sort by notification effective date
            { $skip: skip },
            { $limit: itemsPerPage },
            { // Unwind the recipients array to process each recipient subdocument
                $unwind: "$recipients"
            },
            { // Match again to filter only the specific resident's subdocument from the unwound array
                $match: { "recipients.resident_id": residentObjectId }
            },
            { // Project the desired fields, including the specific recipient's status
                $project: {
                    _id: 1, name: 1, content: 1, date: 1, by: 1, type: 1,
                    created_at: 1, target_audience: 1, // Keep target_audience if useful for client
                    read_status: "$recipients.status", // Resident's specific read status
                    read_at: "$recipients.read_at"     // Resident's specific read timestamp
                }
            }
        ];

        const notifications = await notificationsCollection.aggregate(notificationsPipeline).toArray();
        
        // For total count, we only need to match the resident ID in the array
        const totalNotifications = await notificationsCollection.countDocuments({ "recipients.resident_id": residentObjectId });


        res.json({
            notifications: notifications,
            total: totalNotifications,
            page: page,
            itemsPerPage: itemsPerPage,
            totalPages: Math.ceil(totalNotifications / itemsPerPage),
        });

    } catch (error) {
        console.error("Error fetching resident notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications for resident.", message: error.message });
    }
});


// MARK NOTIFICATION(S) AS READ/UNREAD FOR A RESIDENT
// Can mark single or multiple notifications as read
app.patch('/api/residents/:residentId/notifications/mark-read', async (req, res) => {
    const { residentId } = req.params;
    const { notification_ids, read = true } = req.body; // `read` defaults to true, can send false to mark unread

    if (!ObjectId.isValid(residentId)) {
        return res.status(400).json({ error: "Invalid resident ID format." });
    }
    if (!Array.isArray(notification_ids) || notification_ids.some(id => !ObjectId.isValid(id))) {
        return res.status(400).json({ error: "Invalid notification_ids format. Expected an array of valid ObjectIds." });
    }

    const residentObjectId = new ObjectId(residentId);
    const notificationObjectIds = notification_ids.map(id => new ObjectId(id));
    const newStatus = read ? "read" : "pending"; // Or "unread" if you prefer
    const readAtTimestamp = read ? new Date() : null;

    try {
        const dab = await db();
        const notificationsCollection = dab.collection('notifications');

        const result = await notificationsCollection.updateMany(
            { _id: { $in: notificationObjectIds }, "recipients.resident_id": residentObjectId },
            {
                $set: {
                    "recipients.$.status": newStatus,
                    "recipients.$.read_at": readAtTimestamp,
                    "updated_at": new Date() // Update the main notification doc's timestamp
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "No matching notifications found for this resident." });
        }
        
        res.json({ message: `Successfully updated read status for ${result.modifiedCount} of ${result.matchedCount} matched notifications.`, modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error("Error marking notifications as read/unread:", error);
        res.status(500).json({ error: "Failed to update notification read status.", message: error.message });
    }
});


// ADD NEW NOTIFICATION (POST) - UPDATED
app.post('/api/notifications', async (req, res) => {
  const {
    name, content, date, by,
    type,
    target_audience = 'SpecificResidents',
    recipient_ids = []
  } = req.body;

  // Updated Validation
  if (!name || !content || !by || !type) {
    return res.status(400).json({ error: 'Validation failed', message: 'Name, content, by (creator), and type are required.' });
  }

  const VALID_TYPES = ['News', 'Events', 'Alert'];
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Validation failed', message: 'Invalid notification type.' });
  }

  const VALID_AUDIENCES = ['All', 'SpecificResidents', 'PWDResidents', 'SeniorResidents', 'VotersResidents'];
  if (!VALID_AUDIENCES.includes(target_audience)) {
    return res.status(400).json({ error: 'Validation failed', message: `Invalid target_audience. Must be one of: ${VALID_AUDIENCES.join(', ')}` });
  }

  if (target_audience === 'SpecificResidents') {
    if (!Array.isArray(recipient_ids) || recipient_ids.some(id => !ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'Validation failed', message: 'For specific residents, recipient_ids must be an array of valid ObjectIds.' });
    }
    if (recipient_ids.length === 0) {
      return res.status(400).json({ error: 'Validation failed', message: 'For specific residents, recipient_ids array cannot be empty.' });
    }
  }

  try {
    const dab = await db();
    const createdNotification = await createNotification(dab, {
        name, content, by, type, target_audience, recipient_ids, date
    });

    if (!createdNotification) {
        return res.status(400).json({ error: 'Notification creation failed', message: 'Could not create notification. Check targeting or server logs.' });
    }

    await createAuditLog({
      description: `New notification created: '${name}' targeting '${target_audience}'.`,
      action: "CREATE",
      entityType: "Notification",
      entityId: createdNotification._id.toString(),
    }, req)

    res.status(201).json({ message: 'Notification added successfully', notification: createdNotification });
  } catch (error) {
    console.error("Error in POST /api/notifications endpoint:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not add notification.' });
  }
});



// GET NOTIFICATION BY ID (GET)
app.get('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const dab = await db();
    const notificationsCollection = dab.collection('notifications');
    // When fetching a single notification (e.g., for an admin to view/edit),
    // we typically return the full recipients list.
    // If this is for a resident viewing a specific notification, use the resident-specific endpoint.
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

// UPDATE NOTIFICATION BY ID (PUT) - UPDATED
app.put('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, content, date, by,
    type, target_audience, recipient_ids
  } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const dab = await db();
  const notificationsCollection = dab.collection('notifications');
  const residentsCollection = dab.collection('residents');

  try {
    const currentNotification = await notificationsCollection.findOne({ _id: new ObjectId(id) });
    if (!currentNotification) {
      return res.status(404).json({ error: 'Not found', message: 'Notification not found.' });
    }
    
    const updateFields = {};

    // Standard field validation and updates
    if (name !== undefined) updateFields.name = String(name).trim();
    if (content !== undefined) updateFields.content = String(content).trim();
    if (date !== undefined) updateFields.date = new Date(date);
    if (by !== undefined) updateFields.by = String(by).trim();

    // Updated validation for type and target_audience
    if (type !== undefined) {
      if (!['News', 'Events', 'Alert'].includes(type)) return res.status(400).json({ error: 'Validation failed', message: 'Invalid notification type.' });
      updateFields.type = type;
    }

    const needsRecipientRebuild = target_audience !== undefined || recipient_ids !== undefined;
    
    if (needsRecipientRebuild) {
      const effectiveTargetAudience = target_audience !== undefined ? target_audience : currentNotification.target_audience;
      const effectiveRecipientIds = recipient_ids !== undefined ? recipient_ids : currentNotification.recipients.map(r => r.resident_id.toString());
      
      const VALID_AUDIENCES = ['All', 'SpecificResidents', 'PWDResidents', 'SeniorResidents', 'VotersResidents'];
      if (!VALID_AUDIENCES.includes(effectiveTargetAudience)) {
          return res.status(400).json({ error: 'Validation failed', message: 'Invalid target_audience.' });
      }
      updateFields.target_audience = effectiveTargetAudience;
      
      let finalRecipientObjects = [];
      if (effectiveTargetAudience === 'SpecificResidents') {
          finalRecipientObjects = effectiveRecipientIds
              .filter(rid => ObjectId.isValid(rid))
              .map(ridStr => ({ resident_id: new ObjectId(ridStr), status: 'pending', read_at: null }));
      } else {
          let recipientQuery = { status: 'Approved' };
          switch (effectiveTargetAudience) {
              case 'All': break;
              case 'PWDResidents': recipientQuery.is_pwd = true; break;
              case 'SeniorResidents': recipientQuery.is_senior_citizen = true; break;
              case 'VotersResidents': recipientQuery.is_voter = true; break;
          }
          const targetResidents = await residentsCollection.find(recipientQuery, { projection: { _id: 1 } }).toArray();
          finalRecipientObjects = targetResidents.map(r => ({ resident_id: r._id, status: 'pending', read_at: null }));
      }
      updateFields.recipients = finalRecipientObjects;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.json({ message: 'No changes provided to update.', notification: currentNotification });
    }
    
    updateFields.updated_at = new Date();

    await notificationsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    const updatedNotification = await notificationsCollection.findOne({ _id: new ObjectId(id) });

    await createAuditLog({
      description: `Notification updated: '${currentNotification.name}' was modified.`,
      action: "UPDATE",
      entityType: "Notification",
      entityId: id,
    }, req);

    res.json({ message: 'Notification updated successfully', notification: updatedNotification });

  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not update notification.' });
  }
});

// DELETE NOTIFICATION BY ID (DELETE)
app.delete("/api/notifications/:id", async (req, res) => {
  const { id } = req.params

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid ID format" })
  }

  try {
    const dab = await db()
    const notificationsCollection = dab.collection("notifications")

    // Get notification details before deletion for audit log
    const notification = await notificationsCollection.findOne({ _id: new ObjectId(id) })
    if (!notification) {
      return res.status(404).json({ error: "Not found", message: "Notification not found." })
    }

    const result = await notificationsCollection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Not found", message: "Notification not found." })
    }

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Notification deleted: '${notification.name}' was removed from the system.`,
      action: "DELETE",
      entityType: "Notification",
      entityId: id,
    }, req)
    // --- END AUDIT LOG ---

    res.json({ message: "Notification deleted successfully" })
  } catch (error) {
    console.error("Error deleting notification:", error)
    res.status(500).json({ error: "Database error", message: "Could not delete notification." })
  }
})










// ====================== BORROW ASSETS CRUD (REVISED for Resident Borrower) =========================== //
// Ensure ObjectId is imported: import { ObjectId } from 'mongodb';
// --- Status Constants ---
const STATUS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned',
  OVERDUE: 'Overdue',
  LOST: 'Lost',
  DAMAGED: 'Damaged',
  RESOLVED: 'Resolved',
};

// --- Helper Function Placeholder for Notifications ---
// async function createNotification(db, { name, content, by, type, target_audience, recipient_ids }) {
//   // Your implementation here...
// }


// 1. ADD NEW BORROW ASSET REQUEST (POST)
app.post('/api/borrowed-assets', async (req, res) => {
  const dab = await db();
  const {
    borrower_resident_id,
    borrower_display_name,
    borrow_datetime,
    borrowed_from_personnel,
    item_borrowed,
    quantity_borrowed,
    expected_return_date,
    notes,
  } = req.body;

  // Validation
  if (!borrower_resident_id || !borrower_display_name || !item_borrowed || !quantity_borrowed || !expected_return_date) {
    return res.status(200).json({ error: 'Missing required fields. Borrower, item, quantity, and expected return date are required.' });
  }
  if (!ObjectId.isValid(borrower_resident_id)) {
    return res.status(200).json({ error: 'Invalid borrower resident ID format.' });
  }
  const requestedQuantity = parseInt(quantity_borrowed, 10);
  if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      return res.status(200).json({ error: 'Quantity must be a number greater than 0.' });
  }

  try {
    const assetsCollection = dab.collection('assets');
    const borrowedAssetsCollection = dab.collection('borrowed_assets');

    // Server-side Stock Validation
    const masterAsset = await assetsCollection.findOne({ name: item_borrowed });
    if (!masterAsset) {
      return res.status(404).json({ error: 'Item not found in inventory.' });
    }
    const borrowedCountResult = await borrowedAssetsCollection.aggregate([
        { $match: { item_borrowed: item_borrowed, status: { $in: [STATUS.APPROVED, STATUS.OVERDUE] } } },
        { $group: { _id: "$item_borrowed", total_borrowed: { $sum: "$quantity_borrowed" } } }
    ]).toArray();
    const totalBorrowed = borrowedCountResult.length > 0 ? borrowedCountResult[0].total_borrowed : 0;
    console.log(totalBorrowed);
    const availableStock = masterAsset.total_quantity - totalBorrowed;
    if (requestedQuantity > availableStock) {
      return res.status(200).json({
          error: 'Insufficient stock.',
          message: `Cannot borrow ${requestedQuantity}. Only ${availableStock} ${item_borrowed} are available.`
      });
    }

    // Create New Transaction Document
    const newTransaction = {
      borrower_resident_id: new ObjectId(borrower_resident_id),
      borrower_display_name: String(borrower_display_name).trim(),
      borrow_datetime: new Date(borrow_datetime),
      borrowed_from_personnel: String(borrowed_from_personnel).trim(),
      item_borrowed: String(item_borrowed),
      quantity_borrowed: requestedQuantity,
      expected_return_date: new Date(expected_return_date),
      status: STATUS.PENDING,
      date_returned: null,
      return_proof_image_url: null,
      return_condition_notes: null,
      notes: notes ? String(notes).trim() : null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await borrowedAssetsCollection.insertOne(newTransaction);
    const insertedDoc = await borrowedAssetsCollection.findOne({ _id: result.insertedId });

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      userId: new ObjectId(borrower_resident_id),
      userName: borrower_display_name,
      description: `New asset borrowing request: ${borrower_display_name} requested to borrow ${requestedQuantity} ${item_borrowed}.`,
      action: "CREATE",
      entityType: "BorrowedAsset",
      entityId: result.insertedId.toString(),
    }, req)
    // --- END AUDIT LOG ---

    res.status(201).json({ message: 'Asset borrowing request submitted successfully', transaction: insertedDoc });

  } catch (error) {
    console.error('Error adding borrow asset transaction:', error);
    res.status(500).json({ error: 'Error processing your request: ' + error.message });
  }
});

// 2. GET ALL BORROWED ASSETS (GET) - Revised for all filters
app.get('/api/borrowed-assets', async (req, res) => {
  try {
    // --- 1. Extract and Sanitize All Potential Query Parameters ---
    const {
      search,
      status, // Can be a comma-separated string like "Borrowed,Overdue"
      sortBy,
      sortOrder,
      byResidentId = '',
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const collection = dab.collection('borrowed_assets');

    // Assuming STATUS constants are defined elsewhere, e.g., const STATUS = { APPROVED: 'Approved', OVERDUE: 'Overdue' }
    // If not, define them here or replace with string literals.
    const STATUS = { APPROVED: 'Approved', OVERDUE: 'Overdue' };

    // --- 2. Build the MongoDB Match Conditions Dynamically ---
    const matchConditions = [];

    // Add search filter if it exists
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      matchConditions.push({
        $or: [
          { item_borrowed: searchRegex },
          { "borrower_details.first_name": searchRegex },
          { "borrower_details.last_name": searchRegex },
          // Also search against the calculated 'current_status'
          { "current_status": searchRegex },
        ]
      });
    }

    if (byResidentId && byResidentId.trim() !== '') {
      matchConditions.push({ borrower_resident_id: new ObjectId(byResidentId) });
    }

    // Add status filter if it exists. Handles single or multiple statuses.
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      // Filter against 'current_status' to correctly find 'Overdue' items
      matchConditions.push({ current_status: { $in: statusArray } });
    }

    // Combine all filters into a single $match stage
    const mainMatchStage = matchConditions.length > 0 ? { $and: matchConditions } : {};
    
    // --- 3. Define Sorting Stage Dynamically ---
    let sortStage = { $sort: { borrow_datetime: -1 } }; // Default sort
    if (sortBy) {
        sortStage = { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } };
    }

    // --- 4. Construct the Main Aggregation Pipeline ---
    // The order of these stages is important.
    const aggregationPipeline = [
      // Stage 1: Get borrower details
      { $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array' } },
      { $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } } },
      // Stage 2: Calculate the real-time status (e.g., check for Overdue)
      { $addFields: { current_status: { $cond: { if: { $and: [ { $eq: ["$status", STATUS.APPROVED] }, { $lt: ["$expected_return_date", new Date()] } ] }, then: STATUS.OVERDUE, else: "$status" } } } },
      // Stage 3: Apply all the combined filters
      { $match: mainMatchStage },
      // Stage 4: Shape the data for the frontend
      {
        $project: {
          _id: 1, borrow_datetime: 1, item_borrowed: 1, quantity_borrowed: 1, expected_return_date: 1, date_returned: 1,
          status: "$current_status", // Use the calculated status
          borrower_name: { $concat: [ { $ifNull: ["$borrower_details.first_name", "Unknown"] }, " ", { $ifNull: ["$borrower_details.last_name", "Resident"] } ] },
        }
      },
      // Stage 5 & 6: Sort and Paginate
      sortStage,
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const transactions = await collection.aggregate(aggregationPipeline).toArray();

    // --- 5. Get Accurate Total Count for Pagination ---
    // This pipeline must mirror the filtering logic of the main one.
    const countPipeline = [
      ...aggregationPipeline.slice(0, 4), // Re-use all stages before pagination and sorting
      { $count: 'total' }
    ];

    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalTransactions = countResult.length > 0 ? countResult[0].total : 0;

    // --- 6. Send Response ---
    res.json({
      transactions,
      total: totalTransactions,
      page,
      itemsPerPage,
      totalPages: Math.ceil(totalTransactions / itemsPerPage)
    });

  } catch (error) {
    console.error('Error fetching borrowed assets:', error);
    res.status(500).json({ error: "Failed to fetch transactions." });
  }
});

// 3. GET TRANSACTION BY ID (GET)
app.get('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  try {
    const aggregationPipeline = [
      { $match: { _id: new ObjectId(id) } },
      { $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array' } },
      { $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } } },
      { $addFields: { current_status: { $cond: { if: { $and: [ { $eq: ["$status", STATUS.APPROVED] }, { $lt: ["$expected_return_date", new Date()] } ] }, then: STATUS.OVERDUE, else: "$status" } } } },
      {
        $project: {
          borrow_datetime: 1, borrowed_from_personnel: 1, item_borrowed: 1, quantity_borrowed: 1, status: "$current_status", expected_return_date: 1,
          date_returned: 1, return_proof_image_url: 1, return_condition_notes: 1, notes: 1, created_at: 1, updated_at: 1, borrower_resident_id: 1,
          borrower_display_name: 1, borrower_details: 1,
        }
      }
    ];
    const result = await collection.aggregate(aggregationPipeline).toArray();
    if (result.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ transaction: result[0] });
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    res.status(500).json({ error: "Failed to fetch transaction." });
  }
});


// 4. UPDATE TRANSACTION DETAILS (PUT)
app.put('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  const { borrow_datetime, item_borrowed, quantity_borrowed, expected_return_date, notes } = req.body;
  
  const updateFields = {};
  if (borrow_datetime !== undefined) updateFields.borrow_datetime = new Date(borrow_datetime);
  if (item_borrowed !== undefined) updateFields.item_borrowed = String(item_borrowed);
  if (quantity_borrowed !== undefined) updateFields.quantity_borrowed = parseInt(quantity_borrowed, 10);
  if (expected_return_date !== undefined) updateFields.expected_return_date = new Date(expected_return_date);
  if (notes !== undefined) updateFields.notes = notes ? String(notes).trim() : null;
  if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No fields to update provided.' });
  
  updateFields.updated_at = new Date();

  try {
    const transactionToUpdate = await collection.findOne({ _id: new ObjectId(id) });
    if (!transactionToUpdate) return res.status(404).json({ error: 'Transaction not found.' });

    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Transaction not found during update.' });
    
    const updatedDoc = await collection.findOne({ _id: new ObjectId(id) });

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Details updated for borrowed asset transaction: '${updatedDoc.item_borrowed}' (Borrower: ${updatedDoc.borrower_display_name}).`,
      action: "UPDATE",
      entityType: "BorrowTransaction",
      entityId: id,
      // In a real app, you'd get the admin's name from auth context
      // userName: req.user.name 
    }, req);
    // --- END AUDIT LOG ---

    res.json({ message: 'Transaction updated successfully', transaction: updatedDoc });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Error updating transaction: ' + error.message });
  }
});

// 5. UPDATE TRANSACTION STATUS (PATCH)
app.patch('/api/borrowed-assets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status: newStatus, notes } = req.body;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid Transaction ID format' });
  if (!newStatus || !Object.values(STATUS).includes(newStatus)) return res.status(400).json({ error: `Status is required and must be one of: ${Object.values(STATUS).join(', ')}` });
  
  try {
    const dab = await db();
    const borrowedAssetsCollection = dab.collection('borrowed_assets');
    const residentsCollection = dab.collection('residents');

    const transaction = await borrowedAssetsCollection.findOne({ _id: new ObjectId(id) });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    const oldStatus = transaction.status;

    // Only proceed if status is actually changing
    if (oldStatus === newStatus) {
        return res.json({ message: `Transaction status is already '${newStatus}'.`, transaction: transaction });
    }

    const updateFields = { status: newStatus, updated_at: new Date() };
    if (notes) {
      updateFields.notes = transaction.notes ? `${transaction.notes}\n\n--- STATUS UPDATE ---\n[${new Date().toLocaleString()}] ${notes}` : `[${new Date().toLocaleString()}] ${notes}`;
    }
    
    // Deactivate/Reactivate resident if item is lost/damaged or resolved
    if ([STATUS.LOST, STATUS.DAMAGED].includes(newStatus)) {
        await residentsCollection.updateOne({ _id: transaction.borrower_resident_id }, { $set: { 'account_status': 'Deactivated' } });
    } else if (newStatus === STATUS.RESOLVED && [STATUS.LOST, STATUS.DAMAGED].includes(transaction.status)) {
        await residentsCollection.updateOne({ _id: transaction.borrower_resident_id }, { $set: { 'account_status': 'Active' } });
    }

    await borrowedAssetsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Status for borrowed item '${transaction.item_borrowed}' (Borrower: ${transaction.borrower_display_name}) changed from '${oldStatus}' to '${newStatus}'.`,
      action: "STATUS_CHANGE",
      entityType: "BorrowTransaction",
      entityId: id,
    }, req);
    // --- END AUDIT LOG ---


    // Create notification for all status changes
    await createNotification(dab, {
      name: `Status of borrowed item '${transaction.item_borrowed}' changed`,
      content: `The status of the borrowed item '${transaction.item_borrowed}' has been updated to '${newStatus}'.`,
      by: 'System',
      type: 'Notification',
      target_audience: 'Specific Residents',
      recipient_ids: [transaction.borrower_resident_id],
    });

    const updatedTransaction = await borrowedAssetsCollection.findOne({ _id: new ObjectId(id) });
    res.json({ message: `Transaction status updated to '${newStatus}' successfully.`, transaction: updatedTransaction });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({ error: 'Database error during status update.' });
  }
});

// 6. PROCESS ITEM RETURN (PATCH) - UPDATED FOR BASE64
app.patch('/api/borrowed-assets/:id/return', async (req, res) => {
    const { id } = req.params;
    const { return_proof_image_base64, return_condition_notes } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid transaction ID format.' });

    try {
        const dab = await db();
        const collection = dab.collection('borrowed_assets');

        const transaction = await collection.findOne({ _id: new ObjectId(id) });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
        if (![STATUS.APPROVED, STATUS.OVERDUE].includes(transaction.status)) {
          return res.status(400).json({ error: `Cannot return an item with status '${transaction.status}'.` });
        }

        const updateFields = {
            status: STATUS.RETURNED,
            date_returned: new Date(),
            return_proof_image_url: return_proof_image_base64 || null,
            return_condition_notes: return_condition_notes || "Item returned.",
            updated_at: new Date(),
        };

        await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        
        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
          description: `Item returned for transaction: ${transaction.quantity_borrowed}x '${transaction.item_borrowed}' by ${transaction.borrower_display_name}.`,
          action: "STATUS_CHANGE",
          entityType: "BorrowTransaction",
          entityId: id,
        }, req);
        // --- END AUDIT LOG ---

        const updatedTransaction = await collection.findOne({ _id: new ObjectId(id) });
        res.json({ message: 'Item marked as returned successfully.', transaction: updatedTransaction });
    } catch (error) {
        console.error('Error marking item as returned:', error);
        res.status(500).json({ error: 'Failed to update transaction.' });
    }
});


// 7. DELETE TRANSACTION (DELETE)
app.delete('/api/borrowed-assets/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID format." })
  }

  try {
    const dab = await db()
    const collection = dab.collection("borrowed_assets")

    // Get transaction details before deletion for audit log
    const transaction = await collection.findOne({ _id: new ObjectId(req.params.id) })
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found." })
    }

    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) })
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Transaction not found." })
    }

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Borrowed asset transaction deleted: ${transaction.item_borrowed} (ID: ${req.params.id}).`,
      action: "DELETE",
      entityType: "BorrowedAsset",
      entityId: req.params.id,
    }, req)
    // --- END AUDIT LOG ---

    res.json({ message: "Transaction deleted successfully" })
  } catch (error) {
    console.error("Error deleting borrowed asset:", error)
    res.status(500).json({ error: "Failed to delete transaction." })
  }
});




// ================================ INVENTORY MANAGEMENT ================================ //

// NEW ENDPOINT: GET /api/assets/inventory-status
app.get('/api/assets/inventory-status', async (req, res) => {
    try {
        const dab = await db();
        const assetsCollection = dab.collection('assets');
        const borrowedAssetsCollection = dab.collection('borrowed_assets');

        // Step 1: Get the master list of all assets and their total quantities
        const allAssets = await assetsCollection.find({}, { projection: { name: 1, total_quantity: 1, _id: 0 } }).toArray();

        // Step 2: Get the count of all items currently borrowed (not Returned, Lost, or Damaged)
        const borrowedCounts = await borrowedAssetsCollection.aggregate([
            { $match: { status: { $in: ['Borrowed', 'Overdue'] } } },
            { $group: { _id: "$item_borrowed", borrowed: { $sum: "$quantity_borrowed" } } }
        ]).toArray();

        // Step 3: Combine the data
        const inventoryStatus = allAssets.map(asset => {
            const borrowedInfo = borrowedCounts.find(b => b._id === asset.name);
            const borrowedCount = borrowedInfo ? borrowedInfo.borrowed : 0;
            return {
                name: asset.name,
                total: asset.total_quantity,
                borrowed: borrowedCount,
                available: asset.total_quantity - borrowedCount,
            };
        });

        res.json({ inventory: inventoryStatus });

    } catch (error) {
        console.error("Error fetching inventory status:", error);
        res.status(500).json({ error: "Failed to fetch inventory status" });
    }
});



// ================================== ASSETS CRUD (WITH FULL AUDIT LOG) ================================== //

// 1. CREATE: POST /api/assets
app.post('/api/assets', async (req, res) => {
    const dab = await db();
    const collection = dab.collection('assets');
    const { name, total_quantity, category } = req.body;

    // --- Validation ---
    if (!name || total_quantity === undefined || !category) {
        return res.status(400).json({ error: 'Missing required fields: name, total_quantity, and category are required.' });
    }
    const quantity = parseInt(total_quantity, 10);
    if (isNaN(quantity) || quantity < 0) {
        return res.status(400).json({ error: 'Total quantity must be a non-negative number.' });
    }

    try {
        const newAssetDoc = {
            name: String(name).trim(),
            total_quantity: quantity,
            category: String(category).trim(),
            created_at: new Date(),
            updated_at: new Date(),
        };

        const result = await collection.insertOne(newAssetDoc);

        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `Added new asset to inventory: ${quantity}x '${name}' (Category: ${category}).`,
            action: "CREATE",
            entityType: "Asset",
            entityId: result.insertedId.toString(),
            // userName: req.user.name // In a real app with auth
        }, req);
        // --- END AUDIT LOG ---

        res.status(201).json({ message: 'Asset added successfully', assetId: result.insertedId });
    } catch (error) {
        console.error("Error adding asset:", error);
        res.status(500).json({ error: 'Failed to add asset.' });
    }
});

// 2. READ (List): GET /api/assets
app.get('/api/assets', async (req, res) => {
    const search = req.query.search || '';
    const categoryFilter = req.query.category || '';
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const collection = dab.collection('assets');
    
    let query = {};
    const andConditions = [];

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        andConditions.push({
            $or: [
                { name: { $regex: searchRegex } },
                { category: { $regex: searchRegex } },
            ]
        });
    }

    if (categoryFilter) {
        andConditions.push({ category: categoryFilter });
    }
    
    if (andConditions.length > 0) {
        query = { $and: andConditions };
    }

    try {
        const assets = await collection.find(query)
            .sort({ name: 1 })
            .skip(skip)
            .limit(itemsPerPage)
            .toArray();
            
        const totalAssets = await collection.countDocuments(query);

        res.json({ assets, totalAssets });
    } catch (error) {
        console.error("Error fetching assets:", error);
        res.status(500).json({ error: 'Failed to fetch assets.' });
    }
});

/**
 * =================================================================
 *  FETCH UNIQUE CATEGORIES: GET /api/assets/categories
 * =================================================================
 * @description Retrieves a sorted list of all unique, non-empty asset categories.
 * This is used to dynamically populate the filter options on the frontend.
 */
app.get('/api/assets/categories', async (req, res) => {
    try {
        const dab = await db(); // Establishes database connection
        const collection = dab.collection('assets');

        // Use the .distinct() method to get all unique values for the 'category' field.
        // This is the most efficient way to perform this query.
        const categories = await collection.distinct('category');

        // Clean the data:
        // 1. Filter out any null, undefined, or empty string values.
        // 2. Sort the categories alphabetically for a consistent UI experience.
        const cleanedAndSortedCategories = categories
            .filter(category => category) // Removes falsy values (null, "", undefined)
            .sort(); // Sorts alphabetically

        // Send the structured response expected by the frontend
        res.status(200).json({ categories: cleanedAndSortedCategories });

    } catch (error) {
        console.error("Error fetching asset categories:", error);
        res.status(500).json({ error: 'Failed to fetch asset categories.' });
    }
});

// 3. READ (Single): GET /api/assets/:id
app.get('/api/assets/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format.' });
    const dab = await db();
    const collection = dab.collection('assets');
    try {
        const asset = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!asset) return res.status(404).json({ error: 'Asset not found.' });
        res.json({ asset });
    } catch (error) {
        console.error("Error fetching asset by ID:", error);
        res.status(500).json({ error: 'Failed to fetch asset.' });
    }
});

// 4. UPDATE: PUT /api/assets/:id
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
    
    const dab = await db();
    const collection = dab.collection('assets');
    const { name, total_quantity, category } = req.body;

    // --- Validation ---
    if (!name || total_quantity === undefined || !category) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    const quantity = parseInt(total_quantity, 10);
    if (isNaN(quantity) || quantity < 0) {
        return res.status(400).json({ error: 'Total quantity must be a non-negative number.' });
    }

    try {
        const assetToUpdate = await collection.findOne({ _id: new ObjectId(id) });
        if (!assetToUpdate) return res.status(404).json({ error: 'Asset not found.' });

        const updateFields = {
            name: String(name).trim(),
            total_quantity: quantity,
            category: String(category).trim(),
            updated_at: new Date(),
        };

        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Asset not found during update.' });
        
        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `Updated asset details for '${assetToUpdate.name}'.`,
            action: "UPDATE",
            entityType: "Asset",
            entityId: id,
            // userName: req.user.name 
        }, req);
        // --- END AUDIT LOG ---

        res.json({ message: 'Asset updated successfully' });
    } catch (error) {
        console.error("Error updating asset:", error);
        res.status(500).json({ error: 'Failed to update asset.' });
    }
});

// 5. DELETE: DELETE /api/assets/:id
app.delete('/api/assets/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format.' });
    
    const dab = await db();
    const collection = dab.collection('assets');
    
    try {
        const assetToDelete = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!assetToDelete) return res.status(404).json({ error: 'Asset not found.' });

        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Asset not found during deletion.' });
        
        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `Deleted asset from inventory: '${assetToDelete.name}'.`,
            action: "DELETE",
            entityType: "Asset",
            entityId: req.params.id,
            // userName: req.user.name
        }, req);
        // --- END AUDIT LOG ---

        res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
        console.error("Error deleting asset:", error);
        res.status(500).json({ error: 'Failed to delete asset.' });
    }
});





// ====================== COMPLAINT REQUESTS CRUD (REVISED) =========================== //

// MODIFIED: ADD NEW COMPLAINT REQUEST (POST)
// We no longer need the `upload.none()` middleware because the frontend is sending a JSON body.
app.post('/api/complaints', async (req, res) => {
  const dab = await db();
  
  // MODIFIED: Destructuring now includes `proofs_base64` and removes `person_complained_against_resident_id`.
  const {
    complainant_resident_id,
    complainant_display_name,
    complainant_address,
    contact_number,
    category,
    date_of_complaint,
    time_of_complaint,
    person_complained_against_name,
    status,
    notes_description,
    proofs_base64, // NEW: Expecting an array of Base64 strings
  } = req.body;

  // --- Start of Validation ---
  if (!complainant_resident_id || !complainant_display_name || !complainant_address || !contact_number || !category ||
      !date_of_complaint || !time_of_complaint || !person_complained_against_name || !status || !notes_description) {
    return res.status(400).json({ error: 'Missing required fields for complaint request.' });
  }
  if (!ObjectId.isValid(complainant_resident_id)) {
    return res.status(400).json({ error: 'Invalid complainant resident ID format.' });
  }
  // MODIFIED: Removed validation for the obsolete person_complained_against_resident_id
  // --- End of Validation ---

  try {
    const collection = dab.collection('complaints');
    const complaintDate = new Date(date_of_complaint);

    // --- 1. GENERATE THE UNIQUE REFERENCE NUMBER ---
    const customRefNo = await generateUniqueReference(collection);

    // --- 2. ADD ref_no AND PROOFS TO THE NEW COMPLAINT OBJECT ---
    const newComplaint = {
      ref_no: customRefNo,
      complainant_resident_id: new ObjectId(complainant_resident_id),
      complainant_display_name: String(complainant_display_name).trim(),
      complainant_address: String(complainant_address).trim(),
      contact_number: String(contact_number).trim(),
      date_of_complaint: complaintDate,
      time_of_complaint: String(time_of_complaint).trim(),
      person_complained_against_name: String(person_complained_against_name).trim(),
      // MODIFIED: This is now always null as it's no longer linked to a resident.
      person_complained_against_resident_id: null,
      status: String(status).trim(),
      category: String(category).trim(),
      notes_description: String(notes_description).trim(),
      // NEW: Store the array of Base64 proofs.
      // Use a check to ensure it's an array, defaulting to an empty one if not.
      proofs_base64: Array.isArray(proofs_base64) ? proofs_base64 : [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await collection.insertOne(newComplaint);

    // --- 3. UPDATE THE AUDIT LOG DESCRIPTION --- (No changes needed here)
    await createAuditLog({
      userId: newComplaint.complainant_resident_id,
      userName: newComplaint.complainant_display_name,
      description: `New complaint (Ref: ${customRefNo}) filed by '${newComplaint.complainant_display_name}' against '${newComplaint.person_complained_against_name}'. Category: ${newComplaint.category}.`,
      action: 'CREATE',
      entityType: 'Complaint',
      entityId: result.insertedId.toString()
    }, req);

    // --- 4. UPDATE THE RESPONSE TO THE FRONTEND --- (No changes needed here)
    res.status(201).json({
      message: 'Complaint request added successfully',
      complaintId: result.insertedId,
      refNo: customRefNo
    });
    
  } catch (error) {
    console.error('Error adding complaint request:', error);
    res.status(500).json({ error: 'Error adding complaint: ' + error.message });
  }
});

// GET ALL COMPLAINT REQUESTS (GET)
app.get('/api/complaints', async (req, res) => {
  const search = req.query.search || '';
  const status = req.query.status || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  const dab = await db();
  const collection = dab.collection('complaints');
  
  let matchQuery = {};

  if (status) {
    matchQuery.status = status;
  }
  
  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i'); // Added .trim() for better UX
    matchQuery.$or = [
      { ref_no: { $regex: searchRegex } }, // <-- MODIFIED: Added ref_no to search
      { complainant_display_name: { $regex: searchRegex } },
      { "complainant_details.first_name": { $regex: searchRegex } },
      { "complainant_details.last_name": { $regex: searchRegex } },
      { person_complained_against_name: { $regex: searchRegex } },
      { "person_complained_details.first_name": { $regex: searchRegex } },
      { "person_complained_details.last_name": { $regex: searchRegex } },
      { status: { $regex: searchRegex } },
      { category: { $regex: searchRegex } },
      { notes_description: { $regex: searchRegex } },
    ];
  }

  try {
    const aggregationPipeline = [
      { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
      { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } } },
      { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } } },
      { $match: matchQuery },
      {
        $project: {
          _id: 1,
          ref_no: 1, // <-- MODIFIED: Included ref_no in the response
          complainant_name: { 
            $ifNull: [
                { $concat: [ "$complainant_details.first_name", " ", "$complainant_details.last_name"] }, 
                "$complainant_display_name"
            ]
          },
          person_complained_against: {
            $ifNull: [
              { $concat: [ "$person_complained_details.first_name", " ", "$person_complained_details.last_name"] },
              "$person_complained_against_name"
            ]
          },
          date_of_complaint: 1, status: 1, notes_description: 1, created_at: 1, category: 1,
        }
      },
      { $sort: { date_of_complaint: -1, created_at: -1 } },
      { $skip: skip }, { $limit: itemsPerPage }
    ];

    const complaints = await collection.aggregate(aggregationPipeline).toArray();
    
    // The count pipeline correctly uses the same `matchQuery`
    const countPipeline = [
        { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
        { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
        { $match: matchQuery },
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

// GET COMPLAINTS FOR A SPECIFIC RESIDENT
app.get('/api/complaints/by-resident/:residentId', async (req, res) => {
  const { residentId } = req.params;
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  if (!ObjectId.isValid(residentId)) {
    return res.status(400).json({ error: 'Invalid Resident ID format' });
  }
  const residentObjectId = new ObjectId(residentId);

  try {
    const dab = await db();
    const collection = dab.collection('complaints');

    const mainMatchStage = { complainant_resident_id: residentObjectId };

    let searchMatchSubStage = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      searchMatchSubStage = {
        $or: [
          { ref_no: { $regex: searchRegex } },
          { person_complained_against_name: { $regex: searchRegex } },
          { "person_complained_details.first_name": { $regex: searchRegex } }, // If looking up person complained
          { "person_complained_details.last_name": { $regex: searchRegex } },
          { status: { $regex: searchRegex } },
          { notes_description: { $regex: searchRegex } },
          // { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: searchRegex } } } // Search by Ref #
        ],
      };
    }

    const combinedMatchStage = search ? { $and: [mainMatchStage, searchMatchSubStage] } : mainMatchStage;

    const aggregationPipeline = [
      { $match: combinedMatchStage },
      // Lookup person complained against (details might be useful for the complainant)
      {
        $lookup: {
          from: 'residents',
          localField: 'person_complained_against_resident_id', // Assuming this field exists
          foreignField: '_id',
          as: 'person_complained_details_array'
        }
      },
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } } },
      {
        $project: {
          _id: 1,
          ref_no: 1, 
          // complainant_name is known (it's the current user), but API can return it for consistency
          complainant_display_name: 1, // The stored display name at time of complaint
          person_complained_against_name: { // Show looked-up name if available, else stored name
            $ifNull: [
              { $concat: [
                  "$person_complained_details.first_name", " ",
                  { $ifNull: ["$person_complained_details.middle_name", ""] },
                  { $cond: { if: { $eq: [{ $ifNull: ["$person_complained_details.middle_name", ""] }, ""] }, then: "", else: " " } },
                  "$person_complained_details.last_name"
              ]},
              "$person_complained_against_name"
            ]
          },
          date_of_complaint: 1,
          time_of_complaint: 1, // Added this field
          status: 1,
          notes_description: 1,
          created_at: 1,
          updated_at: 1,
          // Include other relevant fields for the complainant to see
        }
      },
      { $sort: { date_of_complaint: -1, created_at: -1 } },
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const complaints = await collection.aggregate(aggregationPipeline).toArray();

    const countPipeline = [
        { $match: combinedMatchStage },
        // If search includes person_complained_details, lookup is needed for accurate count
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
        { $match: search ? searchMatchSubStage : {} }, // Apply sub-search again after potential lookup
        { $count: 'total' }
    ];
    // More precise count by applying full combined match directly
    const preciseCountPipeline = [
        { $match: mainMatchStage }, // Start with the resident
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
        // If searchMatchSubStage references fields from person_complained_details, apply it after lookup
        { $match: search ? searchMatchSubStage : {} },
        { $count: 'total' }
    ];

    const countResult = await collection.aggregate(preciseCountPipeline).toArray();
    const totalComplaints = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      complaints,
      total: totalComplaints,
      page,
      itemsPerPage,
      totalPages: Math.ceil(totalComplaints / itemsPerPage)
    });
  } catch (error) {
    console.error(`Error fetching complaints for resident ${residentId}:`, error);
    res.status(500).json({ error: "Failed to fetch complaints for this resident." });
  }
});

// GET COMPLAINT REQUEST BY ID (GET)
app.get('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();

  // --- MODIFIED: Create a dynamic query object ---
  // This allows the frontend to use either the short ref_no or the database _id
  let query = {};
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    // Assuming ref_no is always stored uppercase
    query = { ref_no: id.toUpperCase() };
  }

  try {
    const collection = dab.collection('complaints');
    
    const aggregationPipeline = [
      { $match: query }, // Use the dynamic query here
      { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
      { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
      { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
      { 
        $project: {
          // --- MODIFIED: Added ref_no to the response ---
          ref_no: 1, 
          // Complaint fields
          complainant_resident_id: 1,
          complainant_display_name: 1,
          complainant_address: 1,
          contact_number: 1,
          date_of_complaint: 1,
          time_of_complaint: 1,
          person_complained_against_name: 1,
          person_complained_against_resident_id: 1,
          status: 1,
          notes_description: 1,
          created_at: 1,
          updated_at: 1,
          category: 1,
          // Include details from looked-up documents
          proofs_base64: 1, 
          complainant_details: 1,
          person_complained_details: 1,
        }
      }
    ];

    const result = await collection.aggregate(aggregationPipeline).toArray();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }
    
    res.json({ complaint: result[0] });

  } catch (error) {
    console.error('Error fetching complaint by ID/Ref:', error);
    res.status(500).json({ error: "Failed to fetch complaint." });
  }
});

// UPDATE COMPLAINT REQUEST BY ID (PUT)
app.put('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();

  // --- MODIFIED: Create a dynamic query object ---
  let query = {};
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    query = { ref_no: id.toUpperCase() };
  }

  const {
    complainant_resident_id, complainant_display_name, complainant_address, contact_number,
    date_of_complaint, time_of_complaint, category,
    person_complained_against_name, person_complained_against_resident_id,
    status, notes_description,
  } = req.body;

  // Build the $set object with only the fields provided in the request
  const updateFields = {};
  if (complainant_resident_id !== undefined) updateFields.complainant_resident_id = new ObjectId(complainant_resident_id);
  if (complainant_display_name !== undefined) updateFields.complainant_display_name = String(complainant_display_name).trim();
  if (complainant_address !== undefined) updateFields.complainant_address = String(complainant_address).trim();
  if (contact_number !== undefined) updateFields.contact_number = String(contact_number).trim();
  if (date_of_complaint !== undefined) updateFields.date_of_complaint = new Date(date_of_complaint);
  if (time_of_complaint !== undefined) updateFields.time_of_complaint = String(time_of_complaint).trim();
  if (person_complained_against_name !== undefined) updateFields.person_complained_against_name = String(person_complained_against_name).trim();
  if (person_complained_against_resident_id !== undefined) {
    updateFields.person_complained_against_resident_id = person_complained_against_resident_id && ObjectId.isValid(person_complained_against_resident_id)
      ? new ObjectId(person_complained_against_resident_id) : null;
  }
  if (category !== undefined) updateFields.category = String(category).trim();
  if (status !== undefined) updateFields.status = String(status).trim();
  if (notes_description !== undefined) updateFields.notes_description = String(notes_description).trim();

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields provided to update.' });
  }
  updateFields.updated_at = new Date();

  try {
    const collection = dab.collection('complaints');

    // --- MODIFIED: Fetch original document first for audit logging and existence check ---
    const originalComplaint = await collection.findOne(query);
    if (!originalComplaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    await collection.updateOne({ _id: originalComplaint._id }, { $set: updateFields });

    // --- MODIFIED: Added a detailed audit log ---
    await createAuditLog({
      description: `Updated details for complaint (Ref: ${originalComplaint.ref_no}).`,
      action: "UPDATE",
      entityType: "Complaint",
      entityId: originalComplaint._id.toString(),
    }, req);

    // Fetch the fully populated, updated document to return to the frontend
    const updatedComplaintResult = await collection.aggregate([
        { $match: { _id: originalComplaint._id } }, // Match by the definitive _id
        { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
        { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
    ]).toArray();

    res.json({ message: 'Complaint updated successfully', complaint: updatedComplaintResult[0] || null });

  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: 'Error updating complaint.' });
  }
});

// --- GET ALL NOTES FOR A COMPLAINT ---
// GET /api/complaints/:id/notes
app.get('/api/complaints/:id/notes', async (req, res) => {
  const { id } = req.params;
  const dab = await db();

  // --- MODIFIED: Create a dynamic query object ---
  let query = {};
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    query = { ref_no: id.toUpperCase() };
  }

  try {
    const collection = dab.collection('complaints');
    const aggregationPipeline = [
      { $match: query },
      { $unwind: { path: '$investigation_notes', preserveNullAndEmptyArrays: true } },
      { $match: { 'investigation_notes': { $ne: null } } },
      { $lookup: { from: 'users', localField: 'investigation_notes.authorId', foreignField: '_id', as: 'author_details' }},
      { 
        $project: {
          _id: '$investigation_notes._id',
          content: '$investigation_notes.content',
          createdAt: '$investigation_notes.createdAt',
          author: { name: { $ifNull: [ { $arrayElemAt: ['$author_details.name', 0] }, 'Unknown User' ] } }
        }
      }
    ];

    const notes = await collection.aggregate(aggregationPipeline).toArray();
    res.json({ notes: notes });

  } catch (error) {
    console.error('Error fetching complaint notes by ID/Ref:', error);
    res.status(500).json({ error: 'Failed to fetch complaint notes.' });
  }
});


// --- ADD A NEW NOTE TO A COMPLAINT ---
// POST /api/complaints/:id/notes
app.post('/api/complaints/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Note content is required and cannot be empty.' });
  }

  const dab = await db();
  const collection = dab.collection('complaints');

  // --- MODIFIED: Dynamic query and pre-fetch for audit log ---
  let query = {};
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    query = { ref_no: id.toUpperCase() };
  }

  const newNote = { _id: new ObjectId(), content: content.trim(), createdAt: new Date() };

  try {
    const originalComplaint = await collection.findOne(query);
    if (!originalComplaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    await collection.updateOne(
      { _id: originalComplaint._id },
      { $push: { investigation_notes: { $each: [newNote], $sort: { createdAt: -1 } } } }
    );
    
    await createAuditLog({
        description: `Added a new investigation note to complaint (Ref: ${originalComplaint.ref_no}).`,
        action: "UPDATE",
        entityType: "Complaint",
        entityId: originalComplaint._id.toString(),
    }, req);

    res.status(201).json({ message: 'Note added successfully', note: newNote });

  } catch (error) {
    console.error('Error adding complaint note by ID/Ref:', error);
    res.status(500).json({ error: 'Error adding complaint note.' });
  }
});


// --- UPDATE COMPLAINT STATUS ---
// PATCH /api/complaints/:id/status
app.patch('/api/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const ALLOWED_STATUSES = ['New', 'Under Investigation', 'Resolved', 'Closed', 'Dismissed'];
  
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  const dab = await db();

  // --- MODIFIED: Dynamic query and pre-fetch ---
  let query = {};
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    query = { ref_no: id.toUpperCase() };
  }

  try {
    const complaintsCollection = dab.collection('complaints');
    
    const originalComplaint = await complaintsCollection.findOne(query);
    if (!originalComplaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }
    const oldStatus = originalComplaint.status;

    if (oldStatus === status) {
        return res.json({ message: `Complaint status is already '${status}'.`, statusChanged: false });
    }

    await complaintsCollection.updateOne(
      { _id: originalComplaint._id },
      { $set: { status: status, updated_at: new Date() } }
    );

    await createAuditLog({
        description: `Status for complaint (Ref: ${originalComplaint.ref_no}) changed from '${oldStatus}' to '${status}'.`,
        action: "STATUS_CHANGE",
        entityType: "Complaint",
        entityId: originalComplaint._id.toString(),
    }, req);

    if (originalComplaint.complainant_resident_id) {
      await createNotification(dab, {
        name: `Complaint Status Update (Ref: ${originalComplaint.ref_no})`,
        content: `The status of your complaint against "${originalComplaint.person_complained_against_name}" has been updated to: ${status}.`,
        by: "System Administration",
        type: "Notification",
        target_audience: 'Specific Residents', // Ensure this matches your createNotification function
        target_residents: [originalComplaint.complainant_resident_id], // Ensure this is the expected field name
      });
    }

    res.json({ message: `Complaint status updated to '${status}' successfully.`, statusChanged: true });

  } catch (error) {
    console.error("Error updating complaint status by ID/Ref:", error);
    res.status(500).json({ error: 'Could not update complaint status.' });
  }
});


// --- DELETE COMPLAINT ---
// DELETE /api/complaints/:id
app.delete('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();

  // --- MODIFIED: Dynamic query ---
  let query = {};
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    query = { ref_no: id.toUpperCase() };
  }
  
  try {
    const collection = dab.collection('complaints');
    
    const complaintToDelete = await collection.findOne(query);
    if (!complaintToDelete) {
        return res.status(404).json({ error: 'Complaint not found.' });
    }
    
    await collection.deleteOne({ _id: complaintToDelete._id });
    
    await createAuditLog({
        description: `Deleted complaint (Ref: ${complaintToDelete.ref_no}, Complainant: ${complaintToDelete.complainant_display_name}).`,
        action: "DELETE",
        entityType: "Complaint",
        entityId: complaintToDelete._id.toString(),
    }, req);

    res.json({ message: 'Complaint deleted successfully' });

  } catch (error) {
    console.error('Error deleting complaint by ID/Ref:', error);
    res.status(500).json({ error: 'Error deleting complaint: ' + error.message });
  }
});

















// ====================== DOCUMENT REQUESTS CRUD (REVISED FOR DYNAMIC FORMS & GENERATION) =========================== //


// POST /api/document-requests - ADD NEW DOCUMENT REQUEST (Handles new 'details' object)
app.post('/api/document-requests', async (req, res) => {
  const dab = await db();
  const {
    requestor_resident_id,
    request_type,
    purpose,
    details, // This is the new object with custom fields
  } = req.body;

  // Validation
  if (!requestor_resident_id || !request_type) {
    return res.status(400).json({ error: 'Missing required fields: requestor and type are required.' });
  }
  if (!ObjectId.isValid(requestor_resident_id)) {
    return res.status(400).json({ error: 'Invalid requestor resident ID format.' });
  }

  try {
    const residentsCollection = dab.collection('residents');
    const requestsCollection = dab.collection('document_requests'); // Get the collection once

    // --- FETCH REQUESTOR'S NAME FOR A MORE DESCRIPTIVE LOG ---
    const requestor = await residentsCollection.findOne({ _id: new ObjectId(requestor_resident_id) });
    const requestorName = requestor ? `${requestor.first_name} ${requestor.last_name}` : 'An unknown resident';
    // --- END FETCH ---

    // --- 1. GENERATE THE UNIQUE REFERENCE NUMBER ---
    const customRefNo = await generateUniqueReference(requestsCollection);

    // --- 2. ADD THE ref_no TO THE NEW REQUEST OBJECT ---
    const newRequest = {
      ref_no: customRefNo, // Your new user-friendly reference number!
      requestor_resident_id: new ObjectId(requestor_resident_id),
      request_type: String(request_type).trim(),
      purpose: String(purpose).trim(),
      details: details || {},
      document_status: "Pending",
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await requestsCollection.insertOne(newRequest);

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
        description: `New document request '${request_type}' (Ref: ${customRefNo}) submitted by ${requestorName}.`,
        action: "CREATE",
        entityType: "DocumentRequest",
        entityId: result.insertedId.toString(),
        userId: requestor ? requestor._id : null,
        userName: requestorName,
    }, req);
    // --- END AUDIT LOG ---

    // --- 3. UPDATE THE RESPONSE TO THE FRONTEND ---
    res.status(201).json({
      message: 'Document request added successfully',
      requestId: result.insertedId,
      refNo: customRefNo // Send the new ref # back to the frontend
    });
    
  } catch (error) {
    console.error('Error adding document request:', error);
    res.status(500).json({ error: 'Error adding document request.' });
  }
});

// GET /api/document-requests - GET ALL DOCUMENT REQUESTS (Revised for all filters)
app.get('/api/document-requests', async (req, res) => {
  try {
    const { search, status, sortBy, sortOrder, byResidentId = '' } = req.query; 
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const collection = dab.collection('document_requests');

    const matchConditions = [];

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      matchConditions.push({
        $or: [
          // --- MODIFIED: Added ref_no to the search query ---
          { ref_no: { $regex: searchRegex } }, 
          { request_type: { $regex: searchRegex } },
          { "requestor_details.first_name": { $regex: searchRegex } },
          { "requestor_details.last_name": { $regex: searchRegex } },
          { purpose: { $regex: searchRegex } },
          { document_status: { $regex: searchRegex } },
        ]
      });
    }

    if (byResidentId && byResidentId.trim() !== '') {
      matchConditions.push({ requestor_resident_id: new ObjectId(byResidentId) });
    }
    if (status) {
      matchConditions.push({ document_status: status });
    }

    const mainMatchStage = matchConditions.length > 0 ? { $and: matchConditions } : {};
    
    let sortStage = { $sort: { created_at: -1 } }; // Default sort by creation date
    if (sortBy) {
        sortStage = { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } };
    }

    const aggregationPipeline = [
      { $lookup: { from: 'residents', localField: 'requestor_resident_id', foreignField: '_id', as: 'requestor_details_array' }},
      { $addFields: { requestor_details: { $arrayElemAt: ['$requestor_details_array', 0] }}},
      { $match: mainMatchStage },
      { // Project the final shape for the frontend
        $project: {
          _id: 1,
          // --- MODIFIED: Included ref_no in the response ---
          ref_no: 1, 
          request_type: 1,
          requestor_name: { $concat: ["$requestor_details.first_name", " ", "$requestor_details.last_name"] },
          date_of_request: "$created_at",
          document_status: 1,
          // Note: Removed purpose from here to keep the list view lean. You can add it back if needed.
        }
      },
      sortStage,
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const requests = await collection.aggregate(aggregationPipeline).toArray();
    
    const countPipeline = [ ...aggregationPipeline.slice(0, 3), { $count: 'total' } ];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalRequests = countResult.length > 0 ? countResult[0].total : 0;

    res.json({ requests, total: totalRequests });

  } catch (error) {
    console.error('Error fetching document requests:', error);
    res.status(500).json({ error: "Failed to fetch document requests." });
  }
});

// GET /api/document-requests/:id - GET SINGLE DOCUMENT REQUEST (For Details Page)
app.get('/api/document-requests/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();
  const collection = dab.collection('document_requests');

  try {
    // --- MODIFIED: Create a dynamic query object ---
    // This allows the frontend to use either the short ref_no or the database _id
    let query = {};
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      // Assuming ref_no is always uppercase as we defined in the creation logic
      query.ref_no = id.toUpperCase(); 
    }

    const request = await collection.findOne(query);
    if (!request) {
      return res.status(404).json({ error: 'Document request not found.' });
    }

    // Fetch requestor details
    const requestor = await dab.collection('residents').findOne({ _id: request.requestor_resident_id });
    request.requestor_details = requestor; // Attach for frontend use

    res.json({ request });

  } catch (error) { 
    console.error('Error fetching document request by ID/Ref:', error); 
    res.status(500).json({ error: "Failed to fetch request." }); 
  }
});

// PUT /api/document-requests/:id - UPDATE DOCUMENT REQUEST (No changes needed, correct as is)
app.put('/api/document-requests/:id', async (req, res) => {
    const { id } = req.params;
    const dab = await db();
    const collection = dab.collection('document_requests');
    const { requestor_resident_id, request_type, purpose, details } = req.body;

    if (!requestor_resident_id || !request_type || !purpose) {
        return res.status(400).json({ error: 'Missing required fields for update.' });
    }
    
    let query = {};
    if (ObjectId.isValid(id)) {
      query._id = new ObjectId(id);
    } else {
      query.ref_no = id.toUpperCase();
    }

    try {
        const originalRequest = await collection.findOne(query);
        if (!originalRequest) {
            return res.status(404).json({ error: 'Document request not found.' });
        }
        
        const updateFields = {
            requestor_resident_id: new ObjectId(requestor_resident_id),
            request_type, 
            purpose, 
            details,
            updated_at: new Date()
        };
        
        await collection.updateOne(query, { $set: updateFields });
        
        await createAuditLog({
            description: `Updated details for request '${originalRequest.request_type}' (Ref: ${originalRequest.ref_no}).`,
            action: "UPDATE",
            entityType: "DocumentRequest",
            entityId: originalRequest._id.toString(),
        }, req);

        res.json({ message: 'Document request updated successfully' });

    } catch (error) { 
        console.error('Error updating request:', error); 
        res.status(500).json({ error: 'Error updating request.' }); 
    }
});


// PATCH /api/document-requests/:id/status - UPDATE STATUS (UPDATED)
app.patch('/api/document-requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status: newStatus } = req.body;

  // --- MODIFIED: Changed "Denied" to "Declined" ---
  const ALLOWED_DOC_STATUSES = ["Pending", "Processing", "Ready for Pickup", "Released", "Declined"];
  
  if (!newStatus || !ALLOWED_DOC_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status value provided.' });
  }

  try {
    const dab = await db();
    const collection = dab.collection('document_requests');

    let query = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      // Assuming ref_no is always uppercase for consistency
      query = { ref_no: id.toUpperCase() }; 
    }

    const originalRequest = await collection.findOne(query);
    if (!originalRequest) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const oldStatus = originalRequest.document_status;

    if (oldStatus === newStatus) {
      return res.json({ message: `Request status is already '${newStatus}'. No changes made.` });
    }

    const result = await collection.updateOne(query, {
      $set: {
        document_status: newStatus,
        updated_at: new Date()
      }
    });

    if (result.matchedCount === 0) {
      // This is a failsafe, but findOne should have caught it.
      return res.status(404).json({ error: 'Request not found during update operation.' });
    }

    await createAuditLog({
      description: `Status for document request '${originalRequest.request_type}' (Ref: ${originalRequest.ref_no}) changed from '${oldStatus}' to '${newStatus}'.`,
      action: "STATUS_CHANGE",
      entityType: "DocumentRequest",
      entityId: originalRequest._id.toString(),
    }, req);

    const notificationData = {
      name: `Status of your document request has been updated to '${newStatus}'.`,
      content: `Your document request for a ${originalRequest.request_type} has been updated from '${oldStatus}' to '${newStatus}'.`,
      by: "System",
      type: "Notification",
      target_audience: "Specific Residents",
      target_residents: [originalRequest.requestor_resident_id],
    };
    await createNotification(dab, notificationData);

    res.json({ message: `Status updated to '${newStatus}' successfully.` });

  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: 'Could not update status.' });
  }
});





// New ENdpoint per action

/**
 * ACTION 1: Process a Pending Request
 * Called automatically when an admin views a "Pending" request for the first time.
 */
app.patch('/api/document-requests/:id/process', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });

  try {
    const dab = await db();
    const collection = dab.collection('document_requests');
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), document_status: 'Pending' }, // Condition: Must be Pending
      { $set: { document_status: 'Processing', updated_at: new Date() } },
      { returnDocument: 'after' } // Return the updated document
    );

    if (!result.value) {
      // This means the document was not found OR it was not in 'Pending' state.
      // We can fetch the current document to return it without erroring.
      const currentRequest = await collection.findOne({ _id: new ObjectId(id) });
      return res.status(200).json({ message: 'Request was not in Pending state.', request: currentRequest });
    }

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
        description: `Document request '${result.value.request_type}' (#${id.slice(-6)}) moved to 'Processing'.`,
        action: "STATUS_CHANGE",
        entityType: "DocumentRequest",
        entityId: id,
        // userName: req.user.name // In a real app with auth context
    }, req);
    // --- END AUDIT LOG ---


    // Send notification to the user
    const notificationData = {
        name: `Your document request for a ${result.value.request_type} has been approved.`,
        content: `Your document request for a ${result.value.request_type} has been approved. You can view the request details in the Resident Portal.`,
        by: "System",
        type: "Notification",
        target_audience: "Specific Residents",
        target_residents: [result.value.requestor_resident_id],
    };
    await createNotification(dab, notificationData);
    

    res.json({ message: 'Request moved to Processing.', request: result.value });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: 'Could not process request.' });
  }
});

/**
 * ACTION 2: Approve a Processing Request
 * Called when the admin clicks the "Approve" button.
 */
app.patch('/api/document-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
  
  try {
    const dab = await db();
    const collection = dab.collection('document_requests');
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), document_status: 'Processing' }, // Condition: Must be Processing
      { $set: { document_status: 'Approved', updated_at: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'Request not found or is not in Processing state.' });
    }
    

    // TODO: Send notification to user

    const getDocu = await collection.findOne({ _id: new ObjectId(id) });
    const result_type = getDocu.request_type;

    await createNotification(dab, {
        name: `Your document request for a ${result_type} is ready for pickup.`,
        content: `Your document request for a ${result_type} has been approved. The document is ready for pickup at the Resident Portal office.`,
        by: "System",
        type: "Notification",
        target_audience: "SpecificResidents",
        target_residents: [getDocu.requestor_resident_id],
    });


    res.json({ message: 'Request approved successfully.', request: result });
  } catch (error) {
    console.error("Error approving request:", error);
    res.status(500).json({ error: 'Could not approve request.' });
  }
});

/**
 * ACTION 3: Set an Approved Request to Ready for Pickup
 * Called when the admin clicks the "Generate & Set..." button.
 */
app.patch('/api/document-requests/:id/generate', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
  
  try {
    const dab = await db();
    const collection = dab.collection('document_requests');
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), document_status: 'Approved' }, // Condition: Must be Approved
      { $set: { document_status: 'Ready for Pickup', updated_at: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'Request not found or is not in Approved state.' });
    }


    const getDocu = await collection.findOne({ _id: new ObjectId(id) });
    const result_type = getDocu.request_type;

    // Send notification to the user
    const notificationData = {
        name: `Your document request for a ${result_type} is ready for pickup.`,
        content: `Your document request for a ${result_type} has been approved. The document is ready for pickup at the Resident Portal office.`,
        by: "System",
        type: "Notification",
        target_audience: "SpecificResidents",
        target_residents: [getDocu.requestor_resident_id],
    };
    await createNotification(dab, notificationData);
    
    
    res.json({ message: 'Document is now Ready for Pickup.', request: result });
  } catch (error) {
    console.error("Error setting request to Ready for Pickup:", error);
    res.status(500).json({ error: 'Could not update request status.' });
  }
});

/**
 * ACTION 4: Decline a Processing Request
 * Called when the admin clicks the "Decline" button.
 */
app.patch('/api/document-requests/:id/decline', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body; // You can pass a reason for declining
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });

    try {
        const dab = await db();
        const collection = dab.collection('document_requests');
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id), document_status: 'Processing' }, // Can only decline from Processing
            { $set: { document_status: 'Declined', updated_at: new Date(), decline_reason: reason || 'No reason provided.' } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Request not found or is not in Processing state.' });
        }


        const getDocu = await collection.findOne({ _id: new ObjectId(id) });
    const result_type = getDocu.request_type;
        // Send notification to the user
        const notificationData = {
            name: `Your document request for a ${result_type} was declined.`,
            content: `Your document request for a ${result_type} was declined. The reason provided is: '${result.value.decline_reason}'.`,
            by: "System",
            type: "Alert",
            target_audience: "SpecificResidents",
            target_residents: [getDocu.requestor_resident_id],
        };
        await createNotification(dab, notificationData);
        
        
        res.json({ message: 'Request has been declined.', request: result });
    } catch (error) {
        console.error("Error declining request:", error);
        res.status(500).json({ error: 'Could not decline request.' });
    }
});

/**
 * ACTION 5: Release a "Ready for Pickup" Request
 * Called when the admin clicks the "Release" button after uploading proof.
 */
app.patch('/api/document-requests/:id/release', async (req, res) => {
    const { id } = req.params;
    const { proof_of_release } = req.body; // Expecting a Base64 string

    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
    if (!proof_of_release || !proof_of_release.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Valid proof of release photo is required.' });
    }

    try {
        const dab = await db();
        const collection = dab.collection('document_requests');
        
        // --- FETCH ORIGINAL DOCUMENT FOR LOGGING ---
        const originalRequest = await collection.findOne({ _id: new ObjectId(id) });
        if (!originalRequest) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        if (originalRequest.document_status !== 'Ready for Pickup') {
            return res.status(409).json({ error: `Request is not in "Ready for Pickup" state. Current status: ${originalRequest.document_status}` });
        }
        // --- END FETCH ---

        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id), document_status: 'Ready for Pickup' }, // Condition
            { 
                $set: { 
                    document_status: 'Released', 
                    proof_of_release_photo: proof_of_release, // Save the Base64 string
                    released_at: new Date(), // Add a timestamp for when it was released
                    updated_at: new Date() 
                } 
            },
            { returnDocument: 'after' } // Return the updated document
        );

        if (!result) {
            // This case might happen in a race condition, but the pre-check should mostly prevent it.
            return res.status(404).json({ error: 'Request not found or was already updated.' });
        }
        
        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `Document request '${result.request_type}' (#${id.slice(-6)}) was released.`,
            action: "RELEASE",
            entityType: "DocumentRequest",
            entityId: id,
        }, req);
        // --- END AUDIT LOG ---

        res.json({ message: 'Request has been released successfully.', request: result });
    } catch (error) {
        console.error("Error releasing request:", error);
        res.status(500).json({ error: 'Could not release request.' });
    }
});



const isDebug = !false;

// *** NEW ENDPOINT ***
// GET /api/document-requests/:id/generate - GENERATE AND SERVE THE PDF
const puppeteer = isDebug ? require('puppeteer-core') : require('puppeteer');

const fs = require('fs').promises; // Use promise-based fs

app.get('/api/document-requests/:id/generate', async (req, res) => {
  const chromium = (await import('@sparticuz/chromium')).default;


  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();

  try {
    // 1. Fetch ALL necessary data
    const request = await dab.collection('document_requests').findOne({ _id: new ObjectId(req.params.id) });
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    const requestor = await dab.collection('residents').findOne({ _id: request.requestor_resident_id });
    if (!requestor) return res.status(404).json({ error: 'Requestor not found.' });

    // Fetch Barangay Officials (ensure your officials collection and fields are correct)
    const punongBarangay = await dab.collection('barangay_officials').findOne({ position: 'Punong Barangay' });
    punongBarangay.full_name = `${punongBarangay.first_name} ${punongBarangay.middle_name || ''} ${punongBarangay.last_name}`;
    const barangaySecretary = await dab.collection('barangay_officials').findOne({ position: 'Barangay Secretary' });
    barangaySecretary.full_name = `${barangaySecretary.first_name} ${barangaySecretary.middle_name || ''} ${barangaySecretary.last_name}`;

    // 2. Select the correct HTML template
    let templatePath = '';
    const templateMap = {
      'Certificate of Cohabitation': 'cohabitation.html',
      'Certificate of Good Moral': 'good_moral.html',
      'Barangay Clearance': 'clearance.html',
      'Barangay Business Clearance': 'business_clearance.html',
      'Barangay Certification (First Time Jobseeker)': 'jobseeker.html',
      'Certificate of Indigency': 'indigency.html',
      'Certificate of Solo Parent': 'solo_parent.html',
      'Certificate of Residency': 'residency.html',
      'Barangay Permit (for installations)': 'permit.html',
    };
    templatePath = path.join(__dirname, 'templates', templateMap[request.request_type]);
    if (!templatePath) return res.status(400).json({ error: 'No template available for this document type.' });

    let html = await fs.readFile(templatePath, 'utf8');

    // 3. Hydrate the template with data (using simple string replacement)
    const today = new Date();
    const fullAddress = `${requestor.address_house_number || ''} ${requestor.address_street || ''}, ${requestor.address_subdivision_zone || ''}`.trim();
    // --- CORRECTED & COMPLETE REPLACEMENT MAP ---
    const replacements = {
        // --- General & Common Placeholders ---
        '[FULL NAME]': `${requestor.first_name} ${requestor.last_name}`.trim(),
        '[NAME OF APPLICANT]': `${requestor.first_name} ${requestor.last_name}`.trim(),
        '[Household no, Subdivision/ Zone/Sitio/Purok, City/Municipality]': fullAddress, // Address format 1
        '[Household No./ Street/ Subdivision/ Sitio/ City or Municipality]': fullAddress, // Address format 2
        '[Household no, Street, Subdivision/Zone/Sitio/Purok, City/Municipality]': fullAddress, // Address format 3
        '[PURPOSE]': request.purpose || '',
        '[DAY]': today.getDate(),
        '[MONTH]': today.toLocaleString('en-US', { month: 'long' }),
        '[YEAR]': today.getFullYear(),
        '[YEAR_LIVING]': today.getFullYear() - (requestor.years_at_current_address || 0),
        '[NAME OF BARANGAY SECRETARY]': barangaySecretary?.full_name?.toUpperCase() || 'SECRETARY NAME NOT FOUND',
        '[NAME OF PUNONG BARANGAY]': punongBarangay?.full_name?.toUpperCase() || 'PUNONG BARANGAY NOT FOUND',
        '[BARANGAY CHAIRPERSON’S NAME]': punongBarangay?.full_name?.toUpperCase() || 'PUNONG BARANGAY NOT FOUND',
        '[PUNONG_BARANGAY_PICTURE]': punongBarangay?.photo_url ? punongBarangay.photo_url : 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        '[BARANGAY_SECRETARY_PICTURE]': barangaySecretary?.photo_url ? punongBarangay.photo_url : 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        'Mr./Ms.': requestor.gender === 'Male' ? 'Mr.' : 'Ms.',
        
        // --- Certificate of Cohabitation ---
        '[FULL NAME OF MALE PARTNER]': request.details.male_partner_name || '',
        '[MALE BIRTHDATE]': request.details.male_partner_birthdate ? new Date(request.details.male_partner_birthdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        '[FULL NAME OF FEMALE PARTNER]': request.details.female_partner_name || '',
        '[FEMALE BIRTHDATE]': request.details.female_partner_birthdate ? new Date(request.details.female_partner_birthdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        '[YEAR STARTED COHABITING]': request.details.year_started_cohabiting || '',

        // --- Barangay Clearance ---
        '[TYPE OF WORK]': request.details.type_of_work || '',
        '[OTHER WORK]': request.details.other_work || '',
        '[NUMBER OF STOREYS]': request.details.number_of_storeys || '',
        '[PURPOSE OF CLEARANCE]': request.details.purpose_of_clearance || '',

        // --- Barangay Business Clearance ---
        '[BUSINESS NAME]': request.details.business_name || '',
        '[NATURE OF BUSINESS]': request.details.nature_of_business || '',
        
        // --- First Time Jobseeker ---
        '[AGE]': requestor.age || '',
        '[NUMBER OF YEARS]': request.details.years_lived || '',
        '[NUMBER OF MONTHS]': request.details.months_lived || '',
        '[NEXT YEAR]': today.getFullYear() + 1,

        // -- Indigency --
        '[NEXT YEAR]': today.getFullYear() + 1,
        '[civil status]': requestor.civil_status || '',
        '[Full Address]': fullAddress,
        '[medical/educational/financial]': request.details.medical_educational_financial || '',

        // -- permit --
        '[installation/construction/repair]': request.details.installation_construction_repair || '',
        '[Project Site]': request.details.project_site || '',
    };

    for (const placeholder in replacements) {
        html = html.replace(new RegExp(placeholder.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), replacements[placeholder]);
    }

    console.log('executiable path: ', chromium);

    // 4. Generate PDF using Puppeteer
    const browser = isDebug ? 
    await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: await chromium.headless,
      defaultViewport: chromium.defaultViewport,
    }) : await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }); 
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'Legal', printBackground: true });
    await browser.close();
    
    // 5. Serve the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${request.request_type.replace(/ /g, '_')}_${requestor.last_name}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(`Error generating PDF for request ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to generate PDF document.' });
  }
});





























// ======================== DASHBOARD STATISTICS ======================== //

// ----- Express.js API for Dashboard Metrics -----
// Ensure you have 'app' (Express app instance) and 'db' (DB connection function)
// and ObjectId from mongodb if needed for other parts, though not directly here.

// REVISED: /api/dashboard endpoint to include pending resident data

app.get('/api/dashboard', async (req, res) => {
  try {
    const dab = await db(); // Your DB instance
    const residentsCollection = dab.collection('residents');
    const documentRequestsCollection = dab.collection('document_requests');
    const complaintsCollection = dab.collection('complaints');
    const borrowedAssetsCollection = dab.collection('borrowed_assets');

    // --- Core Metrics ---
    const totalPopulation = await residentsCollection.countDocuments({ status: 'Approved' }); // Ensure we only count approved residents
    const totalHouseholds = await residentsCollection.countDocuments({ is_household_head: true, status: 'Approved' });
    const totalRegisteredVoters = await residentsCollection.countDocuments({ is_registered_voter: true, status: 'Approved' });

    // --- New Demographic Counts ---
    const totalSeniorCitizens = await residentsCollection.countDocuments({
      date_of_birth: { $lte: new Date(new Date().setFullYear(new Date().getFullYear() - 60)) },
      status: 'Approved'
    });
    const totalPWDs = await residentsCollection.countDocuments({ is_pwd: true, status: 'Approved' });
    const totalLaborForce = await residentsCollection.countDocuments({ occupation_status: 'Labor force', status: 'Approved' });
    const totalUnemployed = await residentsCollection.countDocuments({ occupation_status: 'Unemployed', status: 'Approved' });
    const totalOutOfSchoolYouth = await residentsCollection.countDocuments({ occupation_status: 'Out of School Youth', status: 'Approved' });

    // --- Transaction Alerts Data (Counts of Pending Items) ---
    const pendingDocumentRequestsCount = await documentRequestsCollection.countDocuments({
      document_status: 'Pending'
    });
    const newComplaintsCount = await complaintsCollection.countDocuments({
      status: 'New'
    });
    const borrowedAssetsNotReturnedCount = await borrowedAssetsCollection.countDocuments({
      status: { $in: ['Borrowed', 'Overdue'] }
    });

    // ADDED: Get count of residents with "Pending" status
    const pendingResidentsCount = await residentsCollection.countDocuments({ status: 'Pending' });

    // --- Fetch Recent Items for Alert Cards ---
    const recentPendingDocumentRequests = await documentRequestsCollection.find({ document_status: 'Pending' }).sort({ date_of_request: -1 }).limit(3).toArray();
    const recentNewComplaints = await complaintsCollection.find({ status: 'New' }).sort({ date_of_complaint: -1 }).limit(3).toArray();
    const recentBorrowedAssets = await borrowedAssetsCollection.find({ status: { $in: ['Borrowed', 'Overdue'] } }).sort({ borrow_datetime: -1 }).limit(3).toArray();
    
    // ADDED: Fetch recent pending residents and format them for display
    const recentPendingResidentsRaw = await residentsCollection.find({ status: 'Pending' }).sort({ created_at: -1 }).limit(3).toArray();
    
    // Map to a consistent format for the frontend component
    const recentPendingResidents = recentPendingResidentsRaw.map(resident => ({
      _id: resident._id,
      name: `${resident.first_name} ${resident.last_name}`,
      dateAdded: `Added on ${new Date(resident.created_at).toLocaleDateString()}`
    }));


    res.json({
      // Core Metrics
      totalPopulation,
      totalHouseholds,
      totalRegisteredVoters,
      // New Demographic Counts
      totalSeniorCitizens,
      totalPWDs,
      totalLaborForce,
      totalUnemployed,
      totalOutOfSchoolYouth,
      // Transaction Alert Counts
      pendingDocumentRequestsCount,
      newComplaintsCount,
      borrowedAssetsNotReturnedCount,
      pendingResidentsCount, // ADDED: Pending resident count
      // Arrays of recent items for display:
      recentPendingDocumentRequests,
      recentNewComplaints,
      recentBorrowedAssets,
      recentPendingResidents, // ADDED: Recent pending residents list
    });

  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics", message: error.message });
  }
});


// UNCHANGED: /api/dashboard/age-distribution endpoint
// Provides data structured for the age distribution chart.
app.get('/api/dashboard/age-distribution', async (req, res) => {
    try {
        const dab = await db();
        const residentsCollection = dab.collection('residents');

        const ageBrackets = [
            { name: "0-10", min: 0, max: 10 },
            { name: "11-20", min: 11, max: 20 },
            { name: "21-30", min: 21, max: 30 },
            { name: "31-40", min: 31, max: 40 },
            { name: "41-50", min: 41, max: 50 },
            { name: "51-60", min: 51, max: 60 },
            { name: "61-70", min: 61, max: 70 },
            { name: "71-80", min: 71, max: 80 },
            { name: "81+", min: 81, max: 999 },
        ];

        const pipeline = [
             // Stage 0: Filter for approved residents only
            {
                $match: {
                    status: "Approved"
                }
            },
            // Stage 1: Add an 'age' field to each document.
            {
                $addFields: {
                    age: {
                        $dateDiff: {
                            startDate: "$date_of_birth",
                            endDate: "$$NOW",
                            unit: "year"
                        }
                    }
                }
            },
            // Stage 2: Group residents into buckets based on their age.
            {
                $bucket: {
                    groupBy: "$age",
                    boundaries: [0, 11, 21, 31, 41, 51, 61, 71, 81, 999], 
                    default: "Other", 
                    output: {
                        "count": { $sum: 1 }
                    }
                }
            }
        ];

        const results = await residentsCollection.aggregate(pipeline).toArray();

        // Map the MongoDB results to the predefined bracket names and structure
        const formattedData = ageBrackets.map(bracket => {
            const resultForBracket = results.find(r => r._id === bracket.min);
            return {
                bracket: bracket.name,
                count: resultForBracket ? resultForBracket.count : 0,
                minAge: bracket.min,
                maxAge: bracket.max
            };
        });

        res.json({ ageDistribution: formattedData });

    } catch (error) {
        console.error("Error fetching age distribution data:", error);
        res.status(500).json({ error: "Failed to fetch age distribution", message: error.message });
    }
});

// NEW API ENDPOINT
// GET /api/demographics/profile
// Provides detailed demographic breakdowns for reporting, including sex.
app.get('/api/demographics/profile', async (req, res) => {
    try {
        const dab = await db();
        const residentsCollection = dab.collection('residents');

        // ==========================================================
        // 1. AGE AND SEX DISTRIBUTION
        // ==========================================================
        // This pipeline calculates age, groups residents into predefined brackets,
        // and pivots the data to count males and females within each bracket.
        // NOTE: The brackets here match your Vue component's HTML structure.
        const ageSexPipeline = [
            // Stage 1: Calculate age for each resident
            {
                $addFields: {
                    age: {
                        $dateDiff: {
                            startDate: "$date_of_birth",
                            endDate: "$$NOW",
                            unit: "year"
                        }
                    }
                }
            },
            // Stage 2: Assign a specific age bracket string based on the calculated age
            {
                $addFields: {
                    ageBracket: {
                        $switch: {
                            branches: [
                                { case: { $lte: ['$age', 5] }, then: '1. Children 0-5 years old' },
                                { case: { $and: [{ $gte: ['$age', 6] }, { $lte: ['$age', 12] }] }, then: '2. Children 6-12 years old' },
                                { case: { $and: [{ $gte: ['$age', 13] }, { $lte: ['$age', 17] }] }, then: '3. Children 13-17' },
                                { case: { $and: [{ $gte: ['$age', 18] }, { $lte: ['$age', 35] }] }, then: '4. Children 18-35 years old' },
                                { case: { $and: [{ $gte: ['$age', 36] }, { $lte: ['$age', 50] }] }, then: '5. Adult 36-50 years old' },
                                { case: { $and: [{ $gte: ['$age', 51] }, { $lte: ['$age', 65] }] }, then: '6. Adult 51-65 years old' },
                                { case: { $gte: ['$age', 66] }, then: '7. Adult 66 years old & above' }
                            ],
                            default: 'Unknown' // Catch any residents without a valid DOB
                        }
                    }
                }
            },
            // Stage 3: Group by the new age bracket and the existing sex field
            {
                $group: {
                    _id: { bracket: '$ageBracket', sex: '$sex' },
                    count: { $sum: 1 }
                }
            },
            // Stage 4: Pivot the data. Group by bracket and create separate fields for Male/Female counts.
            {
                $group: {
                    _id: '$_id.bracket',
                    male: { $sum: { $cond: [{ $eq: ['$_id.sex', 'Male'] }, '$count', 0] } },
                    female: { $sum: { $cond: [{ $eq: ['$_id.sex', 'Female'] }, '$count', 0] } }
                }
            },
            // Stage 5: Clean up the output format
            {
                $addFields: {
                    total: { $add: ['$male', '$female'] }
                }
            },
            {
                $project: {
                    _id: 0,
                    bracket: '$_id',
                    male: 1,
                    female: 1,
                    total: 1
                }
            },
            // Stage 6: Sort the brackets in the correct order
            { $sort: { bracket: 1 } }
        ];
        
        const ageSexDistribution = await residentsCollection.aggregate(ageSexPipeline).toArray();
        

        // ==========================================================
        // 2. POPULATION BY SECTOR WITH SEX BREAKDOWN
        // ==========================================================
        const getSectorCounts = async (filter) => {
            const male = await residentsCollection.countDocuments({ ...filter, sex: 'Male' });
            const female = await residentsCollection.countDocuments({ ...filter, sex: 'Female' });
            return { male, female, total: male + female };
        };

        const sectorSexDistribution = {
            laborForce: await getSectorCounts({ occupation_status: 'Labor force' }),
            unemployed: await getSectorCounts({ occupation_status: 'Unemployed' }),
            osy: await getSectorCounts({ occupation_status: 'Out of School Youth' }),
            pwd: await getSectorCounts({ is_pwd: true }),
        };

        // ==========================================================
        // 3. SEND RESPONSE
        // ==========================================================
        res.json({
            ageSexDistribution,
            sectorSexDistribution,
        });

    } catch (error) {
        console.error("Error fetching detailed demographic profile:", error);
        res.status(500).json({ error: "Failed to fetch demographic profile", message: error.message });
    }
});


// HELPER FUNCTION - CUSTOM REF NUMBER

async function generateUniqueReference(collection) {
  // nanoid v4+ is ESM, so we use a dynamic import in a CommonJS file.
  const { nanoid } = await import('nanoid');
  const ID_LENGTH = 5;
  let refNo;
  let isUnique = false;

  // Loop until a unique ID is found
  while (!isUnique) {
    // Generate a 5-character alphanumeric ID and convert to uppercase
    refNo = nanoid(ID_LENGTH).toUpperCase();
    
    // Check if a document with this ref_no already exists
    const existingRequest = await collection.findOne({ ref_no: refNo });
    
    if (!existingRequest) {
      isUnique = true; // The ID is unique, exit the loop
    }
    // If it's not unique, the loop will run again to generate a new ID
  }

  return refNo;
}

// =================== AUDIT LOG HELPER =================== //

/**
 * Creates an audit log entry in the database.
 * @param {object} logData - The data for the audit log.
 * @param {ObjectId} [logData.userId] - The ID of the user performing the action (optional).
 * @param {string} [logData.userName] - The name of the user performing the action (optional).
 * @param {string} logData.description - The human-readable log message.
 * @param {'CREATE'|'UPDATE'|'DELETE'|'LOGIN'|'LOGOUT'|'APPROVE'|'REJECT'|'STATUS_CHANGE'|'GENERATE'} logData.action - The type of action.
 * @param {string} [logData.entityType] - The name of the entity being affected (e.g., 'Resident').
 * @param {string} [logData.entityId] - The ID of the document/record being affected.
 */
async function createAuditLog(logData, req = null) {
  try {
    const dab = await db(); // Get DB instance
    const auditLogsCollection = dab.collection('audit_logs');
    
    let userData = {};
    if (req.headers.cookie) { 
      // console.log("Cookie:", req?.headers?.cookie);
      const cookieArray = req.headers.cookie.split(";").map(c => c.trim());
      const userDataCookie = cookieArray.find(c => c.startsWith('userData='));
      userData = userDataCookie ? JSON.parse(decodeURIComponent(userDataCookie.split('=')[1])) : null;

      console.log('user data: ', userData);
    }

    const logDocument = {
      user_id: logData.userId || null,
      user_name: logData.userName || userData?.name || 'System', // Default to 'System' if no user is provided
      description: logData.description,
      action: logData.action,
      entityType: logData.entityType || null,
      entityId: logData.entityId || null,
      createdAt: new Date(),
    };
    
    await auditLogsCollection.insertOne(logDocument);
    // console.log('Audit log created:', logData.description); // Optional: for debugging

  } catch (error) {
    // An audit log failure should not crash the main request.
    console.error('FATAL: Could not create audit log.', error);
  }
}


// ======================= AUDIT LOGS ======================= //

// GET /api/audit-logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const {
      search,
      page = 1,
      itemsPerPage = 10,
      sortBy,
      sortOrder
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(itemsPerPage);
    const limit = parseInt(itemsPerPage);

    const dab = await db();
    const collection = dab.collection('audit_logs');

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { description: searchRegex },
          { user_name: searchRegex },
          { action: searchRegex },
          { entityType: searchRegex }
        ]
      };
    }

    let sortOptions = { createdAt: -1 }; // Default sort: newest first
    if (sortBy) {
        // Map frontend keys to backend fields if necessary
        const sortField = sortBy === 'description' ? 'description' : 'createdAt';
        sortOptions = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
    }

    const logs = await collection.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalLogs = await collection.countDocuments(query);

    res.json({
      logs: logs,
      total: totalLogs,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs", message: error.message });
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