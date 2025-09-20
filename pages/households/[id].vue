<script setup>
import { reactive, ref, onMounted, watch, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';
import { required, helpers, numeric, email, minLength, requiredIf } from '@vuelidate/validators'; // Added new validators
import { useVuelidate } from '@vuelidate/core';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const householdId = ref(null); // This will be the _id of the head resident
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

// --- New State for Proof Viewer Dialog ---
const proofViewerDialog = ref(false);
const currentProofSrc = ref('');
const currentProofTitle = ref('');

// --- New State for Add New Member Modal ---
const showNewMemberModal = ref(false);
const newMemberForm = reactive({
  first_name: '', middle_name: '', last_name: '', suffix: null,
  relationship_to_head: null, other_relationship: '', // Specific for member
  sex: null, date_of_birth: '', civil_status: null, citizenship: 'Filipino',
  occupation_status: null, contact_number: '', // Removed email
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null,
  proof_of_relationship_file: null // Specific for member
});
const newMemberVoterIdPreviewUrl = ref(null);
const newMemberPwdCardPreviewUrl = ref(null);
const newMemberSeniorCardPreviewUrl = ref(null);
const newMemberRelationshipProofPreviewUrl = ref(null);
const savingNewMember = ref(false);


const form = reactive({
  // Household-level details (from the head resident's document)
  household_name: '',
  household_number: '',
  address_unit_room_apt_number: '',
  address_house_number: '',
  address_street: '',
  address_subdivision_zone: '',
  type_of_household: null,

  // Head Resident's core display info (mostly read-only)
  head_id: '',
  head_first_name: '',
  head_middle_name: '',
  head_last_name: '',
  head_suffix: null,
  head_gender: '',
  head_date_of_birth: '',
  head_civil_status: '',
  head_contact_number: '',
  head_email: '',
  head_occupation: '',
  head_is_voter: false,
  head_status: '',

  // Household members (including the head)
  members: [],

  // Original state for cancelEdit
  originalMembers: [],
});

const originalFormState = ref({});

const householdTypeOptions = ['Owner', 'Tenant/Border', 'Sharer'];
const suffixOptions = ['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const relationshipOptions = [
  'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother',
  'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Nephew', 'Niece', 'In-law',
  'Household Help / Kasambahay', 'Other'
];

// --- Vuelidate Rules for editable fields (household details) ---
const rules = computed(() => ({
  address_house_number: { required: helpers.withMessage('House number is required', required) },
  address_street: { required: helpers.withMessage('Street is required', required) },
  address_subdivision_zone: { required: helpers.withMessage('Subdivision/Zone is required', required) },
  type_of_household: { required: helpers.withMessage('Type of household is required', required) },
}));

const v$ = useVuelidate(rules, form);

// --- Vuelidate Rules for New Member Form (modal) ---
const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  let age = new Date().getFullYear() - birthDate.getFullYear();
  const m = new Date().getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
};
const newMemberAge = computed(() => calculateAge(newMemberForm.date_of_birth));
const isNewMemberSenior = computed(() => newMemberAge.value !== null && newMemberAge.value >= 60);

const dateOfBirthValidation = {
  required,
  minValue: helpers.withMessage('Date of birth cannot be more than 100 years ago.', (value) => {
    if (!value) return true;
    const hundredYearsAgo = new Date();
    hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
    return new Date(value) >= hundredYearsAgo;
  }),
  maxValue: helpers.withMessage('Date of birth cannot be in the future.', (value) => {
    if (!value) return true;
    return new Date(value) <= new Date();
  })
};

const newMemberRules = computed(() => ({
  first_name: { required: helpers.withMessage('First Name is required.', required) },
  last_name: { required: helpers.withMessage('Last Name is required.', required) },
  sex: { required: helpers.withMessage('Sex is required.', required) },
  date_of_birth: dateOfBirthValidation,
  civil_status: { required: helpers.withMessage('Civil Status is required.', required) },
  citizenship: { required: helpers.withMessage('Citizenship is required.', required) },
  occupation_status: { required: helpers.withMessage('Occupation Status is required.', required) },
  relationship_to_head: { required: helpers.withMessage('Relationship to Head is required.', required) },
  other_relationship: {
    requiredIf: helpers.withMessage('Please specify the relationship.', requiredIf(() => newMemberForm.relationship_to_head === 'Other'))
  },
  proof_of_relationship_file: { required: helpers.withMessage('Proof of Relationship is required.', required) },
  contact_number: { numeric: helpers.withMessage('Must be a valid contact number (digits only).', numeric), minLength: helpers.withMessage('Contact Number must be 11 digits.', minLength(11)) },
  is_voter: {},
  voter_id_number: {
    requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf((value) => newMemberForm.is_voter && !newMemberForm.voter_id_file))
  },
  voter_id_file: {
    requiredIf: helpers.withMessage("Voter's ID Card or Number is required.", requiredIf((value) => newMemberForm.is_voter && !newMemberForm.voter_id_number))
  },
  is_pwd: {},
  pwd_id: {
    requiredIf: helpers.withMessage('PWD ID Number or Card is required.', requiredIf((value) => newMemberForm.is_pwd && !newMemberForm.pwd_card_file))
  },
  pwd_card_file: {
    requiredIf: helpers.withMessage('PWD Card or ID Number is required.', requiredIf((value) => newMemberForm.is_pwd && !newMemberForm.pwd_id))
  },
  is_senior_citizen: {},
  senior_citizen_id: {
    requiredIf: helpers.withMessage('Senior Citizen ID Number or Card is required.', requiredIf((value) => newMemberForm.is_senior_citizen && !newMemberForm.senior_citizen_card_file && isNewMemberSenior.value))
  },
  senior_citizen_card_file: {
    requiredIf: helpers.withMessage('Senior Citizen Card or ID Number is required.', requiredIf((value) => newMemberForm.is_senior_citizen && !newMemberForm.senior_citizen_id && isNewMemberSenior.value))
  },
}));

const vNewMember$ = useVuelidate(newMemberRules, newMemberForm);


// --- Helper Functions ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) {
    console.error("Error formatting date:", e);
    return 'Invalid Date';
  }
};

const getStatusColor = (s) => ({ 'Approved': 'success', 'Pending': 'warning', 'Declined': 'error', 'Deactivated': 'grey' }[s] || 'default');

// --- Functions for Proof Viewer Dialog ---
const openProofViewer = (proofSrc, memberName) => {
  if (!proofSrc) {
    $toast.fire({ title: 'No proof available.', icon: 'info' });
    return;
  }
  currentProofSrc.value = proofSrc;
  currentProofTitle.value = `Proof of Relationship for ${memberName}`;
  proofViewerDialog.value = true;
};

// --- File Handling for New Member Modal ---
const urlCreator = (file) => file ? URL.createObjectURL(file) : null;
const urlRevoker = (url) => { if (url) URL.revokeObjectURL(url); };

watch(() => newMemberForm.voter_id_file, (newFile, oldFile) => {
  urlRevoker(newMemberVoterIdPreviewUrl.value);
  newMemberVoterIdPreviewUrl.value = urlCreator(newFile);
});
watch(() => newMemberForm.pwd_card_file, (newFile, oldFile) => {
  urlRevoker(newMemberPwdCardPreviewUrl.value);
  newMemberPwdCardPreviewUrl.value = urlCreator(newFile);
});
watch(() => newMemberForm.senior_citizen_card_file, (newFile, oldFile) => {
  urlRevoker(newMemberSeniorCardPreviewUrl.value);
  newMemberSeniorCardPreviewUrl.value = urlCreator(newFile);
});
watch(() => newMemberForm.proof_of_relationship_file, (newFile, oldFile) => {
  urlRevoker(newMemberRelationshipProofPreviewUrl.value);
  newMemberRelationshipProofPreviewUrl.value = urlCreator(newFile);
});

// --- Fetching Data ---
const fetchHouseholdData = async () => {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/residents/${householdId.value}/household-details`);

    if (error.value || data?.value?.error) {
      $toast.fire({
        title: data?.value?.error || 'Error fetching household data.',
        icon: 'error',
      });
      router.push('/households');
      return;
    }

    const headResident = data.value.resident;
    const householdMembers = data.value.householdMembers || [];

    if (!headResident || !headResident.is_household_head) {
      $toast.fire({ title: 'Resident is not a household head or household not found.', icon: 'error' });
      router.push('/households');
      return;
    }

    // Populate form with head's data
    form.head_id = headResident._id;
    form.head_first_name = headResident.first_name || '';
    form.head_middle_name = headResident.middle_name || '';
    form.head_last_name = headResident.last_name || '';
    form.head_suffix = headResident.suffix || null;
    form.head_gender = headResident.sex || '';
    form.head_date_of_birth = headResident.date_of_birth || '';
    form.head_civil_status = headResident.civil_status || '';
    form.head_contact_number = headResident.contact_number || '';
    form.head_email = headResident.email || '';
    form.head_occupation = headResident.occupation_status || '';
    form.head_is_voter = headResident.is_voter || false;
    form.head_status = headResident.status || '';

    form.household_name = `${form.head_first_name} ${form.head_last_name} Household`;
    form.household_number = headResident.address_house_number || 'N/A';
    form.address_unit_room_apt_number = headResident.address_unit_room_apt_number || '';
    form.address_house_number = headResident.address_house_number || '';
    form.address_street = headResident.address_street || '';
    form.address_subdivision_zone = headResident.address_subdivision_zone || '';
    form.type_of_household = headResident.type_of_household || null;

    // Populate members list with robust name handling and new fields
    form.members = householdMembers.map(member => {
      const firstName = member.first_name || '';
      // Add a space only if middle name exists
      const middleName = member.middle_name ? member.middle_name + ' ' : '';
      const lastName = member.last_name || '';
      const suffix = member.suffix ? ' ' + member.suffix : '';
      const fullName = `${firstName} ${middleName}${lastName}${suffix}`.trim(); // Add space after first name

      return {
        _id: member._id,
        name: fullName,
        gender: member.sex || '', // Changed to member.sex for consistency, kept gender for backward compatibility
        isHead: member._id === form.head_id,
        relationship_to_head: member.relationship_to_head || '', // Assuming this comes from backend
        proof_of_relationship_base64: member.proof_of_relationship_base64 || '', // Assuming this comes from backend
        ...member // Spread other properties
      };
    });

    // Store a copy for cancel functionality
    originalFormState.value = {
      address_unit_room_apt_number: form.address_unit_room_apt_number,
      address_house_number: form.address_house_number,
      address_street: form.address_street,
      address_subdivision_zone: form.address_subdivision_zone,
      type_of_household: form.type_of_household,
      members: JSON.parse(JSON.stringify(form.members)),
    };

  } catch (error) {
    console.error("Error fetching household:", error);
    $toast.fire({
      title: 'An unexpected error occurred while fetching household data.',
      icon: 'error',
    });
    router.push('/households');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  householdId.value = route.params.id;
  if (householdId.value) {
    await fetchHouseholdData();
  } else {
    $toast.fire({ title: 'Invalid household ID.', icon: 'error' });
    router.push('/households');
  }
});

// --- Managing Members (removed search, now uses modal) ---

const removeMember = (memberId) => {
  if (memberId === form.head_id) {
    $toast.fire({ title: 'Cannot remove the household head. A household must have a head.', icon: 'warning' });
    return;
  }
  if (confirm('Are you sure you want to remove this member from the household?')) {
    form.members = form.members.filter(member => member._id !== memberId);
    $toast.fire({ title: 'Member removed. Remember to save changes!', icon: 'info' });
  }
};

// --- Actions (Save, Cancel, Delete) ---
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (typeof file === 'string' && file.startsWith('data:')) {
      resolve(file);
      return;
    }
    if (!(file instanceof File || file instanceof Blob)) {
        console.warn('Attempted to convert non-File/Blob object to base64:', file);
        resolve(null);
        return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const saveHousehold = async () => {
  const result = await v$.value.$validate();
  if (!result) {
    $toast.fire({ title: 'Please correct household information errors.', icon: 'error' });
    return;
  }

  saving.value = true;
  const memberIds = form.members.map(member => member._id);

  if (!memberIds.includes(form.head_id)) {
    $toast.fire({ title: 'The household head must be included in the member list.', icon: 'error' });
    saving.value = false;
    return;
  }

  const payload = {
    address_unit_room_apt_number: form.address_unit_room_apt_number,
    address_house_number: form.address_house_number,
    address_street: form.address_street,
    address_subdivision_zone: form.address_subdivision_zone,
    type_of_household: form.type_of_household,
    household_member_ids: memberIds,
  };

  try {
    const { data, error } = await useMyFetch(`/api/residents/${householdId.value}`, {
      method: 'PUT',
      body: payload,
    });

    if (error.value || data?.value?.error) {
      return $toast.fire({
        title: data?.value?.error || 'Something went wrong updating the household.',
        icon: 'error',
      });
    }

    $toast.fire({
      title: data?.value?.message || 'Household updated successfully!',
      icon: 'success',
    });
    editMode.value = false;
    await fetchHouseholdData(); // Re-fetch to ensure UI is consistent with backend
  } catch (error) {
    console.error("Error saving household:", error);
    $toast.fire({
      title: 'An unexpected error occurred while saving the household.',
      icon: 'error',
    });
  } finally {
    saving.value = false;
  }
};

const cancelEdit = () => {
  form.address_unit_room_apt_number = originalFormState.value.address_unit_room_apt_number;
  form.address_house_number = originalFormState.value.address_house_number;
  form.address_street = originalFormState.value.address_street;
  form.address_subdivision_zone = originalFormState.value.address_subdivision_zone;
  form.type_of_household = originalFormState.value.type_of_household;
  form.members = JSON.parse(JSON.stringify(originalFormState.value.members));

  editMode.value = false;
  v$.value.$reset();
};

const deleteHousehold = async () => {
  if (!householdId.value) return;

  if (confirm('Are you sure you want to delete this household? This action will remove the head resident and all household relationships. Individual member profiles will still exist as standalone residents.')) {
    deleting.value = true;
    try {
      const { data, error } = await useMyFetch(`/api/residents/${householdId.value}`, {
        method: 'DELETE',
      });

      if (error.value || data?.value?.error) {
        return $toast.fire({
          title: data?.value?.error || 'Something went wrong while deleting household',
          icon: 'error',
        });
      }

      $toast.fire({
        title: data?.value?.message || 'Household deleted successfully',
        icon: 'success',
      });
      router.push('/households');
    } catch (error) {
      console.error("Error deleting household:", error);
      $toast.fire({
        title: 'An unexpected error occurred while deleting the household',
        icon: 'error',
      });
    } finally {
      deleting.value = false;
      confirmDeleteDialog.value = false;
    }
  }
};

// Computed property to easily get the head's display name
const householdHeadDisplayName = computed(() => {
  const firstName = form.head_first_name || '';
  const middleName = form.head_middle_name ? form.head_middle_name + ' ' : ''; // Ensure space after middle name
  const lastName = form.head_last_name || '';
  const suffix = form.head_suffix ? ' ' + form.head_suffix : '';
  return `${firstName} ${middleName}${lastName}${suffix}`.trim(); // Add space after first name
});


// --- New Member Modal Functions ---
const getInitialNewMemberForm = () => ({
  first_name: '', middle_name: '', last_name: '', suffix: null,
  relationship_to_head: null, other_relationship: '',
  sex: null, date_of_birth: '', civil_status: null, citizenship: 'Filipino',
  occupation_status: null, contact_number: '', // Removed email
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null,
  proof_of_relationship_file: null
});

const openNewMemberModal = () => {
  Object.assign(newMemberForm, getInitialNewMemberForm());
  // Clear previews
  urlRevoker(newMemberVoterIdPreviewUrl.value); newMemberVoterIdPreviewUrl.value = null;
  urlRevoker(newMemberPwdCardPreviewUrl.value); newMemberPwdCardPreviewUrl.value = null;
  urlRevoker(newMemberSeniorCardPreviewUrl.value); newMemberSeniorCardPreviewUrl.value = null;
  urlRevoker(newMemberRelationshipProofPreviewUrl.value); newMemberRelationshipProofPreviewUrl.value = null;

  showNewMemberModal.value = true;
  editMode.value = true; // Automatically enter edit mode when adding a member
};

const closeNewMemberModal = () => {
  showNewMemberModal.value = false;
  vNewMember$.value.$reset();
};

const saveNewMemberToHousehold = async () => {
  const result = await vNewMember$.value.$validate();
  if (!result) {
    $toast.fire({ title: 'Please correct all errors for the new member.', icon: 'error' });
    return;
  }
  if (newMemberAge.value < 0) {
    $toast.fire({ title: 'Date of birth cannot be in the future.', icon: 'error' });
    return;
  }

  savingNewMember.value = true;

  try {
    const newMemberPayload = { ...newMemberForm };

    // Inject dummy email and password to satisfy backend /api/admin/residents validation
    newMemberPayload.email = `dummy-member-${Date.now()}@example.com`;
    newMemberPayload.password = `TempPassword123!`; // A simple placeholder password

    newMemberPayload.age = newMemberAge.value;
    newMemberPayload.status = 'Approved'; // Admin endpoint approves directly
    newMemberPayload.date_created = new Date();
    newMemberPayload.date_updated = new Date();
    newMemberPayload.date_approved = new Date(); // Set approval date

    // Address info copied from household head's address
    newMemberPayload.address_unit_room_apt_number = form.address_unit_room_apt_number;
    newMemberPayload.address_house_number = form.address_house_number;
    newMemberPayload.address_street = form.address_street;
    newMemberPayload.address_subdivision_zone = form.address_subdivision_zone;
    newMemberPayload.address_city_municipality = 'Manila City'; // Assuming this is fixed from head
    newMemberPayload.years_at_current_address = form.years_at_current_address; // Assuming this is fixed from head
    newMemberPayload.is_household_head = false; // This new resident is a member, not a head
    newMemberPayload.household_id = householdId.value; // Link to the current household

    // Convert files to base64
    const [
      voter_registration_proof_base64,
      pwd_card_base64,
      senior_citizen_card_base64,
      proof_of_relationship_base64
    ] = await Promise.all([
      convertFileToBase64(newMemberForm.voter_id_file),
      convertFileToBase64(newMemberForm.pwd_card_file),
      convertFileToBase64(newMemberForm.senior_citizen_card_file),
      convertFileToBase64(newMemberForm.proof_of_relationship_file)
    ]);

    newMemberPayload.voter_registration_proof_base64 = voter_registration_proof_base64;
    newMemberPayload.pwd_card_base64 = pwd_card_base64;
    newMemberPayload.senior_citizen_card_base64 = senior_citizen_card_base64;
    newMemberPayload.proof_of_relationship_base64 = proof_of_relationship_base64;

    // Remove file objects before sending to backend
    delete newMemberPayload.voter_id_file;
    delete newMemberPayload.pwd_card_file;
    delete newMemberPayload.senior_citizen_card_file;
    delete newMemberPayload.proof_of_relationship_file;

    // STEP 1: Create the new resident (will be initially marked as a head by the backend endpoint)
    const { data: createData, error: createError } = await useMyFetch("/api/admin/residents", {
      method: 'post',
      body: newMemberPayload,
    });

    if (createError.value || createData?.value?.error) {
      return $toast.fire({
        title: createData?.value?.error || 'Something went wrong creating the new member.',
        icon: 'error',
      });
    }

    const createdMember = createData.value.resident;

    // STEP 2: Correct the newly created resident's status to be a member and link to the household
    const { data: updateMemberData, error: updateMemberError } = await useMyFetch(`/api/residents/${createdMember._id}`, {
      method: 'PUT',
      body: {
        is_household_head: false,
        household_id: householdId.value,
        relationship_to_head: newMemberForm.relationship_to_head,
        // Ensure other essential fields like address are consistent, if needed
        address_unit_room_apt_number: form.address_unit_room_apt_number,
        address_house_number: form.address_house_number,
        address_street: form.address_street,
        address_subdivision_zone: form.address_subdivision_zone,
        address_city_municipality: 'Manila City',
        years_at_current_address: form.years_at_current_address,
      },
    });

    if (updateMemberError.value || updateMemberData?.value?.error) {
      // Potentially roll back or log this error more aggressively
      console.error("Error updating newly created member's status:", updateMemberError.value || updateMemberData?.value?.error);
      $toast.fire({
        title: updateMemberData?.value?.error || 'Failed to finalize new member details. Please check manually.',
        icon: 'warning',
      });
    }

    // STEP 3: Update the current household to include the new member
    const currentMemberIds = form.members.map(m => m._id);
    const updatedHouseholdMemberIds = [...currentMemberIds, createdMember._id];

    const { data: updateHouseholdData, error: updateHouseholdError } = await useMyFetch(`/api/residents/${householdId.value}`, {
      method: 'PUT',
      body: {
        household_member_ids: updatedHouseholdMemberIds,
      },
    });

    if (updateHouseholdError.value || updateHouseholdData?.value?.error) {
       console.error("Error updating household with new member:", updateHouseholdError.value || updateHouseholdData?.value?.error);
      $toast.fire({
        title: updateHouseholdData?.value?.error || 'Failed to update household member list. Please check manually.',
        icon: 'warning',
      });
    }


    $toast.fire({
      title: `${createdMember.first_name} ${createdMember.last_name} added to household!`,
      icon: 'success',
    });

    closeNewMemberModal();
    await fetchHouseholdData(); // Re-fetch all household data to reflect the changes
  } catch (error) {
    console.error("Error saving new member:", error);
    $toast.fire({
      title: 'An unexpected error occurred while saving the new member.',
      icon: 'error',
    });
  } finally {
    savingNewMember.value = false;
  }
};
</script>

<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Household Details...</p>
    </div>
    <div v-else-if="!form.head_id">
      <v-alert type="error" prominent border="start" text="Household not found or could not be loaded.">
        <template v-slot:append><v-btn to="/households">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <div class="d-flex align-center">
            <h2 class="text-h4 font-weight-bold me-4">Household Details</h2>
            <v-chip v-if="form.head_status" :color="getStatusColor(form.head_status)" label>
              Head Status: {{ form.head_status }}
            </v-chip>
          </div>
          <p class="text-grey-darken-1">{{ form.household_name }} (No. {{ form.household_number || 'N/A' }})</p>
        </v-col>
        <v-col class="text-right" cols="auto">
          <v-btn v-if="!editMode" color="primary" @click="editMode = true" prepend-icon="mdi-pencil" class="mr-2">Edit Household</v-btn>
          <v-btn v-if="editMode" color="success" @click="saveHousehold" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn v-if="!editMode" color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete Household</v-btn>
        </v-col>
      </v-row>

      <!-- Household Information Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Household Information</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.household_name" label="Household Name" readonly variant="outlined" hint="Derived from Head's Name"></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.household_number" label="Household No." readonly variant="outlined" hint="Typically the Head's House Number"></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="form.type_of_household"
                :items="householdTypeOptions"
                label="Type of Household*"
                :readonly="!editMode"
                variant="outlined"
                placeholder="Select Type"
                :error-messages="v$.type_of_household.$errors.map(e => e.$message)"
              ></v-select>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="form.address_unit_room_apt_number"
                label="Unit/Room/Apartment No."
                :readonly="!editMode"
                variant="outlined"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="form.address_house_number"
                label="House Number*"
                :readonly="!editMode"
                variant="outlined"
                :error-messages="v$.address_house_number.$errors.map(e => e.$message)"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="form.address_street"
                label="Street*"
                :readonly="!editMode"
                variant="outlined"
                :error-messages="v$.address_street.$errors.map(e => e.$message)"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="form.address_subdivision_zone"
                label="Subdivision/Zone/Sitio/Purok*"
                :readonly="!editMode"
                variant="outlined"
                :error-messages="v$.address_subdivision_zone.$errors.map(e => e.$message)"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Household Head Information (Read-only summary with link to full profile) -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Household Head</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="6" class="pr-6">
              <p class="font-weight-medium text-body-1 mb-2 py-1">Name: {{ householdHeadDisplayName }}</p>
              <p class="text-body-1 mb-2 py-1">Gender: {{ form.head_gender }}</p>
              <p class="text-body-1 mb-2 py-1">Date of Birth: {{ formatDate(form.head_date_of_birth) }}</p>
              <p class="text-body-1 py-1">Civil Status: {{ form.head_civil_status }}</p>
            </v-col>
            <v-col cols="12" md="6" class="pl-6">
              <p class="text-body-1 mb-2 py-1">Contact No: {{ form.head_contact_number || 'N/A' }}</p>
              <p class="text-body-1 mb-2 py-1">Email: {{ form.head_email || 'N/A' }}</p>
              <p class="text-body-1 mb-2 py-1">Occupation: {{ form.head_occupation || 'N/A' }}</p>
              <p class="text-body-1 py-1">Voter: {{ form.head_is_voter ? 'Yes' : 'No' }}</p>
            </v-col>
          </v-row>
          <v-btn
            class="mt-6"
            variant="tonal"
            color="info"
            size="small"
            :to="`/residents/${form.head_id}`"
            prepend-icon="mdi-account-details-outline"
          >
            View Full Head Profile
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Household Members Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium d-flex align-center">
          Household Members ({{ form.members.length }})
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            rounded
            size="small"
            variant="tonal"
            prepend-icon="mdi-account-plus"
            @click="openNewMemberModal"
          >
            Add New Member
          </v-btn>
        </v-card-title>
        <v-card-text class="pt-4">
          <!-- Search section removed -->

          <v-table class="mt-4">
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Role</th>
                <th>Relationship</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody v-if="form.members.length > 0">
              <tr v-for="member in form.members" :key="member._id">
                <td>{{ member.name }}</td>
                <td>{{ member.sex || member.gender }}</td>
                <td>
                  <v-chip :color="member.isHead ? 'primary' : 'grey'" size="small">
                    {{ member.isHead ? 'Head' : 'Member' }}
                  </v-chip>
                </td>
                <td>{{ member.relationship_to_head || 'N/A' }}</td>
                <td>
                  <v-btn
                    v-if="member.proof_of_relationship_base64"
                    class="ma-1"
                    variant="tonal"
                    size="x-small"
                    color="primary"
                    prepend-icon="mdi-file-document-outline"
                    @click="openProofViewer(member.proof_of_relationship_base64, member.name)"
                  >
                    View Proof
                  </v-btn>
                  <span v-else>N/A</span>
                </td>
                <td>
                  <v-btn
                    class="ma-1"
                    variant="tonal"
                    color="info"
                    size="small"
                    :to="`/residents/${member._id}`"
                    prepend-icon="mdi-account-details-outline"
                  >
                    View Profile
                  </v-btn>
                  <v-btn
                    v-if="!member.isHead && editMode"
                    class="ma-1"
                    variant="outlined"
                    size="small"
                    color="error"
                    prepend-icon="mdi-account-remove"
                    @click="removeMember(member._id)"
                  >
                    Remove
                  </v-btn>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr>
                <td colspan="6" class="text-center py-5 text-grey-darken-1">
                  No members in this household yet. Click "Add New Member" to get started.
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <!-- Proof Viewer Dialog -->
      <v-dialog v-model="proofViewerDialog" max-width="800">
        <v-card>
          <v-toolbar color="primary" dense>
            <v-toolbar-title>{{ currentProofTitle }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn icon @click="proofViewerDialog = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-toolbar>
          <v-card-text class="d-flex justify-center align-center py-4">
            <!-- Check if it's a PDF or image -->
            <iframe v-if="currentProofSrc.startsWith('data:application/pdf')"
                    :src="currentProofSrc"
                    width="100%"
                    height="500px"
                    frameborder="0"
            ></iframe>
            <v-img v-else-if="currentProofSrc.startsWith('data:image')"
                   :src="currentProofSrc"
                   contain
                   max-height="600px"
                   class="bg-surface-variant"
            ></v-img>
            <p v-else class="text-center text-grey-darken-1">Unsupported file type or no preview available.</p>
          </v-card-text>
        </v-card>
      </v-dialog>

      <!-- Add New Member Dialog -->
      <v-dialog v-model="showNewMemberModal" persistent max-width="900px" scrollable>
        <v-card>
          <v-card-title class="text-h5">Add New Household Member</v-card-title>
          <v-card-text>
            <p class="text-subtitle-2 mb-4">Personal Information</p>
            <v-row>
              <v-col cols="12" md="4">
                <label class="v-label">First Name *</label>
                <v-text-field v-model="newMemberForm.first_name" label="First Name *" variant="outlined" :error-messages="vNewMember$.first_name.$errors.map(e => e.$message)" @blur="vNewMember$.first_name.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label">Middle Name</label>
                <v-text-field v-model="newMemberForm.middle_name" label="Middle Name" variant="outlined"></v-text-field>
              </v-col>
              <v-col cols="12" md="3">
                <label class="v-label">Last Name *</label>
                <v-text-field v-model="newMemberForm.last_name" label="Last Name *" variant="outlined" :error-messages="vNewMember$.last_name.$errors.map(e => e.$message)" @blur="vNewMember$.last_name.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="1">
                <label class="v-label">Suffix</label>
                <v-select v-model="newMemberForm.suffix" :items="suffixOptions" label="Suffix" variant="outlined" clearable></v-select>
              </v-col>

              <v-col cols="12" md="6">
                <label class="v-label">Relationship to Head *</label>
                <v-select v-model="newMemberForm.relationship_to_head" :items="relationshipOptions" label="Relationship to Head *" variant="outlined" :error-messages="vNewMember$.relationship_to_head.$errors.map(e => e.$message)" @blur="vNewMember$.relationship_to_head.$touch()"></v-select>
              </v-col>
              <v-col cols="12" md="6" v-if="newMemberForm.relationship_to_head === 'Other'">
                  <label class="v-label">Please Specify Relationship *</label>
                  <v-text-field v-model="newMemberForm.other_relationship" label="Please Specify Relationship *" variant="outlined" :error-messages="vNewMember$.other_relationship.$errors.map(e => e.$message)" @blur="vNewMember$.other_relationship.$touch()"></v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <label class="v-label">Upload Proof of Relationship *</label>
                <v-file-input v-model="newMemberForm.proof_of_relationship_file" label="Upload Proof of Relationship *" variant="outlined" accept="image/*,.pdf" hint="Required for relationship validation'." persistent-hint :error-messages="vNewMember$.proof_of_relationship_file.$errors.map(e => e.$message)" show-size clearable @blur="vNewMember$.proof_of_relationship_file.$touch()"></v-file-input>
                <v-img v-if="newMemberRelationshipProofPreviewUrl" :src="newMemberRelationshipProofPreviewUrl" class="mt-2" height="150" contain></v-img>
              </v-col>

              <v-col cols="12" md="3">
                <label class="v-label">Sex *</label>
                <v-select v-model="newMemberForm.sex" :items="['Male', 'Female']" label="Sex *" variant="outlined" placeholder="Select Sex" :error-messages="vNewMember$.sex.$errors.map(e => e.$message)" @blur="vNewMember$.sex.$touch()"></v-select>
              </v-col>
              <v-col cols="12" md="3">
                <label class="v-label">Date of Birth *</label>
                <v-text-field v-model="newMemberForm.date_of_birth" label="Date of Birth *" type="date" variant="outlined" :error-messages="vNewMember$.date_of_birth.$errors.map(e => e.$message)" @blur="vNewMember$.date_of_birth.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="2">
                <label class="v-label">Age</label>
                <v-text-field :model-value="newMemberAge" label="Age" type="number" variant="outlined" readonly></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label">Civil Status *</label>
                <v-select v-model="newMemberForm.civil_status" :items="['Single', 'Married', 'Widowed', 'Separated']" label="Civil Status *" variant="outlined" placeholder="Select Civil Status" :error-messages="vNewMember$.civil_status.$errors.map(e => e.$message)" @blur="vNewMember$.civil_status.$touch()"></v-select>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label">Citizenship *</label>
                <v-select v-model="newMemberForm.citizenship" :items="['Filipino', 'Other']" label="Citizenship *" variant="outlined" placeholder="Select Citizenship" :error-messages="vNewMember$.citizenship.$errors.map(e => e.$message)" @blur="vNewMember$.citizenship.$touch()"></v-select>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label">Occupation Status *</label>
                <v-select v-model="newMemberForm.occupation_status" :items="['Labor force', 'Unemployed', 'Out of School Youth (OSY)', 'Student', 'Retired', 'Not Applicable']" label="Occupation Status *" variant="outlined" :error-messages="vNewMember$.occupation_status.$errors.map(e => e.$message)" @blur="vNewMember$.occupation_status.$touch()"></v-select>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label">Contact Number</label>
                <v-text-field v-model="newMemberForm.contact_number" label="Contact Number" variant="outlined" maxlength="11" :error-messages="vNewMember$.contact_number.$errors.map(e => e.$message)" @blur="vNewMember$.contact_number.$touch()"></v-text-field>
              </v-col>
            </v-row>

            <v-divider class="my-6"></v-divider>
            <p class="text-subtitle-2 mb-4">Voter Information</p>
            <v-row v-if="newMemberAge >= 18">
              <v-col cols="12">
                <label class="v-label font-weight-medium mb-1">Registered Voter?</label>
                <v-radio-group v-model="newMemberForm.is_voter" inline>
                  <v-radio label="No" :value="false"></v-radio>
                  <v-radio label="Yes" :value="true"></v-radio>
                </v-radio-group>
              </v-col>
            </v-row>
            <v-row v-if="newMemberForm.is_voter && newMemberAge >= 18">
              <v-col cols="12" md="6">
                <label class="v-label">Voter's ID Number</label>
                <v-text-field v-model="newMemberForm.voter_id_number" label="Voter's ID Number" variant="outlined" hint="Required if ID card is not uploaded." persistent-hint :error-messages="vNewMember$.voter_id_number.$errors.map(e => e.$message)" @blur="vNewMember$.voter_id_number.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label">Upload Voter's ID Card</label>
                <v-file-input v-model="newMemberForm.voter_id_file" label="Upload Voter's ID Card" variant="outlined" accept="image/*,application/pdf" hint="Required if ID number is not provided." persistent-hint :error-messages="vNewMember$.voter_id_file.$errors.map(e => e.$message)" show-size clearable @blur="vNewMember$.voter_id_file.$touch()"></v-file-input>
                <v-img v-if="newMemberVoterIdPreviewUrl" :src="newMemberVoterIdPreviewUrl" class="mt-2" height="150" contain></v-img>
              </v-col>
            </v-row>

            <v-divider class="my-6"></v-divider>
            <p class="text-subtitle-2 mb-4">Special Classification</p>
            <v-row>
              <v-col cols="12">
                <label class="v-label font-weight-medium mb-1">Person with Disability (PWD)?</label>
                <v-radio-group v-model="newMemberForm.is_pwd" inline>
                  <v-radio label="No" :value="false"></v-radio>
                  <v-radio label="Yes" :value="true"></v-radio>
                </v-radio-group>
              </v-col>
            </v-row>
            <v-row v-if="newMemberForm.is_pwd">
              <v-col cols="12" md="6">
                <label class="v-label">PWD ID Number</label>
                <v-text-field v-model="newMemberForm.pwd_id" label="PWD ID Number" variant="outlined" hint="Required if PWD card is not uploaded." persistent-hint :error-messages="vNewMember$.pwd_id.$errors.map(e => e.$message)" @blur="vNewMember$.pwd_id.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label">Upload PWD ID Card</label>
                <v-file-input v-model="newMemberForm.pwd_card_file" label="Upload PWD ID Card" variant="outlined" accept="image/*" hint="Required if PWD ID number is not provided." persistent-hint :error-messages="vNewMember$.pwd_card_file.$errors.map(e => e.$message)" show-size clearable @blur="vNewMember$.pwd_card_file.$touch()"></v-file-input>
                <v-img v-if="newMemberPwdCardPreviewUrl" :src="newMemberPwdCardPreviewUrl" class="mt-2" height="150" contain></v-img>
              </v-col>
            </v-row>
            <v-row v-if="isNewMemberSenior">
              <v-divider class="my-4"></v-divider>
              <v-col cols="12">
                <label class="v-label font-weight-medium mb-1">Registered Senior Citizen? (Age 60+)</label>
                <v-radio-group v-model="newMemberForm.is_senior_citizen" inline>
                  <v-radio label="No" :value="false"></v-radio>
                  <v-radio label="Yes" :value="true"></v-radio>
                </v-radio-group>
              </v-col>
              <template v-if="newMemberForm.is_senior_citizen">
                <v-col cols="12" md="6">
                  <label class="v-label">Senior Citizen ID Number</label>
                  <v-text-field v-model="newMemberForm.senior_citizen_id" label="Senior Citizen ID Number" variant="outlined" hint="Required if Senior card is not uploaded." persistent-hint :error-messages="vNewMember$.senior_citizen_id.$errors.map(e => e.$message)" @blur="vNewMember$.senior_citizen_id.$touch()"></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <label class="v-label">Upload Senior Citizen ID Card</label>
                  <v-file-input v-model="newMemberForm.senior_citizen_card_file" label="Upload Senior Citizen ID Card" variant="outlined" accept="image/*" hint="Required if Senior ID number is not provided." persistent-hint :error-messages="vNewMember$.senior_citizen_card_file.$errors.map(e => e.$message)" show-size clearable @blur="vNewMember$.senior_citizen_card_file.$touch()"></v-file-input>
                  <v-img v-if="newMemberSeniorCardPreviewUrl" :src="newMemberSeniorCardPreviewUrl" class="mt-2" height="150" contain></v-img>
              </v-col>
              </template>
            </v-row>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey" text @click="closeNewMemberModal" :disabled="savingNewMember">Cancel</v-btn>
            <v-btn color="primary" @click="saveNewMemberToHousehold" :loading="savingNewMember">Add Member</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>


      <!-- Delete Confirmation Dialog -->
      <v-dialog v-model="confirmDeleteDialog" persistent max-width="500px">
        <v-card>
          <v-card-title class="text-h5">
            <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
            Confirm Deletion
          </v-card-title>
          <v-card-text>
            Are you sure you want to permanently delete the household led by
            <strong>{{ householdHeadDisplayName }}</strong>?
            <br><br>
            This action will delete the head resident's profile and sever all household relationships for its members. Individual member profiles will still exist as standalone residents.
            <br><br>
            This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey" text @click="confirmDeleteDialog = false" :disabled="deleting">Cancel</v-btn>
            <v-btn color="error" variant="flat" @click="deleteHousehold" :loading="deleting">Delete Household</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>

<style scoped>
.v-list-item {
  cursor: pointer;
}
.v-list-item:hover {
  background-color: var(--v-theme-surface-variant);
}
</style>