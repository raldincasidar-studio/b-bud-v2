<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '~/composables/useMyFetch'; // Assuming Nuxt 3 path
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const residentId = route.params.id;

const residentData = ref({}); // Original data from API (read-only display source)
const editableResident = ref({ // Data for editing form
  household_member_ids: [],
  household_members_details: [],
  status: 'Pending',
  newPassword: '',
  confirmNewPassword: '',
  // Initialize all fields to prevent undefined errors in template before data load
  first_name: '', middle_name: null, last_name: '', sex: null, date_of_birth: '', age: null,
  civil_status: null, occupation_status: null, place_of_birth: '', citizenship: '',
  is_pwd: false, contact_number: '', email: '', is_registered_voter: false,
  precinct_number: '', voter_registration_proof_data: null, address_house_number: '',
  address_street: '', address_subdivision_zone: '', address_city_municipality: 'Manila City',
  years_lived_current_address: null, residency_proof_data: null, is_household_head: false,
});

const loading = ref(true);
const errorLoading = ref(false);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const deleteDialog = ref(false);

// File uploads: v-model for v-file-input will be these FileModel refs
const residencyProofFileModel = ref(null); // Holds File[] or null for v-file-input's v-model
const residencyProofFileBase64 = ref('');   // For temporary Base64 storage during processing
const residencyProofFilePreviewName = ref('');// For display of new file name

const voterProofFileModel = ref(null);     // Holds File[] or null for v-file-input's v-model
const voterProofFileBase64 = ref('');      // For temporary Base64 storage
const voterProofFilePreviewName = ref('');   // For display of new file name

// Household member search (for edit mode)
const householdMemberSearchQuery = ref("");
const eligibleMemberSearchResults = ref([]);
const isLoadingEligibleMembers = ref(false);
let eligibleMemberSearchDebounceTimer = null;

// --- Constants for Selects ---
const GENDER_OPTIONS = ['Male', 'Female', 'Other']; // Added 'Other' back
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const OCCUPATION_STATUS_OPTIONS = [
  'Employed', 'Unemployed', 'Student', 'Retired',
  'Labor force', 'Out of School Youth', 'Other'
];
const YES_NO_OPTIONS = [{ title: 'No', value: false }, { title: 'Yes', value: true }];
const STATUS_OPTIONS_EDIT = ['Approved', 'Pending', 'Declined', 'Deactivated'];

onMounted(async () => {
  await fetchResidentDetails();
});

const calculatedEditableAge = computed(() => {
  if (!editableResident.value.date_of_birth) return null;
  const birthDate = new Date(editableResident.value.date_of_birth);
  const today = new Date();
  if (isNaN(birthDate.getTime())) return null;
  let localAge = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    localAge--;
  }
  return localAge >= 0 ? localAge : null;
});

watch(() => editableResident.value.date_of_birth, (newVal) => {
  if (editMode.value && newVal) {
    editableResident.value.age = calculatedEditableAge.value;
  }
});

async function fetchResidentDetails() {
  loading.value = true; errorLoading.value = false;
  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentId}`);
    if (error.value || !data.value?.resident) {
      console.error('Failed to fetch resident details:', error.value);
      errorLoading.value = true; residentData.value = {};
      editableResident.value = {
        status: 'Pending', household_member_ids: [], household_members_details: [],
        newPassword: '', confirmNewPassword: '', first_name: '', middle_name: null, last_name: '',
        sex: null, date_of_birth: '', age: null, civil_status: null, occupation_status: null,
        place_of_birth: '', citizenship: '', is_pwd: false, contact_number: '', email: '',
        is_registered_voter: false, precinct_number: '', voter_registration_proof_data: null,
        address_house_number: '', address_street: '', address_subdivision_zone: '',
        address_city_municipality: 'Manila City', years_lived_current_address: null,
        residency_proof_data: null, is_household_head: false,
      };
    } else {
      const fetched = data.value.resident;
      if (fetched.date_of_birth) {
        fetched.date_of_birth = new Date(fetched.date_of_birth).toISOString().split('T')[0];
      }
      if (!fetched.age && fetched.date_of_birth) {
          const birthDate = new Date(fetched.date_of_birth);
          const today = new Date();
          let ageCalc = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) ageCalc--;
          fetched.age = ageCalc >=0 ? ageCalc : null;
      }
      residentData.value = { ...fetched };
      if (residentData.value.is_household_head && residentData.value.household_member_ids?.length > 0) {
         await fetchAndAssignHouseholdMemberDetails(residentData.value.household_member_ids);
      } else {
         if(residentData.value) residentData.value.household_members_details = [];
      }
      resetEditableData();
    }
  } catch (e) {
    console.error('Exception fetching resident:', e);
    errorLoading.value = true; residentData.value = {};
     editableResident.value = { // Ensure full initialization on error
        status: 'Pending', household_member_ids: [], household_members_details: [],
        newPassword: '', confirmNewPassword: '', first_name: '', middle_name: null, last_name: '',
        sex: null, date_of_birth: '', age: null, civil_status: null, occupation_status: null,
        place_of_birth: '', citizenship: '', is_pwd: false, contact_number: '', email: '',
        is_registered_voter: false, precinct_number: '', voter_registration_proof_data: null,
        address_house_number: '', address_street: '', address_subdivision_zone: '',
        address_city_municipality: 'Manila City', years_lived_current_address: null,
        residency_proof_data: null, is_household_head: false,
      };
  } finally { loading.value = false; }
}

async function fetchAndAssignHouseholdMemberDetails(memberIds) {
  if (!memberIds || memberIds.length === 0) {
    if(residentData.value) residentData.value.household_members_details = [];
    if (editableResident.value) editableResident.value.household_members_details = [];
    return;
  }
  try {
    const memberDetailsPromises = memberIds.map(id =>
      useMyFetch(`/api/residents/${id}`).then(res => res.data.value?.resident)
    );
    const resolvedMembers = (await Promise.all(memberDetailsPromises)).filter(member => member != null);
    const memberDetailsData = resolvedMembers.map(m => ({
        _id: m._id, first_name: m.first_name, last_name: m.last_name,
        middle_name: m.middle_name || '', sex: m.sex
    }));

    if(residentData.value) residentData.value.household_members_details = memberDetailsData;
    // This will be copied to editableResident in resetEditableData or when edit mode is toggled
  } catch (e) {
    console.error("Failed to fetch household member details:", e);
    if(residentData.value) residentData.value.household_members_details = [];
    if(editableResident.value) editableResident.value.household_members_details = [];
  }
}

function resetEditableData() {
  // Deep copy from residentData (which now includes fetched household_members_details)
  editableResident.value = JSON.parse(JSON.stringify(residentData.value));

  // Ensure arrays and default values are correctly initialized if not in source
  if (!editableResident.value.household_members_details) editableResident.value.household_members_details = [];
  if (!editableResident.value.household_member_ids) editableResident.value.household_member_ids = [];
  if (!editableResident.value.status) editableResident.value.status = 'Pending';

  // Reset file input models and their associated state
  residencyProofFileModel.value = null; // This clears the v-file-input
  residencyProofFileBase64.value = '';   // Clear temp base64
  residencyProofFilePreviewName.value = '';// Clear preview name

  voterProofFileModel.value = null;     // This clears the v-file-input
  voterProofFileBase64.value = '';      // Clear temp base64
  voterProofFilePreviewName.value = '';   // Clear preview name

  // Clear password change fields
  editableResident.value.newPassword = '';
  editableResident.value.confirmNewPassword = '';

  // Clear household member search state
  householdMemberSearchQuery.value = "";
  eligibleMemberSearchResults.value = [];
}

function toggleEditMode(enable) {
  editMode.value = enable;
  if (enable) {
    resetEditableData(); // Populate form with current data and reset file inputs
  }
}

function cancelEdit() {
  toggleEditMode(false);
  resetEditableData(); // Revert to original data, including clearing any staged file changes
}

const isImage = (base64String) => base64String && typeof base64String === 'string' && base64String.startsWith('data:image');
const convertFileToBase64Util = (file) => { return new Promise((resolve, reject) => { if (!file) { resolve(""); return; } const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); };

// Corrected File Upload Handler for [id].vue
const handleFileUploadUpdate = async (newFileModelValue, type) => {
  const actualFile = newFileModelValue && newFileModelValue.size > 0 ? newFileModelValue : null;

  let targetBase64Ref, targetNameRef, editableProofDataField, targetFileModelForResetOnError;

  if (type === 'residency') {
    targetBase64Ref = residencyProofFileBase64;
    targetNameRef = residencyProofFilePreviewName;
    editableProofDataField = 'residency_proof_data';
    targetFileModelForResetOnError = residencyProofFileModel;
  } else if (type === 'voter') {
    targetBase64Ref = voterProofFileBase64;
    targetNameRef = voterProofFilePreviewName;
    editableProofDataField = 'voter_registration_proof_data';
    targetFileModelForResetOnError = voterProofFileModel;
  } else {
    return;
  }


  if (!actualFile) { // File was cleared from v-file-input
    targetBase64Ref.value = '';
    targetNameRef.value = '';
    editableResident.value[editableProofDataField] = null; // Mark data for removal/nullification
    return;
  }

  try {
    targetBase64Ref.value = await convertFileToBase64Util(actualFile);
    targetNameRef.value = actualFile.name;
    editableResident.value[editableProofDataField] = targetBase64Ref.value; // Should set 

    console.log('File upload: ', targetBase64Ref.value);
  } catch (error) {
    console.error(`Error converting ${type} proof to Base64:`, error);
    $toast.fire({ title: `Error processing ${type} proof file`, icon: 'error' });
    targetFileModelForResetOnError.value = null; // Reset v-file-input on error
    targetBase64Ref.value = "";
    targetNameRef.value = "";
    editableResident.value[editableProofDataField] = null; // Nullify data
  }
};

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
        if (error.value) console.error("Error searching eligible members:", error.value);
        else {
          eligibleMemberSearchResults.value = (data.value?.searchResults || [])
            .filter(member => member._id !== residentId);
        }
      } catch (e) { console.error("Exception searching members:", e); }
      finally { isLoadingEligibleMembers.value = false; }
    }, 500);
  } else isLoadingEligibleMembers.value = false;
});

const selectHouseholdMemberUpdate = (member) => {
  if (member._id === residentId) { $toast.fire({ title: "Cannot add self.", icon: 'warning' }); return; }
  if (!editableResident.value.household_members_details.find(m => m._id === member._id)) {
    editableResident.value.household_members_details.push({
        _id: member._id, first_name: member.first_name, last_name: member.last_name,
        middle_name: member.middle_name || '', sex: member.sex
    });
    if (!editableResident.value.household_member_ids.includes(member._id)) {
        editableResident.value.household_member_ids.push(member._id);
    }
  } else $toast.fire({ title: "Member already added.", icon: 'info' });
  householdMemberSearchQuery.value = ""; eligibleMemberSearchResults.value = [];
};

const removeHouseholdMemberUpdate = (index) => {
  const removedMember = editableResident.value.household_members_details.splice(index, 1);
  if (removedMember && removedMember.length > 0 && editableResident.value.household_member_ids) {
    editableResident.value.household_member_ids = editableResident.value.household_member_ids.filter(id => id !== removedMember[0]._id);
  }
};

async function saveChanges() {
  saving.value = true;
  const payload = { ...editableResident.value };

  if (payload.newPassword) {
    if (payload.newPassword !== payload.confirmNewPassword) {
      $toast.fire({ title: 'New passwords do not match!', icon: 'error' }); saving.value = false; return;
    }
    if (payload.newPassword.length < 6) {
      $toast.fire({ title: 'New password must be at least 6 characters long.', icon: 'error' }); saving.value = false; return;
    }
  } else {
    delete payload.newPassword;
  }
  delete payload.confirmNewPassword;

  if (payload.is_registered_voter) {
    let hasPrecinct = !!payload.precinct_number;
    let hasProof = !!payload.voter_registration_proof_data; // This holds new Base64 or original if not changed, or null if cleared
    if (!hasPrecinct && !hasProof) {
      $toast.fire({ title: "If registered voter, provide Voter's ID Number or upload Voter's ID.", icon: 'error' });
      saving.value = false; return;
    }
  } else {
    payload.precinct_number = null;
    payload.voter_registration_proof_data = null;
  }
  
  payload.household_member_ids = editableResident.value.household_members_details.map(m => m._id);
  delete payload.household_members_details;

  payload.is_pwd = Boolean(payload.is_pwd);
  payload.is_registered_voter = Boolean(payload.is_registered_voter);
  payload.is_household_head = Boolean(payload.is_household_head);
  if (!payload.is_household_head) {
    payload.household_member_ids = [];
  }

  payload.age = payload.age ? parseInt(payload.age) : null;
  payload.years_lived_current_address = payload.years_lived_current_address ? parseInt(payload.years_lived_current_address) : null;

  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentId}`, {
      method: 'PUT', body: payload,
    });
    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to update resident.', icon: 'error' });
    } else {
      $toast.fire({ title: 'Resident updated successfully!', icon: 'success' });
      await fetchResidentDetails();
      toggleEditMode(false);
    }
  } catch (e) {
    console.error('Exception saving resident:', e);
    $toast.fire({ title: 'An error occurred while saving.', icon: 'error' });
  } finally { saving.value = false; }
}

function confirmDeleteResident() { deleteDialog.value = true; }
async function deleteResident() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/residents/${residentId}`, { method: 'DELETE' });
    if (error.value) $toast.fire({ title: 'Failed to delete resident.', icon: 'error' });
    else {
      $toast.fire({ title: 'Resident deleted successfully.', icon: 'success' });
      router.push('/residents');
    }
  } catch (e) { $toast.fire({ title: 'Error during deletion.', icon: 'error' }); }
  finally { deleting.value = false; deleteDialog.value = false; }
}

watch(() => editableResident.value.is_registered_voter, (newValue) => {
  if (editMode.value && newValue === false) {
    editableResident.value.precinct_number = "";
    editableResident.value.voter_registration_proof_data = null;
    voterProofFileModel.value = null; // Clear v-file-input
    voterProofFileBase64.value = '';
    voterProofFilePreviewName.value = '';
  }
});
watch(() => editableResident.value.is_household_head, (newValue, oldValue) => {
  if (editMode.value && newValue === false && oldValue === true) {
    editableResident.value.household_member_ids = [];
    editableResident.value.household_members_details = [];
  } else if (editMode.value && newValue === true && (!residentData.value.is_household_head || oldValue === false) ) {
    // If changing from non-head to head, or if originally not head and now becoming head
    editableResident.value.household_member_ids = [];
    editableResident.value.household_members_details = [];
  }
});
</script>

<template>
  <v-container class="my-10">
    <div v-if="loading" class="text-center pa-10"><v-progress-circular indeterminate color="primary" size="64"></v-progress-circular><p class="mt-4">Loading resident details...</p></div>
    <div v-else-if="errorLoading || !residentData._id"><v-alert type="error" prominent border="start">Error loading resident details or resident not found. <v-btn color="primary" variant="text" to="/residents" class="ml-2">Go to List</v-btn></v-alert></div>

    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2>
            Resident: {{ residentData.first_name }} {{ residentData.last_name }}
            <v-chip v-if="residentData.is_household_head && !editMode" color="green" small class="ml-2" label>Head</v-chip>
            <v-chip v-if="!editMode" :color="residentData.status === 'Approved' ? 'success' : (residentData.status === 'Pending' ? 'orange' : (residentData.status === 'Declined' ? 'error' : 'grey'))" small class="ml-2" label>{{ residentData.status }}</v-chip>
          </h2>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2" variant="tonal">Edit</v-btn>
          <v-btn v-if="editMode" color="green" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" variant="tonal" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn v-if="!editMode" color="red" @click="confirmDeleteResident" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-form @submit.prevent="saveChanges">
        <!-- Personal Information Card -->
        <v-card class="mb-6" prepend-icon="mdi-card-account-details-outline" title="Personal Information">
          <v-card-text>
            <v-row>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.first_name" label="First Name*" :readonly="!editMode" variant="outlined" density="compact" required></v-text-field></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.middle_name" label="Middle Name" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.last_name" label="Last Name*" :readonly="!editMode" variant="outlined" density="compact" required></v-text-field></v-col>
            </v-row>
            <v-row>
                <v-col cols="12" sm="6" md="3"><v-select v-model="editableResident.sex" :items="GENDER_OPTIONS" label="Sex*" :readonly="!editMode" variant="outlined" density="compact" required></v-select></v-col>
                <v-col cols="12" sm="6" md="3"><v-text-field v-model="editableResident.date_of_birth" label="Date of Birth*" type="date" :readonly="!editMode" variant="outlined" density="compact" required></v-text-field></v-col>
                <v-col cols="12" sm="6" md="3"><v-text-field v-model.number="editableResident.age" label="Age (Auto-calculated)" type="number" readonly variant="outlined" density="compact" min="0"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="3"><v-select v-model="editableResident.civil_status" :items="CIVIL_STATUS_OPTIONS" label="Civil Status" :readonly="!editMode" variant="outlined" density="compact"></v-select></v-col>
            </v-row>
            <v-row>
                <v-col cols="12" sm="6" md="4"><v-select v-model="editableResident.occupation_status" :items="OCCUPATION_STATUS_OPTIONS" label="Occupation Status" :readonly="!editMode" variant="outlined" density="compact"></v-select></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.place_of_birth" label="Place of Birth" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.citizenship" label="Citizenship" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
            </v-row>
            <v-row>
                <v-col cols="12" sm="6" md="4"><v-select v-model="editableResident.is_pwd" :items="YES_NO_OPTIONS" item-title="title" item-value="value" label="PWD?" :readonly="!editMode" variant="outlined" density="compact"></v-select></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.contact_number" label="Contact Number" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                <v-col cols="12" sm="6" md="4"><v-text-field v-model="editableResident.email" label="Email Address*" type="email" :readonly="!editMode" variant="outlined" density="compact" required></v-text-field></v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6" prepend-icon="mdi-account-check-outline" title="Account Status">
            <v-card-text>
                <v-row>
                    <v-col cols="12" sm="6" md="4">
                        <v-select v-model="editableResident.status" :items="STATUS_OPTIONS_EDIT" label="Status" :readonly="!editMode" variant="outlined" density="compact"></v-select>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>

        <v-card class="mb-6" prepend-icon="mdi-map-marker-outline" title="Full Address">
            <v-card-text>
                 <v-row>
                    <v-col cols="12" sm="4"><v-text-field v-model="editableResident.address_house_number" label="House Number" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                    <v-col cols="12" sm="8"><v-text-field v-model="editableResident.address_street" label="Street" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="4"><v-text-field v-model="editableResident.address_subdivision_zone" label="Subdivision/Zone" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                    <v-col cols="12" sm="4"><v-text-field v-model="editableResident.address_city_municipality" label="City/Municipality" :readonly="!editMode" variant="outlined" density="compact"></v-text-field></v-col>
                    <v-col cols="12" sm="4"><v-text-field v-model.number="editableResident.years_lived_current_address" label="Years Lived Here" type="number" :readonly="!editMode" variant="outlined" density="compact" min="0"></v-text-field></v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" md="6">
                        <label class="v-label mb-1 text-subtitle-2">Proof of Residency</label>
                        <div v-if="!editMode && editableResident.residency_proof_data" class="mt-2">
                            <v-img v-if="isImage(editableResident.residency_proof_data)" :src="editableResident.residency_proof_data" max-height="200" contain class="mb-2 elevation-1 bordered-image"></v-img>
                            <a v-else :href="editableResident.residency_proof_data" target="_blank" class="mb-2 d-block">View Proof (Non-Image)</a>
                        </div>
                        <p v-if="!editMode && !editableResident.residency_proof_data" class="text-grey mt-2">No proof uploaded.</p>
                        
                        <v-file-input
                            v-if="editMode"
                            v-model="residencyProofFileModel"
                            @update:modelValue="newFiles => handleFileUploadUpdate(newFiles, 'residency')"
                            label="Change Proof of Residency" accept="image/*,application/pdf"
                            variant="outlined" density="compact" clearable
                            prepend-icon="" prepend-inner-icon="mdi-paperclip"
                            class="mt-2" show-size
                        ></v-file-input>
                        <small v-if="editMode && residencyProofFilePreviewName" class="d-block mt-1">New: {{ residencyProofFilePreviewName }}</small>
                        <small v-if="editMode && !residencyProofFileModel && editableResident.residency_proof_data && !residencyProofFilePreviewName" class="d-block mt-1 text-grey">Current proof exists. Upload new to replace or clear.</small>
                         <small v-if="editMode && !residencyProofFileModel && !editableResident.residency_proof_data && !residencyProofFilePreviewName" class="d-block mt-1 text-grey">No current proof. Upload new if needed.</small>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>

        <v-card class="mb-6" prepend-icon="mdi-vote-outline" title="Voter Information">
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="4">
                <v-select v-model="editableResident.is_registered_voter" :items="YES_NO_OPTIONS" item-title="title" item-value="value" label="Registered Voter?" :readonly="!editMode" variant="outlined" density="compact"></v-select>
              </v-col>
              <v-col v-if="editableResident.is_registered_voter" cols="12" sm="6" md="4">
                <v-text-field v-model="editableResident.precinct_number" label="Voter's ID Number (Optional if ID uploaded)" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>
            <v-row v-if="editableResident.is_registered_voter">
              <v-col cols="12" md="6">
                <label class="v-label mb-1 text-subtitle-2">Proof of Voter's Reg. (Optional if Voter's ID Number provided)</label>
                <div v-if="!editMode && editableResident.voter_registration_proof_data" class="mt-2">
                    <v-img v-if="isImage(editableResident.voter_registration_proof_data)" :src="editableResident.voter_registration_proof_data" max-height="200" contain class="mb-2 elevation-1 bordered-image"></v-img>
                    <a v-else :href="editableResident.voter_registration_proof_data" target="_blank" class="mb-2 d-block">View Proof (Non-Image)</a>
                </div>
                <p v-if="!editMode && !editableResident.voter_registration_proof_data && editableResident.is_registered_voter" class="text-grey mt-2">No proof uploaded.</p>
                
                <v-file-input
                    v-if="editMode"
                    v-model="voterProofFileModel"
                    @update:modelValue="newFiles => handleFileUploadUpdate(newFiles, 'voter')"
                    label="Change Voter Proof" accept="image/*,application/pdf"
                    variant="outlined" density="compact" clearable
                    prepend-icon="" prepend-inner-icon="mdi-paperclip"
                    class="mt-2" show-size
                ></v-file-input>
                 <small v-if="editMode && voterProofFilePreviewName" class="d-block mt-1">New: {{ voterProofFilePreviewName }}</small>
                 <small v-if="editMode && !voterProofFileModel && editableResident.voter_registration_proof_data && !voterProofFilePreviewName" class="d-block mt-1 text-grey">Current proof exists. Upload new to replace or clear.</small>
                 <small v-if="editMode && !voterProofFileModel && !editableResident.voter_registration_proof_data && !voterProofFilePreviewName" class="d-block mt-1 text-grey">No current proof. Upload new if needed.</small>
                 <small v-if="editMode && editableResident.is_registered_voter && !editableResident.precinct_number && !voterProofFileModel && !editableResident.voter_registration_proof_data" class="text-error d-block mt-1">
                    If voter, provide Voter's ID Number or upload ID.
                 </small>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card v-if="editMode" class="mb-6" prepend-icon="mdi-lock-reset" title="Change Password">
            <v-card-text>
                <v-alert type="info" density="compact" class="mb-4" variant="tonal">Only fill these fields if you want to change the password.</v-alert>
                <v-row>
                    <v-col cols="12" sm="6"><v-text-field v-model="editableResident.newPassword" label="New Password" type="password" variant="outlined" density="compact" hint="Min. 6 characters"></v-text-field></v-col>
                    <v-col cols="12" sm="6"><v-text-field v-model="editableResident.confirmNewPassword" label="Confirm New Password" type="password" variant="outlined" density="compact"></v-text-field></v-col>
                </v-row>
            </v-card-text>
        </v-card>

        <v-card class="mb-6" prepend-icon="mdi-home-group" title="Household Information">
            <v-card-text>
                <v-row>
                    <v-col cols="12" sm="6" md="4">
                        <v-select v-model="editableResident.is_household_head" :items="YES_NO_OPTIONS" item-title="title" item-value="value" label="Is Household Head?" :readonly="!editMode" variant="outlined" density="compact"></v-select>
                    </v-col>
                </v-row>
                <div v-if="editableResident.is_household_head">
                    <div v-if="editMode">
                        <v-row class="mt-4"><v-col cols="12"><v-text-field v-model="householdMemberSearchQuery" prepend-inner-icon="mdi-magnify" variant="outlined" color="primary" label="Search & Add Eligible Members" placeholder="Search..." clearable @click:clear="eligibleMemberSearchResults = []" :loading="isLoadingEligibleMembers" density="compact" class="mb-2"></v-text-field></v-col></v-row>
                        <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length > 0">
                            <v-col cols="12"><v-list density="compact" lines="one" class="elevation-1"><v-list-subheader>Eligible (Click to add)</v-list-subheader><v-list-item v-for="member in eligibleMemberSearchResults" :key="member._id" @click="selectHouseholdMemberUpdate(member)" :title="`${member.first_name} ${member.middle_name || ''} ${member.last_name}`" ripple><template v-slot:prepend><v-icon color="green">mdi-account-plus-outline</v-icon></template><v-list-item-subtitle v-if="member.sex">Sex: {{ member.sex }}</v-list-item-subtitle></v-list-item></v-list></v-col>
                        </v-row>
                        <v-row v-if="householdMemberSearchQuery && householdMemberSearchQuery.trim().length >= 2 && !isLoadingEligibleMembers && eligibleMemberSearchResults.length === 0"><v-col cols="12"><p class="text-grey text-center pa-2">No eligible residents found.</p></v-col></v-row>
                    </div>
                    <v-row class="mt-6">
                        <v-col cols="12">
                            <h4 class="mb-2 text-subtitle-1">Household Members:</h4>
                            <v-alert v-if="!editMode && (!editableResident.household_members_details || editableResident.household_members_details.length === 0)" type="info" density="compact" class="mb-2">No household members listed.</v-alert>
                            <v-table v-else-if="editableResident.household_members_details && editableResident.household_members_details.length > 0" density="compact">
                                <thead><tr><th class="text-left">Name</th><th class="text-left">Gender</th><th class="text-left" v-if="editMode">Action</th></tr></thead>
                                <tbody>
                                    <tr v-for="(member, index) in editableResident.household_members_details" :key="member._id || index">
                                        <td>{{ member.first_name }} {{ member.middle_name || '' }} {{ member.last_name }}</td><td>{{ member.sex }}</td>
                                        <td v-if="editMode"><v-btn icon="mdi-account-minus-outline" variant="text" color="red" size="small" @click="removeHouseholdMemberUpdate(index)" title="Remove member"></v-btn></td>
                                    </tr>
                                </tbody>
                            </v-table>
                             <p v-else-if="editMode" class="text-grey text-center py-5">No members added yet.</p>
                        </v-col>
                    </v-row>
                </div>
                <p v-else-if="!editableResident.is_household_head && !editMode" class="mt-2 text-grey">This resident is not a household head.</p>
                 <p v-else-if="!editableResident.is_household_head && editMode" class="mt-2 text-grey">Mark as household head to add members.</p>
            </v-card-text>
        </v-card>

        <!-- Action buttons are at the top, no need for a duplicate submit button here -->
      </v-form>
    </div>

    <v-dialog v-model="deleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>Are you sure you want to delete resident: <strong>{{ residentData.first_name }} {{ residentData.last_name }}</strong>? This action cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteResident" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.bordered-image { border: 1px solid #e0e0e0; border-radius: 4px; background-color: #f9f9f9; }
.v-label.text-subtitle-2 { font-weight: 500; }
.v-file-input + small { margin-top: 4px; display: block; }
</style>