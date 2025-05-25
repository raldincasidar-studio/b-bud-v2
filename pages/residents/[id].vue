<template>
  <v-container class="my-10">
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Loading resident details...</p>
    </div>
    <div v-else-if="!residentData._id && !errorLoading"> <!-- Check for _id or a key field -->
      <v-alert type="warning" prominent border="start">
        Resident not found or could not be loaded.
        <v-btn color="primary" variant="text" to="/residents" class="ml-2">Go to Residents List</v-btn>
      </v-alert>
    </div>
    <div v-else-if="errorLoading">
       <v-alert type="error" prominent border="start">
        Error loading resident details. Please try again.
        <v-btn color="primary" variant="text" @click="fetchResidentDetails" class="ml-2">Retry</v-btn>
      </v-alert>
    </div>

    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2>
            Resident: {{ residentData.first_name }} {{ residentData.last_name }}
            <v-chip v-if="residentData.is_household_head" color="green" small class="ml-2" label>Household Head</v-chip>
          </h2>
        </v-col>
        <v-col class="text-right">
          <v-btn
            v-if="!editMode"
            color="primary"
            @click="toggleEditMode(true)"
            prepend-icon="mdi-pencil"
            class="mr-2"
            variant="tonal"
          >
            Edit
          </v-btn>
          <v-btn
            v-if="editMode"
            color="green"
            @click="saveChanges"
            prepend-icon="mdi-content-save"
            class="mr-2"
            variant="tonal"
            :loading="saving"
          >
            Save Changes
          </v-btn>
          <v-btn
            v-if="editMode"
            color="grey"
            @click="cancelEdit"
            prepend-icon="mdi-close-circle-outline"
            variant="text"
            class="mr-2"
          >
            Cancel
          </v-btn>
          <v-btn
            color="red"
            @click="confirmDeleteResident"
            prepend-icon="mdi-delete"
            variant="outlined"
            :loading="deleting"
          >
            Delete
          </v-btn>
        </v-col>
      </v-row>

      <!-- Personal Information Card -->
      <v-card class="mb-6" prepend-icon="mdi-card-account-details-outline" title="Personal Information">
        <v-card-text>
          <!-- Row 1: Names -->
          <v-row>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.first_name" label="First Name" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.middle_name" label="Middle Name" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.last_name" label="Last Name" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>
          <!-- Row 2: Sex, DOB, Age, Civil Status -->
          <v-row>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="editableResident.sex" :items="['Male', 'Female', 'Other']" label="Sex" :readonly="!editMode" variant="outlined" density="compact"></v-select>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="editableResident.date_of_birth" label="Date of Birth" type="date" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model.number="editableResident.age" label="Age" type="number" :readonly="!editMode" variant="outlined" density="compact" min="0"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="editableResident.civil_status" :items="['Single', 'Married', 'Divorced', 'Widowed', 'Separated']" label="Civil Status" :readonly="!editMode" variant="outlined" density="compact"></v-select>
            </v-col>
          </v-row>
          <!-- Row 3: Occupation, POB, Citizenship -->
          <v-row>
            <v-col cols="12" sm="6" md="4">
              <v-select v-model="editableResident.occupation_status" :items="['Employed', 'Unemployed', 'Student', 'Retired', 'Other']" label="Occupation Status" :readonly="!editMode" variant="outlined" density="compact"></v-select>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.place_of_birth" label="Place of Birth" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.citizenship" label="Citizenship" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>
          <!-- Row 4: PWD, Contact, Email -->
          <v-row>
            <v-col cols="12" sm="6" md="4">
              <v-select v-model="editableResident.is_pwd" :items="[ {title: 'No', value: false}, {title: 'Yes', value: true} ]" item-title="title" item-value="value" label="Person with Disability (PWD)?" :readonly="!editMode" variant="outlined" density="compact"></v-select>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.contact_number" label="Contact Number" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.email" label="Email Address" type="email" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Full Address Card -->
      <v-card class="mb-6" prepend-icon="mdi-map-marker-outline" title="Full Address">
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="4">
              <v-text-field v-model="editableResident.address_house_number" label="House Number" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="8">
              <v-text-field v-model="editableResident.address_street" label="Street" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="4">
              <v-text-field v-model="editableResident.address_subdivision_zone" label="Subdivision/Zone/Sitio/Purok" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field v-model="editableResident.address_city_municipality" label="City/Municipality" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field v-model.number="editableResident.years_lived_current_address" label="Years Lived (Current Address)" type="number" :readonly="!editMode" variant="outlined" density="compact" min="0"></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
                <label class="v-label mb-1 text-subtitle-2">Proof of Residency</label>
                <div v-if="!editMode && editableResident.residency_proof_data" class="mt-2">
                    <v-img v-if="isImage(editableResident.residency_proof_data)" :src="editableResident.residency_proof_data" max-height="200" contain class="mb-2 elevation-1 bordered-image"></v-img>
                    <a v-else :href="editableResident.residency_proof_data" target="_blank" class="mb-2 d-block">View Proof (Non-Image File)</a>
                </div>
                <p v-if="!editMode && !editableResident.residency_proof_data" class="text-grey mt-2">No proof uploaded.</p>
                <v-file-input
                    v-if="editMode"
                    v-model="residencyProofFile"
                    label="Change Proof of Residency"
                    accept="image/*,application/pdf"
                    @change="handleFileUpload($event, 'residency')"
                    variant="outlined" density="compact" clearable
                    prepend-icon="" prepend-inner-icon="mdi-paperclip"
                    class="mt-2"
                ></v-file-input>
                <small v-if="editMode && residencyProofFilePreviewName" class="d-block mt-1">New file: {{ residencyProofFilePreviewName }}</small>
                <small v-if="editMode && !residencyProofFilePreviewName && editableResident.residency_proof_data" class="d-block mt-1 text-grey">Current proof will be kept unless a new file is uploaded or cleared.</small>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Voter Information Card -->
      <v-card class="mb-6" prepend-icon="mdi-vote-outline" title="Voter Information">
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="6" md="4">
              <v-select v-model="editableResident.is_registered_voter" :items="[{title: 'No', value: false}, {title: 'Yes', value: true}]" item-title="title" item-value="value" label="Registered Voter?" :readonly="!editMode" variant="outlined" density="compact"></v-select>
            </v-col>
            <v-col v-if="editableResident.is_registered_voter" cols="12" sm="6" md="4">
              <v-text-field v-model="editableResident.precinct_number" label="Precinct Number" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>
          <v-row v-if="editableResident.is_registered_voter">
            <v-col cols="12" md="6">
                <label class="v-label mb-1 text-subtitle-2">Proof of Voter's Registration</label>
                 <div v-if="!editMode && editableResident.voter_registration_proof_data" class="mt-2">
                    <v-img v-if="isImage(editableResident.voter_registration_proof_data)" :src="editableResident.voter_registration_proof_data" max-height="200" contain class="mb-2 elevation-1 bordered-image"></v-img>
                    <a v-else :href="editableResident.voter_registration_proof_data" target="_blank" class="mb-2 d-block">View Proof (Non-Image File)</a>
                </div>
                <p v-if="!editMode && !editableResident.voter_registration_proof_data && editableResident.is_registered_voter" class="text-grey mt-2">No proof uploaded.</p>
                 <v-file-input
                    v-if="editMode"
                    v-model="voterProofFile"
                    label="Change Voter Proof"
                    accept="image/*,application/pdf"
                    @change="handleFileUpload($event, 'voter')"
                    variant="outlined" density="compact" clearable
                    prepend-icon="" prepend-inner-icon="mdi-paperclip"
                    class="mt-2"
                ></v-file-input>
                 <small v-if="editMode && voterProofFilePreviewName" class="d-block mt-1">New file: {{ voterProofFilePreviewName }}</small>
                 <small v-if="editMode && !voterProofFilePreviewName && editableResident.voter_registration_proof_data" class="d-block mt-1 text-grey">Current proof will be kept unless a new file is uploaded or cleared.</small>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Household Information Card -->
      <v-card class="mb-6" prepend-icon="mdi-home-group" title="Household Information">
        <v-card-text>
            <v-row>
                <v-col cols="12" sm="6" md="4">
                  <v-select v-model="editableResident.is_household_head" :items="[ {title: 'No', value: false}, {title: 'Yes', value: true} ]" item-title="title" item-value="value" label="Is Household Head?" :readonly="!editMode" variant="outlined" density="compact"></v-select>
                </v-col>
            </v-row>

            <!-- This section shows if the current person IS a household head (in view or edit mode) -->
            <div v-if="editableResident.is_household_head">
              <!-- Search and Add Members (Only in Edit Mode) -->
              <div v-if="editMode">
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
                        v-for="member in eligibleMemberSearchResults"
                        :key="member._id"
                        @click="selectHouseholdMember(member)"
                        :title="`${member.first_name} ${member.middle_name || ''} ${member.last_name}`"
                        ripple
                      >
                        <template v-slot:prepend>
                          <v-icon color="green">mdi-account-plus-outline</v-icon>
                        </template>
                        <v-list-item-subtitle v-if="member.sex">Sex: {{ member.sex }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-col>
                </v-row>
                <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length === 0">
                  <v-col cols="12"><p class="text-grey text-center pa-2">No eligible residents found matching "{{ householdMemberSearchQuery }}".</p></v-col>
                </v-row>
              </div>

              <!-- Display Current Household Members -->
              <v-row class="mt-6">
                <v-col cols="12">
                  <h4 class="mb-2 text-subtitle-1">Household Members:</h4>
                   <v-alert v-if="!editMode && (!editableResident.household_members_details || editableResident.household_members_details.length === 0)" type="info" density="compact" class="mb-2">
                    No household members listed.
                  </v-alert>
                  <v-table v-else density="compact">
                    <thead>
                      <tr>
                        <th class="text-left">Name</th>
                        <th class="text-left">Gender</th>
                        <th class="text-left" v-if="editMode">Action</th>
                      </tr>
                    </thead>
                    <tbody v-if="editableResident.household_members_details && editableResident.household_members_details.length > 0">
                      <tr v-for="(member, index) in editableResident.household_members_details" :key="member._id || index">
                        <td>{{ member.first_name }} {{ member.middle_name || '' }} {{ member.last_name }}</td>
                        <td>{{ member.sex }}</td>
                        <td v-if="editMode">
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
                    <tbody v-else-if="editMode"> <!-- Show this only in edit mode if list is empty -->
                       <tr>
                        <td colspan="3" class="text-center py-5 text-grey">No household members added yet.</td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-col>
              </v-row>
            </div>
            <p v-else-if="!editableResident.is_household_head" class="mt-2 text-grey">
                This resident is not a household head.
            </p>
        </v-card-text>
      </v-card>

    </div>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete resident: <strong>{{ residentData.first_name }} {{ residentData.last_name }}</strong>? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteResident" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../composables/useMyFetch'; // Your fetch composable
import { useNuxtApp } from '#app'; // For $toast or similar

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const residentId = route.params.id;

const residentData = ref({}); // Original data from API (read-only display source)
const editableResident = ref({ // Data for editing form
  household_member_ids: [],       // Stores IDs of members
  household_members_details: [] // Stores detail objects of members for display
});
const loading = ref(true);
const errorLoading = ref(false);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const deleteDialog = ref(false);

// For file uploads during edit
const residencyProofFile = ref(null);
const residencyProofFileBase64 = ref('');
const residencyProofFilePreviewName = ref('');
const voterProofFile = ref(null);
const voterProofFileBase64 = ref('');
const voterProofFilePreviewName = ref('');

// --- For Eligible Household Member Search ---
const householdMemberSearchQuery = ref("");
const eligibleMemberSearchResults = ref([]);
const isLoadingEligibleMembers = ref(false);
let eligibleMemberSearchDebounceTimer = null;

// Fetch resident details on component mount
onMounted(async () => {
  await fetchResidentDetails();
});

async function fetchResidentDetails() {
  loading.value = true;
  errorLoading.value = false;
  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentId}`);
    if (error.value || !data.value?.resident) {
      console.error('Failed to fetch resident details:', error.value);
      errorLoading.value = true;
      residentData.value = {};
      editableResident.value = { household_member_ids: [], household_members_details: [] };
    } else {
      // Store the raw fetched data
      const fetchedResident = data.value.resident;
      
      // Format date for input
      if (fetchedResident.date_of_birth) {
        fetchedResident.date_of_birth = new Date(fetchedResident.date_of_birth).toISOString().split('T')[0];
      }
      
      // Initialize household_members_details as an empty array before potentially fetching
      fetchedResident.household_members_details = [];
      residentData.value = { ...fetchedResident }; // Update the main data source

      // If household head, fetch member details based on household_member_ids
      if (fetchedResident.is_household_head && fetchedResident.household_member_ids && fetchedResident.household_member_ids.length > 0) {
        await fetchAndAssignHouseholdMemberDetails(fetchedResident.household_member_ids);
      }
      
      resetEditableData(); // Initialize editable data from residentData
    }
  } catch (e) {
    console.error('Exception fetching resident:', e);
    errorLoading.value = true;
     residentData.value = {};
     editableResident.value = { household_member_ids: [], household_members_details: [] };
  } finally {
    loading.value = false;
  }
}

// New function to fetch details of members and assign to residentData.household_members_details
async function fetchAndAssignHouseholdMemberDetails(memberIds) {
  if (!memberIds || memberIds.length === 0) {
    residentData.value.household_members_details = [];
    return;
  }
  try {
    // Assuming an endpoint like /api/residents/by-ids?ids=id1,id2,id3
    // Or fetch one by one (less efficient)
    const memberDetailsPromises = memberIds.map(id => 
      useMyFetch(`/api/residents/${id}`).then(res => res.data.value?.resident)
    );
    const resolvedMembers = await Promise.all(memberDetailsPromises);
    
    residentData.value.household_members_details = resolvedMembers.filter(member => member != null).map(m => ({
        _id: m._id,
        first_name: m.first_name,
        last_name: m.last_name,
        middle_name: m.middle_name,
        sex: m.sex
        // include other fields needed for display in the members table
    }));
  } catch (e) {
    console.error("Failed to fetch household member details:", e);
    residentData.value.household_members_details = []; // Fallback to empty
  }
}


function resetEditableData() {
  // Deep copy from residentData to editableResident
  editableResident.value = JSON.parse(JSON.stringify(residentData.value));
  // Ensure household_members_details and household_member_ids are arrays
  if (!Array.isArray(editableResident.value.household_members_details)) {
    editableResident.value.household_members_details = [];
  }
  if (!Array.isArray(editableResident.value.household_member_ids)) {
    editableResident.value.household_member_ids = [];
  }

  // Clear file refs for edit mode
  residencyProofFile.value = null;
  residencyProofFileBase64.value = '';
  residencyProofFilePreviewName.value = '';
  voterProofFile.value = null;
  voterProofFileBase64.value = '';
  voterProofFilePreviewName.value = '';
  // Clear household member search
  householdMemberSearchQuery.value = "";
  eligibleMemberSearchResults.value = [];
}

function toggleEditMode(enable) {
  editMode.value = enable;
  if (enable) {
    resetEditableData();
  }
}

function cancelEdit() {
  toggleEditMode(false);
  resetEditableData(); // Revert to original saved data
}

const isImage = (base64String) => {
  if (!base64String || typeof base64String !== 'string') return false;
  return base64String.startsWith('data:image');
};

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(""); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const handleFileUpload = async (event, type) => {
  const file = event.target.files[0];
  const targetBase64Ref = type === 'residency' ? residencyProofFileBase64 : voterProofFileBase64;
  const targetNameRef = type === 'residency' ? residencyProofFilePreviewName : voterProofFilePreviewName;
  const targetFileRef = type === 'residency' ? residencyProofFile : voterProofFile;
  const editableProofDataField = type === 'residency' ? 'residency_proof_data' : 'voter_registration_proof_data';

  if (!file) {
    targetBase64Ref.value = '';
    targetNameRef.value = '';
    targetFileRef.value = null;
    editableResident.value[editableProofDataField] = null; // Mark for removal
    return;
  }

  try {
    const base64 = await convertFileToBase64(file);
    targetBase64Ref.value = base64;
    targetNameRef.value = file.name;
    editableResident.value[editableProofDataField] = base64;
  } catch (error) {
    console.error(`Error converting ${type} proof to Base64:`, error);
    $toast.fire({ title: `Error processing ${type} proof file`, icon: 'error' });
  }
};

// --- Household Member Management ---
watch(householdMemberSearchQuery, (newQuery) => {
  clearTimeout(eligibleMemberSearchDebounceTimer);
  eligibleMemberSearchResults.value = [];
  if (newQuery && newQuery.trim().length >= 2) {
    isLoadingEligibleMembers.value = true;
    eligibleMemberSearchDebounceTimer = setTimeout(async () => {
      try {
        const { data, error } = await useMyFetch('/api/residents/eligible-for-household-search', {
          query: { searchKey: newQuery.trim() },
        });
        if (error.value) {
          console.error("Error searching eligible members:", error.value);
        } else {
          eligibleMemberSearchResults.value = data.value?.searchResults || [];
        }
      } catch (e) { console.error("Exception searching members:", e); }
      finally { isLoadingEligibleMembers.value = false; }
    }, 500);
  } else { isLoadingEligibleMembers.value = false; }
});

const selectHouseholdMember = (member) => {
  if (member._id === residentId) {
    $toast.fire({ title: "Cannot add current resident to their own household.", icon: 'warning' });
    return;
  }
  if (!editableResident.value.household_members_details.find(m => m._id === member._id)) {
    editableResident.value.household_members_details.push({
        _id: member._id,
        first_name: member.first_name,
        last_name: member.last_name,
        middle_name: member.middle_name,
        sex: member.sex
    });
    if(!editableResident.value.household_member_ids.includes(member._id)){ // Keep IDs array in sync
        editableResident.value.household_member_ids.push(member._id);
    }
  } else {
     $toast.fire({ title: "Member already added.", icon: 'info' });
  }
  householdMemberSearchQuery.value = "";
  eligibleMemberSearchResults.value = [];
};

const removeHouseholdMember = (index) => {
  const removedMember = editableResident.value.household_members_details.splice(index, 1);
  if (removedMember && removedMember.length > 0) {
    const removedId = removedMember[0]._id;
    editableResident.value.household_member_ids = editableResident.value.household_member_ids.filter(id => id !== removedId);
  }
};


async function saveChanges() {
  saving.value = true;
  
  const payload = { ...editableResident.value };
  // Backend expects household_member_ids, not the detailed objects
  payload.household_member_ids = editableResident.value.household_members_details.map(m => m._id);
  delete payload.household_members_details; 

  // Base64 file handling: only send if a new file was selected, or if explicitly cleared
  if (residencyProofFileBase64.value) { // New file was uploaded
    payload.residency_proof_data = residencyProofFileBase64.value;
  } else if (residencyProofFile.value === null && editableResident.value.residency_proof_data === null) { // File was cleared by user
    payload.residency_proof_data = null;
  } else { // No change or original value should be kept (backend handles this)
    delete payload.residency_proof_data; // Don't send if no change
  }

  if (voterProofFileBase64.value) {
    payload.voter_registration_proof_data = voterProofFileBase64.value;
  } else if (voterProofFile.value === null && editableResident.value.voter_registration_proof_data === null) {
    payload.voter_registration_proof_data = null;
  } else {
    delete payload.voter_registration_proof_data;
  }
  
  payload.is_pwd = Boolean(payload.is_pwd);
  payload.is_registered_voter = Boolean(payload.is_registered_voter);
  payload.is_household_head = Boolean(payload.is_household_head);
  
  payload.age = payload.age ? parseInt(payload.age) : null;
  payload.years_lived_current_address = payload.years_lived_current_address ? parseInt(payload.years_lived_current_address) : null;

  if (!payload.is_household_head) {
    payload.household_member_ids = []; // Clear members if not a head
  }

  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentId}`, {
      method: 'PUT',
      body: payload,
    });

    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.error || 'Failed to update resident', icon: 'error' });
    } else {
      $toast.fire({ title: 'Resident updated successfully', icon: 'success' });
      await fetchResidentDetails(); // Re-fetch to get the latest state
      toggleEditMode(false);
    }
  } catch (e) {
    console.error('Exception saving resident:', e);
    $toast.fire({ title: 'An error occurred while saving', icon: 'error' });
  } finally {
    saving.value = false;
  }
}

function confirmDeleteResident() {
  deleteDialog.value = true;
}

async function deleteResident() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/residents/${residentId}`, {
      method: 'DELETE',
    });
    if (error.value) {
      $toast.fire({ title: 'Failed to delete resident', icon: 'error' });
    } else {
      $toast.fire({ title: 'Resident deleted successfully', icon: 'success' });
      router.push('/residents');
    }
  } catch (e) {
    console.error('Exception deleting resident:', e);
    $toast.fire({ title: 'An error occurred during deletion', icon: 'error' });
  } finally {
    deleting.value = false;
    deleteDialog.value = false;
  }
}

// Watchers for conditional logic
watch(() => editableResident.value.is_registered_voter, (newValue, oldValue) => {
  if (editMode.value && newValue === false && oldValue === true) {
    editableResident.value.precinct_number = "";
    editableResident.value.voter_registration_proof_data = null;
    voterProofFile.value = null; // Clear v-file-input model
    voterProofFileBase64.value = '';
    voterProofFilePreviewName.value = '';
  }
});

watch(() => editableResident.value.is_household_head, (newValue, oldValue) => {
  if (editMode.value && newValue === false && oldValue === true) {
    // If changing from head to not a head, clear existing members in edit state
    editableResident.value.household_member_ids = [];
    editableResident.value.household_members_details = [];
    householdMemberSearchQuery.value = "";
    eligibleMemberSearchResults.value = [];
  } else if (editMode.value && newValue === true && residentData.value.is_household_head === false) {
    // If changing from not a head to a head, editable list starts empty
    editableResident.value.household_member_ids = [];
    editableResident.value.household_members_details = [];
  }
});

</script>

<style scoped>
.bordered-image {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f9f9f9;
}
.v-label.text-subtitle-2 {
    font-weight: 500;
}
.v-file-input + small { 
    margin-top: 4px;
    display: block;
}
</style>