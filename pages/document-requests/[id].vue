<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10"><v-progress-circular indeterminate color="primary" size="64"></v-progress-circular><p class="mt-2">Loading Request...</p></div>
    <div v-else-if="!form.requestor_resident_id"><v-alert type="warning" prominent border="start" text="Request not found."><template v-slot:append><v-btn to="/document-requests">Back to List</v-btn></template></v-alert></div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Document Request Details</h2>
          <p class="text-grey-darken-1">Reference #: {{ requestId }}</p>
        </v-col>
        <v-col class="text-right">
            <!-- Generate Button -->
            <v-btn
              v-if="isGeneratable"
              color="success"
              @click="generateDocument"
              prepend-icon="mdi-printer-outline"
              class="mr-2"
              size="large"
            >
              Generate & Print
            </v-btn>
            <!-- Edit/Save/Cancel Buttons -->
            <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn>
            <v-btn v-if="editMode" color="primary" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
            <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
            <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
          <!-- Requestor & Purpose -->
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Requestor</label>
              <v-text-field :model-value="form.requestor_details.name" variant="outlined" readonly hint="Requestor cannot be changed after creation." persistent-hint></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Purpose of Request <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field v-model="form.purpose" variant="outlined" :readonly="!editMode" :error-messages="v$.purpose.$errors.map(e => e.$message)"></v-text-field>
            </v-col>
          </v-row>

          <!-- Request Type & Status (Read-Only) -->
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Document Type</label>
              <v-text-field :model-value="form.request_type" variant="outlined" readonly></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Current Status</label>
              <v-text-field :model-value="form.document_status" variant="outlined" readonly>
                <template v-slot:prepend-inner><v-chip :color="getStatusColor(form.document_status)" label size="small">{{ form.document_status }}</v-chip></template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-divider class="my-6"></v-divider>

          <!-- DYNAMIC DETAILS FORM -->
          <div v-if="form.request_type">
            <h3 class="text-h6 mb-4">{{ form.request_type }} - Details</h3>
            <!-- Certificate of Cohabitation -->
            <div v-if="form.request_type === 'Certificate of Cohabitation'">
              <v-row>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.male_partner_name" label="Full Name of Male Partner" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.male_partner_birthdate" label="Birthdate of Male Partner" type="date" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.female_partner_name" label="Full Name of Female Partner" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.female_partner_birthdate" label="Birthdate of Female Partner" type="date" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.year_started_cohabiting" label="Year Started Living Together" type="number" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
              </v-row>
            </div>
            <!-- Barangay Clearance -->
            <div v-if="form.request_type === 'Barangay Clearance'">
              <v-row>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.type_of_work" label="Type of Work" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.other_work" label="Other Work" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.number_of_storeys" label="Number of Storeys" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.purpose_of_clearance" label="Purpose of Clearance" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
              </v-row>
            </div>
            <!-- Barangay Business Clearance -->
            <div v-if="form.request_type === 'Barangay Business Clearance'">
              <v-row>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.business_name" label="Business Trade Name" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.nature_of_business" label="Nature of Business" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
              </v-row>
            </div>
            <!-- First Time Jobseeker -->
            <div v-if="form.request_type === 'Barangay Certification (First Time Jobseeker)'">
              <v-row>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.years_lived" label="Number of Years at Address" type="number" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field v-model="form.details.months_lived" label="Number of Months at Address" type="number" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
              </v-row>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>
    <!-- ... Delete confirmation dialog ... -->
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const requestId = route.params.id;

// --- STATE ---
const form = reactive({
  requestor_resident_id: null, purpose: '', request_type: null, document_status: '',
  requestor_details: {}, // To hold the nested requestor object from the API
  details: {} // To hold the dynamic form fields
});
const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

// --- VUELIDATE ---
const rules = computed(() => {
    const baseRules = { purpose: { required } };
    // Add conditional validation for dynamic fields here if needed
    // Example:
    // if (form.request_type === 'Barangay Business Clearance') {
    //     baseRules.details = { business_name: { required } };
    // }
    return baseRules;
});
const v$ = useVuelidate(rules, form);

// --- COMPUTED PROPERTIES ---
const isGeneratable = computed(() => {
  return ['Ready for Pickup', 'Released'].includes(form.document_status);
});

// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => { await fetchRequest(); });

async function fetchRequest(){
    loading.value = true;
    try {
        const { data, error } = await useMyFetch(`/api/document-requests/${requestId}`);
        if (error.value || !data.value?.request) throw new Error('Request not found.');
        
        const request = data.value.request;
        // Populate the form with all data, including the nested objects
        Object.assign(form, {
            ...request,
            requestor_details: {
                name: `${request.requestor_details.first_name} ${request.requestor_details.last_name}`.trim(),
                ...request.requestor_details // Keep all other requestor fields
            }
        });
        originalFormState.value = JSON.parse(JSON.stringify(form)); // Deep copy for cancel
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); router.push('/document-requests'); }
    finally { loading.value = false; }
}

// --- UI & ACTION HANDLERS ---
const toggleEditMode = (enable) => { editMode.value = enable; if (!enable) resetForm(); };
const cancelEdit = () => { resetForm(); toggleEditMode(false); };
const resetForm = () => { Object.assign(form, originalFormState.value); v$.value.$reset(); };

const baseURL = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:3001'
const generateDocument = () => {
  // Use the API endpoint directly to generate the PDF in a new tab
  // This is simpler than creating a dedicated frontend printable page
  const apiUrl = useRuntimeConfig().public.apiBase; // Get base API URL from Nuxt config
  window.open(`${baseURL}/api/document-requests/${requestId}/generate`, '_blank');
};

async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  saving.value = true;
  try {
    const payload = {
        requestor_resident_id: form.requestor_resident_id,
        request_type: form.request_type,
        purpose: form.purpose,
        details: form.details,
    };
    const { error } = await useMyFetch(`/api/document-requests/${requestId}`, { method: 'PUT', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update request.');
    
    $toast.fire({ title: 'Request updated successfully!', icon: 'success' });
    await fetchRequest();
    toggleEditMode(false);
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteRequest() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/document-requests/${requestId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete request.');
    $toast.fire({ title: 'Request deleted successfully!', icon: 'success' });
    router.push('/document-requests');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}

// --- HELPER FUNCTIONS ---
const getStatusColor = (status) => ({
    "Pending": 'orange-darken-1', "Processing": 'blue-darken-1', "Ready for Pickup": 'teal-darken-1',
    "Released": 'green-darken-1', "Denied": 'red-darken-2'
  }[status] || 'grey');
</script>