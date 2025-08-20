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
              <!-- UPDATED: Template now shows full name and full address -->
              <template v-slot:item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :title="item.raw.name"
                  :subtitle="item.raw.address" 
                  :disabled="item.raw.account_status !== 'Active'"
                >
                  <template v-slot:append>
                    <v-chip
                      v-if="item.raw.account_status !== 'Active'"
                      color="warning" variant="tonal" size="small" label
                    >
                      On Hold
                    </v-chip>
                  </template>
                </v-list-item>
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
              readonly
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
              readonly
            ></v-text-field>
          </v-col>
        </v-row>
        <v-divider class="my-4"></v-divider>
        
        <!-- Person Complained Against Section -->
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Person Complained Against</label>
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

        <!-- Category and Processed By Section -->
        <v-row>
          <v-col cols="12" md="6">
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
          <v-col cols="12" md="6">
              <label class="v-label mb-1">Request Processed By (Personnel)</label>
              <v-text-field
                v-model="form.processed_by_personnel"
                variant="outlined"
                readonly
                hint="This is automatically filled with the logged-in user's name."
                :error-messages="v$.processed_by_personnel.$errors.map(e => e.$message)"
                @blur="v$.processed_by_personnel.$touch"
              ></v-text-field>
          </v-col>
        </v-row>

        <!-- Notes and Proof Section -->
        <v-row>
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
import { reactive, ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp, useCookie } from '#app';

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
  processed_by_personnel: '',
  status: 'New',
  notes_description: '',
  proof_files: [],
});

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
    complainant_resident: {
        required: helpers.withMessage('A complainant must be selected.', required),
        isActive: helpers.withMessage(
            "This resident's account is On Hold and cannot file complaints.",
            (value) => !value || value.account_status === 'Active'
        )
    },
    complainant_address: { required },
    contact_number: { required },
    date_of_complaint: { required },
    time_of_complaint: { required },
    person_complained_against_name: {},
    category: { required },
    processed_by_personnel: { required: helpers.withMessage('Processed by personnel is required.', required) },
    status: { required },
    notes_description: { required },
};
const v$ = useVuelidate(rules, form);

onMounted(() => {
  const userData = useCookie('userData');
  if (userData.value) {
    form.processed_by_personnel = userData.value.name;
  } else {
    form.processed_by_personnel = 'Unknown User';
    console.warn('Could not retrieve user data from cookie.');
  }
});

const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };

const searchResidentsAPI = debounce(async (query) => {
    if (!query || query.trim().length < 2) {
        complainantSearchResults.value = [];
        return;
    }
    isLoadingComplainants.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error(`Error searching for complainant.`);
        
        complainantSearchResults.value = data.value?.residents.map(r => {
            const addressParts = [
                r.address_house_number,
                r.address_street,
                r.address_subdivision_zone
            ].filter(Boolean);
            const fullAddress = addressParts.join(', ').trim();

            return {
                _id: r._id,
                name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                email: r.email,
                address: fullAddress || 'No address available',
                contact_number: r.contact_number,
                account_status: r.account_status
            }
        }) || [];
        
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        isLoadingComplainants.value = false;
    }
}, 500);

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

watch(() => form.proof_files, (newFiles) => {
  if (!newFiles || newFiles.length === 0) {
    proofPreviewUrls.value = [];
    return;
  }
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

async function saveComplaint() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please correct all errors on the form.', icon: 'error' });
    return;
  }
  
  saving.value = true;

  try {
    const proofs_base64 = await Promise.all(
      form.proof_files.map(file => convertFileToBase64(file))
    );

    const payload = {
      complainant_resident_id: form.complainant_resident?._id,
      complainant_display_name: form.complainant_resident?.name,
      complainant_address: form.complainant_address,
      contact_number: form.contact_number,
      date_of_complaint: new Date(form.date_of_complaint).toISOString(),
      time_of_complaint: form.time_of_complaint,
      category: form.category,
      person_complained_against_name: form.person_complained_against_name,
      processed_by_personnel: form.processed_by_personnel,
      status: form.status,
      notes_description: form.notes_description,
      proofs_base64: proofs_base64,
    };
    
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