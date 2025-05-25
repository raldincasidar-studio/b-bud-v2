<script setup>
import { ref, watch } from "vue"; // Added watch
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

// --- Existing Personal Information ---
const firstName = ref("");
const middleName = ref("");
const lastName = ref("");
const gender = ref(""); // Corresponds to 'sex'
const dateOfBirth = ref("");
const civilStatus = ref("");
// const yearLived = ref(""); // Renamed to yearsLivedCurrentAddress
const occupationStatus = ref(""); // Renamed from occupation, now a select
const contactNo = ref(""); // Corresponds to 'contact_number'
const emailAddress = ref(""); // Corresponds to 'email'

// --- New Personal Information Fields ---
const age = ref(null); // New: from schema: age: INTEGER
const placeOfBirth = ref(""); // New: from schema: place_of_birth: VARCHAR(255)
const citizenship = ref(""); // New: from schema: citizenship: VARCHAR(100)
const isPwd = ref("No"); // New: from schema: is_pwd: BOOLEAN (Yes/No)

// --- Voter Information ---
const isVoter = ref("No"); // Corresponds to 'is_registered_voter'
const precinctNumber = ref(""); // New: from schema: precinct_number: VARCHAR(50)
const voterRegistrationProof = ref(null); // New: for file object
const voterRegistrationProofBase64 = ref(""); // New: for base64 string
const voterRegistrationProofName = ref(""); // New: for file name

// --- Address Information ---
// const subdivision = ref(""); // Replaced by addressSubdivisionZone
// const block = ref(""); // Removed, replaced by houseNumber & street
// const lot = ref(""); // Removed, replaced by houseNumber & street
const houseNumber = ref(""); // New: from schema: address_house_number: VARCHAR(50)
const street = ref(""); // New: from schema: address_street: VARCHAR(255)
const addressSubdivisionZone = ref(""); // Renamed from subdivision, corresponds to address_subdivision_zone
const cityMunicipality = ref("Manila City"); // New: from schema: address_city_municipality: VARCHAR(100)
const yearsLivedCurrentAddress = ref(""); // Renamed from yearLived

// --- Proof of Residency (Existing) ---
const proofOfResidency = ref(null);
const proofOfResidencyBase64 = ref("");
const proofOfResidencyName = ref("");

// --- Household Information (Existing) ---
const isHouseholdHead = ref('No');
const householdList = ref([]);

// --- NEW: For Eligible Household Member Search ---
const householdMemberSearchQuery = ref(""); // Renamed from searchResidentQuery to avoid confusion
const eligibleMemberSearchResults = ref([]); // Renamed from residentSearchResult
const isLoadingEligibleMembers = ref(false);
let eligibleMemberSearchDebounceTimer = null;

// --- File Conversion Utility ---
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(""); // Resolve with empty string if no file
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- File Upload Handlers ---
const handleProofOfResidencyUpload = async (event) => {
  const file = event.target.files[0];
  proofOfResidency.value = file; // Store the file object itself
  if (file) {
    try {
      proofOfResidencyBase64.value = await convertFileToBase64(file);
      proofOfResidencyName.value = file.name;
    } catch (error) {
      console.error("Error converting proof of residency to Base64:", error);
      $toast.fire({ title: 'Error processing residency proof file', icon: 'error' });
      proofOfResidency.value = null;
      proofOfResidencyBase64.value = "";
      proofOfResidencyName.value = "";
    }
  } else {
    proofOfResidencyBase64.value = "";
    proofOfResidencyName.value = "";
  }
};

const handleVoterProofUpload = async (event) => {
  const file = event.target.files[0];
  voterRegistrationProof.value = file; // Store the file object
  if (file) {
    try {
      voterRegistrationProofBase64.value = await convertFileToBase64(file);
      voterRegistrationProofName.value = file.name;
    } catch (error) {
      console.error("Error converting voter proof to Base64:", error);
      $toast.fire({ title: 'Error processing voter proof file', icon: 'error' });
      voterRegistrationProof.value = null;
      voterRegistrationProofBase64.value = "";
      voterRegistrationProofName.value = "";
    }
  } else {
    voterRegistrationProofBase64.value = "";
    voterRegistrationProofName.value = "";
  }
};

// Watcher to clear precinct number and voter proof if not a voter
watch(isVoter, (newValue) => {
  if (newValue === 'No') {
    precinctNumber.value = "";
    voterRegistrationProof.value = null;
    voterRegistrationProofBase64.value = "";
    voterRegistrationProofName.value = "";
  }
});

// --- NEW: Search for Eligible Household Members ---
watch(householdMemberSearchQuery, (newQuery) => {
  clearTimeout(eligibleMemberSearchDebounceTimer);
  eligibleMemberSearchResults.value = []; // Clear previous results or when query is too short

  if (newQuery && newQuery.trim().length >= 2) {
    isLoadingEligibleMembers.value = true;
    eligibleMemberSearchDebounceTimer = setTimeout(async () => {
      try {
        const { data, error } = await useMyFetch('/api/residents/eligible-for-household-search', {
          query: {
            searchKey: newQuery.trim(),
          },
        });

        if (error.value) {
          console.error("Error searching eligible household members:", error.value);
          eligibleMemberSearchResults.value = [];
        } else {
          // API returns { searchResults: [...] }
          // Map the results to include a 'title' for the v-list-item
          eligibleMemberSearchResults.value = (data.value?.searchResults || []).map(r => ({
            ...r, // Spread all properties like _id, first_name, last_name, sex
            // Create a display title (adjust as needed based on API response structure)
            title: `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`,
            // Ensure 'id' is present for keying and selection logic if your selectResident expects 'id'
            id: r._id 
          }));
        }
      } catch (e) {
        console.error("Exception searching eligible members:", e);
        eligibleMemberSearchResults.value = [];
      } finally {
        isLoadingEligibleMembers.value = false;
      }
    }, 500); // 500ms debounce
  } else {
    isLoadingEligibleMembers.value = false; // Not loading if query is too short
  }
});

// --- Select/Remove Household Members (Logic remains similar, but uses new search results) ---
const selectHouseholdMember = (resident) => {
  // Prevent adding the current person being registered if they are marked as head
  // (Though the API should prevent them from appearing in search, this is a UI safeguard)
  // For a new resident, there's no 'current ID' to compare against yet until saved.
  // This check is more relevant when editing an existing household head.

  // Prevent adding duplicates
  if (!householdList.value.find(r => r.id === resident.id)) {
    // Store the selected resident object (or just the ID if preferred for payload)
    // Storing the object helps display name/gender in the "Current Household Members" table
    householdList.value.push({
        id: resident.id, // or resident._id
        name: resident.title, // Or construct from first_name, last_name
        gender: resident.sex, // Assuming API returns 'sex'
        // Add other details if needed for display
    });
  }
  householdMemberSearchQuery.value = ""; // Clear search query
  eligibleMemberSearchResults.value = []; // Clear search results
};

const removeHouseholdMember = (index) => {
  householdList.value.splice(index, 1);
};

// --- Household Search (Existing) ---
const searchResidentQuery = ref("");
// const residentId = ref(""); // Not used directly, selection updates householdList
const residentSearchResult = ref([]);

const searchResidents = async () => {
  const query = searchResidentQuery.value;
  if (!query || query.length < 2) {
    residentSearchResult.value = [];
    return;
  }

  const { data, error } = await useMyFetch("/api/residents/search", {
    query: { q: query },
  });

  if (error.value) {
    console.error("Failed to search residents:", error.value);
    residentSearchResult.value = [];
    return;
  }

  residentSearchResult.value = (data.value?.residents || []).map(
    (resident) => ({
      id: resident._id, // Ensure id is used for mapping
      title: resident.name, // Assuming 'name' is a combined name field from backend
      // ...resident // Spread other resident properties if needed by the list item display
      name: resident.name, // Explicitly for display in table
      gender: resident.gender // Explicitly for display in table
    })
  );
};

const selectResident = (resident) => {
  // Prevent adding duplicates
  if (!householdList.value.find(r => r.id === resident.id)) {
    householdList.value.push(resident);
  }
  searchResidentQuery.value = ""; // Clear search query
  residentSearchResult.value = []; // Clear search results
};

const removeResident = (index) => {
  householdList.value.splice(index, 1);
};

// --- Save Resident ---
const saveResident = async () => {
  const residentData = {
    // Personal Info
    is_household_head: isHouseholdHead.value === 'Yes', // Matches schema
    first_name: firstName.value,
    middle_name: middleName.value,
    last_name: lastName.value,
    sex: gender.value, // Matches schema 'sex'
    age: age.value ? parseInt(age.value) : null, // Matches schema 'age'
    date_of_birth: dateOfBirth.value,
    civil_status: civilStatus.value,
    occupation_status: occupationStatus.value, // Matches schema
    place_of_birth: placeOfBirth.value, // Matches schema
    citizenship: citizenship.value, // Matches schema
    is_pwd: isPwd.value === 'Yes', // Matches schema

    // Voter Info
    is_registered_voter: isVoter.value === 'Yes', // Matches schema
    precinct_number: precinctNumber.value, // Matches schema
    voter_registration_proof_base64: voterRegistrationProofBase64.value, // Send base64
    voter_registration_proof_name: voterRegistrationProofName.value, // Send name for backend to reconstruct

    // Address Info
    address_house_number: houseNumber.value,
    address_street: street.value,
    address_subdivision_zone: addressSubdivisionZone.value,
    address_city_municipality: cityMunicipality.value,
    years_lived_current_address: yearsLivedCurrentAddress.value ? parseInt(yearsLivedCurrentAddress.value) : null,

    // Contact Info
    contact_number: contactNo.value, // Matches schema
    email: emailAddress.value, // Matches schema

    // Proofs (send base64 for backend to handle)
    residency_proof_base64: proofOfResidencyBase64.value,
    residency_proof_name: proofOfResidencyName.value,

    // Updated to use householdList which now contains objects with 'id'
    household_member_ids: isHouseholdHead.value === 'Yes' ? (householdList.value?.map((member) => member.id) || []) : [],
  };

  // Note: For voter_registration_proof_urls and residency_proof_urls,
  // the backend will need to handle the base64 data and save it, then store the URL/path.
  // This example sends the base64 string and name.
  // If your backend expects FormData with actual files, the submission logic would need to change.

  try {
    const { data, error } = await useMyFetch("/api/residents", {
      method: 'post',
      body: residentData,
    });

    if (error.value || data?.value?.error) {
      $toast.fire({
        title: data?.value?.error || 'Something went wrong while adding resident',
        icon: 'error',
      });
      return;
    }

    $toast.fire({
      title: data?.value?.message || 'Resident added successfully',
      icon: 'success',
    });
    router.push('/residents');
  } catch (err) {
    console.error(err);
    $toast.fire({
      title: 'Something went wrong while adding resident (catch)',
      icon: 'error',
    });
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between" class="mb-10">
      <v-col><h2>Add New Resident</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveResident"
          prepend-icon="mdi-account-plus"
          color="primary"
        >
          Add Resident
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-card-account-details-outline" title="Personal Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="firstName" label="First Name" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="middleName" label="Middle Name" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="lastName" label="Last Name" variant="outlined"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="gender"
              :items="['Male', 'Female', 'Other']"
              label="Sex (M/F/Other)"
              variant="outlined"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="dateOfBirth"
              label="Date of Birth"
              type="date"
              variant="outlined"
            ></v-text-field>
          </v-col>
           <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="age"
              label="Age"
              type="number"
              variant="outlined"
              min="0"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="civilStatus"
              :items="['Single', 'Married', 'Divorced', 'Widowed', 'Separated']"
              label="Civil Status"
              variant="outlined"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
             <v-select
              v-model="occupationStatus"
              :items="['Employed', 'Unemployed', 'Student', 'Retired', 'Other']"
              label="Occupation Status"
              variant="outlined"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="placeOfBirth" label="Place of Birth" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="citizenship" label="Citizenship" variant="outlined"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
           <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="isPwd"
              :items="['No', 'Yes']"
              label="Are you a PWD?"
              variant="outlined"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="contactNo" label="Contact Number" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="emailAddress" label="Email Address" type="email" variant="outlined"></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>

    <v-card class="mt-6" prepend-icon="mdi-map-marker-outline" title="Full Address">
        <v-card-item>
            <v-row>
                <v-col cols="12" sm="6" md="4">
                    <v-text-field v-model="houseNumber" label="House Number" variant="outlined"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="8">
                    <v-text-field v-model="street" label="Street" variant="outlined"></v-text-field>
                </v-col>
            </v-row>
            <v-row>
                <v-col cols="12" sm="6" md="4">
                    <v-text-field v-model="addressSubdivisionZone" label="Subdivision/Zone/Sitio/Purok" variant="outlined"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="4">
                    <v-text-field v-model="cityMunicipality" label="City/Municipality" variant="outlined"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="4">
                    <v-text-field v-model="yearsLivedCurrentAddress" label="Years Lived (at current address)" type="number" min="0" variant="outlined"></v-text-field>
                </v-col>
            </v-row>
             <v-row>
                <v-col cols="12">
                    <v-file-input
                    v-model="proofOfResidency"
                    label="Upload Proof of Residency (e.g., Utility Bill)"
                    accept="image/*,application/pdf"
                    @change="handleProofOfResidencyUpload"
                    variant="outlined"
                    :prepend-icon="proofOfResidencyName ? 'mdi-file-check' : 'mdi-paperclip'"
                    clearable
                    show-size
                    ></v-file-input>
                    <small v-if="proofOfResidencyName">Selected file: {{ proofOfResidencyName }}</small>
                </v-col>
            </v-row>
        </v-card-item>
    </v-card>

    <v-card class="mt-6" prepend-icon="mdi-vote-outline" title="Voter Information">
        <v-card-item>
            <v-row>
                <v-col cols="12" sm="6" md="4">
                    <v-select
                    v-model="isVoter"
                    :items="['No', 'Yes']"
                    label="Are you a registered voter?"
                    variant="outlined"
                    ></v-select>
                </v-col>
                <v-col cols="12" sm="6" md="4" v-if="isVoter === 'Yes'">
                    <v-text-field v-model="precinctNumber" label="Precinct Number" variant="outlined"></v-text-field>
                </v-col>
            </v-row>
            <v-row v-if="isVoter === 'Yes'">
                <v-col cols="12">
                     <v-file-input
                        v-model="voterRegistrationProof"
                        label="Upload Proof of Voter's Registration"
                        accept="image/*,application/pdf"
                        @change="handleVoterProofUpload"
                        variant="outlined"
                        :prepend-icon="voterRegistrationProofName ? 'mdi-file-check' : 'mdi-paperclip'"
                        clearable
                        show-size
                    ></v-file-input>
                    <small v-if="voterRegistrationProofName">Selected file: {{ voterRegistrationProofName }}</small>
                </v-col>
            </v-row>
        </v-card-item>
    </v-card>


    <!-- UPDATED Household Information Card -->
    <v-card class="mt-6" prepend-icon="mdi-home-group" title="Household Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="isHouseholdHead"
              :items="['No', 'Yes']"
              label="Are you the household head?"
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
        </v-row>

        <!-- This section shows only if the current person IS a household head -->
        <div v-if="isHouseholdHead === 'Yes'">
          <v-row class="mt-4">
            <v-col cols="12">
              <v-text-field
                v-model="householdMemberSearchQuery"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                color="primary"
                label="Search and Add Eligible Household Members"
                placeholder="Search by name, email..."
                clearable
                @click:clear="eligibleMemberSearchResults = []"
                :loading="isLoadingEligibleMembers"
                density="compact"
                class="mb-2"
              />
            </v-col>
          </v-row>

          <!-- Display Search Results for Eligible Members -->
          <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length > 0">
            <v-col cols="12">
              <v-list density="compact" lines="one" class="elevation-1">
                <v-list-subheader>Eligible Residents (Click to add)</v-list-subheader>
                <v-list-item
                  v-for="resident in eligibleMemberSearchResults"
                  :key="resident.id" 
                  @click="selectHouseholdMember(resident)"
                  :title="resident.title" 
                  ripple
                >
                  <template v-slot:prepend>
                    <v-icon color="green">mdi-account-plus-outline</v-icon>
                  </template>
                  <v-list-item-subtitle v-if="resident.sex">
                    Sex: {{ resident.sex }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
          <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length === 0">
             <v-col cols="12">
                <p class="text-grey text-center pa-2">No eligible residents found matching "{{ householdMemberSearchQuery }}".</p>
             </v-col>
          </v-row>


          <!-- Display Current Household Members Added to this New Head -->
          <v-row class="mt-6">
            <v-col cols="12">
              <h4 class="mb-2">Current Household Members to be Added:</h4>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th class="text-left">Name</th>
                    <th class="text-left">Gender</th>
                    <th class="text-left">Action</th>
                  </tr>
                </thead>
                <tbody v-if="householdList.length">
                  <tr v-for="(member, index) in householdList" :key="member.id || index">
                    <td>{{ member.name }}</td>
                    <td>{{ member.gender }}</td>
                    <td>
                      <v-btn
                        icon="mdi-account-minus-outline"
                        variant="text"
                        color="red"
                        size="small"
                        @click="removeHouseholdMember(index)"
                        title="Remove member"
                      />
                    </td>
                  </tr>
                </tbody>
                <tbody v-else>
                  <tr>
                    <td colspan="3" class="text-center py-5 text-grey">No household members added yet.</td>
                  </tr>
                </tbody>
              </v-table>
            </v-col>
          </v-row>
        </div>
      </v-card-item>
    </v-card>

  </v-container>
</template>