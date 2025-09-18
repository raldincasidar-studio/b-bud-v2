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
const { GoogleGenAI, createUserContent, createPartFromUri, Type } = require('@google/genai');

const MONGODB_URI = 'mongodb+srv://raldincasidar:dindin23@accounting-system.haaem.mongodb.net/?retryWrites=true&w=majority'
const GEMINI_API_KEY = 'AIzaSyAH0ZrwBAzmxZItNI0i6HA90s3Cauju5VM'
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


// Semaphore API Key
const SEMAPHORE_API_KEY = '48f0e4cc838b499efc9d2322c9b4a1a8';

// Function to generate a random 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

let CLIENT_DB;

async function db() {
  // REMOVED deprecated options: useNewUrlParser and useUnifiedTopology
  CLIENT_DB = new MongoClient(MONGODB_URI);
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

//   console.log(user);

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
  const { login_identifier, password } = req.body;

  if (!login_identifier || !password) {
    return res.status(400).json({ error: 'Validation failed', message: 'Email/Contact Number and password are required.' });
  }

  try {
    const dab = await db();
    const residentsCollection = dab.collection('residents');
    
    let resident;
    const isEmail = login_identifier.includes('@');

    if (isEmail) {
        resident = await residentsCollection.findOne({ email: String(login_identifier).trim().toLowerCase() });
    } else {
        resident = await residentsCollection.findOne({ contact_number: login_identifier });
    }

    if (!resident) {
      return res.status(401).json({ error: 'Invalid credentials.', message: 'Invalid credentials.' });
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

    if (isEmail) {
        // Send OTP email
        const mailOptions = {
          from: `"B-BUD System" <${SMTP_USER}>`,
          to: resident.email,
          subject: 'Your B-BBUD Login Verification Code',
          html: `
            <p>Hello ${resident.first_name || 'User'},</p>
            <p>To complete your login, please use the following One-Time Password (OTP):</p>
            <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
            <p>This OTP is valid for ${OTP_EXPIRY_MINUTES_LOGIN} minutes.</p>
            <p>If you did not attempt to log in, please secure your account or contact support immediately.</p>
            <br><p>Thanks,<br>The B-BBUD Team</p>`,
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
    } else {
        // Send OTP via SMS
        try {
            await sendMessage(resident.contact_number, `Your B-BBUD login OTP is ${otp}`);
            console.log(`Login OTP sent to ${resident.contact_number} (OTP: ${otp})`);
            return res.status(200).json({
                message: `An OTP has been sent to your contact number (${resident.contact_number}). Please enter it to complete your login.`,
                otpRequired: true,
            });
        } catch (smsError) {
            console.error("Fatal Error: Could not send login OTP SMS:", smsError);
            await residentsCollection.updateOne(
                { _id: resident._id },
                { $unset: { login_otp: "", login_otp_expiry: "" } }
            );
            return res.status(500).json({
                error: 'SMSSendingError',
                message: 'We encountered an issue sending the verification code to your contact number. Please try logging in again shortly. If the problem persists, contact support.'
            });
        }
    }

  } catch (error) {
    console.error("Critical error during resident login process:", error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected server error occurred during login.' });
  }
});


// =================== RESIDENT LOGIN - STEP 2 (Verify OTP) =================== //
app.post('/api/residents/login/verify-otp', async (req, res) => {
  const { login_identifier, otp } = req.body;

  if (!login_identifier || !otp) {
    return res.status(400).json({ error: 'Validation failed', message: 'Email/Contact number and OTP are required.' });
  }
  if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Validation failed', message: 'OTP must be a 6-digit number.' });
  }


  try {
    const dab = await db();
    const residentsCollection = dab.collection('residents');

    const isEmail = login_identifier.includes('@');
    const query = {
        login_otp: otp, // If OTP is hashed: Remove this line. Fetch by email, then use bcrypt.compare(otp, resident.login_otp_hash)
        login_otp_expiry: { $gt: new Date() }
    };

    if (isEmail) {
        query.email = String(login_identifier).trim().toLowerCase();
    } else {
        query.contact_number = login_identifier;
    }

    // Find resident by email, OTP, and ensure OTP is not expired
    // IMPORTANT: If OTP is hashed in DB, query for email first, then compare hashed OTP.
    const resident = await residentsCollection.findOne(query);

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
        from: `"B-BBUD System" <${SMTP_USER}>`,
        to: normalizedEmail,
        subject: 'Your Password Reset OTP Code',
        html: `
          <p>Hello ${resident.first_name || 'User'},</p>
          <p>You requested a password reset. Your One-Time Password (OTP) is:</p>
          <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
          <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <br>
          <p>Thanks,<br>The B-BBUD Team</p>
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
// Helper function to create a resident document from payload data.
const createResidentDocument = (data, isHead = false, headAddress = null) => {
    const age = calculateAge(data.date_of_birth);
    let email = data.email ? String(data.email).toLowerCase() : null;
    let contact_number = data.contact_number ? String(data.contact_number).trim() : null;

    return {
        // Personal Info
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        last_name: data.last_name,
        suffix: data.suffix || null,
        sex: data.sex,
        date_of_birth: new Date(data.date_of_birth),
        age: age,
        civil_status: data.civil_status,
        citizenship: data.citizenship,
        occupation_status: data.occupation_status,
        email: email,
        password_hash: md5(data.password) || null, // Password will be set/hashed during activation for pending accounts
        contact_number: contact_number,
        relationship_to_head: isHead ? null : (data.relationship_to_head === 'Other' ? data.other_relationship : data.relationship_to_head),

        proof_of_relationship_file: data.proof_of_relationship_file || null,
        proof_of_relationship_base64: data.proof_of_relationship_base64 || null,

        // Address Info (Use head's address if provided)
        address_unit_room_apt_number: data.address_unit_room_apt_number || null, // NEW FIELD
        address_house_number: headAddress ? headAddress.address_house_number : data.address_house_number,
        address_street: headAddress ? headAddress.address_street : data.address_street,
        address_subdivision_zone: headAddress ? headAddress.address_subdivision_zone : data.address_subdivision_zone,
        address_city_municipality: headAddress ? headAddress.address_city_municipality : data.address_city_municipality,
        type_of_household: data.type_of_household || null, // NEW FIELD
        years_at_current_address: isHead ? data.years_at_current_address : null,
        // MODIFIED: proof_of_residency_base64 is now an array
        proof_of_residency_base64: isHead ? (Array.isArray(data.proof_of_residency_base64) ? data.proof_of_residency_base64 : []) : null,
        // NEW: Authorization letter field
        authorization_letter_base64: isHead ? (data.authorization_letter_base64 || null) : null,

        // Voter Info
        is_voter: data.is_voter || false,
        voter_id_number: data.is_voter ? data.voter_id_number : null,
        voter_registration_proof_base64: data.is_voter ? data.voter_registration_proof_base64 : null,

        // PWD Info
        is_pwd: data.is_pwd || false,
        pwd_id: data.is_pwd ? data.pwd_id : null,
        pwd_card_base64: data.is_pwd ? data.pwd_card_base64 : null,

        is_senior_citizen: data.is_senior_citizen || false,
        senior_citizen_id: data.is_senior_citizen ? data.senior_citizen_id : null,
        senior_citizen_card_base64: data.is_senior_citizen ? data.senior_citizen_card_base64 : null,
        
        // System-set Fields
        is_household_head: isHead,
        household_member_ids: isHead ? [] : undefined,
        status: 'Pending', // All new accounts start as Pending, awaiting activation
        created_at: new Date(),
        updated_at: new Date(),
        date_approved: null, // Will be set upon approval/activation
        
        // --- NEW: Account activation fields (temporary) ---
        // account_number: null, // Removed as per your request
        activation_otp: null,
        activation_otp_expiry: null,
        pending_password_hash: null, // Will hold the new password during activation flow
        account_status: 'Active', // Default account_status unless issues like overdue
    };
};

// POST /api/residents - CREATE A NEW HOUSEHOLD (HEAD + MEMBERS) - UPDATED
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
            // Ensure date_of_birth is present and type_of_household is optional as per frontend
            if (!headData.first_name || !headData.last_name || !headData.email || !headData.password || !headData.date_of_birth) {
                throw new Error('Validation failed: Head requires first name, last_name, email, password, and date of birth.');
            }
            // Removed: The explicit backend validation for `type_of_household` as it's now optional on the frontend
            // and the AI validation can still process it if present.

            const existingEmail = await residentsCollection.findOne({ email: headData.email.toLowerCase() }, { session });
            if (existingEmail) {
                throw new Error('Conflict: The email address for the Household Head is already in use.');
            }

            const headResidentDocument = createResidentDocument(headData, true);
            // Store head's email, contact_number, and password as pending
            headResidentDocument.email = headData.email.toLowerCase();
            headResidentDocument.contact_number = headData.contact_number ? String(headData.contact_number).trim() : null;
            headResidentDocument.pending_password_hash = md5(headData.password); // Store new password temporarily for the head's own activation

            // --- AI Validation for Proof of Residency (multiple files + authorization letter) ---
            if (!Array.isArray(headData.proof_of_residency_base64) || headData.proof_of_residency_base64.length === 0) {
              throw new Error('Validation failed: At least one proof of residency document is required.');
            }
            const aiResidencyValidation = await validateProofOfResidency(
              {
                first_name: headData.first_name,
                middle_name: headData.middle_name,
                last_name: headData.last_name,
                suffix: headData.suffix,
                date_of_birth: headData.date_of_birth, // <--- ADDED date_of_birth for AI validation
                address_house_number: headData.address_house_number,
                address_unit_room_apt_number: headData.address_unit_room_apt_number,
                address_street: headData.address_street,
                address_subdivision_zone: headData.address_subdivision_zone,
                address_city_municipality: headData.address_city_municipality,
                type_of_household: headData.type_of_household // Keep this as AI can still use it if present
              },
              headData.proof_of_residency_base64, // Array of base64 strings
              headData.authorization_letter_base64 || null // Optional authorization letter
            );

            if (!aiResidencyValidation.isValid) {
              throw new Error(`Proof of Residency AI validation failed: ${aiResidencyValidation.message}`);
            }


            // ... (validation for voter, PWD, Senior as existing, remains the same) ...
            if (headData.is_voter) {
                const proofOfVoterResult = await validateProofOfVoter(headData, headData.voter_registration_proof_base64);
                if (!proofOfVoterResult.isValid) {
                    throw new Error(proofOfVoterResult.message);
                }
            }
            if (headData.is_pwd) {
                const proofOfPWDResult = await validateProofOfPWD(headData, headData.pwd_card_base64);
                if (!proofOfPWDResult.isValid) {
                    throw new Error(proofOfPWDResult.message);
                }
            }
            
            const headInsertResult = await residentsCollection.insertOne(headResidentDocument, { session });
            const insertedHeadId = headInsertResult.insertedId;
            // Removed account_number assignment here.

            newHouseholdHead = { _id: insertedHeadId, ...headResidentDocument };

            // --- Step 2: Validate and Prepare Household Members ---
            const createdMemberIds = [];
            // const processedEmails = new Set(headData.email ? [headData.email.toLowerCase()] : []); // This was unused

            for (const memberData of membersToCreate) {
                // Ensure date_of_birth is required for members too
                if (!memberData.first_name || !memberData.last_name || !memberData.relationship_to_head || !memberData.date_of_birth) {
                    throw new Error(`Validation failed for member: Missing required fields (first_name, last_name, relationship_to_head, date_of_birth).`);
                }
                // const memberAge = calculateAge(memberData.date_of_birth); // Unused here

                // When creating a member, createResidentDocument will copy address/household type from headData
                const newMemberDoc = createResidentDocument(memberData, false, headData); // headData is passed here
                newMemberDoc.email = memberData.email ? String(memberData.email).toLowerCase() : null;
                newMemberDoc.contact_number = memberData.contact_number ? String(memberData.contact_number).trim() : null;
                if (memberData.password) {
                    newMemberDoc.pending_password_hash = md5(memberData.password);
                }
                
                // ... (validation for voter, PWD as existing, remains the same) ...
                if (memberData.is_voter) {
                    const proofOfVoterResult = await validateProofOfVoter(memberData, memberData.voter_registration_proof_base64);
                    if (!proofOfVoterResult.isValid) {
                        throw new Error(proofOfVoterResult.message);
                    }
                }
                if (memberData.is_pwd) {
                    const proofOfPWDResult = await validateProofOfPWD(memberData, memberData.pwd_card_base64);
                    if (!proofOfPWDResult.isValid) {
                        throw new Error(proofOfPWDResult.message);
                    }
                }

                const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
                const insertedMemberId = memberInsertResult.insertedId;
                // Removed account_number assignment here.

                createdMemberIds.push(insertedMemberId);
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
        }); // End of the transaction

        // The audit log description below will also need to be adjusted as 'account_number' is not available in newHouseholdHead
        await createAuditLog({
          userId: newHouseholdHead._id.toString(),
          userName: `${newHouseholdHead.first_name} ${newHouseholdHead.last_name}`,
          description: `Resident '${newHouseholdHead.first_name} ${newHouseholdHead.last_name}' created a new household.`, // Simplified description
          action: "REGISTER",
          entityType: "Resident",
          entityId: newHouseholdHead._id.toString(),
        }, req)

        res.status(201).json({
            message: 'Household registered successfully! All accounts are pending activation.',
            resident: newHouseholdHead // The frontend will need to derive the account number from _id
        });

    } catch (error) {
        console.error("Error during household registration transaction:", error);
        if (error.message.startsWith('Conflict:')) {
            return res.status(409).json({ error: 'The email is already been registered.', message: error.message });
        }
        if (error.message.startsWith('Validation failed:')) {
             return res.status(400).json({ error: 'Validation Error', message: error.message });
        }
        if (error.message.startsWith('Proof of Residency AI validation failed:')) {
          // Special handling for AI validation errors
          return res.status(400).json({ error: 'AI Validation Error', message: error.message });
        }
        console.error('Mobile Registration error: ', error);
        res.status(500).json({ error: error.message, message: error.message || 'Could not complete registration.' });
    } finally {
        await session.endSession();
    }
});

// POST /api/admin/residents - FOR ADMIN ENDPOINT CREATE RESIDENT (UPDATED)
app.post('/api/admin/residents', async (req, res) => {
    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const session = CLIENT_DB.startSession();

    try {
        let newHouseholdHead;

        const finalStatus = 'Approved'; // Admin can set to Approved directly
        const finalApprovalDate = new Date();

        await session.withTransaction(async () => {
            const headData = req.body;
            const membersToCreate = headData.household_members_to_create || [];

            if (!headData.first_name || !headData.last_name || !headData.email || !headData.password) {
                throw new Error('Validation failed: Head requires first name, last_name, email, and password.');
            }
            // NEW FIELD: Validate type_of_household for the head
            // if (!headData.type_of_household) {
            //     throw new Error('Validation failed: Type of household is required for the Household Head.');
            // }
            
            if (headData.email && headData.email.trim() !== '') {
                const existingEmail = await residentsCollection.findOne({ email: headData.email.toLowerCase() }, { session });
                if (existingEmail) {
                    throw new Error('Conflict: The email address for the Household Head is already in use.');
                }
            }

            const headResidentDocument = createResidentDocument(headData, true);
            headResidentDocument.password_hash = md5(headData.password); // Admin sets password directly for immediate login
            headResidentDocument.email = headData.email.toLowerCase(); // Ensure email is saved
            headResidentDocument.contact_number = headData.contact_number ? String(headData.contact_number).trim() : null; // Ensure contact is saved
            
            // MODIFIED: proof_of_residency_base64 now an array
            headResidentDocument.proof_of_residency_base64 = Array.isArray(headData.proof_of_residency_base64) ? headData.proof_of_residency_base64 : [];
            headResidentDocument.authorization_letter_base64 = headData.authorization_letter_base64 || null; // NEW

            headResidentDocument.voter_registration_proof_base64 = headData.voter_registration_proof_base64 || null;
            headResidentDocument.pwd_card_base64 = headData.pwd_card_base64 || null;
            headResidentDocument.senior_citizen_card_base64 = headData.senior_citizen_card_base64 || null;
            
            // NEW FIELD: Include address_unit_room_apt_number and type_of_household in the saved document
            headResidentDocument.address_unit_room_apt_number = headData.address_unit_room_apt_number || null; // NEW FIELD
            headResidentDocument.type_of_household = headData.type_of_household; // NEW FIELD

            headResidentDocument.status = finalStatus;
            headResidentDocument.date_approved = finalApprovalDate;
            headResidentDocument.created_at = new Date();
            headResidentDocument.updated_at = new Date();

            const headInsertResult = await residentsCollection.insertOne(headResidentDocument, { session });
            const insertedHeadId = headInsertResult.insertedId;
            // Removed account_number assignment here.

            newHouseholdHead = { _id: insertedHeadId, ...headResidentDocument };

            const createdMemberIds = [];
            // const processedEmails = new Set(headData.email ? [headData.email.toLowerCase()] : []); // Unused

            for (const memberData of membersToCreate) {
                if (!memberData.first_name || !memberData.last_name || !memberData.relationship_to_head) {
                    throw new Error(`Validation failed for member: Missing required fields.`);
                }
                // const memberAge = calculateAge(memberData.date_of_birth); // Unused
                
                // When creating a member, createResidentDocument will copy address/household type from headData
                const newMemberDoc = createResidentDocument(memberData, false, headData); // headData is passed here
                if (memberData.password) {
                    newMemberDoc.password_hash = md5(memberData.password);
                } else {
                    newMemberDoc.password_hash = null;
                }
                newMemberDoc.email = memberData.email ? String(memberData.email).toLowerCase() : null;
                newMemberDoc.contact_number = memberData.contact_number ? String(memberData.contact_number).trim() : null;

                newMemberDoc.proof_of_relationship_base64 = memberData.proof_of_relationship_base64 || null;
                newMemberDoc.voter_registration_proof_base64 = memberData.voter_registration_proof_base64 || null;
                newMemberDoc.pwd_card_base64 = memberData.pwd_card_base64 || null;
                newMemberDoc.senior_citizen_card_base64 = memberData.senior_citizen_card_base64 || null;

                // NEW FIELD: address_unit_room_apt_number and type_of_household are copied by createResidentDocument
                // No explicit assignment needed here if createResidentDocument handles it.

                newMemberDoc.status = finalStatus;
                newMemberDoc.date_approved = finalApprovalDate;
                newMemberDoc.created_at = new Date();
                newMemberDoc.updated_at = new Date();

                const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
                const insertedMemberId = memberInsertResult.insertedId;
                // Removed account_number assignment here.

                createdMemberIds.push(insertedMemberId);
            }

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
          userId: 'SYSTEM_ADMIN', 
          userName: 'System Admin', 
          description: `Admin-created a new, approved household for '${newHouseholdHead.first_name} ${newHouseholdHead.last_name}'.`,
          action: "ADMIN_CREATE_HOUSEHOLD",
          entityType: "Resident",
          entityId: newHouseholdHead._id.toString(),
        }, req);

        res.status(201).json({
            message: 'Household registered and approved successfully!',
            resident: newHouseholdHead
        });

    } catch (error) {
        console.error("Error during admin household registration:", error);
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


// POST /api/residents/:householdHeadId/members - ADD A NEW MEMBER TO AN EXISTING HOUSEHOLD (UPDATED)
app.post('/api/residents/:householdHeadId/members', async (req, res) => {
    const { householdHeadId } = req.params;
    const memberData = req.body;

    if (!ObjectId.isValid(householdHeadId)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid household head ID format.' });
    }
    if (!memberData || !memberData.first_name || !memberData.last_name || !memberData.relationship_to_head) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required member information.' });
    }

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const session = CLIENT_DB.startSession();

    try {
        let newMemberId;

        await session.withTransaction(async () => {
            const householdHead = await residentsCollection.findOne({ _id: new ObjectId(householdHeadId) }, { session });
            if (!householdHead || !householdHead.is_household_head) {
                throw new Error('Household head not found or the specified user is not a household head.');
            }

            if (memberData.email) {
                const existingEmail = await residentsCollection.findOne({ email: memberData.email.toLowerCase() }, { session });
                if (existingEmail) {
                    throw new Error(`Conflict: The email address '${memberData.email}' is already in use.`);
                }
            }

            // createResidentDocument will copy address and type_of_household from householdHead
            // Ensure createResidentDocument also handles initial date_created, date_updated if it's not passed
            const newMemberDoc = createResidentDocument(memberData, false, householdHead);
            newMemberDoc.email = memberData.email ? String(memberData.email).toLowerCase() : null;
            newMemberDoc.contact_number = memberData.contact_number ? String(memberData.contact_number).trim() : null;
            if (memberData.password) {
                newMemberDoc.pending_password_hash = md5(memberData.password);
            }
            
            newMemberDoc.proof_of_relationship_base64 = memberData.proof_of_relationship_base64 || null;
            
            if (memberData.is_voter) {
                const proofOfVoterResult = await validateProofOfVoter(memberData, memberData.voter_registration_proof_base64);
                if (!proofOfVoterResult.isValid) {
                    throw new Error(proofOfVoterResult.message);
                }
            }
            if (memberData.is_pwd) {
                const proofOfPWDResult = await validateProofOfPWD(memberData, memberData.pwd_card_base64);
                if (!proofOfPWDResult.isValid) {
                    throw new Error(proofOfPWDResult.message);
                }
            }
            // Add validation for senior citizen if needed
            // Also add handling for senior_citizen_id and senior_citizen_card_file if coming from memberData
            if (memberData.is_senior_citizen && (memberData.senior_citizen_id || memberData.senior_citizen_card_file)) {
                // Add validation similar to PWD/Voter if applicable
                newMemberDoc.senior_citizen_id = memberData.senior_citizen_id || null;
                newMemberDoc.senior_citizen_card_base64 = memberData.senior_citizen_card_base64 || null;
            }


            newMemberDoc.status = 'Pending';
            newMemberDoc.date_approved = null;
            // Changed from created_at/updated_at to date_created/date_updated for consistency
            newMemberDoc.date_created = new Date();
            newMemberDoc.date_updated = new Date();

            const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
            newMemberId = memberInsertResult.insertedId;

            await residentsCollection.updateOne(
                { _id: new ObjectId(householdHeadId) },
                { $push: { household_member_ids: newMemberId }, 
                  $set: { date_updated: new Date() } // IMPORTANT: Changed from updated_at to date_updated
                },
                { session }
            );
        });

        const headDetails = await residentsCollection.findOne({ _id: new ObjectId(householdHeadId) });
        await createAuditLog({
          userId: householdHeadId,
          userName: `${headDetails.first_name} ${headDetails.last_name}`,
          description: `Added a new member, '${memberData.first_name} ${memberData.last_name}', to their household.`,
          action: "ADD_MEMBER",
          entityType: "Resident",
          entityId: newMemberId.toString(),
        }, req);

        res.status(201).json({ message: 'Household member added successfully.', memberId: newMemberId });

    } catch (error) {
        console.error("Error adding household member:", error);
        if (error.message.startsWith('Conflict:')) {
            return res.status(409).json({ error: 'Email Conflict', message: error.message });
        }
        if (error.message.startsWith('Validation failed for member:')) {
            return res.status(400).json({ error: 'Validation Error', message: error.message });
        }
        if (error.message === 'Household head not found or the specified user is not a household head.') {
            return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        res.status(500).json({ error: 'Server Error', message: error.message || 'Could not add household member.' });
    } finally {
        await session.endSession();
    }
});

app.post('/api/residents/:householdHeadId/members', async (req, res) => {
    const { householdHeadId } = req.params;
    const memberData = req.body;

    if (!ObjectId.isValid(householdHeadId)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid household head ID format.' });
    }
    if (!memberData || !memberData.first_name || !memberData.last_name || !memberData.relationship_to_head) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required member information.' });
    }

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const session = CLIENT_DB.startSession();

    try {
        let newMemberId;

        await session.withTransaction(async () => {
            const householdHead = await residentsCollection.findOne({ _id: new ObjectId(householdHeadId) }, { session });
            if (!householdHead || !householdHead.is_household_head) {
                throw new Error('Household head not found or the specified user is not a household head.');
            }

            if (memberData.email) {
                const existingEmail = await residentsCollection.findOne({ email: memberData.email.toLowerCase() }, { session });
                if (existingEmail) {
                    throw new Error(`Conflict: The email address '${memberData.email}' is already in use.`);
                }
            }

            // createResidentDocument will copy address and type_of_household from householdHead
            const newMemberDoc = createResidentDocument(memberData, false, householdHead);
            newMemberDoc.email = memberData.email ? String(memberData.email).toLowerCase() : null;
            newMemberDoc.contact_number = memberData.contact_number ? String(memberData.contact_number).trim() : null;
            if (memberData.password) {
                newMemberDoc.pending_password_hash = md5(memberData.password);
            }
            
            // Removed photo_base64 as it was not in your frontend code (new-resident-account.vue)
            // newMemberDoc.photo_base64 = memberData.photo_base64 || null; // This line seems to be old/incorrect from previous prompt
            newMemberDoc.proof_of_relationship_base64 = memberData.proof_of_relationship_base64 || null;
            
            if (memberData.is_voter) {
                const proofOfVoterResult = await validateProofOfVoter(memberData, memberData.voter_registration_proof_base64);
                if (!proofOfVoterResult.isValid) {
                    throw new Error(proofOfVoterResult.message);
                }
            }
            if (memberData.is_pwd) {
                const proofOfPWDResult = await validateProofOfPWD(memberData, memberData.pwd_card_base64);
                if (!proofOfPWDResult.isValid) {
                    throw new Error(proofOfPWDResult.message);
                }
            }
            // Add validation for senior citizen if needed

            newMemberDoc.status = 'Pending';
            newMemberDoc.date_approved = null;
            newMemberDoc.created_at = new Date();
            newMemberDoc.updated_at = new Date();

            const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
            newMemberId = memberInsertResult.insertedId;
            // Removed account_number assignment here.

            await residentsCollection.updateOne(
                { _id: new ObjectId(householdHeadId) },
                { $push: { household_member_ids: newMemberId }, $set: { updated_at: new Date() } },
                { session }
            );
        });

        const headDetails = await residentsCollection.findOne({ _id: new ObjectId(householdHeadId) });
        // The audit log description below will need to be adjusted as 'account_number' is not directly available
        await createAuditLog({
          userId: householdHeadId,
          userName: `${headDetails.first_name} ${headDetails.last_name}`,
          description: `Added a new member, '${memberData.first_name} ${memberData.last_name}', to their household.`, // Simplified description
          action: "ADD_MEMBER",
          entityType: "Resident",
          entityId: newMemberId.toString(),
        }, req);

        res.status(201).json({ message: 'Household member added successfully.', memberId: newMemberId });

    } catch (error) {
        console.error("Error adding household member:", error);
        if (error.message.startsWith('Conflict:')) {
            return res.status(409).json({ error: 'Email Conflict', message: error.message });
        }
        if (error.message.startsWith('Validation failed for member:')) {
            return res.status(400).json({ error: 'Validation Error', message: error.message });
        }
        if (error.message === 'Household head not found or the specified user is not a household head.') {
            return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        res.status(500).json({ error: 'Server Error', message: error.message || 'Could not add household member.' });
    } finally {
        await session.endSession();
    }
});

// PATCH /api/residents/:id/status - APPROVE/DECLINE/DEACTIVATE A RESIDENT
// This route is CRUCIAL for the date_approved logic to work.
// app.patch('/api/residents/:id/status', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status, reason } = req.body;

//         // --- VALIDATION ---
//         if (!ObjectId.isValid(id)) {
//             return res.status(400).json({ message: 'Invalid ID format.' });
//         }
//         if (!status) {
//             return res.status(400).json({ message: 'Status is required.' });
//         }
//         const requiresReason = ['Deactivated', 'Declined', 'Pending'];
//         if (requiresReason.includes(status) && (!reason || reason.trim() === '')) {
//             return res.status(400).json({ message: `A reason is required to ${status.toLowerCase()} this account.` });
//         }

//         const dab = await db();
//         const residentsCollection = dab.collection('residents');
//         const documentRequestsCollection = dab.collection('document_requests');
//         const borrowedAssetsCollection = dab.collection('borrowed_assets');
//         const complaintsCollection = dab.collection('complaints'); // ADDED: Declare complaints collection

//         const resident = await residentsCollection.findOne({ _id: new ObjectId(id) });
//         if (!resident) {
//             return res.status(404).json({ message: 'Resident not found.' });
//         }

//         const updateDocument = {
//             $set: {
//                 status: status,
//                 updated_at: new Date()
//             }
//         };
        
//         if (reason) {
//             updateDocument.$set.status_reason = reason;
//         } else {
//             updateDocument.$unset = { status_reason: "" };
//         }

//         if (status === 'Approved') {
//             updateDocument.$set.date_approved = new Date();
//         } 
//         else if (status === 'Deactivated') {
//             console.log(`Resident ${id} is being deactivated. Initiating cascading updates.`);
//             const defaultDeactivationReason = "Account deactivated by admin.";
//             const actualReason = reason && reason.trim() !== '' ? reason : defaultDeactivationReason; // Use provided reason or a default

//             // --- Existing logic for Document Requests ---
//             const docReqInvalidationReason = `Request invalidated because the user's account was deactivated. Reason: ${actualReason}`;
//             const docReqUpdateResult = await documentRequestsCollection.updateMany(
//                 { 
//                     requestor_resident_id: new ObjectId(id),
//                     document_status: { $in: ['Pending', 'Processing'] }
//                 },
//                 { 
//                     $set: { 
//                         document_status: 'Declined', 
//                         status_reason: docReqInvalidationReason,
//                         updated_at: new Date()
//                     } 
//                 }
//             );
//             console.log(`[Deactivation Cascading] Document Requests: ${docReqUpdateResult.modifiedCount} requests declined for resident ${id}.`);
            
//             // --- Logic to Reject Borrowed Asset Transactions ---
//             const borrowedAssetsRejectionNote = `Transaction automatically rejected. Reason: User account was deactivated. Admin note: "${actualReason}"`;
//             const borrowedAssetsUpdateResult = await borrowedAssetsCollection.updateMany(
//                 {
//                     borrower_resident_id: new ObjectId(id),
//                     status: { $in: ['Pending', 'Processing'] } // Active statuses to be rejected
//                 },
//                 {
//                     $set: {
//                         status: 'Rejected',
//                         notes: borrowedAssetsRejectionNote, // Set a clear rejection reason in the notes
//                         updated_at: new Date()
//                     }
//                 }
//             );
//             console.log(`[Deactivation Cascading] Borrowed Assets: ${borrowedAssetsUpdateResult.modifiedCount} transactions rejected for resident ${id}.`);

//             // --- ADDED: Logic to Dismiss/Decline Pending Complaints ---
//             const complaintDismissReason = `Complaint automatically dismissed due to complainant's deactivated account. Reason: "${actualReason}"`;
//             const complaintsUpdateResult = await complaintsCollection.updateMany(
//                 {
//                     complainant_resident_id: new ObjectId(id),
//                     // These are the "active" statuses for a complaint
//                     status: { $in: ['New'] } 
//                 },
//                 {
//                     $set: {
//                         status: 'Dismissed', // Set to 'Dismissed'
//                         status_reason: complaintDismissReason, // Set the specific reason
//                         updated_at: new Date()
//                     }
//                 }
//             );
//             console.log(`[Deactivation Cascading] Complaints: ${complaintsUpdateResult.modifiedCount} complaints dismissed for resident ${id}.`);
//             // --- END ADDED LOGIC ---
//         }

//         const result = await residentsCollection.updateOne(
//             { _id: new ObjectId(id) },
//             updateDocument
//         );

//         if (result.matchedCount === 0) {
//             return res.status(404).json({ message: 'Resident not found during update.' });
//         }

//         await createAuditLog({
//             description: `Resident account for '${resident.first_name} ${resident.last_name}' status changed to '${status}'. Reason: ${reason || 'N/A'}`,
//             action: 'STATUS_CHANGE',
//             entityType: 'Resident',
//             entityId: id
//         }, req);

//         res.status(200).json({ message: `Resident status updated to ${status}.` });

//     } catch (error) {
//         console.error("Error updating resident status:", error);
//         res.status(500).json({ error: 'Server Error', message: 'Could not update resident status.' });
//     }
// });

// GET ALL RESIDENTS (GET) - Updated to handle all dashboard filters AND DATE RANGE
app.get('/api/residents', async (req, res) => {
  try {
    const {
      search, status, is_voter, is_senior, is_pwd, is_household_head, // ADDED is_household_head here
      occupation, minAge, maxAge, sortBy, sortOrder,
      start_date, end_date // <-- ADDED: Date range query parameters
    } = req.query;
    
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    // Calculate skip only if itemsPerPage is not a very large number (like for print all functionality)
    const skip = (itemsPerPage > 100000) ? 0 : (page - 1) * itemsPerPage; 

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const filters = [];

    // --- Handle 'On-hold' status filter ---
    if (status) {
      if (status === 'On-hold') {
        filters.push({ status: 'Approved', account_status: 'Deactivated' });
      } else if (status === 'All') {
        // No status filter if 'All' is selected
      } else {
        filters.push({ status: status });
      }
    }

    if (is_voter === 'true') filters.push({ is_registered_voter: true });
    if (is_pwd === 'true') filters.push({ is_pwd: true });
    if (is_senior === 'true') filters.push({ is_senior_citizen: true });
    if (occupation) filters.push({ occupation_status: occupation });

    // --- ADDED: Household Role Filtering ---
    if (is_household_head !== undefined) { // Check if the parameter is explicitly provided
      // Convert string 'true'/'false' from query to boolean
      filters.push({ is_household_head: is_household_head === 'true' });
    }
    // --- END ADDED Household Role Filtering ---
    
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

    // --- ADDED: Date Range Filtering for 'created_at' (Date Added) ---
    if (start_date || end_date) {
      const dateAddedFilter = {};
      if (start_date) {
        dateAddedFilter.$gte = new Date(start_date); // Convert ISO string to Date object
      }
      if (end_date) {
        dateAddedFilter.$lte = new Date(end_date);   // Convert ISO string to Date object
      }
      if (Object.keys(dateAddedFilter).length > 0) {
        filters.push({ created_at: dateAddedFilter });
      }
    }
    // --- END ADDED Date Range Filtering ---

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filters.push({
        $or: [
          { first_name: searchRegex }, { middle_name: searchRegex }, { last_name: searchRegex },
          { email: searchRegex }, { contact_number: searchRegex }, { address_street: searchRegex },
          { address_subdivision_zone: searchRegex }, { precinct_number: searchRegex },
          { address_unit_room_apt_number: searchRegex }, // NEW FIELD: Search by unit/room/apt number
          { type_of_household: searchRegex }, // NEW FIELD: Search by type of household
        ],
      });
    }

    const finalQuery = filters.length > 0 ? { $and: filters } : {};

    let sortOptions = { created_at: -1 }; 
    if (sortBy) {
        const sortKey = sortBy === 'date_added' ? 'created_at' : sortBy;
        sortOptions = { [sortKey]: sortOrder === 'desc' ? -1 : 1 };
    }
    
    // --- UPDATE: Add `account_status` and new fields to the projection ---
    const projection = {
        first_name: 1, middle_name: 1, last_name: 1, suffix: 1, sex: 1,
        date_of_birth: 1, is_household_head: 1, address_house_number: 1,
        address_unit_room_apt_number: 1, // NEW FIELD
        address_street: 1, address_subdivision_zone: 1, contact_number: 1,
        email: 1, status: 1, _id: 1,
        type_of_household: 1, // NEW FIELD
        account_status: 1, // Added for frontend logic
        date_added: "$created_at",
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

app.patch('/api/residents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    // Body can contain either 'status' OR 'account_status'
    const { status, account_status, reason } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid resident ID format.' });
    }

    if (!status && !account_status) {
      return res.status(400).json({ message: 'A new status or account_status must be provided.' });
    }

    if (!!account_status && !reason) {
        return res.status(400).json({ message: 'A reason for the status change is required.' });
    }

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const residentId = new ObjectId(id);

    const currentResident = await residentsCollection.findOne({ _id: residentId });
    if (!currentResident) {
      return res.status(404).json({ message: 'Resident not found.' });
    }

    const updatePayload = { $set: {} };
    let historyLogAction = '';

    // --- Logic to handle the update ---
    if (status) {
      // Handle updates to the primary status (Approved, Declined, Deactivated, Pending)
      const allowedPrimaryStatus = ['Approved', 'Declined', 'Deactivated', 'Pending'];
      if (!allowedPrimaryStatus.includes(status)) {
        return res.status(400).json({ message: `Invalid primary status: ${status}` });
      }
      
      updatePayload.$set.status = status;
      historyLogAction = `Status changed to ${status}`;

      // If moving to 'Approved' for the first time, set the approval date and ensure account is active
      if (status === 'Approved' && currentResident.status !== 'Approved') {
        updatePayload.$set.date_approved = new Date();
        updatePayload.$set.account_status = 'Active'; // Default to active on approval
      }

    } else if (account_status) {
      // Handle updates to the secondary account_status (Active, Deactivated for hold)
      const allowedSecondaryStatus = ['Active', 'Deactivated'];
       if (!allowedSecondaryStatus.includes(account_status)) {
        return res.status(400).json({ message: `Invalid account status: ${account_status}` });
      }
      
      // You should only be able to set a hold if the account is already approved
      if (currentResident.status !== 'Approved') {
         return res.status(409).json({ message: 'Cannot change account hold status on a non-approved account.' });
      }

      updatePayload.$set.account_status = account_status;
      historyLogAction = account_status === 'Active' ? 'Account hold removed (Set to Active)' : 'Account placed on hold (Set to Deactivated)';
    }

    // --- Create a history log for the change ---
    const historyEntry = {
      action: historyLogAction,
      reason: reason,
      // Assuming you have middleware that adds the admin/user to the request object
      changed_by: req.user ? new ObjectId(req.user.id) : 'SYSTEM', 
      timestamp: new Date(),
    };

    updatePayload.$push = { status_history: historyEntry };

    const result = await residentsCollection.updateOne(
      { _id: residentId },
      updatePayload
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Update failed. Resident not found." });
    }
    if (result.modifiedCount === 0) {
      return res.status(304).json({ message: "No change in status was made." });
    }

    res.status(200).json({ message: "Resident status updated successfully.", residentId: id });

  } catch (error) {
    console.error("Error updating resident status:", error);
    res.status(500).json({ message: "Failed to update resident status", error: error.message });
  }
});


// GET ALL APPROVED RESIDENTS (GET) - Updated to handle all dashboard filters
app.get('/api/residents/approved', async (req, res) => {
  try {
    // --- UPDATED: Added is_household_head to the destructured query params ---
    const {
      search, is_voter, is_senior, is_pwd,
      occupation, minAge, maxAge, sortBy, sortOrder,
      is_household_head // <-- ADDED
    } = req.query;
    
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const residentsCollection = dab.collection('residents');

    const filters = [ { status: 'Approved' } ];

    if (is_voter === 'true') filters.push({ is_registered_voter: true });
    if (is_pwd === 'true') filters.push({ is_pwd: true });
    if (is_senior === 'true') filters.push({ is_senior_citizen: true });
    if (occupation) filters.push({ occupation_status: occupation });

    // --- NEW: Added logic to handle the household role filter ---
    if (is_household_head === 'true') {
        filters.push({ is_household_head: true });
    } else if (is_household_head === 'false') {
        filters.push({ is_household_head: false });
    }
    // If is_household_head is not provided, no role filter is applied (shows all roles).
    
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

    let sortOptions = { date_approved: -1 };
    if (sortBy) {
        // Note: The frontend sends 'household_role' as the sortBy key, but the actual field is 'is_household_head'.
        // You may need to map this if you want to sort by role.
        const sortKey = sortBy === 'date_added' ? 'created_at' : (sortBy === 'household_role' ? 'is_household_head' : sortBy);
        sortOptions = { [sortKey]: sortOrder === 'desc' ? -1 : 1 };
    }
    
    const projection = {
        first_name: 1, middle_name: 1, last_name: 1, suffix: 1, sex: 1,
        date_of_birth: 1, is_household_head: 1, address_house_number: 1,
        address_street: 1, address_subdivision_zone: 1, contact_number: 1,
        email: 1, status: 1, _id: 1,
        date_added: "$created_at",
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

  console.log(`[BACKEND SEARCH - START] Received search request. Query parameter 'q': "${searchQuery}"`);
  console.log(`[BACKEND SEARCH - START] Limit results: ${limitResults}`);
  console.log(`[BACKEND SEARCH - START] Request origin: ${req.headers.origin || 'Unknown'}`); // Log the origin of the request
  console.log(`[BACKEND SEARCH - START] Request user-agent: ${req.headers['user-agent'] || 'Unknown'}`); // Log the user-agent
  console.log(`[BACKEND SEARCH - INFO] Request received. Query parameter 'q': "${searchQuery}"`); // Added
  console.log(`[BACKEND SEARCH - INFO] Limit results: ${limitResults}`); // Added
  if (!searchQuery || searchQuery.trim().length < 2) {
    console.log('[BACKEND SEARCH - EARLY EXIT] Search query is empty or too short. Returning empty results.');
    return res.json({ residents: [] }); // Return empty if no search query or too short
  }

  const dab = await db();
  if (!dab) {
      console.error('[BACKEND SEARCH - ERROR] Database connection not established. Cannot proceed.');
      return res.status(500).json({ error: "Server error: Database connection failed." });
  }
  const residentsCollection = dab.collection('residents');
  if (!residentsCollection) {
      console.error('[BACKEND SEARCH - ERROR] Residents collection not found in DB instance. Cannot proceed.');
      return res.status(500).json({ error: "Server error: Residents collection inaccessible." });
  }

  try {
    const trimmedQuery = searchQuery.trim();
    // Ensure regex pattern is correctly escaped if necessary, though RegExp constructor handles most cases
    const searchRegex = new RegExp(trimmedQuery, 'i'); 

    console.log(`[BACKEND SEARCH - INFO] Using search regex pattern: ${searchRegex.source}`); // Log the actual regex pattern

    const query = {
      $or: [
        { first_name: { $regex: searchRegex } },
        { last_name: { $regex: searchRegex } },
        { middle_name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { contact_number: { $regex: searchRegex } },
        { address_house_number: { $regex: searchRegex } },
        { address_street: { $regex: searchRegex } },
        { address_subdivision_zone: { $regex: searchRegex } },
        { address_city_municipality: { $regex: searchRegex } },
      ],
    };

    console.log('[BACKEND SEARCH - INFO] Constructed MongoDB query object:', JSON.stringify(query));

    let residents = [];
    let totalFound = 0;
    try {
        residents = await residentsCollection
          .find(query)
          .project({
            _id: 1,
            first_name: 1,
            last_name: 1,
            middle_name: 1,
            suffix: 1,
            email: 1,
            sex: 1,
            contact_number: 1,
            address_house_number: 1,
            address_street: 1,
            address_subdivision_zone: 1,
            address_city_municipality: 1,
            is_household_head: 1,
            created_at: 1,
            status: 1,
            birthdate: '$date_of_birth', // Alias 'date_of_birth' to 'birthdate'
            account_status: 1,
          })
          .limit(limitResults)
          .sort({ last_name: 1, first_name: 1 })
          .toArray();
        totalFound = residents.length;
        console.log(`[BACKEND SEARCH - SUCCESS] MongoDB find operation completed. Found ${totalFound} residents.`);
        // Uncomment the line below for a sample of the data returned by MongoDB if needed
        // console.log('[BACKEND SEARCH - SUCCESS] Sample resident results (first 3):', residents.slice(0, Math.min(3, residents.length))); 
    } catch (mongoErr) {
        // This catch specifically handles errors during the MongoDB query execution
        console.error('[BACKEND SEARCH - MONGODB ERROR] Error during MongoDB find operation:', mongoErr);
        return res.status(500).json({ error: "Database query failed.", message: mongoErr.message });
    }
    
    console.log(`[BACKEND SEARCH - END] Responding with ${totalFound} residents for query "${trimmedQuery}".`);
    res.json({ residents: residents });

  } catch (error) {
    // This outer catch block handles any other unexpected errors in the endpoint logic
    console.error("[BACKEND SEARCH - UNEXPECTED ERROR] An unexpected error occurred during residents search (outer catch block):", error);
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

// GET NOTIFICATIONS FOR A RESIDENT
app.get('/api/residents/:id/notifications', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const dab = await db();
    const notificationsCollection = dab.collection('notifications');
    const residentObjectId = new ObjectId(id);

    const notifications = await notificationsCollection.find({
      $or: [
        { target_audience: 'All' },
        {
          target_audience: 'SpecificResidents',
          'recipients.resident_id': residentObjectId
        }
      ]
    }).sort({ date: -1 }).toArray();

    const unreadCount = await notificationsCollection.countDocuments({
      $or: [
        { target_audience: 'All' },
        {
          target_audience: 'SpecificResidents',
          'recipients.resident_id': residentObjectId
        }
      ],
      read_by: { $not: { $elemMatch: { resident_id: residentObjectId } } }
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching notifications for resident:", error);
    res.status(500).json({ error: 'Server error', message: 'Could not fetch notifications.' });
  }
});

// MARK NOTIFICATION AS READ FOR A RESIDENT
app.patch('/api/notifications/:notificationId/mark-as-read', async (req, res) => {
  const { notificationId } = req.params;
  const { resident_id } = req.body;

  if (!ObjectId.isValid(notificationId) || !ObjectId.isValid(resident_id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const dab = await db();
    const notificationsCollection = dab.collection('notifications');
    const residentObjectId = new ObjectId(resident_id);

    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { $addToSet: { read_by: { resident_id: residentObjectId, read_at: new Date() } } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: 'Server error', message: 'Could not mark notification as read.' });
  }
});

// GET NOTIFICATION BY ID
app.get('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const dab = await db();
    const notificationsCollection = dab.collection('notifications');
    const notification = await notificationsCollection.findOne({ _id: new ObjectId(id) });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    console.error("Error fetching notification by ID:", error);
    res.status(500).json({ error: 'Server error', message: 'Could not fetch notification.' });
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

// GET /api/residents/:id/household-members - FETCHES MEMBERS OF A RESIDENT'S HOUSEHOLD
app.get('/api/residents/:id/household-members', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const residentObjectId = new ObjectId(id);

    try {
        // Step 1: Find the initial resident
        const resident = await residentsCollection.findOne({ _id: residentObjectId });
        if (!resident) {
            return res.status(404).json({ error: 'Resident not found.' });
        }

        let householdMemberIds = [];

        if (resident.is_household_head) {
            // Case 1: The resident is the head of the household.
            // Their `household_member_ids` contains the list of all members.
            householdMemberIds = resident.household_member_ids || [];
        } else {
            // Case 2: The resident is a member, not the head.
            // We need to find the head of their household to get the member list.
            const householdHead = await residentsCollection.findOne({
                is_household_head: true,
                household_member_ids: residentObjectId // Find the head that lists this resident as a member
            });

            if (householdHead) {
                // We found the head, so we get their list of members.
                // We also add the head's ID to the list so they also appear in the dropdown.
                householdMemberIds = householdHead.household_member_ids || [];
                householdMemberIds.push(householdHead._id); 
            }
        }
        
        // Remove the original resident's ID from the list to avoid duplication, as the frontend already has their data.
        const otherMemberIds = householdMemberIds
            .filter(memberId => memberId && !memberId.equals(residentObjectId) && ObjectId.isValid(memberId))
            .map(memberId => new ObjectId(memberId)); // Ensure all are ObjectIds

        let household_members = [];
        if (otherMemberIds.length > 0) {
            // Fetch the full details for each member ID
            household_members = await residentsCollection.find(
                { _id: { $in: otherMemberIds } },
                // Project only the fields needed by the frontend to keep the payload small
                { projection: { _id: 1, first_name: 1, last_name: 1 } }
            ).toArray();
        }

        // --- FINAL RESPONSE ---
        // Return the data in the format the frontend expects: { household_members: [...] }
        res.json({ household_members });

    } catch (error) {
        console.error("Error fetching household members:", error);
        res.status(500).json({ error: 'Server error', message: 'Could not fetch household members.' });
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
    'first_name', 'middle_name', 'last_name', 'suffix', // <-- ADDED SUFFIX HERE
    'sex', 'civil_status', 'address_unit_room_apt_number', // NEW FIELD
    'occupation_status', 'citizenship', 'contact_number',
    'address_house_number', 'address_street', 'address_subdivision_zone',
    'relationship_to_head', 'other_relationship', 'type_of_household' // NEW FIELD
  ];
  const booleanFields = ['is_voter', 'is_pwd', 'is_senior_citizen', 'is_household_head'];
  const numericFields = ['years_at_current_address'];
  
  // Process simple text fields
  simpleFields.forEach(field => {
    // Check if the payload contains the field and if its value is different from the current one
    // Also allows explicit setting to null/empty string if payload provides it
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
        // Coerce to number, or null if empty/invalid.
        // Frontend sends null for empty fields, but empty string might come too.
        updateFields[field] = updatePayload[field] !== null && updatePayload[field] !== '' ? parseInt(updatePayload[field], 10) : null;
    }
  });

  // Process Date of Birth and Age
  if (updatePayload.hasOwnProperty('date_of_birth')) {
    updateFields.date_of_birth = updatePayload.date_of_birth ? new Date(updatePayload.date_of_birth) : null;
    // Re-calculate age on the backend for data integrity
    updateFields.age = calculateAge(updateFields.date_of_birth);
  }

  // Process Email with uniqueness check
  if (updatePayload.hasOwnProperty('email')) {
    const newEmail = String(updatePayload.email).trim().toLowerCase();
    // Only check if email has actually changed
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
  if (updatePayload.hasOwnProperty('is_voter')) { // Check if is_voter was sent
      updateFields.is_voter = Boolean(updatePayload.is_voter);
      if (updatePayload.is_voter === true) {
          if (updatePayload.hasOwnProperty('voter_id_number')) updateFields.voter_id_number = updatePayload.voter_id_number;
          if (updatePayload.hasOwnProperty('voter_registration_proof_base64')) updateFields.voter_registration_proof_base64 = updatePayload.voter_registration_proof_base64;
      } else { // If is_voter is false, clear associated fields
          updateFields.voter_id_number = null;
          updateFields.voter_registration_proof_base64 = null;
      }
  } else { // If is_voter wasn't sent, but other voter fields were, still update them
      if (updatePayload.hasOwnProperty('voter_id_number')) updateFields.voter_id_number = updatePayload.voter_id_number;
      if (updatePayload.hasOwnProperty('voter_registration_proof_base64')) updateFields.voter_registration_proof_base64 = updatePayload.voter_registration_proof_base64;
  }

  // PWD
  if (updatePayload.hasOwnProperty('is_pwd')) { // Check if is_pwd was sent
      updateFields.is_pwd = Boolean(updatePayload.is_pwd);
      if (updatePayload.is_pwd === true) {
          if (updatePayload.hasOwnProperty('pwd_id')) updateFields.pwd_id = updatePayload.pwd_id;
          if (updatePayload.hasOwnProperty('pwd_card_base64')) updateFields.pwd_card_base64 = updatePayload.pwd_card_base64;
      } else { // If is_pwd is false, clear associated fields
          updateFields.pwd_id = null;
          updateFields.pwd_card_base64 = null;
      }
  } else { // If is_pwd wasn't sent, but other PWD fields were, still update them
      if (updatePayload.hasOwnProperty('pwd_id')) updateFields.pwd_id = updatePayload.pwd_id;
      if (updatePayload.hasOwnProperty('pwd_card_base64')) updateFields.pwd_card_base64 = updatePayload.pwd_card_base64;
  }

  // Senior Citizen
  if (updatePayload.hasOwnProperty('is_senior_citizen')) { // Check if is_senior_citizen was sent
      updateFields.is_senior_citizen = Boolean(updatePayload.is_senior_citizen);
      if (updatePayload.is_senior_citizen === true) {
          if (updatePayload.hasOwnProperty('senior_citizen_id')) updateFields.senior_citizen_id = updatePayload.senior_citizen_id;
          if (updatePayload.hasOwnProperty('senior_citizen_card_base64')) updateFields.senior_citizen_card_base64 = updatePayload.senior_citizen_card_base64;
      } else { // If is_senior_citizen is false, clear associated fields
          updateFields.senior_citizen_id = null;
          updateFields.senior_citizen_card_base64 = null;
      }
  } else { // If is_senior_citizen wasn't sent, but other senior fields were, still update them
      if (updatePayload.hasOwnProperty('senior_citizen_id')) updateFields.senior_citizen_id = updatePayload.senior_citizen_id;
      if (updatePayload.hasOwnProperty('senior_citizen_card_base64')) updateFields.senior_citizen_card_base64 = updatePayload.senior_citizen_card_base64;
  }
  
  // REVISION: Process Proof of Residency file (now an array)
  if (updatePayload.hasOwnProperty('proof_of_residency_base64')) {
    updateFields.proof_of_residency_base64 = Array.isArray(updatePayload.proof_of_residency_base64) ? updatePayload.proof_of_residency_base64 : [];
  }
  // NEW: Process Authorization Letter
  if (updatePayload.hasOwnProperty('authorization_letter_base64')) {
      updateFields.authorization_letter_base64 = updatePayload.authorization_letter_base64 || null;
  }


  // REVISION: Process Proof of Relationship file (for non-head residents)
  if (!currentResident.is_household_head && updatePayload.hasOwnProperty('proof_of_relationship_base64')) {
      updateFields.proof_of_relationship_base64 = updatePayload.proof_of_relationship_base64;
  }

  // Household Membership (mainly for heads)
  if (updatePayload.hasOwnProperty('is_household_head')) {
    updateFields.is_household_head = Boolean(updatePayload.is_household_head);
    if (updateFields.is_household_head === false) {
      // If no longer a head, clear household_member_ids
      updateFields.household_member_ids = []; 
      // Also potentially clear household_head_id from this resident if it was a self-reference error
      updateFields.household_head_id = null; 
    } else if (updatePayload.hasOwnProperty('household_member_ids')) {
      // If still a head, update household_member_ids (expects an array of string IDs from frontend)
      updateFields.household_member_ids = Array.isArray(updatePayload.household_member_ids)
        ? updatePayload.household_member_ids.filter(memId => ObjectId.isValid(memId)).map(memId => new ObjectId(memId))
        : [];
    }
  } else if (updatePayload.hasOwnProperty('household_member_ids') && currentResident.is_household_head) {
      // If is_household_head wasn't changed but member IDs are sent (meaning it's an update to an existing head)
      updateFields.household_member_ids = Array.isArray(updatePayload.household_member_ids)
        ? updatePayload.household_member_ids.filter(memId => ObjectId.isValid(memId)).map(memId => new ObjectId(memId))
        : [];
  }
  // For non-heads, if household_head_id is in payload, update it.
  if (!currentResident.is_household_head && updatePayload.hasOwnProperty('household_head_id')) {
      if (ObjectId.isValid(updatePayload.household_head_id)) {
          updateFields.household_head_id = new ObjectId(updatePayload.household_head_id);
      } else {
          updateFields.household_head_id = null;
      }
  }


  // Password Change
  if (updatePayload.newPassword) {
    if (String(updatePayload.newPassword).length < 6) {
        return res.status(400).json({ error: 'Validation failed', message: 'New password must be at least 6 characters.' });
    }
    // WARNING: MD5 IS INSECURE. REPLACE WITH BCRYPT (as mentioned in previous responses)
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
      description: `Resident '${updatedResident.first_name} ${updatedResident.last_name}${updatedResident.suffix ? ' ' + updatedResident.suffix : ''}' information was updated.`, // Added suffix to audit log
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

// UPDATED Endpoint: PATCH /api/residents/:id/status
app.patch('/api/residents/:id/status', async (req, res) => {
  const { id } = req.params;
  // Destructure all possible inputs from the body
  const { status, account_status, reason } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // A request must be to update either the primary status or the account (hold) status
  if (!status && !account_status) {
    return res.status(400).json({ error: 'Validation failed', message: 'A `status` or `account_status` must be provided.' });
  }
  
  // A reason is required for any action other than setting the status to 'Approved'.
  if (status !== 'Approved' && (!reason || reason.trim() === '')) {
      return res.status(400).json({ error: 'A reason is required for this action.' });
  }

  try {
    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const residentId = new ObjectId(id);

    const currentResident = await residentsCollection.findOne({ _id: residentId });
    if (!currentResident) {
      return res.status(404).json({ error: 'Resident not found.' });
    }

    const updateFields = { updated_at: new Date() };
    let auditDescription = '';
    let notificationContent = '';
    let notificationName = '';

    // --- LOGIC BRANCH 1: Updating the primary registration status ---
    if (status) {
      const allowedStatusValues = ['Approved', 'Declined', 'Deactivated', 'Pending'];
      if (!allowedStatusValues.includes(status)) {
        return res.status(400).json({ error: 'Validation failed', message: `Invalid status value.` });
      }
      
      if (currentResident.status === status) {
        return res.json({ message: `Resident status is already ${status}.`, statusChanged: false });
      }
      
      updateFields.status = status;
      updateFields.status_reason = reason; // Store the reason
      auditDescription = `Status for resident ${id} was changed to '${status}'.`;
      notificationName = `Account Status Updated: ${status}`;
      notificationContent = `Your account status has been updated to ${status}.`;

      // If approving for the first time, set the approval date and ensure account is active
      if (status === 'Approved' && !currentResident.date_approved) {
        updateFields.date_approved = new Date();
        updateFields.account_status = 'Active'; // Default to active on first approval
        notificationContent = 'Your account has been approved. You can now log in and access all community features.';
        
        // Also approve all associated household members
        if (currentResident.household_member_ids && currentResident.household_member_ids.length > 0) {
            const memberIds = currentResident.household_member_ids.map(mid => new ObjectId(mid));
            await residentsCollection.updateMany(
                { _id: { $in: memberIds } },
                { $set: { status: 'Approved', account_status: 'Active', updated_at: new Date() } }
            );
        }
      }
    
    // --- LOGIC BRANCH 2: Updating the secondary account status (Removing a Hold) ---
    } else if (account_status) {
      if (account_status !== 'Active') {
        return res.status(400).json({ error: 'Validation failed', message: 'Can only set `account_status` to "Active" via this action.' });
      }
      if (currentResident.status !== 'Approved') {
        return res.status(409).json({ error: 'Conflict', message: 'Cannot remove a hold on an account that is not approved.' });
      }
       if (currentResident.account_status === 'Active') {
        return res.json({ message: 'Account is already Active.', statusChanged: false });
      }

      updateFields.account_status = 'Active';
      updateFields.status_reason = reason; // Log the reason for removing the hold
      auditDescription = `Account hold removed for resident ${id}. Status set to 'Active'.`;
      notificationName = 'Account Hold Removed';
      notificationContent = 'The hold on your account has been lifted. Full access has been restored.';
    }

    // --- Perform the database update ---
    const result = await residentsCollection.updateOne({ _id: residentId }, { $set: updateFields });

    if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Update failed, resident not found.' });
    }

    // --- Post-update actions ---
    await createAuditLog({
      description: auditDescription,
      action: 'STATUS_CHANGE',
      entityType: 'Resident',
      entityId: id
    }, req);

    await createNotification(dab, {
      name: notificationName,
      content: notificationContent,
      by: 'System Administrator',
      type: 'Notification',
      target_audience: 'SpecificResidents',
      recipient_ids: [id.toString()], // Ensure recipient ID is a string if your helper requires it
      date: new Date()
    });

    res.json({ message: 'Resident status updated successfully.', statusChanged: true });

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

  // Sorting
  const sortBy = req.query.sortBy || 'last_name'; // Default sort by last name
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // Default ascending

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
        { address_house_number: { $regex: searchRegex } }, // Search by household number
        { address_unit_room_apt_number: { $regex: searchRegex } }, // Search by unit number
        { type_of_household: { $regex: searchRegex } } // Search by type of household
      ];
    }

    // Define sort object dynamically
    const sort = {};
    if (sortBy) {
        // Map frontend sort keys to backend field names if they differ
        const backendSortKey = {
            'head_date_approved': 'date_approved',
            'head_date_updated': 'date_updated',
            'head_full_name': 'last_name', // Sort by last name for full name column
            'household_name': 'last_name' // Sort by last name for household name column
            // Add other mappings if necessary, otherwise use sortBy directly
        }[sortBy] || sortBy;
        sort[backendSortKey] = sortOrder;
        // If sorting by name-related fields, add a secondary sort for consistency
        if (['last_name', 'first_name'].includes(backendSortKey)) {
            sort['first_name'] = sortOrder; // Secondary sort for first name
        }
    } else {
        // Default sort if no sortBy is provided
        sort['last_name'] = 1;
        sort['first_name'] = 1;
    }


    // Fetch household heads with necessary fields for transformation
    const householdHeads = await residentsCollection
      .find(query)
      .project({ // Select only the fields needed
        _id: 1,
        last_name: 1,
        first_name: 1,
        address_house_number: 1,
        household_member_ids: 1,
        address_unit_room_apt_number: 1, // NEW FIELD
        type_of_household: 1,            // NEW FIELD
        date_approved: 1,                // NEW FIELD (from frontend code)
        date_updated: 1,                 // NEW FIELD (from frontend code)
      })
      .skip(skip)
      .limit(itemsPerPage)
      .sort(sort) // Apply dynamic sorting
      .toArray();

    // Transform the data
    const formattedHouseholds = householdHeads.map(head => ({
      household_id: head._id,
      household_name: `${head.last_name}'s Household`,
      household_number: head.address_house_number || 'N/A',
      number_of_members: Array.isArray(head.household_member_ids) ? head.household_member_ids.length : 0,
      head_first_name: head.first_name,
      head_last_name: head.last_name,
      head_address_unit_room_apt_number: head.address_unit_room_apt_number || 'N/A', // NEW
      head_type_of_household: head.type_of_household || 'N/A',                         // NEW
      head_date_approved: head.date_approved || null,                                 // NEW
      head_date_updated: head.date_updated || null,                                   // NEW
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

// ADD NEW HOUSEHOLD MEMBER
app.post('/api/residents/:id/members', async (req, res) => {
    const { id: headId } = req.params;
    const memberData = req.body;

    if (!ObjectId.isValid(headId)) {
        return res.status(400).json({ error: 'Invalid household head ID format.' });
    }

    const dab = await db();
    const residentsCollection = dab.collection('residents');
    const session = CLIENT_DB.startSession();

    try {
        let newMemberId;
        await session.withTransaction(async () => {
            // 1. Find the household head
            const householdHead = await residentsCollection.findOne({ _id: new ObjectId(headId) }, { session });
            if (!householdHead || !householdHead.is_household_head) {
                throw new Error('Household head not found.');
            }

            // 2. Validate member data
            if (!memberData.first_name || !memberData.last_name || !memberData.relationship_to_head) {
                throw new Error('Validation failed for member: Missing required fields.');
            }

            // 3. Check for email conflicts if an email is provided
            if (memberData.email) {
                const memberEmail = memberData.email.toLowerCase();
                const existingMemberEmail = await residentsCollection.findOne({ email: memberEmail }, { session });
                if (existingMemberEmail) {
                    throw new Error(`Conflict: The email address '${memberEmail}' is already in use.`);
                }
            }

            // 4. Create the new resident document
            const newMemberDoc = createResidentDocument(memberData, false, householdHead);
            newMemberDoc.created_at = new Date();
            newMemberDoc.updated_at = new Date();
            newMemberDoc.date_approved = null; // Members are pending until approved

            const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
            newMemberId = memberInsertResult.insertedId;

            // 5. Add the new member's ID to the household head's member list
            await residentsCollection.updateOne(
                { _id: new ObjectId(headId) },
                { $push: { household_member_ids: newMemberId }, $set: { updated_at: new Date() } },
                { session }
            );
        });

        // --- ADD AUDIT LOG HERE ---
        const headDetails = await residentsCollection.findOne({ _id: new ObjectId(headId) });
        await createAuditLog({
            userId: headId,
            userName: `${headDetails.first_name} ${headDetails.last_name}`,
            description: `Added a new member to their household.`,
            action: "ADD_MEMBER",
            entityType: "Resident",
            entityId: newMemberId.toString(),
        }, req);

        res.status(201).json({ message: 'Household member added successfully!', memberId: newMemberId });

    } catch (error) {
        console.error("Error adding household member:", error);
        if (error.message.startsWith('Conflict:')) {
            return res.status(409).json({ error: 'Email Conflict', message: error.message });
        }
        if (error.message.startsWith('Validation failed for member:')) {
            return res.status(400).json({ error: 'Validation Error', message: error.message });
        }
        if (error.message === 'Household head not found.') {
            return res.status(404).json({ error: 'Not Found', message: error.message });
        }
        res.status(500).json({ error: 'Server Error', message: 'Could not add household member.' });
    } finally {
        await session.endSession();
    }
});




// ======================= DOCUMENT REQUEST ======================= //

// ADD NEW DOCUMENT (POST)
// POST /api/document-requests - ADD NEW DOCUMENT REQUEST (Handles new 'details' object and 'processed_by_personnel')
app.post('/api/document-requests', async (req, res) => {
  const dab = await db();
  const {
    requestor_resident_id,
    processed_by_personnel,
    request_type,
    purpose,
    details,
  } = req.body;

  // --- 2. UPDATE VALIDATION ---
  if (!requestor_resident_id || !request_type ) {
    return res.status(400).json({ error: 'Missing required fields: requestor and type are required.' });
  }
  if (!ObjectId.isValid(requestor_resident_id)) {
    return res.status(400).json({ error: 'Invalid requestor resident ID format.' });
  }

  try {
    const residentsCollection = dab.collection('residents');
    const requestsCollection = dab.collection('document_requests');

    // --- ADDED: Account Status Check ---
    await checkResidentAccountStatus(requestor_resident_id, dab);
    // --- END ADDED ---

    // Fetch the requestor's name for a more descriptive log
    const requestor = await residentsCollection.findOne({ _id: new ObjectId(requestor_resident_id) });
    const requestorName = requestor ? `${requestor.first_name} ${requestor.last_name}`.trim() : 'an unknown resident';

    // Generate a unique, user-friendly reference number
    const customRefNo = await generateUniqueReference(requestsCollection);

    // --- 3. ADD THE NEW FIELD TO THE DATABASE OBJECT ---
    const newRequest = {
      ref_no: customRefNo,
      requestor_resident_id: new ObjectId(requestor_resident_id),
      processed_by_personnel: String(processed_by_personnel).trim(), // Save the personnel's name
      request_type: String(request_type).trim(),
      purpose: String(purpose).trim(),
      details: details || {},
      document_status: "Pending",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await requestsCollection.insertOne(newRequest);

    // --- 4. UPDATE THE AUDIT LOG DESCRIPTION ---
    await createAuditLog({
        description: `New document request '${request_type}' (Ref: ${customRefNo}) for resident ${requestorName} was processed by ${processed_by_personnel}.`,
        action: "CREATE",
        entityType: "DocumentRequest",
        entityId: result.insertedId.toString(),
        userId: requestor ? requestor._id : null,
        userName: requestorName,
    }, req);

    // Update the response to the frontend
    res.status(201).json({
      message: 'Document request added successfully',
      requestId: result.insertedId,
      refNo: customRefNo
    });

  } catch (error) {
    console.error('Error adding document request:', error);
    // --- ADDED: Specific error handling for account status restrictions ---
    if (error.message.includes("account is pending approval") ||
        error.message.includes("account has been declined") ||
        error.message.includes("account has been permanently deactivated") ||
        error.message.includes("account is currently On Hold/Deactivated")) {
      return res.status(403).json({ // 403 Forbidden is appropriate for access denied
        error: 'Action Restricted. Account status On Hold / Deactivated.',
        message: error.message
      });
    }
    // --- END ADDED ---
    res.status(500).json({ error: 'Error adding document request.' });
  }
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
    .sort({ date_added: -1 })
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

// FOLLOW UP ON A DOCUMENT REQUEST
app.patch('/api/document-requests/:id/follow-up', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const dab = await db();
    const documentRequestsCollection = dab.collection('document_requests');
    const requestObjectId = new ObjectId(id);

    const documentRequest = await documentRequestsCollection.findOne({ _id: requestObjectId });

    if (!documentRequest) {
      return res.status(404).json({ error: 'Document request not found' });
    }

    // Check if the user can follow up
    if (documentRequest.last_follow_up_at) {
      const lastFollowUp = new Date(documentRequest.last_follow_up_at);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (lastFollowUp > twentyFourHoursAgo) {
        return res.status(429).json({ error: 'Too Many Requests', message: 'You can only follow up on a request once every 24 hours.' });
      }
    }

    // Update the status and the follow-up timestamp
    const result = await documentRequestsCollection.updateOne(
      { _id: requestObjectId },
      {
        $set: {
          document_status: 'Follow up',
          last_follow_up_at: new Date(),
          updated_at: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Document request not found during update' });
    }
    
    res.json({ message: 'Successfully followed up on the request.' });

  } catch (error) {
    console.error("Error following up on document request:", error);
    res.status(500).json({ error: 'Server error', message: 'Could not follow up on the request.' });
  }
});
''


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
    try {
        const dab = await db(); // Assuming db() connects to your MongoDB
        const collection = dab.collection('admins'); // Assuming 'admins' collection

        const {
            search,
            page: reqPage,
            itemsPerPage: reqItemsPerPage,
            sortBy,
            sortOrder,
            start_date, // NEW: Date range start
            end_date    // NEW: Date range end
        } = req.query;

        const page = parseInt(reqPage) || 1;
        const itemsPerPage = parseInt(reqItemsPerPage) || 10;
        const skip = (itemsPerPage > 100000) ? 0 : (page - 1) * itemsPerPage; // Handle "print all" scenario

        const filters = [];

        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filters.push({
                $or: [
                    { name: searchRegex },
                    { username: searchRegex },
                    { email: searchRegex },
                    { role: searchRegex }
                ]
            });
        }

        // --- NEW: Add Date Range Filtering for 'createdAt' ---
        if (start_date || end_date) {
            const createdAtFilter = {};
            if (start_date) {
                createdAtFilter.$gte = new Date(start_date); // Convert ISO string to Date object
            }
            if (end_date) {
                createdAtFilter.$lte = new Date(end_date);   // Convert ISO string to Date object
            }
            if (Object.keys(createdAtFilter).length > 0) {
                filters.push({ createdAt: createdAtFilter });
            }
        }
        // --- END NEW Date Range Filtering ---

        const finalQuery = filters.length > 0 ? { $and: filters } : {};

        let sortOptions = { createdAt: -1 }; // Default sort by creation date descending
        if (sortBy) {
            sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
        }

        const admins = await collection.find(finalQuery)
            .project({ // Select only necessary fields
                name: 1,
                username: 1,
                email: 1,
                role: 1,
                createdAt: 1,
                _id: 1
            })
            .sort(sortOptions)
            .skip(skip)
            .limit(itemsPerPage)
            .toArray();

        const totalAdmins = await collection.countDocuments(finalQuery);

        res.json({
            admins: admins,
            totalAdmins: totalAdmins,
            page: page,
            itemsPerPage: itemsPerPage,
            totalPages: Math.ceil(totalAdmins / itemsPerPage)
        });

    } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({ error: 'Failed to fetch administrators.' });
    }
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

// 2. READ (List): GET /api/barangay-officials
app.get('/api/barangay-officials', async (req, res) => {
    try {
        const dab = await db();
        const collection = dab.collection('barangay_officials');

        // --- 1. Extract and Sanitize Query Parameters ---
        const {
            search,
            status: statusFilter,
            position: positionFilter,
            sortBy,
            sortOrder,
            term_start_gte, // NEW: Term start greater than or equal to
            term_end_lte    // NEW: Term end less than or equal to
        } = req.query;

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
        const skip = (itemsPerPage > 100000) ? 0 : (page - 1) * itemsPerPage; // Handle "print all" scenario

        // --- 2. (Optional but Recommended) Automatic Status Update ---
        // This ensures the data is always fresh before querying.
        const currentDate = new Date();
        // Set to 'Inactive' if their term has ended but they are still 'Active'
        await collection.updateMany(
            { status: 'Active', term_end: { $lt: currentDate } },
            { $set: { status: 'Inactive' } }
        );
        // Set to 'Active' if they are within their term (term_start <= now and term_end >= now or term_end is null)
        await collection.updateMany(
            { 
                status: 'Inactive', 
                term_start: { $lte: currentDate }, 
                $or: [
                    { term_end: { $gte: currentDate } },
                    { term_end: null } // Officials with no end date are considered active
                ]
            },
            { $set: { status: 'Active' } }
        );

        // --- 3. Build the MongoDB Query Dynamically ---
        let query = {};
        const conditions = [];

        if (statusFilter && statusFilter !== 'All') { // Assuming 'All' means no filter
            conditions.push({ status: statusFilter });
        }
        if (positionFilter && positionFilter !== 'All') { // Assuming 'All' means no filter
            conditions.push({ position: positionFilter });
        }
        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            conditions.push({
                $or: [
                    { first_name: searchRegex },
                    { last_name: searchRegex },
                    { position: searchRegex }
                ]
            });
        }
        
        // --- NEW: Add Term Date Range Filtering Conditions ---
        if (term_start_gte) {
            conditions.push({ term_start: { $gte: new Date(term_start_gte) } });
        }
        if (term_end_lte) {
            // For term_end_lte, we want officials whose term ends on or before the specified date.
            // We also need to consider officials whose term_end is null (representing 'Present' or indefinite).
            // If term_end_lte is specified, it generally implies filtering for terms that have a defined end
            // within that boundary. To include 'Present' officials only if their start date falls within
            // the early part of the range, or if the end date is not explicitly bounded by term_end_lte,
            // the logic can get complex.
            //
            // For simplicity and direct interpretation of "term_end_lte":
            // We filter for officials whose 'term_end' is less than or equal to the provided date.
            // This will exclude 'Present' officials (term_end: null) when term_end_lte is set,
            // as 'null' is not <= a specific date. This seems to align with expecting a bounded term.
            conditions.push({ term_end: { $lte: new Date(term_end_lte) } });
        }
        // --- END NEW Term Date Range Filtering Conditions ---

        if (conditions.length > 0) {
            query = { $and: conditions };
        }
        
        // --- 4. Define Sorting Options ---
        let sortOptions = { term_start: -1 }; // Default sort: newest term first
        if (sortBy) {
            // Special handling for 'name' sort if it's a concatenated field
            if (sortBy === 'name') {
              sortOptions = { last_name: sortOrder === 'desc' ? -1 : 1, first_name: sortOrder === 'desc' ? -1 : 1 };
            } else {
              sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
            }
        }

        // --- 5. Fetch Paginated Data ---
        const officials = await collection.find(query)
            .project({ // Select only necessary fields for the list view
                first_name: 1,
                middle_name: 1, // Added middle_name for full name construction
                last_name: 1,
                position: 1,
                status: 1,
                term_start: 1,
                term_end: 1,
                photo_url: 1
            })
            .sort(sortOptions)
            .skip(skip)
            .limit(itemsPerPage)
            .toArray();

        // --- 6. Fetch Total Count for Pagination UI ---
        const totalOfficials = await collection.countDocuments(query);

        // --- 7. Send the Response ---
        res.json({
            officials,
            totalOfficials: totalOfficials, // Renamed 'total' to 'totalOfficials' for consistency with frontend
            page,
            itemsPerPage,
            totalPages: Math.ceil(totalOfficials / itemsPerPage)
        });

    } catch (error) {
        console.error("Error fetching barangay officials:", error);
        res.status(500).json({ error: 'Failed to fetch barangay officials.' });
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

    // Send SMS notification
    if (finalRecipientObjects && finalRecipientObjects.length > 0) {
        const recipientIds = finalRecipientObjects.map(r => r.resident_id);
        const recipients = await residentsCollection.find({ _id: { $in: recipientIds } }).toArray();
        try {
        await sendMessage(recipients?.map(r => r.contact_number), `B-BUD Notification: ${name}`);
        } catch (error) {
            console.error(`Failed to send SMS notification to recipients`, error);
        }
    }

    

    return { _id: result.insertedId, ...newNotificationDoc };
  } catch (error) {
    console.error("Error inserting notification document in helper:", error);
    return null;
  }
}



// =================== NOTIFICATION MODULE CRUD =========================== //

// GET ALL NOTIFICATIONS (GET) - Updated to handle filters and DATE RANGE
app.get('/api/notifications', async (req, res) => {
  try {
    const {
      search, type, sortBy, sortOrder,
      start_date, end_date // ADDED: Date range query parameters
    } = req.query;
    
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (itemsPerPage > 100000) ? 0 : (page - 1) * itemsPerPage; 

    const dab = await db();
    const notificationsCollection = dab.collection('notifications'); // Assuming 'notifications' collection

    const filters = [];

    if (type) {
      filters.push({ type: type });
    }

    // --- ADDED: Date Range Filtering for 'date' field ---
    // Assuming 'date' in your notification documents represents the effective date
    if (start_date || end_date) {
      const dateFilter = {};
      if (start_date) {
        dateFilter.$gte = new Date(start_date); // Convert ISO string to Date object
      }
      if (end_date) {
        dateFilter.$lte = new Date(end_date);   // Convert ISO string to Date object
      }
      if (Object.keys(dateFilter).length > 0) {
        filters.push({ date: dateFilter }); 
      }
    }
    // --- END ADDED Date Range Filtering ---

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filters.push({
        $or: [
          { name: searchRegex },
          { content: searchRegex },
          { by: searchRegex }, // Assuming 'by' is the author field
          // Add other searchable fields if applicable
        ],
      });
    }

    const finalQuery = filters.length > 0 ? { $and: filters } : {};

    let sortOptions = { date: -1 }; // Default sort by date descending (from 'Effective Date')
    if (sortBy) {
        sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    }
    
    const projection = {
        name: 1, type: 1, content: 1, target_audience: 1, recipients: 1,
        date: 1, by: 1, _id: 1,
    };
    
    const notifications = await notificationsCollection
      .find(finalQuery)
      .project(projection)
      .sort(sortOptions)
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    const totalNotifications = await notificationsCollection.countDocuments(finalQuery);

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




// ====================== HELPER FUNCTION =========================== //

/**
 * Checks if a resident's account is 'Active' and 'Approved'.
 * Throws an error if the account is not found, is pending approval, declined,
 * deactivated (primary status), or on hold (secondary account_status).
 * This acts as a security gatekeeper for creating new requests.
 * @param {ObjectId} residentId - The ID of the resident to check.
 * @param {Db} dab - The database connection instance.
 */
const checkResidentAccountStatus = async (residentId, dab) => {
  const residentsCollection = dab.collection('residents');
  const resident = await residentsCollection.findOne({ _id: new ObjectId(residentId) });

  if (!resident) {
    // Using a generic message to avoid leaking info about which IDs exist
    throw new Error('Invalid resident specified.'); 
  }

  // --- Primary Status Check (Registration Lifecycle) ---
  if (resident.status === 'Pending') {
    throw new Error(`Resident account is pending approval. You cannot make new requests until your account is approved by an administrator.`);
  }
  if (resident.status === 'Declined') {
    throw new Error(`Resident account has been declined. You cannot make new requests.`);
  }
  // Note: If resident.status is 'Deactivated', the account_status below would likely also be 'Deactivated',
  // but explicitly checking here ensures the message is specific to primary deactivation.
  if (resident.status === 'Deactivated') {
    throw new Error(`Resident account has been permanently deactivated. You cannot make new requests.`);
  }

  // --- Secondary Status Check (Post-Approval Holds, e.g., for borrowed assets) ---
  if (resident.account_status === 'Deactivated') {
    // This is for accounts that are 'Approved' but then put 'On Hold' due to other issues.
    throw new Error(`This resident's account is currently On Hold/Deactivated due to unresolved issues. You cannot make new requests until these issues are resolved.`);
  }

  // If the code reaches here, the resident's primary status is 'Approved'
  // and their secondary account_status is 'Active' or equivalent, allowing requests.
};

// Add this helper function near the top of your file with the others

async function checkAndReactivateAccount(dbInstance, residentId, excludeTransactionId) {
    const borrowedAssetsCollection = dbInstance.collection('borrowed_assets');
    const residentsCollection = dbInstance.collection('residents');

    const otherUnresolvedIssues = await borrowedAssetsCollection.findOne({
        borrower_resident_id: residentId,
        _id: { $ne: excludeTransactionId }, // Exclude the transaction being processed
        status: { $in: [STATUS.OVERDUE, STATUS.LOST, STATUS.DAMAGED] }
    });

    // If no other issues exist, reactivate the account
    if (!otherUnresolvedIssues) {
        await residentsCollection.updateOne(
            { _id: residentId },
            { $set: { 'account_status': 'Active' } }
        );
        console.log(`Account for resident ${residentId} reactivated.`);
    }
}



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

// 1. ADD NEW BORROW ASSET REQUEST (POST) - UPDATED TO EMBED BASE64 DIRECTLY
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
    borrow_proof_image_base64, // Receives the Base64 image string (or null) from frontend
  } = req.body;

  // Validation
  if (!borrower_resident_id || !borrower_display_name || !item_borrowed || !quantity_borrowed || !expected_return_date) {
    return res.status(400).json({ error: 'Missing required fields. Borrower, item, quantity, and expected return date are required.' });
  }
  if (!ObjectId.isValid(borrower_resident_id)) {
    return res.status(400).json({ error: 'Invalid borrower resident ID format.' });
  }
  const requestedQuantity = parseInt(quantity_borrowed, 10);
  if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a number greater than 0.' });
  }

  // IMPORTANT NOTE: When directly embedding Base64, consider the MongoDB document size limit (16MB).
  // The frontend already has a 2MB file size validation rule, which helps, but doesn't guarantee against 16MB limit.
  // No Cloudinary upload here, as per request to mimic "Filed Complaints".
  // The 'borrow_proof_image_base64' is directly stored.

  try {
    // Gatekeeper: Check if the resident is allowed to borrow
    await checkResidentAccountStatus(borrower_resident_id, dab);

    const assetsCollection = dab.collection('assets');
    const borrowedAssetsCollection = dab.collection('borrowed_assets');

    const refNo = await generateUniqueReference(borrowedAssetsCollection);

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
    const availableStock = masterAsset.total_quantity - totalBorrowed;
    if (requestedQuantity > availableStock) {
      return res.status(409).json({ // 409 Conflict is a good status for stock issues
          error: 'Insufficient stock.',
          message: `Cannot borrow ${requestedQuantity}. Only ${availableStock} ${item_borrowed} are available.`
      });
    }

    // Create New Transaction Document
    const newTransaction = {
      ref_no: refNo,
      borrower_resident_id: new ObjectId(borrower_resident_id),
      borrower_display_name: String(borrower_display_name).trim(),
      borrow_datetime: new Date(borrow_datetime),
      borrowed_from_personnel: String(borrowed_from_personnel).trim(),
      item_borrowed: String(item_borrowed),
      quantity_borrowed: requestedQuantity,
      expected_return_date: new Date(expected_return_date),
      status: STATUS.PENDING,
      date_returned: null,
      date_resolved: null,
      return_proof_image_url: null, // Keep if you intend to upload return proofs to Cloudinary later
      return_condition_notes: null,
      // ✨ UPDATED: Directly store the Base64 string instead of a Cloudinary URL ✨
      borrow_proof_image_base64: borrow_proof_image_base64 || null, // Store the Base64 string directly
      notes: notes ? String(notes).trim() : null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await borrowedAssetsCollection.insertOne(newTransaction);
    const insertedDoc = await borrowedAssetsCollection.findOne({ ref_no: refNo });

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      userId: new ObjectId(borrower_resident_id),
      userName: borrower_display_name,
      description: `New asset borrowing request: ${borrower_display_name} requested to borrow ${requestedQuantity} ${item_borrowed}.`,
      action: "CREATE",
      entityType: "BorrowedAsset",
      entityId: result.insertedId.toString(),
    }, req);
    // --- END AUDIT LOG ---

    res.status(201).json({ message: 'Asset borrowing request submitted successfully', transaction: insertedDoc });

  } catch (error) {
    // --- CORRECTED ERROR HANDLING ---
    // Check if the error is from our account status gatekeeper
    if (error.message.includes("On Hold/Deactivated") || error.message.includes("pending approval") || error.message.includes("been declined")) {
      return res.status(403).json({ // 403 Forbidden is the correct HTTP status
        error: 'Cannot borrow due to account status.',
        message: error.message
      });
    }
    // Handle all other errors as a general server error
    console.error('Error adding borrow asset transaction:', error);
    res.status(500).json({
        error: 'An internal server error occurred while processing your request.'
    });
    // --- END OF CORRECTION ---
  }
});

// 2. GET ALL BORROWED ASSETS (GET) - UPDATED with Date Range Filtering
app.get('/api/borrowed-assets', async (req, res) => {
  try {
    const dab = await db();
    const borrowedAssetsCollection = dab.collection('borrowed_assets');
    const residentsCollection = dab.collection('residents');

    // --- NEW: AUTOMATICALLY UPDATE OVERDUE STATUSES BEFORE FETCHING ---
    const overdueTransactions = await borrowedAssetsCollection.find({
        status: STATUS.APPROVED,
        expected_return_date: { $lt: new Date() }
    }).toArray();

    if (overdueTransactions.length > 0) {
        const transactionIdsToUpdate = overdueTransactions.map(t => t._id);
        const residentIdsToDeactivate = [...new Set(overdueTransactions.map(t => t.borrower_resident_id))];

        // Update transactions to 'Overdue'
        await borrowedAssetsCollection.updateMany(
            { _id: { $in: transactionIdsToUpdate } },
            { $set: { status: STATUS.OVERDUE, updated_at: new Date() } }
        );
        // Deactivate the accounts of the borrowers
        await residentsCollection.updateMany(
            { _id: { $in: residentIdsToDeactivate } },
            { $set: { 'account_status': 'Deactivated' } }
        );
        console.log(`Auto-updated ${transactionIdsToUpdate.length} items to Overdue and deactivated ${residentIdsToDeactivate.length} accounts.`);
    }
    // --- END OF AUTOMATION ---

    const { search, status, sortBy, sortOrder, byResidentId = '', start_date, end_date } = req.query; // ADDED start_date, end_date
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const matchConditions = [];
    if (search) {
        const searchRegex = new RegExp(search.trim(), 'i');
        matchConditions.push({ $or: [ { ref_no: searchRegex }, { item_borrowed: searchRegex }, { "borrower_details.first_name": searchRegex }, { "borrower_details.last_name": searchRegex }, { status: searchRegex } ] });
    }
    if (byResidentId) { matchConditions.push({ borrower_resident_id: new ObjectId(byResidentId) }); }
    if (status && status !== 'All') {
        const statusArray = status.split(',').map(s => s.trim());
        matchConditions.push({ status: { $in: statusArray } });
    }

    // --- ADDED: Date Range Filtering for borrow_datetime ---
    if (start_date || end_date) {
      const dateRangeCondition = {};
      if (start_date) {
        dateRangeCondition.$gte = new Date(start_date);
      }
      if (end_date) {
        dateRangeCondition.$lte = new Date(end_date);
      }
      matchConditions.push({ borrow_datetime: dateRangeCondition });
    }
    // --- END ADDED ---
    
    const mainMatchStage = matchConditions.length > 0 ? { $and: matchConditions } : {};
    let sortStage = { $sort: { borrow_datetime: -1 } };
    if (sortBy) { sortStage = { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } }; }

    const aggregationPipeline = [
      // 1. Initial lookup for borrower details (needed for search and display)
      { $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array' } },
      // 2. Add borrower_details as a single object
      { $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } } },
      // 3. Match documents based on all filters (search, status, resident ID, and now date range)
      { $match: mainMatchStage },
      // 4. Project the final output fields
      {
        $project: {
          _id: 1, ref_no: 1, borrow_datetime: 1, item_borrowed: 1, quantity_borrowed: 1, expected_return_date: 1, date_returned: 1,
          status: "$status", // Reads the correct status directly
          borrower_name: { $concat: [ { $ifNull: ["$borrower_details.first_name", "Unknown"] }, " ", { $ifNull: ["$borrower_details.last_name", "Resident"] } ] },
        }
      },
      // 5. Sort the results
      sortStage,
      // 6. Skip and limit for pagination
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const transactions = await borrowedAssetsCollection.aggregate(aggregationPipeline).toArray();
    
    // For total count, we should apply the same matching conditions but without skip/limit
    // The count needs to happen *after* the initial lookup and match, but *before* the skip/limit
    const countPipeline = [
      { $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array' } },
      { $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } } },
      { $match: mainMatchStage }, // Apply the same match conditions
      { $count: "total" } // Count the documents that passed the match
    ];
    const countResult = await borrowedAssetsCollection.aggregate(countPipeline).toArray();
    const totalTransactions = countResult.length > 0 ? countResult[0].total : 0;


    res.json({ transactions, total: totalTransactions, page, itemsPerPage, totalPages: Math.ceil(totalTransactions / itemsPerPage) });
  } catch (error) {
    console.error('Error fetching borrowed assets:', error);
    res.status(500).json({ error: "Failed to fetch transactions." });
  }
});

const findByRefOrId = (id) => {
  // If the ID looks like a MongoDB ObjectId, search by both.
  // Otherwise, assume it's a ref_no. This provides backward compatibility.
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { ref_no: id }] };
  }
  // If it's not a valid ObjectId format, it must be a ref_no
  return { ref_no: id };
};

// 3. GET TRANSACTION BY ID (GET) - UPDATED to retrieve Base64 for both proofs
app.get('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params;
  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  try {
    const aggregationPipeline = [
      { $match: findByRefOrId(id) },
      { $lookup: { from: 'residents', localField: 'borrower_resident_id', foreignField: '_id', as: 'borrower_details_array' } },
      { $addFields: { borrower_details: { $arrayElemAt: ['$borrower_details_array', 0] } } },
      {
        $project: {
          _id: 1, ref_no: 1, borrow_datetime: 1, borrowed_from_personnel: 1, item_borrowed: 1, quantity_borrowed: 1,
          status: "$status",
          expected_return_date: 1, date_returned: 1,
          // ✨ IMPORTANT: PROJECT THE CORRECT FIELD FOR RETURN PROOF ✨
          return_proof_image_base64: 1, // Changed from return_proof_image_url
          return_condition_notes: 1, notes: 1,
          borrow_proof_image_base64: 1, // Already correct for borrowing proof
          created_at: 1, updated_at: 1, borrower_resident_id: 1, borrower_display_name: 1, borrower_details: 1,
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
  // This line should be removed to allow ref_no
  // if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' }); 

  const dab = await db();
  const collection = dab.collection('borrowed_assets');
  const { borrow_datetime, item_borrowed, quantity_borrowed, expected_return_date, notes } = req.body;
  
  const updateFields = {};
  // ... (your updateFields logic is fine) ...
  if (borrow_datetime !== undefined) updateFields.borrow_datetime = new Date(borrow_datetime);
  if (item_borrowed !== undefined) updateFields.item_borrowed = String(item_borrowed);
  if (quantity_borrowed !== undefined) updateFields.quantity_borrowed = parseInt(quantity_borrowed, 10);
  if (expected_return_date !== undefined) updateFields.expected_return_date = new Date(expected_return_date);
  if (notes !== undefined) updateFields.notes = notes ? String(notes).trim() : null;
  if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No fields to update provided.' });
  
  updateFields.updated_at = new Date();

  try {
    const findQuery = findByRefOrId(id);

    const transactionToUpdate = await collection.findOne(findQuery);
    if (!transactionToUpdate) return res.status(404).json({ error: 'Transaction not found.' });

    const result = await collection.updateOne(findQuery, { $set: updateFields });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Transaction not found during update.' });
    
    // MODIFIED: Use the reliable findQuery to get the updated document
    const updatedDoc = await collection.findOne(findQuery);

    // --- ADD AUDIT LOG HERE ---
    await createAuditLog({
      description: `Details updated for borrowed asset transaction: '${updatedDoc.item_borrowed}' (Ref: ${updatedDoc.ref_no}).`,
      action: "UPDATE",
      entityType: "BorrowTransaction",
      entityId: updatedDoc._id.toString(),
    }, req);
    // --- END AUDIT LOG ---

    res.json({ message: 'Transaction updated successfully', transaction: updatedDoc });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Error updating transaction: ' + error.message });
  }
});

// 5. UPDATE TRANSACTION STATUS (PATCH) - UPDATED
app.patch('/api/borrowed-assets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status: newStatus, notes } = req.body;
  if (!newStatus || !Object.values(STATUS).includes(newStatus)) { return res.status(400).json({ error: `Invalid status.` }); }
  
  try {
    const dab = await db();
    const borrowedAssetsCollection = dab.collection('borrowed_assets');
    const residentsCollection = dab.collection('residents');
    const findQuery = findByRefOrId(id);
    const transaction = await borrowedAssetsCollection.findOne(findQuery);
    if (!transaction) { return res.status(404).json({ error: 'Transaction not found.' }); }
    
    const oldStatus = transaction.status;
    if (oldStatus === newStatus) { return res.json({ message: `Status is already '${newStatus}'.`, transaction: transaction }); }

    const updateFields = { status: newStatus, updated_at: new Date() };

    if (newStatus === STATUS.REJECTED) {
      updateFields.notes = notes || 'No reason provided for rejection.';
    } else if (notes) {
      updateFields.notes = `${transaction.notes || ''}\n\n--- STATUS UPDATE ---\n[${new Date().toLocaleString()}] ${notes}`;
    }

    if (newStatus === STATUS.RESOLVED) { updateFields.date_resolved = new Date(); }
    
    const borrowerId = transaction.borrower_resident_id;

    if ([STATUS.LOST, STATUS.DAMAGED, STATUS.OVERDUE].includes(newStatus)) {
        await residentsCollection.updateOne({ _id: borrowerId }, { $set: { 'account_status': 'Deactivated' } });
    } else if (newStatus === STATUS.RESOLVED) {
        await checkAndReactivateAccount(dab, borrowerId, transaction._id);
    }

    await borrowedAssetsCollection.updateOne(findQuery, { $set: updateFields });
    await createAuditLog({ description: `Status for item '${transaction.item_borrowed}' changed from '${oldStatus}' to '${newStatus}'.`, action: "STATUS_CHANGE", entityType: "BorrowTransaction", entityId: transaction._id.toString() }, req);
    
    // --- INSERT NOTIFICATION LOGIC HERE ---
    await createNotification(dab, {
      name: `Borrowed Asset Update (Ref: ${transaction.ref_no})`,
      content: `The status for your borrowed item '${transaction.item_borrowed}' has changed from '${oldStatus}' to '${newStatus}'.`,
      by: 'System Administration',
      type: 'Alert',
      target_audience: 'SpecificResidents',
      recipient_ids: [transaction.borrower_resident_id.toString()],
    });
    // --- END NOTIFICATION LOGIC ---

    const updatedTransaction = await borrowedAssetsCollection.findOne(findQuery);
    res.json({ message: `Transaction status updated to '${newStatus}' successfully.`, transaction: updatedTransaction });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({ error: 'Database error during status update.' });
  }
});

// 6. PROCESS ITEM RETURN (PATCH) - UPDATED TO STORE BASE64
app.patch('/api/borrowed-assets/:id/return', async (req, res) => {
    const { id } = req.params;
    const { return_proof_image_base64, return_condition_notes } = req.body;
    try {
        const dab = await db();
        const borrowedAssetsCollection = dab.collection('borrowed_assets');
        const findQuery = findByRefOrId(id);
        const transaction = await borrowedAssetsCollection.findOne(findQuery);

        if (!transaction) { return res.status(404).json({ error: 'Transaction not found.' }); }
        if (![STATUS.APPROVED, STATUS.OVERDUE].includes(transaction.status)) { return res.status(400).json({ error: `Cannot return an item with status '${transaction.status}'.` }); }

        // ✨ CRITICAL CHANGE HERE: Use return_proof_image_base64 field ✨
        const updateFields = {
            status: STATUS.RETURNED,
            date_returned: new Date(),
            return_proof_image_base64: return_proof_image_base64 || null, // Store Base64 directly
            return_condition_notes: return_condition_notes || "Item returned.",
            updated_at: new Date()
        };
        await borrowedAssetsCollection.updateOne(findQuery, { $set: updateFields });

        await checkAndReactivateAccount(dab, transaction.borrower_resident_id, transaction._id);

        await createAuditLog({ description: `Item returned for transaction: ${transaction.quantity_borrowed}x '${transaction.item_borrowed}'...`, action: "STATUS_CHANGE", entityType: "BorrowTransaction", entityId: transaction._id.toString() }, req);

        // --- INSERT NOTIFICATION LOGIC HERE ---
        await createNotification(dab, {
          name: `Item Returned (Ref: ${transaction.ref_no})`,
          content: `Thank you for returning the item: '${transaction.item_borrowed}'. Your transaction is now marked as Returned.`,
          by: 'System Administration',
          type: 'Alert',
          target_audience: 'SpecificResidents',
          recipient_ids: [transaction.borrower_resident_id.toString()],
        });
        // --- END NOTIFICATION LOGIC ---

        const updatedTransaction = await borrowedAssetsCollection.findOne(findQuery);
        res.json({ message: 'Item marked as returned successfully.', transaction: updatedTransaction });
    } catch (error) {
        console.error('Error marking item as returned:', error);
        res.status(500).json({ error: 'Failed to update transaction.' });
    }
});


// 7. DELETE TRANSACTION (DELETE) - UPDATED
app.delete('/api/borrowed-assets/:id', async (req, res) => {
  const { id } = req.params; 
  try {
    const dab = await db();
    const borrowedAssetsCollection = dab.collection("borrowed_assets");
    const findQuery = findByRefOrId(id);
    const transaction = await borrowedAssetsCollection.findOne(findQuery);

    if (!transaction) { return res.status(404).json({ error: "Transaction not found." }); }

    const result = await borrowedAssetsCollection.deleteOne(findQuery);
    if (result.deletedCount === 0) { return res.status(404).json({ error: "Transaction not found during deletion." }); }

    // --- NEW: Check if this deletion should reactivate the user's account ---
    if ([STATUS.OVERDUE, STATUS.LOST, STATUS.DAMAGED].includes(transaction.status)) {
        await checkAndReactivateAccount(dab, transaction.borrower_resident_id, transaction._id);
    }
    // --- END OF NEW LOGIC ---

    await createAuditLog({ description: `Borrowed asset transaction deleted: ${transaction.item_borrowed} (Ref: ${transaction.ref_no || id}).`, action: "DELETE", entityType: "BorrowedAsset", entityId: transaction._id.toString() }, req);
    
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting borrowed asset:", error);
    res.status(500).json({ error: "Failed to delete transaction." });
  }
});



// ================================ INVENTORY MANAGEMENT ================================ //

// NEW ENDPOINT: GET /api/assets/inventory-status - REVISED WITH CORRECT STATUSES
app.get('/api/assets/inventory-status', async (req, res) => {
    try {
        const dab = await db();
        const assetsCollection = dab.collection('assets');
        const borrowedAssetsCollection = dab.collection('borrowed_assets');

        // Step 1: Get the master list of all assets and their total quantities
        const allAssets = await assetsCollection.find({}, { projection: { name: 1, total_quantity: 1, _id: 0 } }).toArray();

        // Step 2: Get the count of all items currently borrowed (not Returned or Resolved)
        const borrowedCounts = await borrowedAssetsCollection.aggregate([
            { $match: { 
                // CORRECTED: Any status that means the item is 'out' should be counted.
                status: { $in: ['Pending', 'Approved', 'Overdue', 'Lost', 'Damaged'] } 
              } 
            },
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

// 2. READ (List): GET /api/assets - REVISED WITH SERVER-SIDE CALCULATIONS (INCLUDING PENDING and PROCESSING)
app.get('/api/assets', async (req, res) => {
    const search = req.query.search || '';
    const categoryFilter = req.query.category || '';
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    // ADDED: Extract start_date and end_date from query
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;

    const skip = (page - 1) * itemsPerPage;

    const dab = await db();
    const collection = dab.collection('assets');

    // --- Build the match conditions for filtering ---
    const andConditions = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        andConditions.push({ $or: [{ name: searchRegex }, { category: searchRegex }] });
    }
    if (categoryFilter) {
        andConditions.push({ category: categoryFilter });
    }

    // --- ADDED: Date Range Filtering for asset creation date (created_at) ---
    // Assuming 'created_at' is the field that stores when the asset record was created.
    // Adjust 'created_at' if your actual field name is different (e.g., 'date_added').
    if (start_date || end_date) {
      const dateRangeCondition = {};
      if (start_date) {
        dateRangeCondition.$gte = new Date(start_date);
      }
      if (end_date) {
        // Ensure end_date includes the entire day
        const endDateObj = new Date(end_date);
        endDateObj.setHours(23, 59, 59, 999); // Set to end of the day
        dateRangeCondition.$lte = endDateObj;
      }
      andConditions.push({ created_at: dateRangeCondition }); // Push to andConditions
    }
    // --- END ADDED ---

    let matchConditions = {};
    if (andConditions.length > 0) {
        matchConditions = { $and: andConditions };
    }

    try {
        // --- Aggregation Pipeline ---
        const aggregationPipeline = [
            // Stage 1: Initial filtering of assets (now includes date range)
            { $match: matchConditions },

            // Stage 2: Lookup for CURRENTLY BORROWED / OUT-OF-INVENTORY items
            // This now includes 'Processing', 'Approved', 'Overdue', 'Lost', 'Damaged'
            {
                $lookup: {
                    from: "borrowed_assets",
                    let: { assetName: "$name" },
                    pipeline: [
                        { $match: { 
                            $expr: { $eq: ["$item_borrowed", "$$assetName"] },
                            status: { $in: ['Processing', 'Approved', 'Overdue', 'Lost', 'Damaged'] } 
                        }},
                        { $group: { _id: null, total: { $sum: "$quantity_borrowed" } } }
                    ],
                    as: "borrowed_info"
                }
            },

            // Stage 3: Lookup for PENDING borrowed items (status 'Pending')
            // This specifically counts items awaiting approval
            {
                $lookup: {
                    from: "borrowed_assets",
                    let: { assetName: "$name" },
                    pipeline: [
                        { $match: { 
                            $expr: { $eq: ["$item_borrowed", "$$assetName"] },
                            status: 'Pending' // Only 'Pending' items
                        }},
                        { $group: { _id: null, total: { $sum: "$quantity_borrowed" } } }
                    ],
                    as: "pending_info"
                }
            },

            // Stage 4: Add calculated fields for 'borrowed' and 'pending'
            {
                $addFields: {
                    borrowed: { $ifNull: [{ $arrayElemAt: ["$borrowed_info.total", 0] }, 0] },
                    pending: { $ifNull: [{ $arrayElemAt: ["$pending_info.total", 0] }, 0] }
                }
            },
            
            // Stage 5: Calculate 'available' based on total_quantity, borrowed, and pending
            // 'Available' means items not borrowed AND not currently pending approval
            {
                $addFields: {
                    available: { $subtract: ["$total_quantity", { $add: ["$borrowed", "$pending"] }] }
                }
            },
            
            // Stage 6: Sort before pagination
            // Assuming default sort by 'name' as in your original code
            { $sort: { name: 1 } },

            // Stage 7: Use $facet for pagination and total count in one go
            {
                $facet: {
                    paginatedResults: [ 
                        { $skip: skip }, 
                        { $limit: itemsPerPage },
                        // Select all the fields needed by the frontend, including 'pending'
                        { $project: { name: 1, category: 1, total_quantity: 1, available: 1, borrowed: 1, pending: 1 } }
                    ],
                    totalCount: [ { $count: 'total' } ]
                }
            }
        ];

        const result = await collection.aggregate(aggregationPipeline).toArray();

        const assets = result[0].paginatedResults;
        const totalAssets = result[0].totalCount.length > 0 ? result[0].totalCount[0].total : 0;

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
app.post('/api/complaints', async (req, res) => {
  const dab = await db();
  
  // --- 1. RECEIVE THE NEW FIELD ---
  const {
    complainant_resident_id,
    processed_by_personnel, // New field
    complainant_display_name,
    complainant_address,
    contact_number,
    category,
    date_of_complaint,
    time_of_complaint,
    person_complained_against_name,
    status,
    notes_description,
    proofs_base64,
  } = req.body;

  // --- 2. UPDATE VALIDATION ---
  if (!complainant_resident_id || !complainant_display_name || !complainant_address || !contact_number || 
      !category || !date_of_complaint || !time_of_complaint  || !status || !notes_description) {
    return res.status(400).json({ error: 'Missing required fields for complaint request.' });
  }
  if (!ObjectId.isValid(complainant_resident_id)) {
    return res.status(400).json({ error: 'Invalid complainant resident ID format.' });
  }

  try {
    const collection = dab.collection('complaints');
    const complaintDate = new Date(date_of_complaint);

    // --- ADDED: Account Status Check ---
    // This will throw an error if the resident's account is restricted
    await checkResidentAccountStatus(complainant_resident_id, dab);
    // --- END ADDED ---

    const customRefNo = await generateUniqueReference(collection);

    // --- 3. ADD THE NEW FIELD TO THE DATABASE OBJECT ---
    const newComplaint = {
      ref_no: customRefNo,
      complainant_resident_id: new ObjectId(complainant_resident_id),
      processed_by_personnel: String(processed_by_personnel || '').trim(), // Save the personnel's name
      complainant_display_name: String(complainant_display_name).trim(),
      complainant_address: String(complainant_address).trim(),
      contact_number: String(contact_number).trim(),
      date_of_complaint: complaintDate,
      time_of_complaint: String(time_of_complaint).trim(),
      person_complained_against_name: String(person_complained_against_name).trim(),
      person_complained_against_resident_id: null,
      status: String(status).trim(),
      category: String(category).trim(),
      notes_description: String(notes_description).trim(),
      proofs_base64: Array.isArray(proofs_base64) ? proofs_base64 : [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await collection.insertOne(newComplaint);

    // --- 4. UPDATE THE AUDIT LOG DESCRIPTION ---
    await createAuditLog({
      userId: newComplaint.complainant_resident_id,
      userName: newComplaint.complainant_display_name,
      description: `New complaint (Ref: ${customRefNo}) filed by '${newComplaint.complainant_display_name}' was processed by ${newComplaint.processed_by_personnel}. The complaint is against '${newComplaint.person_complained_against_name}'.`,
      action: 'CREATE',
      entityType: 'Complaint',
      entityId: result.insertedId.toString()
    }, req);

    res.status(201).json({
      message: 'Complaint request added successfully',
      complaintId: result.insertedId,
      refNo: customRefNo
    });
    
  } catch (error) {
    console.error('Error adding complaint request:', error);
    // --- ADDED: Specific error handling for account status restrictions ---
    if (error.message.includes("account is pending approval") ||
        error.message.includes("account has been declined") ||
        error.message.includes("account has been permanently deactivated") ||
        error.message.includes("account is currently On Hold/Deactivated")) {
      return res.status(403).json({ // 403 Forbidden is appropriate for access denied
        error: 'Action Restricted. Account status On Hold / Deactivated.',
        message: error.message
      });
    }
    // --- END ADDED ---
    res.status(500).json({ error: 'Error adding complaint: ' + error.message });
  }
});

// GET ALL COMPLAINT REQUESTS (GET) - UPDATED with Date Range Filtering
app.get('/api/complaints', async (req, res) => {
  const search = req.query.search || '';
  const status = req.query.status || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  // ADDED: Extract start_date and end_date from query
  const start_date = req.query.start_date;
  const end_date = req.query.end_date;

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

  // --- ADDED: Date Range Filtering for date_of_complaint ---
  if (start_date || end_date) {
    const dateRangeCondition = {};
    if (start_date) {
      dateRangeCondition.$gte = new Date(start_date);
    }
    if (end_date) {
      // Ensure end_date includes the entire day
      const endDateObj = new Date(end_date);
      endDateObj.setHours(23, 59, 59, 999); // Set to end of the day
      dateRangeCondition.$lte = endDateObj;
    }
    matchQuery.date_of_complaint = dateRangeCondition;
  }
  // --- END ADDED ---

  try {
    const aggregationPipeline = [
      { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
      { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } } },
      { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } } },
      { $match: matchQuery }, // This $match now includes date range filter
      {
        $project: {
          _id: 1,
          ref_no: 1, // <-- MODIFIED: Included ref_no in the response
          complainant_name: { 
            $ifNull: [
                { $concat: [ "$complainant_details.first_name", " ", "$complainant_details.last_name"] }, 
                "$complainant_display_name" // Fallback for existing data or if resident not found
            ]
          },
          person_complained_against: {
            $ifNull: [
              { $concat: [ "$person_complained_details.first_name", " ", "$person_complained_details.last_name"] },
              "$person_complained_against_name" // Fallback for existing data or if resident not found
            ]
          },
          date_of_complaint: 1, status: 1, notes_description: 1, created_at: 1, category: 1,
        }
      },
      { $sort: { date_of_complaint: -1, created_at: -1 } }, // Default sort
      { $skip: skip }, { $limit: itemsPerPage }
    ];

    const complaints = await collection.aggregate(aggregationPipeline).toArray();
    
    // The count pipeline must also incorporate the date range filter
    const countPipeline = [
        { $lookup: { from: 'residents', localField: 'complainant_resident_id', foreignField: '_id', as: 'complainant_details_array' }},
        { $addFields: { complainant_details: { $arrayElemAt: ['$complainant_details_array', 0] } }},
        { $lookup: { from: 'residents', localField: 'person_complained_against_resident_id', foreignField: '_id', as: 'person_complained_details_array' }},
        { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } }},
        { $match: matchQuery }, // This $match now includes date range filter
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
  const status = req.query.status || ''; // <-- ADDED: Read the status query parameter
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

    // Build the initial match query for the complainant's resident ID
    let finalMatchQuery = { complainant_resident_id: residentObjectId };

    // Add status filter if a status is provided (and it's not 'All' which results in undefined on frontend)
    if (status) {
        finalMatchQuery.status = status;
    }

    // Add search filter if a search term is provided
    if (search) {
        const searchRegex = new RegExp(search.trim(), 'i');
        const searchCriteria = [
            { ref_no: { $regex: searchRegex } },
            { person_complained_against_name: { $regex: searchRegex } },
            { "person_complained_details.first_name": { $regex: searchRegex } },
            { "person_complained_details.last_name": { $regex: searchRegex } },
            { status: { $regex: searchRegex } }, // Also search within status for flexibility
            { notes_description: { $regex: searchRegex } },
            { category: { $regex: searchRegex } }, // Added category to search
        ];
        
        // If we already have filters (like status), combine with $and
        if (finalMatchQuery.status) {
            finalMatchQuery = {
                $and: [
                    { complainant_resident_id: residentObjectId },
                    { status: finalMatchQuery.status },
                    { $or: searchCriteria }
                ]
            };
        } else {
            // No specific status filter, just combine resident ID and search
            finalMatchQuery = {
                $and: [
                    { complainant_resident_id: residentObjectId },
                    { $or: searchCriteria }
                ]
            };
        }
    }

    const aggregationPipeline = [
      { $match: finalMatchQuery }, // Use the correctly constructed finalMatchQuery
      {
        $lookup: {
          from: 'residents',
          localField: 'person_complained_against_resident_id',
          foreignField: '_id',
          as: 'person_complained_details_array'
        }
      },
      { $addFields: { person_complained_details: { $arrayElemAt: ['$person_complained_details_array', 0] } } },
      {
        $project: {
          _id: 1,
          ref_no: 1, 
          complainant_display_name: 1,
          person_complained_against_name: { 
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
          time_of_complaint: 1,
          status: 1,
          notes_description: 1,
          created_at: 1,
          updated_at: 1,
          category: 1,
          proofs_base64: 1,
        }
      },
      { $sort: { date_of_complaint: -1, created_at: -1 } },
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const complaints = await collection.aggregate(aggregationPipeline).toArray();

    // The preciseCountPipeline also needs to use the same finalMatchQuery for consistency
    const preciseCountPipeline = [
        { $match: finalMatchQuery }, // Use the same finalMatchQuery
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
           status_reason: 1,
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
  const { status, reason } = req.body;
  // UPDATED: Added 'Unresolved' to the list of allowed statuses
  const ALLOWED_STATUSES = ['New', 'Under Investigation', 'Unresolved', 'Resolved', 'Closed', 'Dismissed'];
  
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  if (status === 'Dismissed' && (!reason || reason.trim() === '')) {
      return res.status(400).json({ message: `A reason is required to ${status.toLowerCase()} this complaint.` });
  }

  const dab = await db();

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

    const updateSet = { status: status, updated_at: new Date() };

    // If dismissing, set the reason. Otherwise, unset it to clear previous dismissal reasons.
    if (status === 'Dismissed' && reason) {
        updateSet.status_reason = reason;
    } else if (originalComplaint.status_reason) { // Only unset if there was a reason previously
        await complaintsCollection.updateOne(
            { _id: originalComplaint._id },
            { $unset: { status_reason: "" } }
        );
    }

    await complaintsCollection.updateOne(
      { _id: originalComplaint._id },
      { $set: updateSet }
    );

    await createAuditLog({
        description: `Status for complaint (Ref: ${originalComplaint.ref_no}) changed from '${oldStatus}' to '${status}'. Reason: ${reason || 'N/A'}`,
        action: "STATUS_CHANGE",
        entityType: "Complaint",
        entityId: originalComplaint._id.toString(),
    }, req);

    if (originalComplaint.complainant_resident_id) {
      const notificationContent = reason 
        ? `The status of your complaint against "${originalComplaint.person_complained_against_name}" has been updated to: ${status}. Reason: ${reason}`
        : `The status of your complaint against "${originalComplaint.person_complained_against_name}" has been updated to: ${status}.`;

      // --- THIS IS THE CORRECTED PART ---
      await createNotification(dab, {
        name: `Complaint Status Update (Ref: ${originalComplaint.ref_no})`,
        content: notificationContent,
        by: "System Administration",
        type: "Alert", // Changed to 'Alert' for consistency
        target_audience: 'SpecificResidents',
        // The resident ID must be converted to a string
        recipient_ids: [originalComplaint.complainant_resident_id.toString()], 
      });
      // --- END OF CORRECTION ---
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


// ADD NEW DOCUMENT (POST)
// POST /api/document-requests - ADD NEW DOCUMENT REQUEST (Handles new 'details' object and 'processed_by_personnel')
app.post('/api/document-requests', async (req, res) => {
  const dab = await db();
  const {
    requestor_resident_id,
    processed_by_personnel,
    request_type,
    purpose,
    details,
  } = req.body;

  // --- 2. UPDATE VALIDATION ---
  if (!requestor_resident_id || !request_type ) {
    return res.status(400).json({ error: 'Missing required fields: requestor and type are required.' });
  }
  if (!ObjectId.isValid(requestor_resident_id)) {
    return res.status(400).json({ error: 'Invalid requestor resident ID format.' });
  }

  try {
    const residentsCollection = dab.collection('residents');
    const requestsCollection = dab.collection('document_requests');

    // --- ADDED: Account Status Check ---
    await checkResidentAccountStatus(requestor_resident_id, dab);
    // --- END ADDED ---

    // Fetch the requestor's name for a more descriptive log
    const requestor = await residentsCollection.findOne({ _id: new ObjectId(requestor_resident_id) });
    const requestorName = requestor ? `${requestor.first_name} ${requestor.last_name}`.trim() : 'an unknown resident';

    // Generate a unique, user-friendly reference number
    const customRefNo = await generateUniqueReference(requestsCollection);

    // --- 3. ADD THE NEW FIELD TO THE DATABASE OBJECT ---
    // MODIFIED: Added requestor_name to the newRequest object for easier retrieval
    const newRequest = {
      ref_no: customRefNo,
      requestor_resident_id: new ObjectId(requestor_resident_id),
      requestor_name: requestorName, // Store the requestor's name directly in the document request
      processed_by_personnel: String(processed_by_personnel).trim(), // Save the personnel's name
      request_type: String(request_type).trim(),
      purpose: String(purpose).trim(),
      details: details || {},
      document_status: "Pending",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await requestsCollection.insertOne(newRequest);

    // --- 4. UPDATE THE AUDIT LOG DESCRIPTION ---
    await createAuditLog({
        description: `New document request '${request_type}' (Ref: ${customRefNo}) for resident ${requestorName} was processed by ${processed_by_personnel}.`,
        action: "CREATE",
        entityType: "DocumentRequest",
        entityId: result.insertedId.toString(),
        userId: requestor ? requestor._id : null,
        userName: requestorName,
    }, req);

    // Update the response to the frontend
    res.status(201).json({
      message: 'Document request added successfully',
      requestId: result.insertedId,
      refNo: customRefNo
    });

  } catch (error) {
    console.error('Error adding document request:', error);
    // --- ADDED: Specific error handling for account status restrictions ---
    if (error.message.includes("account is pending approval") ||
        error.message.includes("account has been declined") ||
        error.message.includes("account has been permanently deactivated") ||
        error.message.includes("account is currently On Hold/Deactivated")) {
      return res.status(403).json({ // 403 Forbidden is appropriate for access denied
        error: 'Action Restricted. Account status On Hold / Deactivated.',
        message: error.message
      });
    }
    // --- END ADDED ---
    res.status(500).json({ error: 'Error adding document request.' });
  }
});


// NEW ENDPOINT: GET ALL DOCUMENT REQUESTS (GET)
// Handles search, status filter, pagination, sorting, and DATE RANGE FILTERING
app.get('/api/document-requests', async (req, res) => {
  const dab = await db();
  const requestsCollection = dab.collection('document_requests');

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const statusFilter = req.query.status; // e.g., 'Pending', 'Approved', 'Declined', 'All'
  const sortBy = req.query.sortBy;
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // 1 for ascending, -1 for descending
  const startDate = req.query.start_date; // ISO string from frontend
  const endDate = req.query.end_date;     // ISO string from frontend

  const matchQuery = {};

  // Status filter
  if (statusFilter && statusFilter !== 'All') {
    matchQuery.document_status = statusFilter;
  }

  // Date range filter on `created_at` field
  if (startDate || endDate) {
    matchQuery.created_at = {};
    if (startDate) {
      matchQuery.created_at.$gte = new Date(startDate);
    }
    if (endDate) {
      matchQuery.created_at.$lte = new Date(endDate);
    }
  }

  let sortOptions = {};
  if (sortBy) {
    sortOptions[sortBy] = sortOrder;
  } else {
    // Default sort: newest requests first
    sortOptions = { created_at: -1 };
  }

  try {
    const pipeline = [
      // 1. Match documents based on initial filters (status, date)
      { $match: matchQuery },
      
      // 2. Lookup resident details
      {
        $lookup: {
          from: 'residents', // The collection to join with
          localField: 'requestor_resident_id', // Field from the input documents
          foreignField: '_id', // Field from the "residents" documents
          as: 'requestorInfo' // Output array field
        }
      },
      // 3. Deconstruct the requestorInfo array (it will be an array with one resident)
      {
        $unwind: {
          path: '$requestorInfo',
          preserveNullAndEmptyArrays: true // Keep requests even if resident not found
        }
      },
      // 4. Add a computed requestor_name field
      {
        $addFields: {
          requestor_name_computed: {
            $cond: {
              if: '$requestorInfo.first_name', // Check if resident info exists
              then: { $concat: ['$requestorInfo.first_name', ' ', '$requestorInfo.last_name'] },
              else: { $ifNull: ['$requestor_name', 'N/A'] } // Fallback to denormalized or 'N/A'
            }
          }
        }
      },
      // 5. Apply search filter (now includes the computed requestor_name)
      // This $match must come after $addFields for requestor_name_computed to be available
      {
        $match: search
          ? {
              $or: [
                { request_type: { $regex: new RegExp(search, 'i') } },
                { purpose: { $regex: new RegExp(search, 'i') } },
                { ref_no: { $regex: new RegExp(search, 'i') } },
                { requestor_name_computed: { $regex: new RegExp(search, 'i') } } // Search on computed name
              ]
            }
          : {}
      },
      // 6. Sort
      { $sort: sortOptions },
      // 7. Count total documents for pagination metadata
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          requests: { $push: '$$ROOT' }
        }
      },
      // 8. Project the desired fields, apply skip and limit
      {
        $project: {
          _id: 0,
          total: 1,
          requests: {
            $slice: [
              {
                $map: {
                  input: '$requests',
                  as: 'request',
                  in: {
                    _id: '$$request._id',
                    ref_no: '$$request.ref_no',
                    requestor_resident_id: '$$request.requestor_resident_id',
                    request_type: '$$request.request_type',
                    purpose: '$$request.purpose',
                    details: '$$request.details',
                    document_status: '$$request.document_status',
                    created_at: '$$request.created_at',
                    updated_at: '$$request.updated_at',
                    // Use the computed name
                    requestor_name: '$$request.requestor_name_computed', 
                    // Add other fields you need for the frontend
                  }
                }
              },
              (page - 1) * itemsPerPage,
              itemsPerPage
            ]
          }
        }
      }
    ];

    const aggregationResult = await requestsCollection.aggregate(pipeline).toArray();
    
    // The result will be an array with one element containing 'total' and 'requests'
    const result = aggregationResult.length > 0 ? aggregationResult[0] : { total: 0, requests: [] };

    res.json({
      requests: result.requests,
      total: result.total,
    });
  } catch (error) {
    console.error('Error fetching document requests:', error);
    res.status(500).json({ error: 'Error fetching document requests.' });
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
  // Destructure the new status and optional reason from the request body
  const { status: newStatus, reason } = req.body; 

  const ALLOWED_DOC_STATUSES = ["Pending", "Processing", "Ready for Pickup", "Approved", "Released", "Declined"];
  
  // --- Validation ---
  if (!newStatus || !ALLOWED_DOC_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status value provided.' });
  }

  // NEW: Validate that a reason is provided when the status is 'Declined'
  if (newStatus === 'Declined' && (!reason || reason.trim() === '')) {
      return res.status(400).json({ message: 'A reason is required to decline this request.' });
  }
  // --- End Validation ---

  try {
    const dab = await db();
    const collection = dab.collection('document_requests');

    // Dynamically query by either database _id or the user-friendly ref_no
    let query = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { ref_no: id.toUpperCase() }; 
    }

    // Fetch the original document to check its current state and for logging
    const originalRequest = await collection.findOne(query);
    if (!originalRequest) {
      return res.status(404).json({ error: 'Request not found.' });
    }
    
    const oldStatus = originalRequest.document_status;
    if (oldStatus === newStatus) {
      return res.json({ message: `Request status is already '${newStatus}'. No changes made.` });
    }

    // --- Build the MongoDB Update Payload ---
    const updatePayload = {
        $set: {
            document_status: newStatus,
            updated_at: new Date()
        }
    };

    if (reason) {
        // If a reason is provided, add it to the 'status_reason' field.
        updatePayload.$set.status_reason = reason; 
    } else {
        // If no reason is provided (e.g., for 'Approved'), remove any existing reason.
        updatePayload.$unset = { status_reason: "" }; 
    }
    // --- End Build Update Payload ---

    const result = await collection.updateOne(query, updatePayload);
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Request not found during update operation.' });
    }

    // Create a detailed audit log for this action
    await createAuditLog({
      description: `Status for doc request '${originalRequest.request_type}' (Ref: ${originalRequest.ref_no}) changed from '${oldStatus}' to '${newStatus}'. Reason: ${reason || 'N/A'}`,
      action: "STATUS_CHANGE",
      entityType: "DocumentRequest",
      entityId: originalRequest._id.toString(),
    }, req);

    // --- INSERT NOTIFICATION LOGIC HERE ---
    const notificationContent = reason
      ? `The status of your document request for '${originalRequest.request_type}' (Ref: ${originalRequest.ref_no}) has been updated to: ${newStatus}. Reason: ${reason}`
      : `The status of your document request for '${originalRequest.request_type}' (Ref: ${originalRequest.ref_no}) has been updated to: ${newStatus}.`;

    await createNotification(dab, {
      name: `Document Request Update (Ref: ${originalRequest.ref_no})`,
      content: notificationContent,
      by: 'System Administration',
      type: 'Alert',
      target_audience: 'SpecificResidents',
      recipient_ids: [originalRequest.requestor_resident_id.toString()],
    });
    // --- END NOTIFICATION LOGIC ---

    res.json({ message: `Status updated to '${newStatus}' successfully.` });

  } catch (error) {
    console.error("Error updating document request status:", error);
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
      const currentRequest = await collection.findOne({ _id: new ObjectId(id) });
      return res.status(200).json({ message: 'Request was not in Pending state.', request: currentRequest });
    }

    await createAuditLog({
        description: `Document request '${result.value.request_type}' (#${id.slice(-6)}) moved to 'Processing'.`,
        action: "STATUS_CHANGE",
        entityType: "DocumentRequest",
        entityId: id,
    }, req);

    // --- CORRECTED NOTIFICATION LOGIC ---
    await createNotification(dab, {
        name: `Your document request is now being processed`,
        content: `Your request for a ${result.value.request_type} (Ref: ${result.value.ref_no}) has been received and is now being processed.`,
        by: "System Administration",
        type: "Alert",
        target_audience: "SpecificResidents",
        recipient_ids: [result.value.requestor_resident_id.toString()], // Corrected field
    });
    
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

    // --- CORRECTED NOTIFICATION LOGIC ---
    const getDocu = await collection.findOne({ _id: new ObjectId(id) });
    await createNotification(dab, {
        name: `Your document request has been approved`,
        content: `Your request for a ${getDocu.request_type} (Ref: ${getDocu.ref_no}) has been approved and is being prepared.`,
        by: "System Administration",
        type: "Alert",
        target_audience: "SpecificResidents",
        recipient_ids: [getDocu.requestor_resident_id.toString()], // Corrected field
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

    // --- CORRECTED NOTIFICATION LOGIC ---
    const getDocu = await collection.findOne({ _id: new ObjectId(id) });
    await createNotification(dab, {
        name: `Your document is ready for pickup`,
        content: `Your document request for a ${getDocu.request_type} (Ref: ${getDocu.ref_no}) is now ready for pickup at the barangay hall.`,
        by: "System Administration",
        type: "Alert",
        target_audience: "SpecificResidents",
        recipient_ids: [getDocu.requestor_resident_id.toString()], // Corrected field
    });
    
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
    const { reason } = req.body;
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
        
        // --- CORRECTED NOTIFICATION LOGIC ---
        const getDocu = await collection.findOne({ _id: new ObjectId(id) });
        await createNotification(dab, {
            name: `Your document request was declined`,
            content: `Your document request for a ${getDocu.request_type} (Ref: ${getDocu.ref_no}) was declined. Reason: '${reason || 'No reason provided.'}'`,
            by: "System Administration",
            type: "Alert",
            target_audience: "SpecificResidents",
            recipient_ids: [getDocu.requestor_resident_id.toString()], // Corrected field
        });
        
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

    // if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
    if (!proof_of_release || !proof_of_release.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Valid proof of release photo is required.' });
    }

    try {
        const dab = await db();
        const collection = dab.collection('document_requests');
        
        // --- FETCH ORIGINAL DOCUMENT FOR LOGGING ---
        const originalRequest = await collection.findOne({ ref_no: id });
        if (!originalRequest) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        if (originalRequest.document_status !== 'Ready for Pickup') {
            return res.status(409).json({ error: `Request is not in "Ready for Pickup" state. Current status: ${originalRequest.document_status}` });
        }
        // --- END FETCH ---

        const result = await collection.findOneAndUpdate(
            { ref_no: id, document_status: 'Ready for Pickup' }, // Condition
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



const isDebug = !false; /* For production */
// const isDebug = false; /* For development */

// *** NEW ENDPOINT ***
// GET /api/document-requests/:id/generate - GENERATE AND SERVE THE PDF
const puppeteer = isDebug ? require('puppeteer-core') : require('puppeteer');

const fs = require('fs').promises; // Use promise-based fs

app.get('/api/document-requests/:id/generate', async (req, res) => {
  const chromium = (await import('@sparticuz/chromium')).default;


  // if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
  const dab = await db();

  try {
    // 1. Fetch ALL necessary data
    const request = await dab.collection('document_requests').findOne({ ref_no: req.params.id });
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
      'Barangay Business Permit': 'business-permit.html',
      'Barangay BADAC Certificate': 'badac-certificate.html',
      'Certificate of Oneness': 'oneness_certificate.html'
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

        // --- Barangay Business Permit ---
        '[BUSINESS NAME]': request.details.business_name || '',
        '[BUSINESS ADDRESS]': request.details.business_address || '',
        
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

        // Badac Certificate
        '[BADAC PURPOSE]': request.details.badac_certificate|| '',

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
    // res.setHeader('Content-Disposition', `attachment; filename="${request.request_type.replace(/ /g, '_')}_${requestor.last_name}.pdf"`);
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

    // --- Core Metrics (No changes) ---
    const totalPopulation = await residentsCollection.countDocuments({ status: 'Approved' });
    const totalHouseholds = await residentsCollection.countDocuments({ is_household_head: true, status: 'Approved' });
    const totalRegisteredVoters = await residentsCollection.countDocuments({ is_registered_voter: true, status: 'Approved' });
    const totalSeniorCitizens = await residentsCollection.countDocuments({ date_of_birth: { $lte: new Date(new Date().setFullYear(new Date().getFullYear() - 60)) }, status: 'Approved' });
    const totalPWDs = await residentsCollection.countDocuments({ is_pwd: true, status: 'Approved' });
    const totalLaborForce = await residentsCollection.countDocuments({ occupation_status: 'Labor force', status: 'Approved' });
    const totalUnemployed = await residentsCollection.countDocuments({ occupation_status: 'Unemployed', status: 'Approved' });
    const totalOutOfSchoolYouth = await residentsCollection.countDocuments({ occupation_status: 'Out of School Youth', status: 'Approved' });
    
    // --- Transaction Alert Counts ---
    const pendingDocumentRequestsCount = await documentRequestsCollection.countDocuments({ document_status: 'Pending' });
    const newComplaintsCount = await complaintsCollection.countDocuments({ status: 'New' });
    
    // <<< CHANGE #1: Add 'Approved' to the count query
    const borrowedAssetsNotReturnedCount = await borrowedAssetsCollection.countDocuments({
      status: { $in: ['Approved', 'Borrowed', 'Overdue'] } 
    });
    
    const pendingResidentsCount = await residentsCollection.countDocuments({ status: 'Pending' });

    // --- Fetch Recent Items for Alert Cards ---
    const recentPendingDocumentRequests = await documentRequestsCollection.find({ document_status: 'Pending' }).sort({ date_of_request: -1 }).limit(3).toArray();
    const recentNewComplaints = await complaintsCollection.find({ status: 'New' }).sort({ date_of_complaint: -1 }).limit(3).toArray();
    
    // <<< CHANGE #2: Add 'Approved' to the items list query
    const recentBorrowedAssetsRaw = await borrowedAssetsCollection.find({
        status: { $in: ['Approved', 'Borrowed', 'Overdue'] }
    }).sort({ borrow_datetime: -1 }).limit(3).toArray();
    
    const recentPendingResidentsRaw = await residentsCollection.find({ status: 'Pending' }).sort({ created_at: -1 }).limit(3).toArray();
    
    // Format the data for the frontend (No changes needed in this logic)
    const recentBorrowedAssets = recentBorrowedAssetsRaw.map(asset => ({
        _id: asset._id,
        item_borrowed: asset.item_borrowed,
        quantity_borrowed: asset.quantity_borrowed,
        borrower_name: asset.borrower,
        created_at: asset.borrow_datetime,
    }));

    const recentPendingResidents = recentPendingResidentsRaw.map(resident => ({
      _id: resident._id,
      name: `${resident.first_name} ${resident.last_name}`,
      dateAdded: resident.created_at
    }));

    // --- Send Final JSON Response ---
    res.json({
      totalPopulation,
      totalHouseholds,
      totalRegisteredVoters,
      totalSeniorCitizens,
      totalPWDs,
      totalLaborForce,
      totalUnemployed,
      totalOutOfSchoolYouth,
      pendingDocumentRequestsCount,
      newComplaintsCount,
      borrowedAssetsNotReturnedCount,
      pendingResidentsCount,
      recentPendingDocumentRequests,
      recentNewComplaints,
      recentBorrowedAssets,
      recentPendingResidents,
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
    
    // --- START: MODIFICATION ---
    // 1. Generate a unique reference number for this log entry.
    const refNo = await generateUniqueReference(auditLogsCollection);
    // --- END: MODIFICATION ---

    let userData = {};
    if (req.headers.cookie) { 
      const cookieArray = req.headers.cookie.split(";").map(c => c.trim());
      const userDataCookie = cookieArray.find(c => c.startsWith('userData='));
      userData = userDataCookie ? JSON.parse(decodeURIComponent(userDataCookie.split('=')[1])) : null;
    }

    const logDocument = {
      ref_no: refNo, // <-- 2. ADD THE NEW FIELD HERE
      user_id: logData.userId || null,
      user_name: logData.userName || userData?.name || 'System',
      description: logData.description,
      action: logData.action,
      entityType: logData.entityType || null,
      entityId: logData.entityId || null,
      createdAt: new Date(),
    };
    
    await auditLogsCollection.insertOne(logDocument);

  } catch (error) {
    console.error('FATAL: Could not create audit log.', error);
  }
}


// ======================= AUDIT LOGS ======================= //

// GET ALL AUDIT LOGS
app.get('/api/audit-logs', async (req, res) => {
    try {
        const dab = await db(); // Assuming db() connects to your MongoDB
        const collection = dab.collection('audit_logs'); // Assuming 'audit_logs' collection

        const {
            search,
            page: reqPage,
            itemsPerPage: reqItemsPerPage,
            sortBy,
            sortOrder,
            start_date, // NEW: Date range start
            end_date    // NEW: Date range end
        } = req.query;

        const page = parseInt(reqPage) || 1;
        const itemsPerPage = parseInt(reqItemsPerPage) || 10;
        const skip = (itemsPerPage > 100000) ? 0 : (page - 1) * itemsPerPage; // Handle "print all" scenario

        const filters = [];

        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filters.push({
                $or: [
                    { description: searchRegex },
                    { user_name: searchRegex },
                    { ref_no: searchRegex }
                    // Add other searchable fields if applicable
                ]
            });
        }

        // --- NEW: Add Date Range Filtering for 'createdAt' ---
        if (start_date || end_date) {
            const createdAtFilter = {};
            if (start_date) {
                createdAtFilter.$gte = new Date(start_date); // Convert ISO string to Date object
            }
            if (end_date) {
                createdAtFilter.$lte = new Date(end_date);   // Convert ISO string to Date object
            }
            if (Object.keys(createdAtFilter).length > 0) {
                filters.push({ createdAt: createdAtFilter });
            }
        }
        // --- END NEW Date Range Filtering ---

        const finalQuery = filters.length > 0 ? { $and: filters } : {};

        let sortOptions = { createdAt: -1 }; // Default sort by creation date descending
        if (sortBy) {
            sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
        }

        const logs = await collection.find(finalQuery)
            .project({ // Select only necessary fields
                ref_no: 1,
                user_name: 1,
                description: 1,
                createdAt: 1,
                _id: 0 // Exclude _id if not needed, as ref_no is used as item-value
            })
            .sort(sortOptions)
            .skip(skip)
            .limit(itemsPerPage)
            .toArray();

        const total = await collection.countDocuments(finalQuery);

        res.json({
            logs: logs,
            total: total,
            page: page,
            itemsPerPage: itemsPerPage,
            totalPages: Math.ceil(total / itemsPerPage)
        });

    } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
});


// ================================== BUDGET MANAGEMENT CRUD ================================== //

// 1. CREATE: POST /api/budgets
app.post('/api/budgets', async (req, res) => {
    const dab = await db();
    const collection = dab.collection('budgets');
    const { budgetName, category, amount, date } = req.body;

    // --- Validation ---
    if (!budgetName || !category || amount === undefined || !date) {
        return res.status(400).json({ error: 'Missing required fields: budgetName, category, amount, and date are required.' });
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
        return res.status(400).json({ error: 'Amount must be a non-negative number.' });
    }

    try {
        const newBudgetDoc = {
            budgetName: String(budgetName).trim(),
            category: String(category).trim(),
            amount: numericAmount,
            date: new Date(date),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await collection.insertOne(newBudgetDoc);

        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `New budget entry created: '${budgetName}' for ${numericAmount.toFixed(2)}.`,
            action: "CREATE",
            entityType: "Budget",
            entityId: result.insertedId.toString(),
        }, req);
        // --- END AUDIT LOG ---

        res.status(201).json({ message: 'Budget entry added successfully', budgetId: result.insertedId });
    } catch (error) {
        console.error("Error adding budget entry:", error);
        res.status(500).json({ error: 'Failed to add budget entry.' });
    }
});

app.get('/api/budgets/categories', async (req, res) => {
  try {
    const dab = await db();
    const budgetsCollection = dab.collection('budgets');
    const categories = await budgetsCollection.distinct('category');
    res.json({ categories });
  } catch (error) {
    console.error("Error fetching budget categories:", error);
    res.status(500).json({ error: "Failed to fetch budget categories", message: error.message });
  }
});

app.get('/api/budgets', async (req, res) => {
    try {
        const dab = await db(); // Get database connection
        const collection = dab.collection('budgets');

        const { search, sortBy, sortOrder, start_date, end_date, filterYear } = req.query;
        let page = parseInt(req.query.page) || 1;
        let itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
        if (itemsPerPage !== -1 && itemsPerPage < 1) itemsPerPage = 10; 

        console.log("Backend received /api/budgets query params:", req.query);

        let query = {};

        // Search filter
        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query = {
                $or: [
                    { budgetName: searchRegex },
                    { category: searchRegex }
                ]
            };
        }

        // NEW: Date Range filters (start_date and end_date)
        if (start_date || end_date) {
            query.date = {};
            if (start_date) {
                // Parse ISO string to Date object
                query.date.$gte = new Date(start_date);
                console.log(`Filtering from start_date: ${new Date(start_date).toISOString()}`);
            }
            if (end_date) {
                // Parse ISO string to Date object
                query.date.$lte = new Date(end_date);
                console.log(`Filtering up to end_date: ${new Date(end_date).toISOString()}`);
            }
        } 
        // Existing: Filter by Year (only if no specific start/end dates are provided)
        else if (filterYear) {
            const year = parseInt(filterYear);
            const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
            const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

            query.date = {
                $gte: startOfYear,
                $lte: endOfYear,
            };
            console.log(`Filtering by year: ${filterYear}, UTC range: ${startOfYear.toISOString()} to ${endOfYear.toISOString()}`);
        }
        
        let sortOptions = { date: -1 }; // Default sort
        if (sortBy) {
            sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
        }

        console.log("Final MongoDB Query for /api/budgets:", JSON.stringify(query));

        let cursor = collection.find(query).sort(sortOptions);

        if (itemsPerPage !== -1) {
            const skip = (page - 1) * itemsPerPage;
            cursor = cursor.skip(skip).limit(itemsPerPage);
        }

        const budgets = await cursor.toArray();
        console.log("Number of budgets fetched for /api/budgets:", budgets.length);

        const totalBudgets = await collection.countDocuments(query);

        res.json({
            budgets,
            totalBudgets,
        });

    } catch (error) {
        console.error("Error fetching budget entries:", error);
        res.status(500).json({ error: 'Failed to fetch budget entries.' });
    }
});

// NEW ROUTE: Endpoint to fetch distinct budget years for the filter dropdown
app.get('/api/budgets/years', async (req, res) => {
    try {
        const dab = await db();
        const collection = dab.collection('budgets');

        // MongoDB aggregation pipeline to extract distinct years
        const distinctYears = await collection.aggregate([
            {
                $project: {
                    // Assuming 'date' field in your MongoDB collection is stored as an ISODate (BSON Date type).
                    // If your 'date' field is a string (e.g., "DD/MM/YYYY"), you would first need to convert it using $dateFromString:
                    // convertedDate: { $dateFromString: { dateString: "$date", format: "%d/%m/%Y" } }
                    // Then use: year: { $year: "$convertedDate" }
                    year: { $year: "$date" }
                }
            },
            {
                $group: {
                    _id: "$year" // Group by the extracted year to get unique values
                }
            },
            {
                $sort: { _id: 1 } // Sort the years in ascending order
            },
            {
                $project: {
                    _id: 0,      // Exclude the default _id field
                    year: "$_id" // Project the grouped _id value as 'year'
                }
            }
        ]).toArray();

        // Convert the array of objects [{ year: 2025 }, { year: 2026 }]
        // to a simple array of numbers [2025, 2026]
        const yearsArray = distinctYears.map(item => item.year);

        console.log("Fetched distinct budget years:", yearsArray);
        res.status(200).json({ years: yearsArray });

    } catch (error) {
        console.error("Error fetching distinct budget years:", error);
        res.status(500).json({ message: "Failed to fetch distinct budget years." });
    }
});

// 3. READ (Single): GET /api/budgets/:id
app.get('/api/budgets/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format.' });
    const dab = await db();
    const collection = dab.collection('budgets');
    try {
        const budget = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!budget) return res.status(404).json({ error: 'Budget entry not found.' });
        res.json({ budget });
    } catch (error) {
        console.error("Error fetching budget entry by ID:", error);
        res.status(500).json({ error: 'Failed to fetch budget entry.' });
    }
});

// 4. UPDATE: PUT /api/budgets/:id
app.put('/api/budgets/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format.' });
    
    const dab = await db();
    const collection = dab.collection('budgets');
    const { budgetName, category, amount, date } = req.body;

    // --- Validation ---
    if (!budgetName || !category || amount === undefined || !date) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
     const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
        return res.status(400).json({ error: 'Amount must be a non-negative number.' });
    }

    try {
        const budgetToUpdate = await collection.findOne({ _id: new ObjectId(id) });
        if (!budgetToUpdate) return res.status(404).json({ error: 'Budget entry not found.' });

        const updateFields = {
            budgetName: String(budgetName).trim(),
            category: String(category).trim(),
            amount: numericAmount,
            date: new Date(date),
            updatedAt: new Date(),
        };

        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Budget entry not found during update.' });
        
        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `Updated budget entry: '${budgetToUpdate.budgetName}'.`,
            action: "UPDATE",
            entityType: "Budget",
            entityId: id,
        }, req);
        // --- END AUDIT LOG ---

        res.json({ message: 'Budget entry updated successfully' });
    } catch (error) {
        console.error("Error updating budget entry:", error);
        res.status(500).json({ error: 'Failed to update budget entry.' });
    }
});

// 5. DELETE: DELETE /api/budgets/:id
app.delete('/api/budgets/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID format.' });
    
    const dab = await db();
    const collection = dab.collection('budgets');
    
    try {
        const budgetToDelete = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!budgetToDelete) return res.status(404).json({ error: 'Budget entry not found.' });

        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Budget entry not found during deletion.' });
        
        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            description: `Deleted budget entry: '${budgetToDelete.budgetName}'.`,
            action: "DELETE",
            entityType: "Budget",
            entityId: req.params.id,
        }, req);
        // --- END AUDIT LOG ---

        res.json({ message: 'Budget entry deleted successfully' });
    } catch (error) {
        console.error("Error deleting budget entry:", error);
        res.status(500).json({ error: 'Failed to delete budget entry.' });
    }
});

async function getImageBase64(imagePath) {
    try {
        const fullPath = path.resolve(__dirname, '../assets/img', imagePath); // Adjust path relative to api/index.js
        const buffer = await fs.readFile(fullPath);
        // Basic MIME type detection: IMPORTANT for browsers to display Base64 correctly
        const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`Error reading image ${imagePath}:`, error);
        return null; // Return null if image not found/readable
    }
}

// NEW ENDPOINT: GET /api/logos
app.get('/api/logos', async (req, res) => {
    try {
        const manilaLogoBase64 = await getImageBase64('manila-logo.png'); // Left logo
        const bagongPilipinasLogoBase64 = await getImageBase64('bagong-pilipinas-logo.png'); // Right logo
        const cityBudgetLogoBase64 = await getImageBase64('city-budget-logo.png'); // Central logo (City Budget Office)

        res.json({
            manilaLogo: manilaLogoBase64,
            bagongPilipinasLogo: bagongPilipinasLogoBase64,
            cityBudgetLogo: cityBudgetLogoBase64, // Correctly named and served
        });
    } catch (error) {
        console.error("Error fetching logos for print:", error);
        res.status(500).json({ error: "Failed to fetch logos." });
    }
});




// =================== ACCOUNT ACTIVATION FLOW =================== //

// 1. REQUEST OTP FOR ACCOUNT ACTIVATION (UPDATED for _id suffix matching and pending_password_hash $or condition)
app.post('/api/residents/activate-account/request-otp', async (req, res) => {
    const { account_number, email, contact_number, password } = req.body; // account_number is now the 4-digit suffix

    if (!account_number || !password) {
        return res.status(400).json({ error: 'Validation failed', message: 'Account Number and Password are required.' });
    }
    if (String(account_number).trim().length !== 4) { // Validate 4-digit input
        return res.status(400).json({ error: 'Validation failed', message: 'Account Number must be 4 characters long.' });
    }
    if (!email && !contact_number) { // Require at least one contact method
        return res.status(400).json({ error: 'Validation failed', message: 'Either Email or Contact Number is required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Validation failed', message: 'Password must be at least 6 characters long.' });
    }

    try {
        const dab = await db();
        const residentsCollection = dab.collection('residents');
        const hashedPassword = md5(password); // Hash the provided password

        // --- Aggregation Pipeline to find resident by _id suffix ---
        const residentResult = await residentsCollection.aggregate([
            {
                $match: {
                    status: 'Pending', // Only allow activation for pending accounts
                    password_hash: null, // Ensure no password has been set yet
                    // FIX: Use $or for pending_password_hash: null OR $exists: false
                    $or: [
                        { pending_password_hash: null },
                        { pending_password_hash: { $exists: false } }
                    ]
                }
            },
            {
                $addFields: {
                    // Derive the 4-character account number from the _id string
                    derivedAccountNumber: { $substrCP: [{ $toString: "$_id" }, { $subtract: [{ $strLenCP: { $toString: "$_id" } }, 4] }, 4] }
                }
            },
            {
                $match: {
                    // Ensure the input account_number is compared in lowercase
                    derivedAccountNumber: String(account_number).trim().toLowerCase()
                }
            },
            { $limit: 1 } // We only expect one match
        ]).toArray();

        const resident = residentResult.length > 0 ? residentResult[0] : null;

        if (!resident) {
            return res.status(404).json({
                error: 'Account not found or already active.',
                message: 'No pending account found matching the provided details. It might be already active or require admin approval.'
            });
        }

        // --- Step 1: Update Resident's Contact Info and Store Pending Password ---
        const updateFields = {
            email: email ? String(email).trim().toLowerCase() : null,
            contact_number: contact_number ? String(contact_number).trim() : null,
            pending_password_hash: hashedPassword, // Store new password temporarily
            updated_at: new Date()
        };

        // Generate and store activation OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        updateFields.activation_otp = otp;
        updateFields.activation_otp_expiry = otpExpiry;

        await residentsCollection.updateOne(
            { _id: resident._id }, // Update using the actual _id
            { $set: updateFields }
        );

        // --- Step 2: Send OTP to the (newly updated) contact method ---
        let sendSuccess = false;
        let recipientIdentifier = '';

        // Prioritize email if provided
        if (email) {
            recipientIdentifier = email;
            const mailOptions = {
                from: `"B-BUD System" <${SMTP_USER}>`,
                to: recipientIdentifier,
                subject: 'Your B-BUD Account Activation Code',
                html: `
                    <p>Hello ${resident.first_name || 'User'},</p>
                    <p>To activate your account, please use the following One-Time Password (OTP):</p>
                    <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
                    <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <br><p>Thanks,<br>The B-BUD Team</p>`,
            };
            try {
                await transporter.sendMail(mailOptions);
                console.log(`Activation OTP email sent to ${recipientIdentifier} (OTP: ${otp})`);
                sendSuccess = true;
            } catch (emailError) {
                console.error("Error sending activation OTP email:", emailError);
            }
        }

        // If email wasn't sent or failed, try SMS if contact number is provided
        if (!sendSuccess && contact_number) {
            recipientIdentifier = contact_number;
            try {
                await sendMessage(recipientIdentifier, `Your B-BUD account activation OTP is ${otp}. It is valid for ${OTP_EXPIRY_MINUTES} minutes.`);
                console.log(`Activation OTP SMS sent to ${recipientIdentifier} (OTP: ${otp})`);
                sendSuccess = true;
            } catch (smsError) {
                console.error("Error sending activation OTP SMS:", smsError);
            }
        }

        if (sendSuccess) {
            res.status(200).json({
                message: `An OTP has been sent to ${recipientIdentifier} to activate your account.`,
                otpRequired: true,
            });
        } else {
            // If neither email nor SMS could be sent, clear the temporary data
            await residentsCollection.updateOne(
                { _id: resident._id },
                { $unset: { activation_otp: "", activation_otp_expiry: "", pending_password_hash: "" } }
            );
            return res.status(500).json({
                error: 'DeliveryFailed',
                message: 'Could not send the activation OTP to your provided contact details. Please ensure they are valid.'
            });
        }

    } catch (error) {
        console.error("Error processing account activation request:", error);
        res.status(500).json({ error: 'ServerError', message: 'An unexpected server error occurred.' });
    }
});

// 2. VERIFY OTP AND FINALIZE ACCOUNT ACTIVATION (UPDATED for _id suffix matching and pending_password_hash)
app.post('/api/residents/activate-account/verify-otp', async (req, res) => {
    const { account_number, otp } = req.body; // account_number is the 4-digit suffix

    if (!account_number || !otp) {
        return res.status(400).json({ error: 'Validation failed', message: 'Account Number and OTP are required.' });
    }
    if (String(account_number).trim().length !== 4) { // Validate 4-digit input
        return res.status(400).json({ error: 'Validation failed', message: 'Account Number must be 4 characters long.' });
    }
    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: 'Validation failed', message: 'OTP must be a 6-digit number.' });
    }

    try {
        const dab = await db();
        const residentsCollection = dab.collection('residents');

        // --- Aggregation Pipeline to find resident by _id suffix and OTP details ---
        const residentResult = await residentsCollection.aggregate([
            {
                $match: {
                    activation_otp: otp,
                    activation_otp_expiry: { $gt: new Date() }, // OTP must not be expired
                    status: 'Pending', // Should still be pending
                    pending_password_hash: { $exists: true, $ne: null } // Ensure a pending password exists
                }
            },
            {
                $addFields: {
                    // Derive the 4-character account number from the _id string
                    derivedAccountNumber: { $substrCP: [{ $toString: "$_id" }, { $subtract: [{ $strLenCP: { $toString: "$_id" } }, 4] }, 4] }
                }
            },
            {
                $match: {
                    // Ensure the input account_number is compared in lowercase
                    derivedAccountNumber: String(account_number).trim().toLowerCase()
                }
            },
            { $limit: 1 } // We only expect one match
        ]).toArray();

        const resident = residentResult.length > 0 ? residentResult[0] : null;

        if (!resident) {
            return res.status(400).json({ error: 'InvalidOTP', message: 'Invalid or expired OTP, or account details do not match. Please request a new OTP.' });
        }

        // OTP is valid, proceed to activate the account
        // Move pending_password_hash to password_hash and set status to Approved
        await residentsCollection.updateOne(
            { _id: resident._id }, // Update using the actual _id
            {
                $set: {
                    password_hash: resident.pending_password_hash, // Finalize the new password
                    status: 'Approved', // Mark account as approved/active
                    date_approved: new Date(), // Set approval date
                    updated_at: new Date()
                },
                $unset: { // Clear temporary activation fields
                    activation_otp: "",
                    activation_otp_expiry: "",
                    pending_password_hash: "" // Clear the temporary password hash
                }
            }
        );

        // --- ADD AUDIT LOG HERE ---
        await createAuditLog({
            userId: resident._id,
            userName: `${resident.first_name} ${resident.last_name}`,
            description: `Resident account for '${resident.first_name} ${resident.last_name}' (Account No suffix: ${account_number}) activated successfully via OTP.`,
            action: "ACTIVATE_ACCOUNT",
            entityType: "Resident",
            entityId: resident._id.toString(),
        }, req);
        // --- END AUDIT LOG ---

        res.status(200).json({ message: 'Account activated successfully! You can now log in with your new password.' });

    } catch (error) {
        console.error("Error during account activation OTP verification:", error);
        res.status(500).json({ error: 'ServerError', message: 'An unexpected server error occurred during activation.' });
    }
});

// =================== END ACCOUNT ACTIVATION FLOW =================== //

/**
 * Sends an SMS message using the Semaphore API.
 *
 * @param {string|string[]} number - A single recipient's number or an array of numbers.
 * @param {string} message - The content of the SMS message.
 * @returns {Promise<any>} A promise that resolves with the API response.
 * @throws {Error} Throws an error if the API request fails.
 */
// function sendMessage(number, message) {
//   return new Promise(async (resolve, reject) => {
//     const endpoint = 'https://api.semaphore.co/api/v4/messages';

//     // Validate required parameters
//     if (!number || !message) {
//       return reject(new Error('Missing required parameters: apiKey, number, and message are required.'));
//     }

//     // Note from the API documentation: Do not start your message with "TEST".
//     if (message.trim().toUpperCase().startsWith('TEST')) {
//       return reject(new Error('Messages starting with "TEST" are silently ignored by the API and will not be sent.'));
//     }

//     // Construct the form-urlencoded body
//     const params = new URLSearchParams();
//     params.append('apikey', SEMAPHORE_API_KEY);
//     // If 'number' is an array, join it into a comma-separated string as per the API docs
//     params.append('number', Array.isArray(number) ? number.join(',') : number);
//     params.append('message', message);

//     params.append('sendername', 'B-Bud Systems');

//     try {
//       const response = await fetch(endpoint, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded',
//         },
//         body: params,
//       });

//       // The API is expected to return JSON, even for errors.
//       const responseData = await response.json();

//       // Check if the HTTP response is not OK (status code not in the 200-299 range)
//       if (!response.ok) {
//         // Create an error object with details from the API response
//         const error = new Error(`API request failed with status ${response.status}: ${response.statusText}`);
//         error.response = responseData; // Attach the API's error details
//         console.error(error);
//         return reject(error);
//       }

//       console.info('SMS message sent successfully:', responseData);

//       return resolve(responseData);

//     } catch (error) {
//       // This will catch network errors (e.g., no internet connection) or errors thrown above
//       console.error('An error occurred while sending the message:', error);
//       // Re-throw the error so the calling function can handle it
//       return reject(error);
//     }
//   });
// }

// temporary
function sendMessage(number, message) {
  return new Promise(async (resolve, reject) => {
      const API_KEY = 'b8c3fa61-d93f-4a9f-a077-93057bcba635'
      const DEVICE_ID = '68a60f711b59e7ea6c3663d7'
      const endpoint = `https://api.textbee.dev/api/v1/gateway/devices/${DEVICE_ID}/send-sms`;

    // Validate required parameters
    if (!number || !message) {
      return reject(new Error('Missing required parameters: apiKey, number, and message are required.'));
    }

    // Note from the API documentation: Do not start your message with "TEST".
    if (message.trim().toUpperCase().startsWith('TEST')) {
      return reject(new Error('Messages starting with "TEST" are silently ignored by the API and will not be sent.'));
    }

    // Construct the form-urlencoded body
    const params = new URLSearchParams();
    params.append('apikey', SEMAPHORE_API_KEY);
    // If 'number' is an array, join it into a comma-separated string as per the API docs
    params.append('number', Array.isArray(number) ? number.join(',') : number);
    params.append('message', message);

    params.append('sendername', 'B-Bud Systems');

    console.log('Message from SMS:', message);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
            recipients: Array.isArray(number) ? number : [number],
            message
        }),
      });

      // The API is expected to return JSON, even for errors.
      const responseData = await response.json();

      // Check if the HTTP response is not OK (status code not in the 200-299 range)
      if (!response.ok) {
        // Create an error object with details from the API response
        const error = new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        error.response = responseData; // Attach the API's error details
        console.error(error);
        return reject(error);
      }

      console.info('SMS message sent successfully:', responseData);

      return resolve(responseData);

    } catch (error) {
      // This will catch network errors (e.g., no internet connection) or errors thrown above
      console.error('An error occurred while sending the message:', error);
      // Re-throw the error so the calling function can handle it
      return reject(error);
    }
  });
}


// Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// Helper function
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString("hex"); // 32 bytes = 64 hex chars
}

// For Google Gemini Helper

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

// --- Code to be updated in your api/index.js file ---

// 1. Update the 'validateProofOfResidency' function:

// VALIDATE Proof of Residency via AI and return the result { isValid: bool, message: string }
async function validateProofOfResidency(userJSON, proofsInBase64, authorizationLetterInBase64 = null) {

  try {
    const responseSchema = {
        type: Type.OBJECT, // Assuming 'Type' is defined/imported from a schema library like @google/generative-ai
        properties: {
            isValid: {
            type: Type.BOOLEAN,
            description: "True if all documents are valid proofs of residency and the details match the provided JSON data, or are sufficiently explained by an authorization letter if present, otherwise false.",
            },
            message: {
            type: Type.STRING,
            description: "A message explaining whether the documents are valid or not, and the reason for the validation result, including details about any authorization letter if applicable.",
            },
        },
        required: ["isValid", "message"],
    };

    const contents = [];
    
    // 1. Add the main prompt as a text part
    contents.push({
      text: `
      Your task is to validate one or more documents, which may include proof of residency documents and/or a birth certificate, and optionally an authorization letter, against provided JSON user data.

      **Instructions:**
      1.  **Proof of Residency Validation:** For each provided 'proof of residency' image:
          *   Verify if it's a legitimate document commonly accepted as proof of residency in the Philippines (e.g., utility bills like Meralco, Maynilad, water bills, internet bills, barangay certificates from other areas, bank statements, valid government-issued IDs with address).
          *   Extract the full name and address (house number, street, subdivision/zone/sitio/purok, city/municipality) from the document.
          *   Compare these extracted details with the 'first_name', 'middle_name', 'last_name', 'suffix', 'address_house_number', 'address_street', 'address_subdivision_zone', 'address_city_municipality' from the provided JSON data.
          *   Note any discrepancies in names or addresses.

      2.  **Birth Certificate Validation (if provided):** If a document is identified as a birth certificate among the provided proofs:
          *   Confirm it appears to be a genuine birth certificate.
          *   Extract the date of birth from the document.
          *   Compare this extracted date of birth with the 'date_of_birth' field from the provided JSON data. The expected format for 'date_of_birth' in userJSON is YYYY-MM-DD.
          *   Note any discrepancies in the date of birth.

      3.  **Authorization Letter (Optional):** If an 'authorization letter' image is provided:
          *   Confirm it appears to be a genuine letter.
          *   Extract its content, specifically looking for statements that authorize the applicant (whose details are in the JSON) to use the provided proof of residency documents, especially if the names on the proofs do not match the applicant's name. It should clearly state that the bill is under a different name (e.g., a family member or landlord) but that the applicant resides at the address.

      4.  **Final Verdict:**
          *   Set "isValid" to \`true\` if:
              *   All proof of residency documents are legitimate and their details (name, address) match the JSON data **OR**
              *   There are name discrepancies on the proof documents, but the 'authorization letter' (if provided) is legitimate and clearly explains/authoFrizes the use of the documents by the applicant at the specified address.
              *   **AND**, if a birth certificate was provided, its extracted date of birth matches the 'date_of_birth' in the user JSON data.
          *   Set "isValid" to \`false\` if:
              *   Any proof of residency document is deemed illegitimate or forged.
              *   Details on the proof documents do not match the JSON, AND no valid authorization letter is provided to explain the discrepancy.
              *   The authorization letter (if provided) is illegitimate or does not clearly authorize the use of the proof documents.
              *   **OR**, if a birth certificate was provided, and its extracted date of birth does not match the 'date_of_birth' in the user JSON data.

      **Return a JSON object with "isValid" (boolean) and "message" (string).**
      *   Keep the message concise but comprehensive, explaining the outcome.
      *   For example: 'All documents validated successfully.', 'Name on [Document Type] does not match. Authorization letter is required.', 'Proof of residency [Document Type] is invalid.', 'Name on [Document Type] does not match, but authorization letter clarifies residency at the address.', **'Date of birth on birth certificate does not match user data.'**, 'Birth certificate provided but date of birth does not match.' etc.
      `
    });
    
    // 2. Add the user JSON as a text part
    contents.push({ text: JSON.stringify(userJSON) });

    // 3. Add multiple proof images (each with its own preceding text label part)
    for (const [index, proofBase64] of proofsInBase64.entries()) {
        // Text label part for the proof document
        contents.push({ text: `Proof of Residency Document or Other Proof ${index + 1}:` });
        contents.push({
            inlineData: {
                mimeType: getMimeTypeFromBase64(proofBase64),
                data: stripDataUriPrefix(proofBase64),
            },
        });
    }

    // 4. Add authorization letter if present (with its own preceding text label part)
    if (authorizationLetterInBase64) {
        // Text label part for the authorization letter
        contents.push({ text: 'Authorization Letter:' });
        contents.push({
            inlineData: {
                mimeType: getMimeTypeFromBase64(authorizationLetterInBase64),
                data: stripDataUriPrefix(authorizationLetterInBase64),
            },
        });
    }

    console.log("Generating content from the model for Proof of Residency validation using 'gemini-2.5-flash'...");
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    // Logging the full result to debug the 'undefined' issue
    console.log("Full Gemini AI result object:", JSON.stringify(result, null, 2));

    let rawResponseTextFromAI;
    let finalParsedJSON;

    // FIX: Access candidates directly from result, not result.response
    if (result && result.candidates && result.candidates.length > 0) {
        const firstCandidate = result.candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            rawResponseTextFromAI = firstCandidate.content.parts[0].text;
        }
    }

    if (!rawResponseTextFromAI) {
        console.error("Gemini AI did not return expected text content within the response structure.");
        return { isValid: false, message: 'AI validation service received incomplete or malformed response from Gemini. Please check API key, model availability, and network.' };
    }
    
    console.log("Raw response text from Gemini:", rawResponseTextFromAI);

    // EXTRACT THE JSON STRING from the markdown code block
    const jsonMatch = rawResponseTextFromAI.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        finalParsedJSON = JSON.parse(jsonMatch[1]);
    } else {
        // Fallback: if not wrapped in ```json```, assume it's pure JSON text
        console.warn("Gemini AI response was not wrapped in ```json```. Attempting to parse as-is.");
        finalParsedJSON = JSON.parse(rawResponseTextFromAI);
    }
    
    console.log("Parsed JSON from Gemini for Proof of Residency validation:", finalParsedJSON);

    return finalParsedJSON;

  } catch (error) {
    console.error("An error occurred during proof of residency validation by AI:", error);
    // Return a generic AI validation failure if the AI call itself fails,
    // or if JSON parsing fails after extracting the string.
    return { isValid: false, message: 'AI validation service encountered an error. Please try again. Details: ' + error.message };
  }
}

// 2. Update the 'validateProofOfPWD' function:

async function validateProofOfPWD(userJSON, fileInBase64) {

  try {
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            isValid: {
            type: Type.BOOLEAN,
            description: "True if the document is a valid Philippine PWD ID and the details match the provided JSON data, otherwise false.",
            },
            message: {
            type: Type.STRING,
            description: "A message explaining whether the document is valid or not, and the reason for the validation result.",
            },
        },
        required: ["isValid", "message"],
    };

    // 3. Construct the prompt for the Gemini model
    const prompt = `
    Your task is to validate if the submitted image is a legitimate Philippine PWD (Person with Disability) ID and if the data on it matches the provided JSON data.

    1. First, verify that the image provided is a genuine Philippine PWD ID. Check for specific features of a real PWD ID, such as the official logos, layout, and required fields.
    2. Second, carefully compare the full name, address, date of birth, PWD number, and other relevant details from the ID against the provided JSON object.

    Return a JSON object with two keys: "isValid" (boolean) and "message" (a short but complete explanation of the result).
    - If everything is correct, set "isValid" to true and the message to 'PWD ID successfully validated.'
    - If the details do not match or if the document is not a valid PWD ID, set "isValid" to false and briefly explain the reason (e.g., 'Full name on ID does not match the provided data.' or 'The provided image is not a valid Philippine PWD ID.').
    `;
    
    // 5. Generate the content
    console.log("Generating content from the model for PWD validation...");
    const result = await ai.models.generateContent({ // FIX: Directly use ai.models.generateContent
      model: 'gemini-2.5-flash',
      contents: [
        {text: prompt},
        {text: JSON.stringify(userJSON)},
        {
          inlineData: {
            mimeType: getMimeTypeFromBase64(fileInBase64),
            data: stripDataUriPrefix(fileInBase64),
          }
        }
      ],
      generationConfig: { // FIX: Use generationConfig for responseSchema and responseMimeType
        responseSchema: responseSchema,
        responseMimeType: "application/json"
      }
    });

    console.log("Received raw response from Gemini for PWD validation:", JSON.stringify(result, null, 2));

    let rawResponseTextFromAI;
    let finalParsedJSON;

    // FIX: Access candidates directly from result, not result.response
    if (result && result.candidates && result.candidates.length > 0) {
        const firstCandidate = result.candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            rawResponseTextFromAI = firstCandidate.content.parts[0].text;
        }
    }

    if (!rawResponseTextFromAI) {
        console.error("Gemini AI for PWD validation did not return expected text content within the response structure.");
        return { isValid: false, message: 'AI validation service received incomplete or malformed response from Gemini for PWD ID. Please check API key, model availability, and network.' };
    }
    
    console.log("Raw response text from Gemini for PWD validation:", rawResponseTextFromAI);

    // EXTRACT THE JSON STRING from the markdown code block
    const jsonMatch = rawResponseTextFromAI.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        finalParsedJSON = JSON.parse(jsonMatch[1]);
    } else {
        // Fallback: if not wrapped in ```json```, assume it's pure JSON text
        console.warn("Gemini AI PWD response was not wrapped in ```json```. Attempting to parse as-is.");
        finalParsedJSON = JSON.parse(rawResponseTextFromAI);
    }
    
    console.log("Parsed JSON from Gemini for PWD validation:", finalParsedJSON);

    return finalParsedJSON;

  } catch (error) {
    console.error("An error occurred during PWD ID validation by AI:", error);
    // Return a generic AI validation failure if the AI call itself fails,
    // or if JSON parsing fails after extracting the string.
    return { isValid: false, message: 'AI validation service encountered an error during PWD ID validation. Please try again. Details: ' + error.message };
  }
}

// 3. Add a placeholder for 'validateProofOfVoter' function:
// (This function is called in your /api/residents and /api/residents/:householdHeadId/members endpoints but not defined)
// You will need to implement its actual logic similar to validateProofOfPWD if it also uses AI.
async function validateProofOfVoter(userJSON, fileInBase64) {
    // Placeholder for voter validation logic
    console.warn("validateProofOfVoter is a placeholder and needs to be implemented.");
    // In a real scenario, you would integrate AI validation here similar to PWD.
    // For now, it will always return valid to prevent blocking registration.
    
    // Example: You might want to make an AI call here to validate voter ID.
    /*
    try {
        const responseSchema = { ... }; // Define schema
        const prompt = `...`; // Define prompt
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: prompt },
                { text: JSON.stringify(userJSON) },
                { inlineData: { mimeType: getMimeTypeFromBase64(fileInBase64), data: stripDataUriPrefix(fileInBase64) } }
            ],
            generationConfig: { responseSchema, responseMimeType: "application/json" }
        });
        // Add robust JSON parsing logic similar to validateProofOfResidency
        // ...
        return parsedResult;
    } catch (error) {
        console.error("Error during voter ID validation by AI:", error);
        return { isValid: false, message: 'AI validation service encountered an error during voter ID validation. Please try again. Details: ' + error.message };
    }
    */
    return { isValid: true, message: 'Voter validation is a placeholder and passed automatically.' };
}

function getMimeTypeFromBase64(fileInBase64) {
  const mime = require('mime-types');
  const dataUriRegex = /^data:(.*?);base64,(.*)$/;
  const match = fileInBase64.match(dataUriRegex);
  const mimeType = match && match[1];
  console.log("MIME TYPE", mimeType);
  return mimeType;
}

function stripDataUriPrefix(dataUri) {
  return dataUri.replace(/^data:[^;]+;base64,/, "");
}