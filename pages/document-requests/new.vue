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
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Full Name of Male Partner <span class="text-red">*</span></label>
                <v-autocomplete
                  v-model="form.details.male_partner"
                  v-model:search="malePartnerSearchQuery"
                  label="Search for male partner..."
                  variant="outlined"
                  :items="malePartnerSearchResults"
                  item-title="name"
                  return-object
                  :loading="isLoadingMalePartners"
                  :error-messages="v$.details.male_partner.$errors.map(e => e.$message)"
                  @blur="v$.details.male_partner.$touch"
                  no-filter
                  @update:model-value="handleMalePartnerSelection"
                >
                  <template v-slot:item="{ props, item }">
                    <v-list-item
                      v-bind="props"
                      :title="item.raw.name"
                      :subtitle="item.raw.address"
                    ></v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.details.male_partner_birthdate" label="Birthdate of Male Partner" type="date" variant="outlined"
                  :error-messages="v$.details.male_partner_birthdate.$errors.map(e => e.$message)"
                  @blur="v$.details.male_partner_birthdate.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Full Name of Female Partner <span class="text-red">*</span></label>
                <v-autocomplete
                  v-model="form.details.female_partner"
                  v-model:search="femalePartnerSearchQuery"
                  label="Search for female partner..."
                  variant="outlined"
                  :items="femalePartnerSearchResults"
                  item-title="name"
                  return-object
                  :loading="isLoadingFemalePartners"
                  :error-messages="v$.details.female_partner.$errors.map(e => e.$message)"
                  @blur="v$.details.female_partner.$touch"
                  no-filter
                  @update:model-value="handleFemalePartnerSelection"
                >
                  <template v-slot:item="{ props, item }">
                    <v-list-item
                      v-bind="props"
                      :title="item.raw.name"
                      :subtitle="item.raw.address"
                    ></v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.details.female_partner_birthdate" label="Birthdate of Female Partner" type="date" variant="outlined"
                  :error-messages="v$.details.female_partner_birthdate.$errors.map(e => e.$message)"
                  @blur="v$.details.female_partner_birthdate.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.year_started_cohabiting" label="Year Started Living Together" type="number" variant="outlined"
                  :error-messages="v$.details.year_started_cohabiting.$errors.map(e => e.$message)"
                  @blur="v$.details.year_started_cohabiting.$touch"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Clearance'">
            <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.type_of_work" label="Type of Work (e.g., sidewalk repair)" variant="outlined"
                  :error-messages="v$.details.type_of_work.$errors.map(e => e.$message)"
                  @blur="v$.details.type_of_work.$touch"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.other_work" label="Other Work (e.g., drainage tapping)" variant="outlined"
                  :error-messages="v$.details.other_work.$errors.map(e => e.$message)"
                  @blur="v$.details.other_work.$touch"></v-text-field></v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Number of Storeys <span class="text-red">*</span></label>
                <v-text-field v-model="form.details.number_of_storeys" label="Number of Storeys" type="number" variant="outlined"
                  :error-messages="v$.details.number_of_storeys.$errors.map(e => e.$message)"
                  @blur="v$.details.number_of_storeys.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.purpose_of_clearance" label="Purpose of this Clearance" variant="outlined"
                  :error-messages="v$.details.purpose_of_clearance.$errors.map(e => e.$message)"
                  @blur="v$.details.purpose_of_clearance.$touch"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Business Clearance'">
             <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.business_name" label="Business Trade Name" variant="outlined"
                  :error-messages="v$.details.business_name.$errors.map(e => e.$message)"
                  @blur="v$.details.business_name.$touch"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.nature_of_business" label="Nature of Business" variant="outlined"
                  :error-messages="v$.details.nature_of_business.$errors.map(e => e.$message)"
                  @blur="v$.details.nature_of_business.$touch"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Business Permit'">
             <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.business_name" label="Business Trade Name" variant="outlined"
                  :error-messages="v$.details.business_name.$errors.map(e => e.$message)"
                  @blur="v$.details.business_name.$touch"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.business_address" label="Business Address" variant="outlined"
                  :error-messages="v$.details.business_address.$errors.map(e => e.$message)"
                  @blur="v$.details.business_address.$touch"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Certification (First Time Jobseeker)'">
            <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.years_lived" label="Number of Years at Address" type="number" variant="outlined"
                  :error-messages="v$.details.years_lived.$errors.map(e => e.$message)"
                  @blur="v$.details.years_lived.$touch"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="form.details.months_lived" label="Number of Months at Address" type="number" variant="outlined"
                  :error-messages="v$.details.months_lived.$errors.map(e => e.$message)"
                  @blur="v$.details.months_lived.$touch"></v-text-field></v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Certificate of Indigency'">
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Medical/Educational/Financial <span class="text-red">*</span></label>
                <v-select
                  v-model="form.details.medical_educational_financial"
                  :items="['Medical', 'Educational', 'Financial']"
                  label="Medical/Educational/Financial"
                  variant="outlined"
                  :error-messages="v$.details.medical_educational_financial.$errors.map(e => e.$message)"
                  @blur="v$.details.medical_educational_financial.$touch"
                ></v-select>
              </v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay BADAC Certificate'">
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">BADAC PURPOSE <span class="text-red">*</span></label>
                <v-select
                  v-model="form.details.badac_certificate"
                  :items="['PNP Application', 'School Requirement', 'Job Application', 'Board Exam', 'Others']"
                  label="BADAC PURPOSE"
                  variant="outlined"
                  :error-messages="v$.details.badac_certificate.$errors.map(e => e.$message)"
                  @blur="v$.details.badac_certificate.$touch"
                ></v-select>
              </v-col>
            </v-row>
          </div>

          <div v-if="form.request_type === 'Barangay Permit (for installations)'">
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Installation/Construction/Repair <span class="text-red">*</span></label>
                <v-text-field
                  v-model="form.details.installation_construction_repair"
                  label="Installation/Construction/Repair"
                  variant="outlined"
                  :error-messages="v$.details.installation_construction_repair.$errors.map(e => e.$message)"
                  @blur="v$.details.installation_construction_repair.$touch"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Project Site <span class="text-red">*</span></label>
                <v-text-field
                  v-model="form.details.project_site"
                  label="Project Site"
                  variant="outlined"
                  :error-messages="v$.details.project_site.$errors.map(e => e.$message)"
                  @blur="v$.details.project_site.$touch"
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
import { reactive, ref, watch, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers, minValue } from '@vuelidate/validators'; // Import minValue
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp, useCookie } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();

const documentTypes = [
  'Barangay Clearance', 'Barangay Permit (for installations)', 'Certificate of Indigency', 
  'Certificate of Solo Parent', 'Certificate of Residency', 'Barangay Business Permit',
  'Barangay BADAC Certificate', 'Certificate of Good Moral', 'Certificate of Cohabitation', 
  'Barangay Business Clearance', 'Barangay Certification (First Time Jobseeker)', 'Certificate of Oneness'
    
];

const form = reactive({
  requestor_resident: null,
  processed_by_personnel: '',
  request_type: null,
  purpose: null,
  details: {} // Initialize as an empty object
});
const saving = ref(false);

const requestorSearchQuery = ref('');
const requestorSearchResults = ref([]);
const isLoadingRequestors = ref(false);

const malePartnerSearchQuery = ref('');
const malePartnerSearchResults = ref([]);
const isLoadingMalePartners = ref(false);

const femalePartnerSearchQuery = ref('');
const femalePartnerSearchResults = ref([]);
const isLoadingFemalePartners = ref(false);

// Define specific rules for each document type
const cohabitationRules = {
  male_partner: { required: helpers.withMessage('Male partner is required.', required) },
  male_partner_birthdate: { required: helpers.withMessage('Male partner birthdate is required.', required) },
  female_partner: { required: helpers.withMessage('Female partner is required.', required) },
  female_partner_birthdate: { required: helpers.withMessage('Female partner birthdate is required.', required) },
  year_started_cohabiting: {
    required: helpers.withMessage('Year started living together is required.', required),
    minValue: helpers.withMessage('Year cannot be negative.', minValue(0))
  },
};

const barangayClearanceRules = {
  type_of_work: { required: helpers.withMessage('Type of Work is required.', required) },
  other_work: {}, // Optional
  number_of_storeys: {
    required: helpers.withMessage('Number of storeys is required.', required),
    minValue: helpers.withMessage('Number of storeys cannot be negative.', minValue(0))
  },
  purpose_of_clearance: { required: helpers.withMessage('Purpose of Clearance is required.', required) },
};

const barangayBusinessClearanceRules = {
  business_name: { required: helpers.withMessage('Business Trade Name is required.', required) },
  nature_of_business: { required: helpers.withMessage('Nature of Business is required.', required) },
};
const barangayBusinessPermitRules = {
  business_name: { required: helpers.withMessage('Business Trade Name is required.', required) },
  business_address: { required: helpers.withMessage('Business address is required.', required) },
};

const firstTimeJobseekerRules = {
  years_lived: {
    required: helpers.withMessage('Number of Years at Address is required.', required),
    minValue: helpers.withMessage('Years cannot be negative.', minValue(0))
  },
  months_lived: {
    required: helpers.withMessage('Number of Months at Address is required.', required),
    minValue: helpers.withMessage('Months cannot be negative.', minValue(0)),
  },
};

const certificateOfIndigencyRules = {
  medical_educational_financial: { required: helpers.withMessage('Purpose (Medical/Educational/Financial) is required.', required) },
};

const barangayBadacCertificate = {
  badac_certificate: { required: helpers.withMessage('Purpose (PNP-application/school-requirement/job-application/board-exam/Others please specify) is required.', required) },
};

const barangayPermitRules = {
  installation_construction_repair: { required: helpers.withMessage('Type of activity is required.', required) },
  project_site: { required: helpers.withMessage('Project site is required.', required) },
};

// Make rules a computed property to be dynamic based on request_type
const rules = computed(() => {
  const baseRules = {
    requestor_resident: {
        required: helpers.withMessage('A requestor must be selected.', required),
        isEligible: helpers.withMessage(
            (value) => {
                if (!value) return "Requestor not selected.";
                if (value.status === 'Pending') return "Resident account is pending approval and cannot make requests.";
                if (value.status === 'Declined') return "Resident account has been declined and cannot make requests.";
                if (value.status === 'Deactivated') return "Resident account has been permanently deactivated and cannot make requests.";
                if (value.account_status !== 'Active') return "This resident's account is On Hold and cannot make new requests.";
                return true;
            },
            (value) => {
                if (!value) return true;
                return value.status === 'Approved' && value.account_status === 'Active';
            }
        )
    },
    processed_by_personnel: { required: helpers.withMessage('Processed by personnel is required.', required) },
    purpose: {}, // Purpose is optional for now
    request_type: { required: helpers.withMessage('Document type is required.', required) },
    details: {}, // Initialize details as an empty object for the base rules
  };

  // Conditionally apply rules for the 'details' object based on 'request_type'
  if (form.request_type === 'Certificate of Cohabitation') {
    baseRules.details = cohabitationRules;
  } else if (form.request_type === 'Barangay Clearance') {
    baseRules.details = barangayClearanceRules;
  } else if (form.request_type === 'Barangay Business Clearance') {
    baseRules.details = barangayBusinessClearanceRules;
  } else if (form.request_type === 'Barangay Business Permit') {
    baseRules.details = barangayBusinessPermitRules;
  } else if (form.request_type === 'Barangay Certification (First Time Jobseeker)') {
    baseRules.details = firstTimeJobseekerRules;
  } else if (form.request_type === 'Certificate of Indigency') {
    baseRules.details = certificateOfIndigencyRules;
  } else if (form.request_type === 'Barangay Permit (for installations)') {
    baseRules.details = barangayPermitRules;
  } else if (form.request_type === 'Barangay BADAC Certificate') {
    baseRules.details = barangayBadacCertificate;
  }
  // Add more `else if` for other document types as you define their rules.

  return baseRules;
});

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

const searchResidentsAPI = debounce(async (query, targetResults, targetLoading) => {
    if (!query || query.trim().length < 2) {
        targetResults.value = [];
        return;
    }
    targetLoading.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if(error.value) throw new Error('Error searching residents.');
        
        targetResults.value = data.value?.residents.map(r => {
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
                status: r.status,
                account_status: r.account_status,
                birthdate: r.birthdate // Assuming birthdate is available in resident data
            };
        }) || [];

    } catch(e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        targetLoading.value = false;
    }
}, 500);

// Watchers for search queries to trigger API calls
watch(requestorSearchQuery, (nq) => { searchResidentsAPI(nq, requestorSearchResults, isLoadingRequestors); });
watch(malePartnerSearchQuery, (nq) => { searchResidentsAPI(nq, malePartnerSearchResults, isLoadingMalePartners); });
watch(femalePartnerSearchQuery, (nq) => { searchResidentsAPI(nq, femalePartnerSearchResults, isLoadingFemalePartners); });

// Watch for changes in request_type to reset form.details and Vuelidate state
watch(() => form.request_type, (newType, oldType) => {
  if (newType !== oldType) {
    // Clear all previous details to ensure no stale data or validation
    // issues from a previously selected document type.
    form.details = {}; 

    // Reset Vuelidate for the 'details' section to clear errors
    // associated with the previous document type's fields.
    v$.value.details.$reset();

    // Re-initialize specific fields for the new type if needed
    // This step is important to ensure v-model has reactive properties to bind to.
    if (newType === 'Certificate of Cohabitation') {
      form.details.male_partner = null;
      form.details.male_partner_birthdate = null;
      form.details.female_partner = null;
      form.details.female_partner_birthdate = null;
      form.details.year_started_cohabiting = null;
    }
    if (newType === 'Barangay Clearance') {
      form.details.type_of_work = '';
      form.details.other_work = '';
      form.details.number_of_storeys = null; // Initialize number to null or 0
      form.details.purpose_of_clearance = '';
    }
    if (newType === 'Barangay Business Clearance') {
      form.details.business_name = '';
      form.details.nature_of_business = '';
    }
    if (newType === 'Barangay Business Permit') {
      form.details.business_name = '';
      form.details.business_address = '';
    }
    if (newType === 'Barangay Certification (First Time Jobseeker)') {
      form.details.years_lived = null;
      form.details.months_lived = null;
    }
    if (newType === 'Certificate of Indigency') {
      form.details.medical_educational_financial = null;
    }
    if (newType === 'Barangay BADAC Certificate') {
      form.details.badac_certificate = null;
    }
    if (newType === 'Barangay Permit (for installations)') {
      form.details.installation_construction_repair = '';
      form.details.project_site = '';
    }
  }
});

// Handlers for selection to auto-fill birthdates
const handleMalePartnerSelection = (selectedPartner) => {
  if (selectedPartner && selectedPartner.birthdate) {
    form.details.male_partner_birthdate = selectedPartner.birthdate.split('T')[0];
  } else {
    form.details.male_partner_birthdate = null;
  }
};

const handleFemalePartnerSelection = (selectedPartner) => {
  if (selectedPartner && selectedPartner.birthdate) {
    form.details.female_partner_birthdate = selectedPartner.birthdate.split('T')[0];
  } else {
    form.details.female_partner_birthdate = null;
  }
};


async function saveRequest() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please complete all required fields and correct invalid entries.', icon: 'error' });
    return;
  }
  
  saving.value = true;
  try {
    const payload = {
        requestor_resident_id: form.requestor_resident._id,
        processed_by_personnel: form.processed_by_personnel,
        purpose: form.purpose,
        request_type: form.request_type,
        details: {
          ...form.details,
          male_partner_id: form.details.male_partner ? form.details.male_partner._id : null,
          male_partner_name: form.details.male_partner ? form.details.male_partner.name : null,
          female_partner_id: form.details.female_partner ? form.details.female_partner._id : null,
          female_partner_name: form.details.female_partner ? form.details.female_partner.name : null,
        },
    };
    delete payload.details.male_partner;
    delete payload.details.female_partner;

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