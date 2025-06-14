<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Official Data...</p>
    </div>
    <div v-else-if="!form.last_name">
      <v-alert type="warning" prominent border="start" text="Official not found.">
        <template v-slot:append><v-btn to="/barangay-officials">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Edit Barangay Official</h2>
          <p class="text-grey-darken-1">Update details for {{ form.first_name }} {{ form.last_name }}</p>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="editMode = true" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
          <v-row>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Last Name <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field
                v-model="form.last_name"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.last_name.$errors.map(e => e.$message)"
                @blur="v$.last_name.$touch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">First Name <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field
                v-model="form.first_name"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.first_name.$errors.map(e => e.$message)"
                @blur="v$.first_name.$touch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Middle Name (Optional)</label>
              <v-text-field
                v-model="form.middle_name"
                :readonly="!editMode" variant="outlined"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Sex <span v-if="editMode" class="text-red">*</span></label>
              <v-select
                v-model="form.sex"
                :items="['M', 'F']"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.sex.$errors.map(e => e.$message)"
                @blur="v$.sex.$touch"
              ></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Civil Status <span v-if="editMode" class="text-red">*</span></label>
              <v-select
                v-model="form.civil_status"
                :items="['Single', 'Married', 'Widowed', 'Separated']"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.civil_status.$errors.map(e => e.$message)"
                @blur="v$.civil_status.$touch"
              ></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Religion (Optional)</label>
              <v-text-field
                v-model="form.religion"
                :readonly="!editMode" variant="outlined"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Position / Designation <span v-if="editMode" class="text-red">*</span></label>
              <v-select
                v-model="form.position"
                :items="['Punong Barangay', 'Barangay Secretary', 'Treasurer', 'Sangguniang Barangay Member', 'SK Chairperson', 'SK Member']"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.position.$errors.map(e => e.$message)"
                @blur="v$.position.$touch"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Term in Present Position <span v-if="editMode" class="text-red">*</span></label>
              <v-select
                v-model="form.term_in_present_position"
                :items="['1st', '2nd', '3rd']"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.term_in_present_position.$errors.map(e => e.$message)"
                @blur="v$.term_in_present_position.$touch"
              ></v-select>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Term Start Date <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field
                v-model="form.term_start"
                type="date" :readonly="!editMode" variant="outlined"
                :error-messages="v$.term_start.$errors.map(e => e.$message)"
                @blur="v$.term_start.$touch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Term End Date (Optional)</label>
              <v-text-field
                v-model="form.term_end"
                type="date" :readonly="!editMode" variant="outlined"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Status <span v-if="editMode" class="text-red">*</span></label>
              <v-select
                v-model="form.status"
                :items="['Active', 'Inactive']"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.status.$errors.map(e => e.$message)"
                @blur="v$.status.$touch"
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>Delete official record for <strong>{{ form.first_name }} {{ form.last_name }}</strong>? This action cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteOfficial" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const officialId = route.params.id;

// --- STATE ---
const form = reactive({
  first_name: '', last_name: '', middle_name: '', sex: null, civil_status: null, religion: '', term_in_present_position: null,
  position: null, term_start: '', term_end: '', status: 'Active',
});
const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

// --- VUELIDATE ---
const rules = {
  first_name: { required }, last_name: { required }, sex: { required }, civil_status: { required },
  position: { required }, term_in_present_position: { required }, term_start: { required }, status: { required },
};
const v$ = useVuelidate(rules, form);

// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => { await fetchOfficial(); });

async function fetchOfficial() {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/barangay-officials/${officialId}`);
    if (error.value) throw new Error('Official not found or could not be loaded.');
    
    const official = data.value.official;
    Object.assign(form, {
        ...official,
        term_start: formatDateForInput(official.term_start),
        term_end: formatDateForInput(official.term_end),
    });
    originalFormState.value = JSON.parse(JSON.stringify(form));
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    router.push('/barangay-officials');
  } finally {
    loading.value = false;
  }
}

// --- FORM & UI LOGIC ---
const cancelEdit = () => {
    Object.assign(form, originalFormState.value); // Revert changes
    v$.value.$reset(); // Reset validation
    editMode.value = false;
};

// --- SAVE & DELETE ---
async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  
  saving.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/barangay-officials/${officialId}`, {
        method: 'PUT',
        body: form,
    });
    if (error.value) throw new Error(error.value.data?.error || 'Failed to update official.');
    
    $toast.fire({ title: 'Official updated successfully!', icon: 'success' });
    await fetchOfficial(); // Refetch the latest data
    editMode.value = false;
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteOfficial() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/barangay-officials/${officialId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete official.');
    $toast.fire({ title: 'Official deleted successfully!', icon: 'success' });
    router.push('/barangay-officials');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}

// --- HELPER FUNCTION ---
const formatDateForInput = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toISOString().split('T')[0];
};
</script>

<style scoped>
.v-label {
    opacity: 1;
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
}
</style>