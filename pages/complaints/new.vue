<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">File New Complaint</h2>
        <p class="text-grey-darken-1">Log a new complaint from a resident.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveComplaint" prepend-icon="mdi-content-save" :loading="saving" size="large">
          Submit Complaint
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-text class="py-6">
        <!-- Complainant Section -->
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Complainant Name <span class="text-red">*</span></label>
            <v-autocomplete
              v-model="form.complainant_resident"
              v-model:search="complainantSearchQuery"
              label="Search Complainant (Resident)..."
              variant="outlined"
              :items="complainantSearchResults"
              item-title="name"
              return-object
              :loading="isLoadingComplainants"
              :error-messages="v$.complainant_resident.$errors.map(e => e.$message)"
              @blur="v$.complainant_resident.$touch"
              no-filter
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item>
              </template>
            </v-autocomplete>
          </v-col>
          <v-col cols="12" md="6">
             <label class="v-label mb-1">Complainant Address <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.complainant_address"
              label="Complainant Address"
              variant="outlined"
              readonly
              :error-messages="v$.complainant_address.$errors.map(e => e.$message)"
              @blur="v$.complainant_address.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Complainant Contact Number <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.contact_number"
              label="Complainant Contact Number"
              variant="outlined"
              readonly
              type="tel"
              :error-messages="v$.contact_number.$errors.map(e => e.$message)"
              @blur="v$.contact_number.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <label class="v-label mb-1">Date of Complaint <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.date_of_complaint"
              label="Date of Complaint"
              type="date"
              variant="outlined"
              :error-messages="v$.date_of_complaint.$errors.map(e => e.$message)"
              @blur="v$.date_of_complaint.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
             <label class="v-label mb-1">Time of Complaint <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.time_of_complaint"
              label="Time of Complaint"
              type="time"
              variant="outlined"
              :error-messages="v$.time_of_complaint.$errors.map(e => e.$message)"
              @blur="v$.time_of_complaint.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-divider class="my-4"></v-divider>
        <!-- Person Complained Against Section -->
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Person Complained Against <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.person_complained_against_name"
              label="Name of Person Complained Against"
              variant="outlined"
              placeholder="Enter full name"
              :error-messages="v$.person_complained_against_name.$errors.map(e => e.$message)"
              @blur="v$.person_complained_against_name.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Initial Status <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.status"
              label="Initial Status"
              variant="outlined"
              readonly
              :error-messages="v$.status.$errors.map(e => e.$message)"
              @blur="v$.status.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <label class="v-label mb-1">Category <span class="text-red">*</span></label>
            <v-select
              v-model="form.category"
              label="Category"
              :items="complaintCategories"
              variant="outlined"
              placeholder="Select Category"
              :error-messages="v$.category.$errors.map(e => e.$message)"
              @blur="v$.category.$touch"
            ></v-select>
          </v-col>
          <v-col cols="12">
            <label class="v-label mb-1">Notes / Description of Complaint <span class="text-red">*</span></label>
            <v-textarea
              v-model="form.notes_description"
              label="Notes / Description of Complaint"
              variant="outlined" rows="5" auto-grow
              :error-messages="v$.notes_description.$errors.map(e => e.$message)"
              @blur="v$.notes_description.$touch"
            ></v-textarea>
          </v-col>
          <!-- MODIFIED: Proof of Complaint section with image previews -->
          <v-col cols="12">
             <label class="v-label mb-1">Proof of Complaint</label>
             <v-file-input
                v-model="form.proof_files"
                label="Attach Proof (Photos or Videos)"
                variant="outlined"
                multiple
                chips
                show-size
                counter
                prepend-icon="mdi-paperclip"
                accept="image/*,video/*"
              ></v-file-input>
              <!-- NEW: Image Preview Section -->
              <v-row v-if="proofPreviewUrls.length > 0" class="mt-4">
                <v-col v-for="(url, index) in proofPreviewUrls" :key="index" cols="6" sm="4" md="3">
                  <v-img :src="url" aspect-ratio="1" class="grey lighten-2" cover>
                    <template v-slot:placeholder>
                      <v-row class="fill-height ma-0" align="center" justify="center">
                        <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                      </v-row>
                    </template>
                  </v-img>
                </v-col>
              </v-row>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();

const form = reactive({
  complainant_resident: null,
  complainant_address: '',
  contact_number: '',
  date_of_complaint: new Date().toISOString().split('T')[0],
  time_of_complaint: new Date().toTimeString().slice(0,5),
  category: '',
  person_complained_against_name: '',
  status: 'New',
  notes_description: '',
  // MODIFIED: This will now hold the raw File objects from the input
  proof_files: [],
});

// NEW: A reactive ref to hold the generated URLs for image previews
const proofPreviewUrls = ref([]);

const complaintCategories = ref([
  'Theft / Robbery', 'Scam / Fraud', 'Physical Assault / Violence', 'Verbal Abuse / Threats',
  'Sexual Harassment / Abuse', 'Vandalism', 'Noise Disturbance', 'Illegal Parking / Obstruction',
  'Drunk and Disorderly Behavior', 'Curfew Violation / Minor Offenses', 'Illegal Gambling',
  'Animal Nuisance / Stray Animal Concern', 'Garbage / Sanitation Complaints',
  'Boundary Disputes / Trespassing', 'Barangay Staff / Official Misconduct', 'Missing Person', 'Others',
]);

const saving = ref(false);
const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);

const rules = {
    complainant_resident: { required: helpers.withMessage('A complainant must be selected.', required) },
    complainant_address: { required },
    contact_number: { required },
    date_of_complaint: { required },
    time_of_complaint: { required },
    person_complained_against_name: { required: helpers.withMessage('The person being complained against is required.', required) },
    category: { required },
    status: { required },
    notes_description: { required },
    // proof_files is optional, so no validation rule is needed.
};
const v$ = useVuelidate(rules, form);

const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };

const searchResidentsAPI = debounce(async (query) => {
    if (!query || query.trim().length < 2) { complainantSearchResults.value = []; return; }
    isLoadingComplainants.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error(`Error searching for complainant.`);
        complainantSearchResults.value = data.value?.residents.map(r => ({
            _id: r._id, name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            email: r.email, address: `${r.address_house_number||''} ${r.address_street||''}, ${r.address_subdivision_zone||''}`, contact_number: r.contact_number
        })) || [];
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { isLoadingComplainants.value = false; }
}, 500);

// NEW: Helper function to convert a file to a Base64 string
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file); // Read the single file object
  });
};

// NEW: Watcher to generate preview URLs when files are selected
watch(() => form.proof_files, (newFiles) => {
  if (!newFiles || newFiles.length === 0) {
    proofPreviewUrls.value = [];
    return;
  }
  // Create object URLs for each selected file for previewing
  proofPreviewUrls.value = newFiles.map(file => URL.createObjectURL(file));
}, { deep: true });

watch(complainantSearchQuery, (newQuery) => { searchResidentsAPI(newQuery); });

watch(() => form.complainant_resident, (newResident) => {
    if (newResident && typeof newResident === 'object') {
        form.complainant_address = newResident.address;
        form.contact_number = newResident.contact_number;
    } else {
        form.complainant_address = '';
        form.contact_number = '';
    }
});

// MODIFIED: The entire save logic is updated to send a JSON payload with Base64 strings.
async function saveComplaint() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please correct all errors on the form.', icon: 'error' });
    return;
  }
  
  saving.value = true;

  try {
    // Convert all proof files to Base64 strings in parallel
    const proofs_base64 = await Promise.all(
      form.proof_files.map(file => convertFileToBase64(file))
    );

    // Create the JSON payload
    const payload = {
      complainant_resident_id: form.complainant_resident?._id,
      complainant_display_name: form.complainant_resident?.name,
      complainant_address: form.complainant_address,
      contact_number: form.contact_number,
      date_of_complaint: new Date(form.date_of_complaint).toISOString(),
      time_of_complaint: form.time_of_complaint,
      category: form.category,
      person_complained_against_name: form.person_complained_against_name,
      status: form.status,
      notes_description: form.notes_description,
      // Add the array of Base64 strings to the payload
      proofs_base64: proofs_base64,
    };
    
    // Send the JSON payload, NOT FormData
    const { error } = await useMyFetch('/api/complaints', {
      method: 'POST',
      body: payload,
    });
    
    if (error.value) throw new Error(error.value.data?.message || 'Failed to submit complaint');

    $toast.fire({ title: 'Complaint submitted successfully!', icon: 'success' });
    router.push('/complaints');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}
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