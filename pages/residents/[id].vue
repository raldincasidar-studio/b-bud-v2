<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Resident Details...</p>
    </div>
    <div v-else-if="!form.first_name">
      <v-alert type="error" prominent border="start" text="Resident not found or could not be loaded.">
        <template v-slot:append><v-btn to="/residents">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Resident Details</h2>
          <p class="text-grey-darken-1">{{ form.first_name }} {{ form.last_name }}</p>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="editMode = true" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn v-if="!editMode" color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <!-- Personal Information Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Personal Information</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="4"><v-text-field v-model="form.first_name" label="First Name*" :readonly="!editMode" variant="outlined" :error-messages="v$.first_name.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.middle_name" label="Middle Name" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.last_name" label="Last Name*" :readonly="!editMode" variant="outlined" :error-messages="v$.last_name.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="3"><v-select v-model="form.sex" :items="['Male', 'Female']" label="Sex*" :readonly="!editMode" variant="outlined" placeholder="Select Sex" :error-messages="v$.sex.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="3"><v-text-field v-model="form.date_of_birth" label="Date of Birth*" type="date" :readonly="!editMode" variant="outlined" :error-messages="v$.date_of_birth.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="2"><v-text-field :model-value="calculatedAge" label="Age" readonly variant="outlined" hint="Auto-calculated" persistent-hint></v-text-field></v-col>
            <!-- REVISION: Updated civil status options -->
            <v-col cols="12" md="4"><v-select v-model="form.civil_status" :items="['Single', 'Married', 'Widowed', 'Separated']" label="Civil Status*" :readonly="!editMode" variant="outlined" placeholder="Select Civil Status" :error-messages="v$.civil_status.$errors.map(e => e.$message)"></v-select></v-col>
            <!-- REVISION: Added Citizenship field -->
            <v-col cols="12" md="4"><v-select v-model="form.citizenship" :items="['Filipino', 'Other']" label="Citizenship*" :readonly="!editMode" variant="outlined" placeholder="Select Citizenship" :error-messages="v$.citizenship.$errors.map(e => e.$message)"></v-select></v-col>
            <!-- REVISION: Updated occupation status options -->
            <v-col cols="12" md="4"><v-select v-model="form.occupation_status" :items="['Labor force', 'Unemployed', 'Out of School Youth (OSY)', 'Student', 'Retired', 'Not Applicable']" label="Occupation Status*" :readonly="!editMode" variant="outlined" :error-messages="v$.occupation_status.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.email" label="Email Address*" type="email" :readonly="!editMode" variant="outlined" :error-messages="v$.email.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.contact_number" label="Contact Number*" :readonly="!editMode" variant="outlined" :error-messages="v$.contact_number.$errors.map(e => e.$message)"></v-text-field></v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- REVISION: Added Address Information Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Address Information</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="4"><v-text-field v-model="form.address_house_number" label="House Number/Lot/Block*" :readonly="!editMode" variant="outlined" :error-messages="v$.address_house_number.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="8"><v-text-field v-model="form.address_street" label="Street*" :readonly="!editMode" variant="outlined" :error-messages="v$.address_street.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.address_subdivision_zone" label="Subdivision/Zone/Sitio/Purok*" :readonly="!editMode" variant="outlined" :error-messages="v$.address_subdivision_zone.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.address_city_municipality" label="City/Municipality" readonly variant="outlined"></v-text-field></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.years_at_current_address" label="Years at Current Address*" type="number" :readonly="!editMode" variant="outlined" :error-messages="v$.years_at_current_address.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.proof_of_residency_file" label="Upload to Replace Proof of Residency" variant="outlined" accept="image/*,application/pdf" clearable></v-file-input>
              <div v-else><label class="v-label mb-1">Uploaded Proof of Residency</label>
                <v-img v-if="form.proof_of_residency_base64" :src="form.proof_of_residency_base64" max-height="150" contain class="mt-2 elevation-1"></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Voter Information Card -->
      <v-card class="mb-6" flat border v-if="calculatedAge >= 18">
        <v-card-title class="text-h6 font-weight-medium">Voter Information</v-card-title>
        <v-card-text class="pt-2">
          <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Voter?</label><v-radio-group v-model="form.is_voter" inline :readonly="!editMode"><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
          <v-row v-if="form.is_voter">
            <v-col cols="12" md="6"><v-text-field v-model="form.voter_id_number" label="Voter's ID Number" :readonly="!editMode" variant="outlined" :error-messages="v$.voter_id_number.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.voter_id_file" label="Upload to Replace Voter's ID" variant="outlined" accept="image/*,application/pdf" clearable></v-file-input>
              <div v-else><label class="v-label mb-1">Uploaded Voter's ID</label>
                <v-img v-if="form.voter_registration_proof_base64" :src="form.voter_registration_proof_base64" max-height="150" contain class="mt-2 elevation-1"></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
      
      <!-- Special Classification Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Special Classification</v-card-title>
        <v-card-text class="pt-2">
          <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Person with Disability (PWD)?</label><v-radio-group v-model="form.is_pwd" inline :readonly="!editMode"><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
          <v-row v-if="form.is_pwd">
            <v-col cols="12" md="6"><v-text-field v-model="form.pwd_id" label="PWD ID Number*" :readonly="!editMode" variant="outlined" :error-messages="v$.pwd_id.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.pwd_card_file" label="Upload to Replace PWD ID Card" variant="outlined" accept="image/*" clearable></v-file-input>
              <div v-else><label class="v-label mb-1">Uploaded PWD ID Card</label>
                <v-img v-if="form.pwd_card_base64" :src="form.pwd_card_base64" max-height="150" contain class="mt-2 elevation-1"></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
          <!-- REVISION: Updated Senior Citizen logic -->
          <v-row v-if="isSenior">
            <v-divider class="my-4"></v-divider>
            <v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Senior Citizen? (Age 60+)</label><v-radio-group v-model="form.is_senior_citizen" inline :readonly="!editMode"><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col>
            <template v-if="form.is_senior_citizen">
              <v-col cols="12" md="6"><v-text-field v-model="form.senior_citizen_id" label="Senior Citizen ID Number*" :readonly="!editMode" variant="outlined" :error-messages="v$.senior_citizen_id.$errors.map(e => e.$message)"></v-text-field></v-col>
              <v-col cols="12" md="6">
                <v-file-input v-if="editMode" v-model="form.senior_citizen_card_file" label="Upload to Replace Senior ID" variant="outlined" accept="image/*" clearable></v-file-input>
                <div v-else><label class="v-label mb-1">Uploaded Senior Citizen ID</label>
                  <v-img v-if="form.senior_citizen_card_base64" :src="form.senior_citizen_card_base64" max-height="150" contain class="mt-2 elevation-1"></v-img>
                  <p v-else class="text-grey mt-2">No file uploaded.</p>
                </div>
              </v-col>
            </template>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- REVISION: Added Change Password Card, only shows in edit mode -->
      <v-card v-if="editMode" class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Change Password</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="6"><v-text-field v-model="form.newPassword" label="New Password" type="password" variant="outlined" hint="Leave blank to keep current password" persistent-hint :error-messages="v$.newPassword.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.confirmNewPassword" label="Confirm New Password" type="password" variant="outlined" :error-messages="v$.confirmNewPassword.$errors.map(e => e.$message)"></v-text-field></v-col>
          </v-row>
        </v-card-text>
      </v-card>
      
      <!-- Household Management Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Household Management</v-card-title>
        <v-card-text class="pt-4">
          <v-row><v-col cols="12" md="4"><label class="v-label mb-1">Household Role</label><v-select v-model="form.is_household_head" :items="[{title:'Head', value:true}, {title:'Member', value:false}]" :readonly="!editMode" variant="outlined"></v-select></v-col></v-row>
          <div v-if="form.is_household_head">
            <v-divider class="my-4"></v-divider><h3 class="text-subtitle-1 font-weight-medium">Household Members</h3>
            <v-autocomplete v-if="editMode" v-model:search="householdMemberSearchQuery" label="Search & Add Eligible Members..." variant="outlined" class="my-4" :items="eligibleMemberSearchResults" item-title="name" item-value="_id" :loading="isLoadingEligibleMembers" @update:model-value="addMember" no-filter clearable>
              <template v-slot:item="{ props, item }"><v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item></template>
              <template v-slot:no-data><v-list-item><v-list-item-title>No eligible residents found.</v-list-item-title></v-list-item></template>
            </v-autocomplete>
            <v-table>
              <thead><tr><th>Name</th><th>Relationship</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="(member, index) in form.household_members_details" :key="member._id">
                  <td><v-chip link color="primary" prepend-icon="mdi-account" :to="`/residents/${member._id}`">{{ member.first_name }} {{ member.last_name }}</v-chip></td><td>{{ member.relationship_to_head || 'Not specified' }}</td>
                  <td><v-btn prepend-icon="mdi-pencil-outline" variant="text" color="primary" size="small" :to="`/residents/${member._id}`">View Info</v-btn><v-btn icon="mdi-delete-outline" variant="text" color="error" v-if="editMode"   size="small" @click="removeMember(index)"></v-btn></td>
                </tr>
                <tr v-if="!form.household_members_details || form.household_members_details.length === 0"><td colspan="3" class="text-center text-grey py-3">No members in this household.</td></tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>

      <v-dialog v-model="confirmDeleteDialog" persistent max-width="500px">
        <v-card>
          <v-card-title class="text-h5">
            <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
            Confirm Deletion
          </v-card-title>
          <v-card-text>
            Are you sure you want to permanently delete the record for 
            <strong>{{ form.first_name }} {{ form.last_name }}</strong>? 
            <br><br>
            This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey" text @click="confirmDeleteDialog = false" :disabled="deleting">Cancel</v-btn>
            <v-btn color="error" variant="flat" @click="deleteResident" :loading="deleting">Delete Resident</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, requiredIf, helpers, numeric } from '@vuelidate/validators'; // REVISION: Added numeric validator
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const residentId = route.params.id;

// REVISION: Added all new fields to the form state to match new.vue
const form = reactive({
  first_name: '', middle_name: '', last_name: '', sex: null, date_of_birth: '', civil_status: null,
  citizenship: 'Filipino', occupation_status: null, email: '', contact_number: '', newPassword: '', confirmNewPassword: '',
  address_house_number: '', address_street: '', address_subdivision_zone: '', address_city_municipality: 'Manila City',
  years_at_current_address: null, proof_of_residency_file: null, proof_of_residency_base64: null,
  is_voter: false, voter_id_number: '', voter_id_file: null, voter_registration_proof_base64: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null, pwd_card_base64: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null, senior_citizen_card_base64: null,
  is_household_head: false, household_members_details: [],
});
const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

const householdMemberSearchQuery = ref('');
const eligibleMemberSearchResults = ref([]);
const isLoadingEligibleMembers = ref(false);

const calculatedAge = computed(() => {
  if (!form.date_of_birth) return null;
  const birthDate = new Date(form.date_of_birth); if (isNaN(birthDate.getTime())) return null;
  let age = new Date().getFullYear() - birthDate.getFullYear();
  const m = new Date().getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
});
const isSenior = computed(() => calculatedAge.value !== null && calculatedAge.value >= 60);

// REVISION: Updated validation rules to match new.vue
const rules = {
  first_name: { required }, last_name: { required }, sex: { required }, date_of_birth: { required },
  civil_status: { required }, citizenship: { required }, occupation_status: { required },
  email: { required, email }, contact_number: { required },
  address_house_number: { required }, address_street: { required }, address_subdivision_zone: { required },
  years_at_current_address: { required, numeric },
  newPassword: { minLength: minLength(6) },
  confirmNewPassword: { sameAs: helpers.withMessage('Passwords do not match.', sameAs(computed(() => form.newPassword))) },
  voter_id_number: { requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf(() => form.is_voter && !form.voter_id_file && !form.voter_registration_proof_base64)) },
  pwd_id: { requiredIf: helpers.withMessage('PWD ID is required.', requiredIf(() => form.is_pwd)) },
  senior_citizen_id: { requiredIf: helpers.withMessage('Senior ID is required.', requiredIf(() => form.is_senior_citizen)) },
};
const v$ = useVuelidate(rules, form);

onMounted(async () => { await fetchResident(); });

async function fetchResident() {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentId}/household-details`);
    if (error.value) throw new Error('Resident not found.');
    
    const residentData = data.value;
    Object.assign(form, { ...residentData.resident, household_members_details: residentData.householdMembers || [] });
    form.date_of_birth = form.date_of_birth ? new Date(form.date_of_birth).toISOString().split('T')[0] : '';
    originalFormState.value = JSON.parse(JSON.stringify(form));
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); router.push('/residents'); }
  finally { loading.value = false; }
}

const cancelEdit = () => { Object.assign(form, JSON.parse(JSON.stringify(originalFormState.value))); v$.value.$reset(); editMode.value = false; };

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || file.length === 0) { resolve(null); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file[0]);
  });
};

async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  saving.value = true;
  try {
    const payload = { ...form };
    payload.household_member_ids = form.household_members_details.map(m => m._id);
    delete payload.household_members_details;
    
    // REVISION: Handle all potential new file uploads
    if (form.voter_id_file) payload.voter_registration_proof_base64 = await convertFileToBase64(form.voter_id_file);
    if (form.pwd_card_file) payload.pwd_card_base64 = await convertFileToBase64(form.pwd_card_file);
    if (form.senior_citizen_card_file) payload.senior_citizen_card_base64 = await convertFileToBase64(form.senior_citizen_card_file);
    if (form.proof_of_residency_file) payload.proof_of_residency_base64 = await convertFileToBase64(form.proof_of_residency_file);
    
    // REVISION: Clean up all file objects before sending payload
    delete payload.voter_id_file; delete payload.pwd_card_file; delete payload.senior_citizen_card_file; delete payload.proof_of_residency_file;
    
    await useMyFetch(`/api/residents/${residentId}`, { method: 'PUT', body: payload });
    $toast.fire({ title: 'Resident updated successfully!', icon: 'success' });
    await fetchResident();
    editMode.value = false;
  } catch(e) { $toast.fire({ title: e.message || 'Failed to update resident.', icon: 'error' }); }
  finally { saving.value = false; }
}

const debounce = (fn,delay) => { let t; return (...a)=>{ clearTimeout(t); t = setTimeout(() => fn.apply(this,a), delay); }; };
const searchMembers = debounce(async (query) => {
  if (!query || query.length < 2) { eligibleMemberSearchResults.value = []; return; }
  isLoadingEligibleMembers.value = true;
  try {
    const { data } = await useMyFetch('/api/residents/eligible-for-household-search', { query: { searchKey: query } });
    eligibleMemberSearchResults.value = (data.value?.searchResults || []).map(r => ({ _id: r._id, name: `${r.first_name} ${r.last_name}`, ...r }));
  } finally { isLoadingEligibleMembers.value = false; }
}, 500);

watch(householdMemberSearchQuery, (nq) => searchMembers(nq));

const addMember = (selectedId) => {
  if (!selectedId) return;
  const member = eligibleMemberSearchResults.value.find(r => r._id === selectedId);
  if (member && !form.household_members_details.some(m => m._id === member._id)) {
    form.household_members_details.push(member);
  }
  householdMemberSearchQuery.value = ''; eligibleMemberSearchResults.value = [];
};
const removeMember = (index) => { form.household_members_details.splice(index, 1); };

async function deleteResident() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/residents/${residentId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete resident.');
    $toast.fire({ title: 'Resident deleted!', icon: 'success' });
    router.push('/residents');
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { deleting.value = false; confirmDeleteDialog.value = false; }
}
</script>