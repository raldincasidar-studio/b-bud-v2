<script setup>
import { ref, watch, computed } from "vue";
import { useMyFetch } from "~/composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

// --- Personal Information ---
const firstName = ref("");
const middleName = ref("");
const lastName = ref("");
const gender = ref(null);
const dateOfBirth = ref("");
const age = ref(null);
const civilStatus = ref(null);
const occupationStatus = ref(null);
const placeOfBirth = ref("");
const citizenship = ref("");
const isPwd = ref(false);
const contactNo = ref("");
const emailAddress = ref("");

// --- Credentials ---
const password = ref("");
const confirmPassword = ref("");

// --- Voter Information ---
const isVoter = ref(false);
const precinctNumber = ref("");
// For v-file-input, model should be an array of File objects or null
const voterRegistrationProofFileModel = ref(null); // <--- RENAMED for clarity, this is the v-model for v-file-input
const voterRegistrationProofBase64 = ref("");
const voterRegistrationProofName = ref("");

// --- Address Information ---
const houseNumber = ref("");
const street = ref("");
const addressSubdivisionZone = ref("");
const cityMunicipality = ref("Manila City");
const yearsLivedCurrentAddress = ref("");

// --- Proof of Residency ---
const proofOfResidencyFileModel = ref(null); // <--- RENAMED for clarity, this is the v-model for v-file-input
const proofOfResidencyBase64 = ref("");
const proofOfResidencyName = ref("");

// --- Household Information ---
const isHouseholdHead = ref(false);
const householdList = ref([]);
const householdMemberSearchQuery = ref("");
const eligibleMemberSearchResults = ref([]);
const isLoadingEligibleMembers = ref(false);
let eligibleMemberSearchDebounceTimer = null;

const GENDER_OPTIONS = ['Male', 'Female'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const OCCUPATION_STATUS_OPTIONS = ['Employed', 'Unemployed', 'Student', 'Retired', 'Labor force', 'Out of School Youth', 'Other'];
const YES_NO_OPTIONS = [{ title: 'No', value: false }, { title: 'Yes', value: true }];

const calculatedAge = computed(() => {
  if (!dateOfBirth.value) return null;
  const birthDate = new Date(dateOfBirth.value);
  const today = new Date();
  if (isNaN(birthDate.getTime())) return null;
  let localAge = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) localAge--;
  return localAge >= 0 ? localAge : null;
});
watch(calculatedAge, (newAge) => { age.value = newAge; });

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(""); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Corrected File Upload Handler
// The `files` argument will be the new model value from v-file-input (an array of File objects or null)
const handleFileUpload = async (files, type) => {
  const actualFile = files && files.size > 0 ? files : null;

  let targetBase64Ref, targetNameRef;
  // The file model refs (proofOfResidencyFileModel, voterRegistrationProofFileModel)
  // are already updated by v-file-input's v-model binding.
  // We just need to process the `actualFile` here.

  if (type === 'residency') {
    targetBase64Ref = proofOfResidencyBase64;
    targetNameRef = proofOfResidencyName;
    // proofOfResidencyFileModel is already updated via v-model
  } else if (type === 'voter') {
    targetBase64Ref = voterRegistrationProofBase64;
    targetNameRef = voterRegistrationProofName;
    // voterRegistrationProofFileModel is already updated via v-model
  } else {
    return;
  }

  if (!actualFile) { // File was cleared from v-file-input
    targetBase64Ref.value = "";
    targetNameRef.value = "";
    return;
  }

  try {
    targetBase64Ref.value = await convertFileToBase64(actualFile);
    targetNameRef.value = actualFile.name;
  } catch (error) {
    console.error(`Error converting ${type} proof to Base64:`, error);
    $toast.fire({ title: `Error processing ${type} proof file`, icon: 'error' });
    // Reset corresponding file model if conversion fails, which will clear v-file-input
    if (type === 'residency') proofOfResidencyFileModel.value = null;
    if (type === 'voter') voterRegistrationProofFileModel.value = null;
    targetBase64Ref.value = "";
    targetNameRef.value = "";
  }
};

watch(isVoter, (newValue) => {
  if (newValue === false) {
    precinctNumber.value = "";
    voterRegistrationProofFileModel.value = null; // Clear the v-file-input model
    voterRegistrationProofBase64.value = "";
    voterRegistrationProofName.value = "";
  }
});

watch(householdMemberSearchQuery, (newQuery) => { /* ... (existing household search logic) ... */ });
const selectHouseholdMember = (resident) => { /* ... (existing logic) ... */ };
const removeHouseholdMember = (index) => { /* ... (existing logic) ... */ };

const saveResident = async () => {
  if (!firstName.value || !lastName.value || !gender.value || !dateOfBirth.value || !emailAddress.value || !password.value) {
    $toast.fire({ title: 'Please fill all required personal and credential fields.', icon: 'error' }); return;
  }
  if (password.value !== confirmPassword.value) {
    $toast.fire({ title: 'Passwords do not match!', icon: 'error' }); return;
  }
   if (password.value.length < 6) {
    $toast.fire({ title: 'Password must be at least 6 characters long.', icon: 'error' }); return;
  }
  if (isVoter.value === true) {
    if (!precinctNumber.value && !voterRegistrationProofBase64.value) {
      $toast.fire({ title: "If registered voter, provide Voter's ID Number or upload Voter's ID.", icon: 'error' }); return;
    }
  }
  if (age.value !== null && age.value < 0) {
      $toast.fire({ title: "Date of birth cannot result in a negative age.", icon: 'error' }); return;
  }

  const residentData = {
    first_name: firstName.value, middle_name: middleName.value, last_name: lastName.value,
    sex: gender.value, date_of_birth: dateOfBirth.value,
    civil_status: civilStatus.value, occupation_status: occupationStatus.value,
    place_of_birth: placeOfBirth.value, citizenship: citizenship.value, is_pwd: isPwd.value,
    contact_number: contactNo.value, email: emailAddress.value, password: password.value,
    is_registered_voter: isVoter.value,
    precinct_number: isVoter.value ? precinctNumber.value : null,
    voter_registration_proof_base64: isVoter.value ? voterRegistrationProofBase64.value : null, // Send the generated base64
    address_house_number: houseNumber.value, address_street: street.value,
    address_subdivision_zone: addressSubdivisionZone.value, address_city_municipality: cityMunicipality.value,
    years_lived_current_address: yearsLivedCurrentAddress.value ? parseInt(yearsLivedCurrentAddress.value) : null,
    residency_proof_base64: proofOfResidencyBase64.value, // Send the generated base64
    is_household_head: isHouseholdHead.value,
    household_member_ids: isHouseholdHead.value ? (householdList.value?.map(member => member.id) || []) : [],
  };

  try {
    const { data, error } = await useMyFetch("/api/residents", { method: 'post', body: residentData });
    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.message || data.value?.error || 'Error adding resident.', icon: 'error' }); return;
    }
    $toast.fire({ title: data.value?.message || 'Resident added successfully!', icon: 'success' });
    router.push('/residents');
  } catch (err) {
    console.error("Save resident exception:", err);
    $toast.fire({ title: 'An unexpected error occurred.', icon: 'error' });
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between" class="mb-10">
      <v-col><h2>Add New Resident</h2></v-col>
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" @click="saveResident" prepend-icon="mdi-account-plus" color="primary">
          Add Resident
        </v-btn>
      </v-col>
    </v-row>

    <v-form @submit.prevent="saveResident">
      <!-- Personal Information Card -->
      <v-card prepend-icon="mdi-card-account-details-outline" title="Personal Information" class="mb-6">
        <v-card-item>
          <v-row>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="firstName" label="First Name*" variant="outlined" required></v-text-field></v-col>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="middleName" label="Middle Name" variant="outlined"></v-text-field></v-col>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="lastName" label="Last Name*" variant="outlined" required></v-text-field></v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="6" md="3"><v-select v-model="gender" :items="GENDER_OPTIONS" label="Sex*" variant="outlined" required></v-select></v-col>
            <v-col cols="12" sm="6" md="3"><v-text-field v-model="dateOfBirth" label="Date of Birth*" type="date" variant="outlined" required></v-text-field></v-col>
            <v-col cols="12" sm="6" md="3"><v-text-field v-model="age" label="Age (Auto-calculated)" type="number" variant="outlined" readonly min="0"></v-text-field></v-col>
            <v-col cols="12" sm="6" md="3"><v-select v-model="civilStatus" :items="CIVIL_STATUS_OPTIONS" label="Civil Status" variant="outlined"></v-select></v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="6" md="4"><v-select v-model="occupationStatus" :items="OCCUPATION_STATUS_OPTIONS" label="Occupation Status" variant="outlined"></v-select></v-col>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="placeOfBirth" label="Place of Birth" variant="outlined"></v-text-field></v-col>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="citizenship" label="Citizenship" variant="outlined"></v-text-field></v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="6" md="4"><v-select v-model="isPwd" :items="YES_NO_OPTIONS" item-title="title" item-value="value" label="Person with Disability (PWD)?" variant="outlined"></v-select></v-col>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="contactNo" label="Contact Number" variant="outlined"></v-text-field></v-col>
            <v-col cols="12" sm="6" md="4"><v-text-field v-model="emailAddress" label="Email Address*" type="email" variant="outlined" required></v-text-field></v-col>
          </v-row>
        </v-card-item>
      </v-card>

      <v-card class="mb-6" prepend-icon="mdi-lock-outline" title="Account Credentials">
        <v-card-item>
          <v-row>
            <v-col cols="12" sm="6"><v-text-field v-model="password" label="Password*" type="password" variant="outlined" required hint="Minimum 6 characters" persistent-hint></v-text-field></v-col>
            <v-col cols="12" sm="6"><v-text-field v-model="confirmPassword" label="Confirm Password*" type="password" variant="outlined" required></v-text-field></v-col>
          </v-row>
        </v-card-item>
      </v-card>

      <v-card class="mb-6" prepend-icon="mdi-map-marker-outline" title="Full Address">
        <v-card-item>
            <v-row>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="houseNumber" label="House Number" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="8"><v-text-field v-model="street" label="Street" variant="outlined"></v-text-field></v-col>
            </v-row>
            <v-row>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="addressSubdivisionZone" label="Subdivision/Zone/Sitio/Purok" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="cityMunicipality" label="City/Municipality" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="yearsLivedCurrentAddress" label="Years Lived (current address)" type="number" min="0" variant="outlined"></v-text-field></v-col>
            </v-row>
            <v-row>
                <v-col cols="12">
                    <!-- Corrected v-file-input binding -->
                    <v-file-input
                      v-model="proofOfResidencyFileModel"
                      @update:modelValue="files => handleFileUpload(files, 'residency')"
                      label="Upload Proof of Residency (e.g., Utility Bill)"
                      accept="image/*,application/pdf"
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

      <v-card class="mb-6" prepend-icon="mdi-vote-outline" title="Voter Information">
        <v-card-item>
            <v-row>
                <v-col cols="12" sm="6" md="4">
                    <v-select v-model="isVoter" :items="YES_NO_OPTIONS" item-title="title" item-value="value" label="Are you a registered voter?" variant="outlined"></v-select>
                </v-col>
                <v-col cols="12" sm="6" md="4" v-if="isVoter === true">
                    <v-text-field v-model="precinctNumber" label="Voter's ID Number (Optional if ID is uploaded)" variant="outlined"></v-text-field>
                </v-col>
            </v-row>
            <v-row v-if="isVoter === true">
                <v-col cols="12">
                     <!-- Corrected v-file-input binding -->
                     <v-file-input
                        v-model="voterRegistrationProofFileModel"
                        @update:modelValue="files => handleFileUpload(files, 'voter')"
                        label="Upload Voter's ID (Optional if Voter's ID Number is provided)"
                        accept="image/*,application/pdf"
                        variant="outlined"
                        :prepend-icon="voterRegistrationProofName ? 'mdi-file-check' : 'mdi-paperclip'"
                        clearable
                        show-size
                    ></v-file-input>
                    <small v-if="voterRegistrationProofName">Selected file: {{ voterRegistrationProofName }}</small>
                     <small v-if="isVoter === true && !precinctNumber && !voterRegistrationProofName" class="text-error d-block mt-1">
                        Please provide either Voter's ID Number or upload Voter's ID.
                    </small>
                </v-col>
            </v-row>
        </v-card-item>
      </v-card>

      <v-card class="mb-6" prepend-icon="mdi-home-group" title="Household Information">
        <v-card-item>
          <v-row><v-col cols="12" sm="6" md="4"><v-select v-model="isHouseholdHead" :items="YES_NO_OPTIONS" item-title="title" item-value="value" label="Are you the household head?" variant="outlined" density="compact"></v-select></v-col></v-row>
          <div v-if="isHouseholdHead === true">
            <v-row class="mt-4"><v-col cols="12"><v-text-field v-model="householdMemberSearchQuery" prepend-inner-icon="mdi-magnify" variant="outlined" color="primary" label="Search & Add Eligible Members" placeholder="Search..." clearable @click:clear="eligibleMemberSearchResults = []" :loading="isLoadingEligibleMembers" density="compact" class="mb-2"></v-text-field></v-col></v-row>
            <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length > 0">
              <v-col cols="12"><v-list density="compact" lines="one" class="elevation-1"><v-list-subheader>Eligible (Click to add)</v-list-subheader><v-list-item v-for="resident in eligibleMemberSearchResults" :key="resident.id" @click="selectHouseholdMember(resident)" :title="resident.title" ripple><template v-slot:prepend><v-icon color="green">mdi-account-plus-outline</v-icon></template><v-list-item-subtitle v-if="resident.sex">Sex: {{ resident.sex }}</v-list-item-subtitle></v-list-item></v-list></v-col>
            </v-row>
            <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length === 0"><v-col cols="12"><p class="text-grey text-center pa-2">No eligible residents found.</p></v-col></v-row>
            <v-row class="mt-6">
              <v-col cols="12">
                <h4 class="mb-2">Current Household Members:</h4>
                <v-table density="compact" v-if="householdList.length > 0">
                  <thead><tr><th class="text-left">Name</th><th class="text-left">Gender</th><th class="text-left">Action</th></tr></thead>
                  <tbody><tr v-for="(member, index) in householdList" :key="member.id || index"><td>{{ member.name }}</td><td>{{ member.gender }}</td><td><v-btn icon="mdi-account-minus-outline" variant="text" color="red" size="small" @click="removeHouseholdMember(index)" title="Remove"></v-btn></td></tr></tbody>
                </v-table>
                <p v-else class="text-grey text-center py-5">No members added.</p>
              </v-col>
            </v-row>
          </div>
        </v-card-item>
      </v-card>

      <v-row class="mt-8 mb-4"><v-col class="text-right">
          <v-btn size="large" color="primary" type="submit" prepend-icon="mdi-content-save">Save New Resident</v-btn>
          <v-btn size="large" variant="text" color="grey" to="/residents" class="ml-2">Cancel</v-btn>
      </v-col></v-row>
    </v-form>
  </v-container>
</template>