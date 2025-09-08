<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">New Document Request</h2>
        <p class="text-grey-darken-1">Select a document type and fill in the required details.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveRequest" prepend-icon="mdi-content-save" :loading="saving" size="large">
          Submit Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-text class="py-6">
        <!-- Step 1: General Information -->
        <h3 class="text-h6 mb-4">Requestor Information</h3>
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Requestor (Resident) <span class="text-red">*</span></label>
            <v-autocomplete
              v-model="form.requestor_resident"
              v-model:search="requestorSearchQuery"
              label="Search for a resident..."
              variant="outlined"
              :items="requestorSearchResults"
              item-title="name"
              return-object
              :loading="isLoadingRequestors"
              :error-messages="v$.requestor_resident.$errors.map(e => e.$message)"
              @blur="v$.requestor_resident.$touch"
              no-filter
            >
              <!-- UPDATED: Template now checks both 'status' and 'account_status' -->
              <template v-slot:item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :title="item.raw.name"
                  :subtitle="item.raw.address"
                  :disabled="item.raw.status !== 'Approved' || item.raw.account_status !== 'Active'"
                >
                  <template v-slot:append>
                    <v-chip
                      v-if="item.raw.status === 'Pending'"
                      color="orange-darken-1" variant="tonal" size="small" label
                    >
                      Pending
                    </v-chip>
                    <v-chip
                      v-else-if="item.raw.status === 'Declined'"
                      color="red-darken-2" variant="tonal" size="small" label
                    >
                      Declined
                    </v-chip>
                    <v-chip
                      v-else-if="item.raw.status === 'Deactivated'"
                      color="grey-darken-1" variant="tonal" size="small" label
                    >
                      Deactivated
                    </v-chip>
                    <v-chip
                      v-else-if="item.raw.account_status !== 'Active'"
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
             <label class="v-label mb-1">Request Processed By (Personnel) <span class="text-red">*</span></label>
             <v-text-field
                v-model="form.processed_by_personnel"
                variant="outlined"
                readonly
                hint="This is automatically filled with the logged-in user's name."
                :error-messages="v$.processed_by_personnel.$errors.map(e => e.$message)"
                @blur="v$.processed_by_personnel.$touch"
              ></v-text-field>
          </v-col>
          <v-col cols="12">
            <label class="v-label mb-1">Purpose of Document Request</label>
            <v-textarea
              v-model="form.purpose"
              label="Enter the purpose for requesting this document"
              variant="outlined"
              :error-messages="v$.purpose.$errors.map(e => e.$message)"
              @blur="v$.purpose.$touch"
              rows="3"
              auto-grow
            ></v-textarea>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>

        <!-- Step 2: Select Document Type -->
        <h3 class="text-h6 mb-4">Document Details</h3>
        <v-row>
          <v-col cols="12">
            <label class="v-label mb-1">Type of Document to Request <span class="text-red">*</span></label>
            <v-select
              v-model="form.request_type" variant="outlined"
              :items="documentTypes" label="Select a document"
              :error-messages="v$.request_type.$errors.map(e => e.$message)"
              @blur="v$.request_type.$touch"
            ></v-select>
          </v-col>
        </v-row>

        <!-- Step 3: DYNAMIC FORM FIELDS based on selection -->
        <div v-if="form.request_type">
          <v-divider class="my-6"></v-divider>
          <h3 class="text-h6 mb-4">{{ form.request_type }} - Required Information</h3>
          
          <div v-if="form.request_type === 'Certificate of Cohabitation'">
            <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.male_partner_name" label="Full Name of Male Partner" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.male_partner_birthdate" label="Birthdate of Male Partner" type="date" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.female_partner_name" label="Full Name of Female Partner" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.female_partner_birthdate" label="Birthdate of Female Partner" type="date" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.year_started_cohabiting" label="Year Started Living Together" type="number" variant="outlined"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Clearance'">
            <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.type_of_work" label="Type of Work (e.g., sidewalk repair)" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.other_work" label="Other Work (e.g., drainage tapping)" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.number_of_storeys" label="Number of Storeys" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.purpose_of_clearance" label="Purpose of this Clearance" variant="outlined"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Business Clearance'">
             <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.business_name" label="Business Trade Name" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.nature_of_business" label="Nature of Business" variant="outlined"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Certification (First Time Jobseeker)'">
            <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.years_lived" label="Number of Years at Address" type="number" variant="outlined"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.months_lived" label="Number of Months at Address" type="number" variant="outlined"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Certificate of Indigency'">
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.details.medical_educational_financial"
                  :items="['Medical', 'Educational', 'Financial']"
                  label="Medical/Educational/Financial"
                  variant="outlined"
                ></v-select>
              </v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Permit (for installations)'">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.details.installation_construction_repair"
                  label="Installation/Construction/Repair"
                  variant="outlined"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.details.project_site"
                  label="Project Site"
                  variant="outlined"
                ></v-text-field>
              </v-col>
            </v-row>
          </div>
          
        </div>
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

const documentTypes = [
  'Certificate of Cohabitation', 'Certificate of Good Moral', 'Certificate of Residency',
  'Certificate of Solo Parent', 'Certificate of Indigency', 'Barangay Clearance',
  'Barangay Permit (for installations)', 'Barangay Business Clearance', 'Barangay Certification (First Time Jobseeker)',
];

const form = reactive({
  requestor_resident: null,
  processed_by_personnel: '',
  request_type: null,
  purpose: null,
  details: {}
});
const saving = ref(false);

const requestorSearchQuery = ref('');
const requestorSearchResults = ref([]);
const isLoadingRequestors = ref(false);

const rules = {
    requestor_resident: {
        required: helpers.withMessage('A requestor must be selected.', required),
        // UPDATED: Check both 'status' and 'account_status'
        isEligible: helpers.withMessage(
            (value) => {
                if (!value) return "Requestor not selected."; // Should be caught by 'required'
                if (value.status === 'Pending') return "Resident account is pending approval and cannot make requests.";
                if (value.status === 'Declined') return "Resident account has been declined and cannot make requests.";
                if (value.status === 'Deactivated') return "Resident account has been permanently deactivated and cannot make requests.";
                if (value.account_status !== 'Active') return "This resident's account is On Hold and cannot make new requests.";
                return true; // Should not be reached if it's active
            },
            (value) => {
                if (!value) return true; // Let 'required' handle empty selections
                return value.status === 'Approved' && value.account_status === 'Active';
            }
        )
    },
    processed_by_personnel: { required: helpers.withMessage('Processed by personnel is required.', required) },
    purpose: {},
    request_type: { required },
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

const debounce = (fn,delay) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),delay); }; };

const searchResidentsAPI = debounce(async (query) => {
    if (!query || query.trim().length < 2) {
        requestorSearchResults.value = [];
        return;
    }
    isLoadingRequestors.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if(error.value) throw new Error('Error searching residents.');
        
        requestorSearchResults.value = data.value?.residents.map(r => {
            const addressParts = [
                r.address_house_number,
                r.address_street,
                r.address_subdivision_zone
            ].filter(Boolean);
            const fullAddress = addressParts.join(', ').trim();

            return {
                _id: r._id,
                name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                address: fullAddress || 'No address available',
                email: r.email,
                status: r.status, // ADDED: Project 'status' here
                account_status: r.account_status
            };
        }) || [];

    } catch(e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        isLoadingRequestors.value = false;
    }
}, 500);

watch(requestorSearchQuery, (nq) => { searchResidentsAPI(nq); });

async function saveRequest() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please complete all required fields.', icon: 'error' });
    return;
  }
  
  saving.value = true;
  try {
    const payload = {
        requestor_resident_id: form.requestor_resident._id,
        processed_by_personnel: form.processed_by_personnel,
        purpose: form.purpose,
        request_type: form.request_type,
        details: form.details,
    };
    const { error } = await useMyFetch('/api/document-requests', { method: 'POST', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to submit request.');
    
    $toast.fire({ title: 'Request submitted successfully!', icon: 'success' });
    router.push('/document-requests');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>