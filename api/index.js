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
const LOCKOUT_DURATION_MINUTES = 15;

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
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
    }

    // Check for account lockout
    if (resident.account_locked_until && new Date(resident.account_locked_until) > new Date()) {
      const timeLeft = Math.ceil((new Date(resident.account_locked_until).getTime() - new Date().getTime()) / (60 * 1000));
      return res.status(403).json({
        error: 'AccountLocked',
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
          error: 'AccountLocked',
          message: `Account locked due to multiple failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
          lockedUntil: lockUntilDate
        });
      } else {
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
        return res.status(401).json({
            error: 'Unauthorized',
            message: `Invalid email or password. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining before lockout.` : 'Account will be locked on next failed attempt.'}`
        });
      }
    }

    // --- Age Restriction for Login (16+ years old) ---
    const residentAge = calculateAge(resident.date_of_birth);
    if (residentAge < 16) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Users must be 16 years old or older to log in.' });
    }

    // --- Check Status (only 'Approved' can login) ---
    if (resident.status !== 'Approved') {
        let message = 'Login denied. Your account is not active.';
        if (resident.status === 'Pending') message = 'Login denied. Your account is pending approval.';
        if (resident.status === 'Declined') message = 'Login denied. Your account has been declined.';
        if (resident.status === 'Deactivated') message = 'Login denied. Your account has been deactivated.';
        return res.status(403).json({ error: 'Forbidden', message });
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
      from: `"BBud System" <${SMTP_USER}>`,
      to: resident.email,
      subject: 'Your BBud Login Verification Code',
      html: `
        <p>Hello ${resident.first_name || 'User'},</p>
        <p>To complete your login, please use the following One-Time Password (OTP):</p>
        <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
        <p>This OTP is valid for ${OTP_EXPIRY_MINUTES_LOGIN} minutes.</p>
        <p>If you did not attempt to log in, please secure your account or contact support immediately.</p>
        <br><p>Thanks,<br>The BBud Team</p>`,
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
        from: `"BBud System" <${SMTP_USER}>`,
        to: normalizedEmail,
        subject: 'Your Password Reset OTP Code',
        html: `
          <p>Hello ${resident.first_name || 'User'},</p>
          <p>You requested a password reset. Your One-Time Password (OTP) is:</p>
          <h2 style="text-align:center; color:#0F00D7; letter-spacing: 2px;">${otp}</h2>
          <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <br>
          <p>Thanks,<br>The BBud Team</p>
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

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });

  } catch (error) {
    console.error("Error verifying OTP and resetting password:", error);
    res.status(500).json({ error: 'An error occurred while resetting your password.' });
  }
});




















// ========================= RESIDENTS =================== //
// ADD NEW RESIDENT (POST) - UPDATED with Household Member Creation (TRANSACTIONAL)
app.post('/api/residents', async (req, res) => {
  // const client = await db(true); // Assuming db(true) can give you the raw client for sessions
  const dab = await db();
  const residentsCollection = dab.collection('residents');
  const session = CLIENT_DB.startSession(); // Start a session

  try {
    // Start the transaction
    await session.withTransaction(async () => {
      const {
        // ... (all your existing head's fields from req.body)
        first_name, middle_name, last_name, sex, date_of_birth,
        civil_status, occupation_status, place_of_birth, citizenship, is_pwd,
        address_house_number, address_street, address_subdivision_zone,
        address_city_municipality, years_lived_current_address,
        contact_number, email, password,
        is_registered_voter, precinct_number, voter_registration_proof_base64,
        residency_proof_base64,
        is_household_head,
        // household_member_ids, // Not used for new head with new members
        household_members_to_create, // Array of member objects from mobile
      } = req.body;

      // --- VALIDATION FOR HEAD ---
      if (!first_name || !last_name || !sex || !date_of_birth || !email || !password) {
        // Abort transaction and throw error
        // await session.abortTransaction();
        // It's better to throw an error that can be caught outside and set status code
        const err = new Error('Validation failed for head: First name, last name, sex, date of birth, email, and password are required.');
        err.statusCode = 400;
        throw err;
      }
      if (String(password).length < 6) {
        // await session.abortTransaction();
        const err = new Error('Validation failed for head: Password must be at least 6 characters long.');
        err.statusCode = 400;
        throw err;
      }
      const headAge = calculateAge(date_of_birth);
      // if (headAge < 16) { /* ... abort and throw ... */ }

      // Voter ID / Precinct Validation for HEAD
      let finalPrecinctNumberHead = null;
      let finalVoterProofDataBase64Head = null;
      if (Boolean(is_registered_voter)) {
        if (!precinct_number && !voter_registration_proof_base64) {
          // await session.abortTransaction();
          const err = new Error("Validation failed for head: If registered voter, provide Voter's ID Number or upload Voter's ID.");
          err.statusCode = 400;
          throw err;
        }
        finalPrecinctNumberHead = precinct_number ? String(precinct_number).trim() : null;
        finalVoterProofDataBase64Head = voter_registration_proof_base64 ? voter_registration_proof_base64 : null;
      }

      // Email uniqueness check for HEAD
      const existingHeadEmail = await residentsCollection.findOne({ email: String(email).trim().toLowerCase() }, { session });
      if (existingHeadEmail) {
        // await session.abortTransaction();
        const err = new Error('Conflict: Head email address already in use.');
        err.statusCode = 409;
        throw err;
      }
      // --- END VALIDATION FOR HEAD ---

      // --- WARNING: MD5 IS INSECURE. REPLACE WITH BCRYPT ---
      const headHashedPassword = md5(password);
      // const headHashedPassword = await bcrypt.hash(password, saltRounds); // For bcrypt

      const headResidentDocument = {
        first_name: String(first_name).trim(), middle_name: middle_name ? String(middle_name).trim() : null, last_name: String(last_name).trim(),
        sex: String(sex), age: headAge, date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        civil_status: civil_status ? String(civil_status) : null,
        occupation_status: occupation_status ? String(occupation_status) : null,
        place_of_birth: place_of_birth ? String(place_of_birth).trim() : null,
        citizenship: citizenship ? String(citizenship).trim() : null, is_pwd: Boolean(is_pwd),
        address_house_number: address_house_number ? String(address_house_number).trim() : null,
        address_street: address_street ? String(address_street).trim() : null,
        address_subdivision_zone: address_subdivision_zone ? String(address_subdivision_zone).trim() : null,
        address_city_municipality: address_city_municipality ? String(address_city_municipality).trim() : 'Manila City',
        years_lived_current_address: years_lived_current_address ? parseInt(years_lived_current_address) : null,
        contact_number: contact_number ? String(contact_number).trim() : null,
        email: String(email).trim().toLowerCase(), password_hash: headHashedPassword,
        is_registered_voter: Boolean(is_registered_voter),
        precinct_number: finalPrecinctNumberHead,
        voter_registration_proof_data: finalVoterProofDataBase64Head,
        residency_proof_data: residency_proof_base64 ? residency_proof_base64 : null,
        is_household_head: Boolean(is_household_head), // Should be true if household_members_to_create is present
        household_member_ids: [], // Will be populated if members are created
        status: 'Pending', // Default status
        created_at: new Date(), updated_at: new Date(),
      };

      const headInsertResult = await residentsCollection.insertOne(headResidentDocument, { session });
      const insertedHeadId = headInsertResult.insertedId;

      const createdMemberIds = [];

      // --- Process household_members_to_create ---
      if (Boolean(is_household_head) && household_members_to_create && Array.isArray(household_members_to_create) && household_members_to_create.length > 0) {
        for (const memberData of household_members_to_create) {
          // VALIDATE EACH MEMBER
          if (!memberData.first_name || !memberData.last_name || !memberData.sex || !memberData.date_of_birth || !memberData.email || !memberData.password) {
            // await session.abortTransaction();
            const err = new Error(`Validation failed for member ${memberData.first_name || '(unknown)'}: Missing required fields.`);
            err.statusCode = 400;
            throw err;
          }
          if (String(memberData.password).length < 6) {
            //  await session.abortTransaction();
            const err = new Error(`Validation failed for member ${memberData.first_name}: Password too short.`);
            err.statusCode = 400;
            throw err;
          }
          const memberAge = calculateAge(memberData.date_of_birth);
          // Optional: Age check for members, e.g., if (memberAge < 0) { abort and throw }

          // Email uniqueness check for MEMBER (against DB and other members in this transaction including head)
          const memberEmailNormalized = String(memberData.email).trim().toLowerCase();
          if (memberEmailNormalized === headResidentDocument.email) { // Check against head's email
            // await session.abortTransaction();
            const err = new Error(`Conflict: Member email ${memberEmailNormalized} is the same as the head's email.`);
            err.statusCode = 409;
            throw err;
          }
          const existingMemberEmailInDb = await residentsCollection.findOne({ email: memberEmailNormalized }, { session });
          if (existingMemberEmailInDb) {
            // await session.abortTransaction();
            const err = new Error(`Conflict: Member email ${memberEmailNormalized} already in use.`);
            err.statusCode = 409;
            throw err;
          }
          // Check against other members being created in this batch
          if (household_members_to_create.filter(m => String(m.email).trim().toLowerCase() === memberEmailNormalized).length > 1) {
            // await session.abortTransaction();
            const err = new Error(`Conflict: Duplicate member email ${memberEmailNormalized} within this registration request.`);
            err.statusCode = 409;
            throw err;
          }


          // --- WARNING: MD5 IS INSECURE. REPLACE WITH BCRYPT ---
          const memberHashedPassword = md5(memberData.password);
          // const memberHashedPassword = await bcrypt.hash(memberData.password, saltRounds); // For bcrypt

          const newMemberDoc = {
            first_name: String(memberData.first_name).trim(),
            middle_name: memberData.middle_name ? String(memberData.middle_name).trim() : null,
            last_name: String(memberData.last_name).trim(),
            sex: String(memberData.sex),
            age: memberAge,
            date_of_birth: memberData.date_of_birth ? new Date(memberData.date_of_birth) : null,
            email: memberEmailNormalized,
            password_hash: memberHashedPassword,
            // Inherit address from head
            address_house_number: headResidentDocument.address_house_number,
            address_street: headResidentDocument.address_street,
            address_subdivision_zone: headResidentDocument.address_subdivision_zone,
            address_city_municipality: headResidentDocument.address_city_municipality,
            // Other member-specific fields from memberData (if provided)
            civil_status: memberData.civil_status ? String(memberData.civil_status) : null,
            occupation_status: memberData.occupation_status ? String(memberData.occupation_status) : null,
            is_pwd: memberData.hasOwnProperty('is_pwd') ? Boolean(memberData.is_pwd) : false,
            contact_number: memberData.contact_number ? String(memberData.contact_number).trim() : null,
            // Members are not household heads by default here
            is_household_head: false,
            household_member_ids: [], // Members don't have their own members in this context
            status: 'Pending', // Or derive from head's status or app default
            created_at: new Date(),
            updated_at: new Date(),
            // Fields that might not apply to members or should default to null
            years_lived_current_address: null,
            place_of_birth: null, // Or collect in modal
            citizenship: null,    // Or collect in modal
            is_registered_voter: false,
            precinct_number: null,
            voter_registration_proof_data: null,
            residency_proof_data: null,
          };

          const memberInsertResult = await residentsCollection.insertOne(newMemberDoc, { session });
          createdMemberIds.push(memberInsertResult.insertedId);
        }

        // Update the head with the newly created member IDs
        if (createdMemberIds.length > 0) {
          await residentsCollection.updateOne(
            { _id: insertedHeadId },
            { $set: { household_member_ids: createdMemberIds, updated_at: new Date() } },
            { session }
          );
        }
      }
      // If not a head or no members to create, the auto-assign logic (if applicable) would run after transaction.
      // For this specific "register head WITH members" flow, the auto-assign isn't the primary path for THESE members.
      // But if a non-head registers, that logic is still relevant.

      // Store the ID to fetch outside the transaction for the response
      req.insertedHeadId = insertedHeadId;

    }); // End of session.withTransaction

    // If transaction was successful, req.insertedHeadId will be set
    const finalInsertedResident = await residentsCollection.findOne(
      { _id: req.insertedHeadId },
      { projection: { password_hash: 0, login_attempts: 0, account_locked_until: 0 } }
    );

    // Auto-assign logic for non-heads (if head was NOT created with members directly)
    if (finalInsertedResident && !finalInsertedResident.is_household_head &&
        (!req.household_members_to_create || req.household_members_to_create.length === 0) && // Only if not part of batch create
        finalInsertedResident.address_house_number && finalInsertedResident.address_street &&
        finalInsertedResident.address_subdivision_zone && finalInsertedResident.address_city_municipality) {
      // This logic runs OUTSIDE the main transaction for simplicity here,
      // or could be part of a larger transactional unit if critical.
      const potentialHead = await residentsCollection.findOne({
        is_household_head: true,
        address_house_number: finalInsertedResident.address_house_number,
        address_street: finalInsertedResident.address_street,
        address_subdivision_zone: finalInsertedResident.address_subdivision_zone,
        address_city_municipality: finalInsertedResident.address_city_municipality,
        _id: { $ne: req.insertedHeadId }
      });
      if (potentialHead) {
        await residentsCollection.updateOne(
          { _id: potentialHead._id },
          { $addToSet: { household_member_ids: req.insertedHeadId }, $set: { updated_at: new Date() } }
        );
      }
    }

    res.status(201).json({ message: 'Resident and household registered successfully', resident: finalInsertedResident });

  } catch (error) {
    console.error("Error during resident and household registration:", error);
    // If error has statusCode, it was thrown by our validation inside transaction
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message.startsWith('Validation failed') ? 'Validation Error' : 'Conflict', message: error.message });
    }
    // Handle other errors (e.g., database connection, unexpected issues)
    if (error.code === 11000) { // Duplicate key error from MongoDB, possibly for email if a check was missed
        return res.status(409).json({ error: 'Conflict', message: 'An email address submitted is already in use.' });
    }
    res.status(500).json({ error: 'Server Error', message: 'Could not complete registration.' });
  } finally {
    // End the session
    await session.endSession();
    // Close client if db(true) created a new one for this request
    // await client.close(); // Depends on your db() implementation
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
  if (search) { /* ... your existing search query ... */ }

  const projection = {
    // ... (your existing projection) ...
    first_name: 1, last_name: 1, middle_name: 1, email: 1, sex: 1,
    contact_number: 1, address_house_number: 1, address_street: 1,
    address_subdivision_zone: 1, address_city_municipality: 1,
    is_household_head: 1, created_at: 1,
    status: 1, // ADDED status
    date_of_birth: 1, // To allow age calculation on frontend if needed, or just for info
    _id: 1,
    // EXCLUDE sensitive/large fields:
    // password_hash: 0, (already excluded if not explicitly projected)
    // voter_registration_proof_data: 0,
    // residency_proof_data: 0,
    // login_attempts: 0,
    // account_locked_until: 0,
  };

  try {
    const residents = await residentsCollection
      .find(query)
      .project(projection)
      .skip(skip)
      .limit(itemsPerPage)
      .sort({ created_at: -1 })
      .toArray();

    const totalResidents = await residentsCollection.countDocuments(query);

    res.json({
      residents: residents,
      total: totalResidents,
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(totalResidents / itemsPerPage),
    });
  } catch (error) { /* ... */ }
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
app.delete('/api/residents/:id', async (req, res) => {
  const dab = await db();
  const residentsCollection = dab.collection('residents');
  await residentsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({message: 'Resident deleted successfully'});
})

// UPDATE RESIDENT BY ID (PUT)
app.put('/api/residents/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const dab = await db();
  const residentsCollection = dab.collection('residents');

  const updatePayload = req.body;
  const updateFields = {};

  // Fetch the current resident state for comparisons and fallbacks
  const currentResident = await residentsCollection.findOne({ _id: new ObjectId(id) });
  if (!currentResident) {
    return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
  }

  // General fields (excluding files and complex conditional logic for now)
  const simpleFields = [
    'first_name', 'middle_name', 'last_name', 'sex', 'civil_status',
    'occupation_status', 'place_of_birth', 'citizenship',
    'address_house_number', 'address_street', 'address_subdivision_zone',
    'address_city_municipality', 'contact_number'
  ];
  const booleanFields = ['is_pwd', 'is_household_head']; // is_registered_voter handled separately
  const numericFields = ['years_lived_current_address'];

  simpleFields.forEach(field => {
    if (updatePayload.hasOwnProperty(field)) {
      updateFields[field] = updatePayload[field] !== null ? String(updatePayload[field]).trim() : null;
    }
  });
  booleanFields.forEach(field => {
    if (updatePayload.hasOwnProperty(field)) {
      updateFields[field] = Boolean(updatePayload[field]);
    }
  });
  numericFields.forEach(field => {
     if (updatePayload.hasOwnProperty(field)) {
        updateFields[field] = (updatePayload[field] !== null && updatePayload[field] !== '') ? parseInt(updatePayload[field]) : null;
    }
  });

  // Date of Birth and Age
  if (updatePayload.hasOwnProperty('date_of_birth')) {
    updateFields.date_of_birth = updatePayload.date_of_birth ? new Date(updatePayload.date_of_birth) : null;
    updateFields.age = calculateAge(updateFields.date_of_birth);
  }

  // Email (with uniqueness check)
  if (updatePayload.hasOwnProperty('email')) {
    const newEmail = String(updatePayload.email).trim().toLowerCase();
    if (currentResident.email !== newEmail) {
        const existingEmailUser = await residentsCollection.findOne({ email: newEmail, _id: { $ne: new ObjectId(id) } });
        if (existingEmailUser) {
            return res.status(409).json({ error: 'Conflict', message: 'Email address already in use by another resident.' });
        }
    }
    updateFields.email = newEmail;
  }

  // --- Voter Information ---
  let finalIsRegisteredVoter = currentResident.is_registered_voter;
  if (updatePayload.hasOwnProperty('is_registered_voter')) {
    finalIsRegisteredVoter = Boolean(updatePayload.is_registered_voter);
    updateFields.is_registered_voter = finalIsRegisteredVoter;
  }

  let finalPrecinctNumber = currentResident.precinct_number;
  if (updatePayload.hasOwnProperty('precinct_number')) {
    finalPrecinctNumber = updatePayload.precinct_number ? String(updatePayload.precinct_number).trim() : null;
    updateFields.precinct_number = finalPrecinctNumber;
  }

  let finalVoterProofData = currentResident.voter_registration_proof_data;
  // Frontend [id].vue sends 'voter_registration_proof_data' key in payload if changed
  if (updatePayload.hasOwnProperty('voter_registration_proof_data')) {
    finalVoterProofData = updatePayload.voter_registration_proof_data; // This will be new Base64 or null
    updateFields.voter_registration_proof_data = finalVoterProofData;
  }

  if (finalIsRegisteredVoter) {
    if (!finalPrecinctNumber && !finalVoterProofData) {
      return res.status(400).json({ error: 'Validation failed', message: "If registered voter, ensure either Voter's ID Number or Voter's ID upload is present." });
    }
  } else {
    // If explicitly set to not a voter, or becomes not a voter
    updateFields.precinct_number = null;
    updateFields.voter_registration_proof_data = null;
  }

  // --- Residency Proof ---
  // Frontend [id].vue sends 'residency_proof_data' key in payload if changed
  if (updatePayload.hasOwnProperty('residency_proof_data')) {
    updateFields.residency_proof_data = updatePayload.residency_proof_data; // New Base64 or null
  }

  // --- Household Info ---
  if (updatePayload.hasOwnProperty('is_household_head')) {
    // updateFields.is_household_head is already set by booleanFields loop
    if (updateFields.is_household_head === false) {
      updateFields.household_member_ids = []; // Clear members if no longer head
    } else if (updatePayload.hasOwnProperty('household_member_ids')) {
      // If becoming head AND new member list is provided
      updateFields.household_member_ids = Array.isArray(updatePayload.household_member_ids)
        ? updatePayload.household_member_ids.filter(memId => ObjectId.isValid(memId)).map(memId => new ObjectId(memId))
        : [];
    }
    // If is_household_head is true but household_member_ids is NOT in payload, existing members are kept (unless explicitly cleared by sending empty array)
  } else if (updatePayload.hasOwnProperty('household_member_ids')) {
    // is_household_head not in payload, so use current status
    if (currentResident.is_household_head) {
        updateFields.household_member_ids = Array.isArray(updatePayload.household_member_ids)
            ? updatePayload.household_member_ids.filter(memId => ObjectId.isValid(memId)).map(memId => new ObjectId(memId))
            : [];
    } else {
        // Not a head, and not becoming one, so members should be empty if sent
         updateFields.household_member_ids = [];
    }
  }


  // --- Status Update ---
  if (updatePayload.hasOwnProperty('status')) {
    const allowedStatusValues = ['Approved', 'Declined', 'Deactivated', 'Pending'];
    if (!allowedStatusValues.includes(updatePayload.status)) {
      return res.status(400).json({ error: 'Validation failed', message: `Invalid status value. Allowed: ${allowedStatusValues.join(', ')}` });
    }
    updateFields.status = updatePayload.status;
  }

  // --- Password Change ---
  if (updatePayload.newPassword) {
    if (typeof updatePayload.newPassword !== 'string' || updatePayload.newPassword.length < 6) {
        return res.status(400).json({ error: 'Validation failed', message: 'New password must be at least 6 characters long.' });
    }
    // --- WARNING: MD5 IS INSECURE. REPLACE WITH BCRYPT ---
    updateFields.password_hash = md5(updatePayload.newPassword);
  }

  if (Object.keys(updateFields).length === 0) {
    // No actual data fields were sent for update, just return current
    return res.status(200).json({ message: 'No changes detected.', resident: currentResident });
  }

  updateFields.updated_at = new Date();

  try {
    const result = await residentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // matchedCount should be 1 if ID is valid, already checked by currentResident fetch
    // if (result.matchedCount === 0) {
    //   return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
    // }

    if (result.modifiedCount === 0 && result.upsertedCount === 0 && Object.keys(updateFields).length > 1) { // length > 1 because updated_at is always there
        // This can happen if all submitted values are the same as existing ones
        // console.log("No effective modification, values might be the same.");
    }

    const updatedResident = await residentsCollection.findOne({ _id: new ObjectId(id) }, { projection: { password_hash: 0, login_attempts: 0, account_locked_until: 0 }});
    res.json({ message: 'Resident updated successfully', resident: updatedResident });

  } catch (error) {
    console.error('Error updating resident:', error);
    // Code 11000 is for duplicate key error (e.g. email)
    if (error.code === 11000) {
        return res.status(409).json({ error: 'Conflict', message: 'Update violates a unique constraint (e.g., email already exists).' });
    }
    res.status(500).json({ error: 'Database error', message: 'Could not update resident.' });
  }
});

// NEW Endpoint: PATCH /api/residents/:id/status (Quick Status Update)
app.patch('/api/residents/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

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

  const dab = await db();
  const residentsCollection = dab.collection('residents');

  try {
    const result = await residentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: status, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Resident not found.' });
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




// =================== NOTIFICATION HELPER =========================== //

/**
 * Creates and saves a new notification.
 * @param {Db} dbInstance - The MongoDB Db instance.
 * @param {object} notificationData - Data for the new notification.
 * @param {string} notificationData.name - Title of the notification.
 * @param {string} notificationData.content - Body of the notification.
 * @param {string} notificationData.by - Creator (Admin/System).
 * @param {string} notificationData.type - Type: 'Announcement', 'Alert', 'Notification'.
 * @param {string} [notificationData.target_audience='SpecificResidents'] - 'All', 'SpecificResidents'.
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
    date = new Date(), // Default to now if not provided
  } = notificationData;

  // Basic validation for core fields
  if (!name || !content || !by || !type) {
    console.error("Notification creation failed in helper: Missing required fields (name, content, by, type). Data:", notificationData);
    return null;
  }
  if (!['Announcement', 'Alert', 'Notification'].includes(type)) {
    console.error("Notification creation failed in helper: Invalid type. Data:", notificationData);
    return null;
  }

  let finalRecipientObjects = [];

  if (target_audience === 'All') {
    try {
      // Fetch all 'Approved' resident IDs. Adjust query if different criteria are needed for "All".
      const allTargetResidents = await residentsCollection.find({ status: 'Approved' }, { projection: { _id: 1 } }).toArray();
      finalRecipientObjects = allTargetResidents.map(r => ({
        resident_id: r._id,
        status: 'pending', // Initial delivery/read status
        read_at: null,
      }));
    } catch (e) {
      console.error("Error fetching all residents for 'All' audience notification:", e);
      return null; // Stop if we can't get recipients for 'All'
    }
  } else if (target_audience === 'SpecificResidents' && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
    finalRecipientObjects = recipient_ids
      .filter(id => ObjectId.isValid(id)) // Ensure valid IDs
      .map(idStr => ({
        resident_id: new ObjectId(idStr),
        status: 'pending',
        read_at: null,
      }));
  } else if (Array.isArray(recipient_ids) && recipient_ids.length > 0) { // Fallback if target_audience not 'All' but IDs are provided
     finalRecipientObjects = recipient_ids
      .filter(id => ObjectId.isValid(id))
      .map(idStr => ({
        resident_id: new ObjectId(idStr),
        status: 'pending',
        read_at: null,
      }));
  }

  // Important: Do not create a notification if it has no one to go to (unless 'All' resulted in 0, which is an edge case for an empty system)
  if (finalRecipientObjects.length === 0 && target_audience !== 'All') {
    console.warn("Attempted to create notification with no valid specific recipients and target_audience was not 'All'. Data:", notificationData);
    return null;
  }


  const newNotificationDoc = {
    name: String(name).trim(),
    content: String(content).trim(),
    date: new Date(date), // Ensure it's a Date object
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
    // Return the full document with the generated _id
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
          { type: { $regex: searchRegex } }, // Also search by type
        ],
      });
    }

    if (typeFilter && ['Announcement', 'Alert', 'Notification'].includes(typeFilter)) {
      andConditions.push({ type: typeFilter });
    }

    if (andConditions.length > 0) {
      query = { $and: andConditions };
    }

    const notifications = await notificationsCollection
      .find(query)
      .sort({ date: -1 }) // Sort by effective date descending
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


// ADD NEW NOTIFICATION (POST) - Uses the helper
app.post('/api/notifications', async (req, res) => {
  const {
    name, content, date, by, // Existing fields
    type,                           // NEW: 'Announcement', 'Alert', 'Notification'
    target_audience = 'SpecificResidents', // NEW: 'All', 'SpecificResidents', defaults if not provided
    recipient_ids = []              // NEW: Array of resident ObjectId strings
  } = req.body;

  // Basic Validation
  if (!name || !content || !by || !type) {
    return res.status(400).json({ error: 'Validation failed', message: 'Name, content, by (creator), and type are required.' });
  }
  if (!['Announcement', 'Alert', 'Notification'].includes(type)) {
    return res.status(400).json({ error: 'Validation failed', message: 'Invalid notification type.' });
  }
  if (!['All', 'SpecificResidents'].includes(target_audience)) {
    return res.status(400).json({ error: 'Validation failed', message: "Invalid target_audience. Must be 'All' or 'SpecificResidents'." });
  }
  if (target_audience === 'SpecificResidents' && (!Array.isArray(recipient_ids) || recipient_ids.some(id => !ObjectId.isValid(id)))) {
    return res.status(400).json({ error: 'Validation failed', message: 'For specific residents, recipient_ids must be an array of valid ObjectIds.' });
  }
   if (target_audience === 'SpecificResidents' && recipient_ids.length === 0) {
    return res.status(400).json({ error: 'Validation failed', message: 'For specific residents, recipient_ids array cannot be empty.' });
  }


  try {
    const dab = await db();
    const createdNotification = await createNotification(dab, {
        name, content, by, type, target_audience, recipient_ids, date // Pass all to helper
    });

    if (!createdNotification) {
        // createNotification returns null on internal failure or if no recipients for specific targeting
        return res.status(400).json({ error: 'Notification creation failed', message: 'Could not create notification. Check targeting or server logs.' });
    }

    res.status(201).json({ message: 'Notification added successfully', notification: createdNotification });
  } catch (error) {
    // This catch is for unexpected errors not handled by createNotification itself (e.g., db connection issue)
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

// UPDATE NOTIFICATION BY ID (PUT)
app.put('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, content, date, by,
    type, target_audience, recipient_ids // Allow updating these as well
  } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const dab = await db();
  const notificationsCollection = dab.collection('notifications');
  const residentsCollection = dab.collection('residents'); // Needed if target_audience changes to 'All'

  const updateFields = {};

  // Standard field updates
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') return res.status(400).json({ error: 'Validation failed', message: 'Name cannot be empty.' });
    updateFields.name = String(name).trim();
  }
  if (content !== undefined) {
    if (typeof content !== 'string' || content.trim() === '') return res.status(400).json({ error: 'Validation failed', message: 'Content cannot be empty.' });
    updateFields.content = String(content).trim();
  }
  if (date !== undefined) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Validation failed', message: 'Invalid date format.' });
    updateFields.date = parsedDate;
  }
  if (by !== undefined) {
     if (typeof by !== 'string' || by.trim() === '') return res.status(400).json({ error: 'Validation failed', message: 'Author (by) cannot be empty.' });
    updateFields.by = String(by).trim();
  }
  if (type !== undefined) {
    if (!['Announcement', 'Alert', 'Notification'].includes(type)) return res.status(400).json({ error: 'Validation failed', message: 'Invalid notification type.' });
    updateFields.type = type;
  }

  // Handle recipients update - If target_audience or recipient_ids are in the payload, rebuild recipients array.
  // This is a simplification. A more complex update might involve adding/removing specific recipients.
  let needsRecipientRebuild = false;
  if (target_audience !== undefined) {
      if (!['All', 'SpecificResidents'].includes(target_audience)) return res.status(400).json({ error: 'Validation failed', message: 'Invalid target_audience.' });
      updateFields.target_audience = target_audience;
      needsRecipientRebuild = true;
  }
  if (recipient_ids !== undefined) { // Even if empty array, it means intent to change
      if (!Array.isArray(recipient_ids) || recipient_ids.some(rid => !ObjectId.isValid(rid))) {
          return res.status(400).json({ error: 'Validation failed', message: 'recipient_ids must be an array of valid ObjectIds.' });
      }
      // If target_audience is not changing to 'SpecificResidents' but recipient_ids are sent,
      // we might assume it's for 'SpecificResidents' or ignore if target is 'All'.
      // Forcing target_audience to 'SpecificResidents' if recipient_ids are provided and target_audience is not 'All'.
      if (updateFields.target_audience !== 'All' && recipient_ids.length > 0) {
          updateFields.target_audience = 'SpecificResidents';
      }
      needsRecipientRebuild = true;
  }

  if (needsRecipientRebuild) {
    let finalRecipientObjects = [];
    const effectiveTargetAudience = updateFields.target_audience || (await notificationsCollection.findOne({_id: new ObjectId(id)}, {projection: {target_audience:1}})).target_audience;
    const effectiveRecipientIds = recipient_ids !== undefined ? recipient_ids : [];


    if (effectiveTargetAudience === 'All') {
      const allApprovedResidents = await residentsCollection.find({ status: 'Approved' }, { projection: { _id: 1 } }).toArray();
      finalRecipientObjects = allApprovedResidents.map(r => ({ resident_id: r._id, status: 'pending', read_at: null }));
    } else if (effectiveTargetAudience === 'SpecificResidents' && effectiveRecipientIds.length > 0) {
      finalRecipientObjects = effectiveRecipientIds.map(ridStr => ({ resident_id: new ObjectId(ridStr), status: 'pending', read_at: null }));
    }
    // If specific and empty, recipients will be an empty array
    updateFields.recipients = finalRecipientObjects;
  }


  if (Object.keys(updateFields).length === 0) {
    const currentNotification = await notificationsCollection.findOne({ _id: new ObjectId(id) });
    return res.json({ message: 'No changes provided to update.', notification: currentNotification });
  }
  updateFields.updated_at = new Date();

  try {
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

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const dab = await db();
    const notificationsCollection = dab.collection('notifications');
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

// GET BORROWED ASSET TRANSACTIONS FOR A SPECIFIC RESIDENT
app.get('/api/borrowed-assets/by-resident/:residentId', async (req, res) => {
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
    const collection = dab.collection('borrowed_assets'); // Make sure this is your collection name

    const mainMatchStage = { borrower_resident_id: residentObjectId };

    let searchMatchSubStage = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      searchMatchSubStage = {
        $or: [
          { item_borrowed: { $regex: searchRegex } }, // Assuming item_borrowed is a string name
          // If item_borrowed is an ObjectId linking to an 'assets' collection, you'd lookup assets first
          // then search on "asset_details.name"
          { status: { $regex: searchRegex } },
          { borrowed_from_personnel: { $regex: searchRegex } }, // Name of personnel
          // { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: searchRegex } } } // Search by Ref #
        ],
      };
    }

    const combinedMatchStage = search ? { $and: [mainMatchStage, searchMatchSubStage] } : mainMatchStage;

    const aggregationPipeline = [
      { $match: combinedMatchStage },
      // Optional: Lookup item details if item_borrowed stores an item_id
      // {
      //   $lookup: {
      //     from: 'inventory_items', // or your items collection name
      //     localField: 'item_id', // Assuming you store item_id
      //     foreignField: '_id',
      //     as: 'item_details_array'
      //   }
      // },
      // { $addFields: { item_details: { $arrayElemAt: ['$item_details_array', 0] } } },
      // // Optional: Lookup personnel details if borrowed_from_personnel stores an ID
      // {
      //   $lookup: {
      //     from: 'residents', // or 'admins'/'officials'
      //     localField: 'borrowed_from_personnel_id',
      //     foreignField: '_id',
      //     as: 'personnel_details_array'
      //   }
      // },
      // { $addFields: { personnel_details: { $arrayElemAt: ['$personnel_details_array', 0] } } },
      {
        $project: {
          _id: 1,
          borrow_datetime: 1,
          item_borrowed: 1, // Direct name, or "$item_details.name" if looked up
          status: 1,
          borrowed_from_personnel: 1, // Direct name, or construct from "$personnel_details"
          date_returned: 1,
          return_condition: 1,
          notes: 1,
          created_at: 1,
          updated_at: 1,
          // borrower_name is known (it's the current user)
        }
      },
      { $sort: { borrow_datetime: -1, created_at: -1 } },
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const transactions = await collection.aggregate(aggregationPipeline).toArray();

    const countPipeline = [
        { $match: combinedMatchStage },
        // Add lookups here if searchMatchSubStage depends on looked-up fields for accurate count
        { $count: 'total' }
    ];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalTransactions = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      transactions,
      total: totalTransactions,
      page,
      itemsPerPage,
      totalPages: Math.ceil(totalTransactions / itemsPerPage)
    });
  } catch (error) {
    console.error(`Error fetching borrowed assets for resident ${residentId}:`, error);
    res.status(500).json({ error: "Failed to fetch borrowed asset transactions for this resident." });
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

app.patch('/api/borrowed-assets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status: newStatus } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid Borrowed Asset Transaction ID format' });
  }

  // Define your allowed statuses for borrowed assets
  const ALLOWED_BORROW_STATUSES = ['Borrowed', 'Returned', 'Overdue', 'Lost', 'Damaged']; // Added more common statuses
  if (!newStatus || !ALLOWED_BORROW_STATUSES.includes(newStatus)) {
    return res.status(400).json({
      error: 'Validation failed',
      message: `Status is required and must be one of: ${ALLOWED_BORROW_STATUSES.join(', ')}`
    });
  }

  try {
    const dab = await db();
    const borrowedAssetsCollection = dab.collection('borrowed_assets'); // Ensure collection name matches
    const residentsCollection = dab.collection('residents');

    const currentTransaction = await borrowedAssetsCollection.findOne({ _id: new ObjectId(id) });
    if (!currentTransaction) {
      return res.status(404).json({ error: 'Not found', message: 'Borrowed asset transaction not found.' });
    }

    if (currentTransaction.status === newStatus) {
      return res.json({ message: `Transaction status is already '${newStatus}'.`, statusChanged: false, updatedTransaction: currentTransaction });
    }

    const updateFields = { status: newStatus, updated_at: new Date() };

    // If status is changing to 'Returned', automatically set date_returned
    if (newStatus === 'Returned' && !currentTransaction.date_returned) {
      updateFields.date_returned = new Date();
    }
    // If changing away from 'Returned', you might want to nullify date_returned (depends on your business logic)
    // else if (currentTransaction.status === 'Returned' && newStatus !== 'Returned') {
    //   updateFields.date_returned = null;
    // }


    const result = await borrowedAssetsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      // This case might be hit if only updated_at would change but status didn't effectively change
       return res.json({ message: `Transaction status was already effectively '${newStatus}'. No substantive fields changed.`, statusChanged: false, updatedTransaction: currentTransaction });
    }

    const updatedTransaction = await borrowedAssetsCollection.findOne({ _id: new ObjectId(id) });

    // --- Send Notification to the Borrower ---
    if (updatedTransaction && updatedTransaction.borrower_resident_id) {
      const borrower = await residentsCollection.findOne({ _id: new ObjectId(updatedTransaction.borrower_resident_id) });
      if (borrower) {
        let notificationContent = `Dear ${borrower.first_name || 'Resident'}, the status of your borrowed item "${updatedTransaction.item_borrowed}" (Ref: ${updatedTransaction._id.toString().slice(-6)}) has been updated to: ${newStatus}.`;
        if (newStatus === "Overdue") {
            notificationContent += " Please return it as soon as possible.";
        } else if (newStatus === "Returned") {
            notificationContent += " Thank you for returning the item.";
        }
        // Assuming you have your createNotification function available
        await createNotification(dab, {
          name: `Borrowed Item Update: ${updatedTransaction.item_borrowed}`,
          content: notificationContent,
          by: "System Administration",
          type: (newStatus === "Overdue" || newStatus === "Lost" || newStatus === "Damaged") ? "Alert" : "Notification",
          target_audience: 'SpecificResidents',
          recipient_ids: [borrower._id.toString()],
        });
      } else {
        console.warn(`Could not find borrower (ID: ${updatedTransaction.borrower_resident_id}) for notification of borrowed asset ${updatedTransaction._id}`);
      }
    }

    res.json({
      message: `Borrowed asset status updated to '${newStatus}' successfully.`,
      statusChanged: true,
      updatedTransaction: updatedTransaction
    });

  } catch (error) {
    console.error("Error updating borrowed asset status:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not update status.' });
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

app.patch('/api/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid Complaint ID format' });
  }

  // Define your allowed statuses
  const ALLOWED_STATUSES = ['New', 'Under Investigation', 'Resolved', 'Closed', 'Dismissed'];
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Validation failed', message: `Status is required and must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  try {
    const dab = await db();
    const complaintsCollection = dab.collection('complaints');

    const result = await complaintsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: status, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Complaint not found.' });
    }

    if (result.modifiedCount === 0) {
      // This means the status was already set to the new value
      return res.json({ message: `Complaint status is already '${status}'.`, statusChanged: false });
    }

    // Optionally, send a notification to the complainant about the status change
    const updatedComplaint = await complaintsCollection.findOne({ _id: new ObjectId(id) });
    if (updatedComplaint && updatedComplaint.complainant_resident_id) {
      await createNotification(dab, {
        name: `Complaint Status Update: Ref #${updatedComplaint._id.toString().slice(-6)}`,
        content: `Dear ${updatedComplaint.complainant_display_name}, the status of your complaint regarding "${updatedComplaint.person_complained_against_name}" has been updated to: ${status}.`,
        by: "System Administration", // Or the admin who made the change
        type: "Notification",
        target_audience: 'SpecificResidents',
        recipient_ids: [updatedComplaint.complainant_resident_id.toString()],
      });
    }

    res.json({ message: `Complaint status updated to '${status}' successfully.`, statusChanged: true });

  } catch (error) {
    console.error("Error updating complaint status:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not update complaint status.' });
  }
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

// GET DOCUMENT REQUESTS FOR A SPECIFIC RESIDENT
app.get('/api/document-requests/by-resident/:residentId', async (req, res) => {
  const { residentId } = req.params;
  const search = req.query.search || ''; // Optional: allow searching within their requests
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
  const skip = (page - 1) * itemsPerPage;

  if (!ObjectId.isValid(residentId)) {
    return res.status(400).json({ error: 'Invalid Resident ID format' });
  }
  const residentObjectId = new ObjectId(residentId);

  try {
    const dab = await db();
    const collection = dab.collection('document_requests');

    // --- Main Match Stage: Filter by residentId ---
    const mainMatchStage = { requestor_resident_id: residentObjectId };

    let searchMatchSubStage = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      searchMatchSubStage = { // Search within this resident's requests
        $or: [
          { request_type: { $regex: searchRegex } },
          { purpose_of_request: { $regex: searchRegex } },
          { document_status: { $regex: searchRegex } },
          // Add _id search if you want them to search by reference number
          // { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: searchRegex } } }
        ],
      };
    }

    // Combine main match with search match
    const combinedMatchStage = search ? { $and: [mainMatchStage, searchMatchSubStage] } : mainMatchStage;

    const aggregationPipeline = [
      { $match: combinedMatchStage }, // Filter by resident ID and then by search term
      // No need to lookup requestor_details if we are already filtering by requestor_resident_id,
      // unless you still want to include their name explicitly in the output for some reason.
      // For this user-specific view, requestor_name might be less relevant or can be fetched on client.
      // However, requested_by_details (admin/official) is still useful.
      {
        $lookup: {
          from: 'residents', // Or 'admins', 'officials'
          localField: 'requested_by_resident_id',
          foreignField: '_id',
          as: 'requested_by_details_array'
        }
      },
      { $addFields: { requested_by_details: { $arrayElemAt: ['$requested_by_details_array', 0] } } },
      {
        $project: {
          _id: 1,
          request_type: 1,
          // requestor_name can be omitted or added if needed, client already knows who the requestor is
          date_of_request: 1,
          purpose_of_request: 1,
          document_status: 1,
          requested_by_name: { // Name of the admin/official who processed it
            $ifNull: [
              { $concat: [
                  "$requested_by_details.first_name", " ",
                  { $ifNull: ["$requested_by_details.middle_name", ""] },
                  { $cond: { if: { $eq: [{ $ifNull: ["$requested_by_details.middle_name", ""] }, ""] }, then: "", else: " " } },
                  "$requested_by_details.last_name"
              ]},
              "$requested_by_display_name", // Fallback to stored display name
              "N/A" // Further fallback if no details and no display name
            ]
          },
          created_at: 1,
          updated_at: 1, // Include updated_at for sorting or display
          // You can add other fields like 'remarks_for_user' if you have them
        }
      },
      { $sort: { date_of_request: -1, created_at: -1 } }, // Sort user's requests
      { $skip: skip },
      { $limit: itemsPerPage }
    ];

    const requests = await collection.aggregate(aggregationPipeline).toArray();

    // Count total documents for this resident matching the search
    const countPipeline = [
        { $match: combinedMatchStage },
        // No need for lookups just for counting if they are not part of combinedMatchStage's search criteria
        { $count: 'total' }
    ];
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalRequests = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      requests,
      total: totalRequests,
      page,
      itemsPerPage,
      totalPages: Math.ceil(totalRequests / itemsPerPage)
    });
  } catch (error) {
    console.error(`Error fetching document requests for resident ${residentId}:`, error);
    res.status(500).json({ error: "Failed to fetch document requests for this resident." });
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

// UPDATE DOCUMENT REQUEST STATUS
app.patch('/api/document-requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status: newStatus } = req.body; // Expecting { status: "NewStatusValue" }

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid Document Request ID format' });
  }

  // Define your allowed document request statuses
  const ALLOWED_DOC_STATUSES = ["Pending", "Processing", "Ready for Pickup", "Released", "Denied"];
  if (!newStatus || !ALLOWED_DOC_STATUSES.includes(newStatus)) {
    return res.status(400).json({
      error: 'Validation failed',
      message: `Status is required and must be one of: ${ALLOWED_DOC_STATUSES.join(', ')}`
    });
  }

  try {
    const dab = await db(); // Your DB instance
    const documentRequestsCollection = dab.collection('document_requests');
    const residentsCollection = dab.collection('residents'); // For fetching requestor details

    // Fetch the current request to get old status and requestor details
    const currentRequest = await documentRequestsCollection.findOne({ _id: new ObjectId(id) });

    if (!currentRequest) {
      return res.status(404).json({ error: 'Not found', message: 'Document Request not found.' });
    }

    if (currentRequest.document_status === newStatus) {
      return res.json({ message: `Document Request status is already '${newStatus}'.`, statusChanged: false, updatedRequest: currentRequest });
    }

    const result = await documentRequestsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { document_status: newStatus, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) { // Should be caught by findOne above, but good for safety
      return res.status(404).json({ error: 'Not found', message: 'Document Request not found during update.' });
    }
    if (result.modifiedCount === 0) {
        // This case should ideally be caught by the status check above
        return res.json({ message: `Document Request status was already '${newStatus}'. No change made.`, statusChanged: false, updatedRequest: currentRequest });
    }

    const updatedRequest = await documentRequestsCollection.findOne({ _id: new ObjectId(id) }); // Fetch the updated document

    // --- Send Notification to the Requestor ---
    if (updatedRequest && updatedRequest.requestor_resident_id) {
      const requestor = await residentsCollection.findOne({ _id: new ObjectId(updatedRequest.requestor_resident_id) });
      if (requestor) {
        let notificationContent = `Dear ${requestor.first_name || 'Resident'}, the status of your document request for "${updatedRequest.request_type}" (Ref: ${updatedRequest._id.toString().slice(-6)}) has been updated to: ${newStatus}.`;
        if (newStatus === "Ready for Pickup") {
            notificationContent += " You can now pick up your document at the barangay hall.";
        } else if (newStatus === "Denied") {
            notificationContent += " Please contact the barangay office for more details regarding the denial.";
        }
        // Assuming you have your createNotification function available
        await createNotification(dab, {
          name: `Document Request Update: ${updatedRequest.request_type}`,
          content: notificationContent,
          by: "System Administration", // Or the admin user who made the change if trackable
          type: "Notification", // Or "Alert" if it's urgent
          target_audience: 'SpecificResidents',
          recipient_ids: [requestor._id.toString()], // Target only the affected resident
        });
      } else {
        console.warn(`Could not find requestor (ID: ${updatedRequest.requestor_resident_id}) to send notification for document request ${updatedRequest._id}`);
      }
    }

    res.json({
      message: `Document Request status updated to '${newStatus}' successfully. Notification sent.`,
      statusChanged: true,
      updatedRequest: updatedRequest // Send back the updated document
    });

  } catch (error) {
    console.error("Error updating document request status:", error);
    res.status(500).json({ error: 'Database error', message: 'Could not update document request status.' });
  }
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

// GET /api/dashboard - REVISED
app.get('/api/dashboard', async (req, res) => {
  try {
    const dab = await db(); // Your DB instance
    const residentsCollection = dab.collection('residents');
    const documentRequestsCollection = dab.collection('document_requests');
    const complaintsCollection = dab.collection('complaints');
    const borrowedAssetsCollection = dab.collection('borrowed_assets'); // Ensure this collection name is correct

    // --- Core Metrics ---
    const totalPopulation = await residentsCollection.countDocuments({});
    const totalHouseholds = await residentsCollection.countDocuments({ is_household_head: true });
    const totalRegisteredVoters = await residentsCollection.countDocuments({ is_registered_voter: true });

    // --- New Demographic Counts ---
    const totalSeniorCitizens = await residentsCollection.countDocuments({
      date_of_birth: { $lte: new Date(new Date().setFullYear(new Date().getFullYear() - 60)) } // Age 60+
    });
    const totalPWDs = await residentsCollection.countDocuments({ is_pwd: true });

    // Occupation Status Counts (ensure 'occupation_status' field has these exact string values)
    const totalLaborForce = await residentsCollection.countDocuments({ occupation_status: 'Labor force' });
    const totalUnemployed = await residentsCollection.countDocuments({ occupation_status: 'Unemployed' });
    const totalOutOfSchoolYouth = await residentsCollection.countDocuments({ occupation_status: 'Out of School Youth' });
    // You might also want a count for 'Student' if that's different from OSY in your definition.

    // --- Transaction Alerts Data (Counts of Pending Items) ---
    const pendingDocumentRequestsCount = await documentRequestsCollection.countDocuments({
      document_status: 'Pending' // Assuming 'Pending' is the initial status
    });
    const newComplaintsCount = await complaintsCollection.countDocuments({
      status: 'New' // Assuming 'New' is the initial status for complaints
    });
    const borrowedAssetsNotReturnedCount = await borrowedAssetsCollection.countDocuments({
      status: { $in: ['Borrowed', 'Overdue'] } // Items currently out
    });
    // You could also fetch a few recent pending items for display if needed
    const recentPendingDocumentRequests = await documentRequestsCollection.find({ document_status: 'Pending' }).sort({ date_of_request: -1 }).limit(3).toArray();
    const recentNewComplaints = await complaintsCollection.find({ status: 'New' }).sort({ date_of_complaint: -1 }).limit(3).toArray();
    const recentBorrowedAssets = await borrowedAssetsCollection.find({ status: { $in: ['Borrowed', 'Overdue'] } }).sort({ borrow_datetime: -1 }).limit(3).toArray();


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
      // Optionally, arrays of recent items for display:
      recentPendingDocumentRequests,
      recentNewComplaints,
      recentBorrowedAssets,
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