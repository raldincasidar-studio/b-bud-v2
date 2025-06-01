<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col><h2>File New Complaint</h2></v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveComplaint" prepend-icon="mdi-content-save" variant="tonal" :loading="saving" size="large">
          Submit Complaint
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-comment-alert-outline" title="Complaint Details">
      <v-card-text>
        <v-form ref="form">
          <!-- Complainant Section -->
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Complainant Name <span class="text-red">*</span></label>
              <v-text-field
                v-model="complainantSearchQuery"
                label="Search Complainant (Resident)..."
                prepend-inner-icon="mdi-account-search-outline"
                variant="outlined" density="compact"
                clearable @click:clear="clearComplainantSelection"
                :loading="isLoadingComplainants"
                :rules="[rules.complainantSelected]"
                :hint="selectedComplainantName ? `Selected: ${selectedComplainantName}` : 'Type to search resident'"
                persistent-hint
              ></v-text-field>
              <div v-if="complainantSearchQuery && complainantSearchQuery.trim().length >= 2 && !isLoadingComplainants" class="search-results-container">
                <v-list v-if="complainantSearchResults.length > 0" density="compact" class="elevation-1 search-results-list">
                    <v-list-item
                    v-for="resident in complainantSearchResults" :key="resident._id" @click="selectComplainant(resident)"
                    :title="`${resident.first_name} ${resident.middle_name || ''} ${resident.last_name}`"
                    ripple
                    ><v-list-item-subtitle>{{ resident.email || 'No email' }}</v-list-item-subtitle></v-list-item>
                </v-list>
                <p v-else class="text-grey pa-3 text-center">No residents found for complainant.</p>
              </div>
            </v-col>
             <v-col cols="12" md="6">
                <v-text-field
                    v-model="complaint.complainant_address"
                    label="Complainant Address"
                    :rules="[rules.required]"
                    variant="outlined" density="compact" required
                    placeholder="Auto-fills or enter manually"
                ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
             <v-col cols="12" md="6">
                <v-text-field
                    v-model="complaint.contact_number"
                    label="Complainant Contact Number"
                    :rules="[rules.required, rules.contactFormat]"
                    variant="outlined" density="compact" required
                    placeholder="Auto-fills or enter manually"
                    type="tel"
                ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="complaint.date_of_complaint"
                label="Date of Complaint"
                type="date"
                :rules="[rules.required]"
                variant="outlined" density="compact" required
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="complaint.time_of_complaint"
                label="Time of Complaint"
                type="time"
                :rules="[rules.required]"
                variant="outlined" density="compact" required
              ></v-text-field>
            </v-col>
             <!-- Person Complained Against Section -->
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Person Complained Against <span class="text-red">*</span></label>
              <v-text-field
                v-model="personComplainedSearchQuery"
                label="Search Resident or Enter Name..."
                prepend-inner-icon="mdi-account-search-outline"
                variant="outlined" density="compact"
                clearable @click:clear="clearPersonComplainedSelection"
                :loading="isLoadingPersonComplained"
                :rules="[rules.personComplainedRequired]"
                :hint="selectedPersonComplainedIsResident ? `Selected Resident: ${selectedPersonComplainedName}` : (personComplainedSearchQuery ? `Entered: ${personComplainedSearchQuery}` : 'Search or type full name')"
                persistent-hint
              ></v-text-field>
               <div v-if="personComplainedSearchQuery && personComplainedSearchQuery.trim().length >= 2 && !isLoadingPersonComplained && !selectedPersonComplainedIsResident" class="search-results-container">
                <v-list v-if="personComplainedSearchResults.length > 0" density="compact" class="elevation-1 search-results-list">
                    <v-list-item
                        v-for="resident in personComplainedSearchResults" :key="resident._id" @click="selectPersonComplained(resident)"
                        :title="`${resident.first_name} ${resident.middle_name || ''} ${resident.last_name}`"
                        ripple
                    ><v-list-item-subtitle>{{ resident.email || 'No email' }}</v-list-item-subtitle></v-list-item>
                </v-list>
                 <p v-else class="text-grey pa-3 text-center">No residents found. You can still enter the name manually.</p>
              </div>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="complaint.status"
                label="Initial Status"
                :items="statusOptions"
                :rules="[rules.required]"
                variant="outlined" density="compact" required
              ></v-select>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="complaint.notes_description"
                label="Notes / Description of Complaint"
                :rules="[rules.required]"
                variant="outlined" rows="5" auto-grow required
              ></v-textarea>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const form = ref(null);

const complaint = ref({
  complainant_address: '',
  contact_number: '',
  date_of_complaint: new Date().toISOString().split('T')[0],
  time_of_complaint: new Date().toTimeString().slice(0,5),
  status: 'New',
  notes_description: '',
});
const saving = ref(false);

// Complainant search state
const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);
const selectedComplainantId = ref(null);
const selectedComplainantName = ref('');

// Person Complained Against search state
const personComplainedSearchQuery = ref(''); // This will hold the text input value for name
const personComplainedSearchResults = ref([]);
const isLoadingPersonComplained = ref(false);
const selectedPersonComplainedId = ref(null); // If a resident is selected from search
const selectedPersonComplainedName = ref(''); // To display name if selected, or store manually typed name
const selectedPersonComplainedIsResident = ref(false); // Flag if selected from search

const statusOptions = ['New', 'Under Investigation', 'Resolved', 'Closed', 'Dismissed'];

const rules = {
  required: value => !!value || 'This field is required.',
  complainantSelected: value => !!selectedComplainantId.value || 'A complainant (resident) must be selected.',
  personComplainedRequired: value => !!personComplainedSearchQuery.value.trim() || 'Person complained against is required.',
  contactFormat: value => (/^\+?[0-9\s-]{7,15}$/.test(value) || value === '') || 'Invalid contact number format.',
};

function debounce(func, delay) { let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>func.apply(this,a),delay);};}

const searchResidentsAPI = async (query, type) => {
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  if (trimmedQuery.length < 2) {
    if (type === 'complainant') complainantSearchResults.value = [];
    if (type === 'personComplained') personComplainedSearchResults.value = [];
    return;
  }
  if (type === 'complainant') isLoadingComplainants.value = true;
  if (type === 'personComplained') isLoadingPersonComplained.value = true;

  try {
    const { data, error } = await useMyFetch('/api/residents/search', { query: { q: trimmedQuery } });
    if (error.value) { console.error(`Error searching ${type}:`, error.value);
    } else {
      if (type === 'complainant') complainantSearchResults.value = data.value?.residents || [];
      if (type === 'personComplained') personComplainedSearchResults.value = data.value?.residents || [];
    }
  } catch (e) { console.error(`Exception searching ${type}:`, e);
  } finally {
    if (type === 'complainant') isLoadingComplainants.value = false;
    if (type === 'personComplained') isLoadingPersonComplained.value = false;
  }
};

// --- Complainant Search ---
const debouncedComplainantSearch = debounce((query) => searchResidentsAPI(query, 'complainant'), 500);
watch(complainantSearchQuery, (nq) => {
  if (nq === selectedComplainantName.value && selectedComplainantId.value) return;
  if (!nq || nq.trim() === '') { complainantSearchResults.value = []; clearComplainantSelection(false); /* Don't clear input */}
  else { debouncedComplainantSearch(nq); }
});
const selectComplainant = (res) => {
  selectedComplainantId.value = res._id;
  const n = `${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();
  selectedComplainantName.value = n;
  complainantSearchQuery.value = n;
  complaint.value.complainant_address = `${res.address_house_number||''} ${res.address_street||''}, ${res.address_subdivision_zone||''}, ${res.address_city_municipality||''}`.replace(/ ,/g,',').replace(/^,|,$/g,'').trim();
  complaint.value.contact_number = res.contact_number || '';
  complainantSearchResults.value = [];
};
const clearComplainantSelection = (clearInput = true) => {
  if(clearInput) complainantSearchQuery.value = '';
  selectedComplainantId.value = null; selectedComplainantName.value = '';
  complaint.value.complainant_address = ''; complaint.value.contact_number = '';
  complainantSearchResults.value = [];
};

// --- Person Complained Against Search ---
const debouncedPersonComplainedSearch = debounce((query) => searchResidentsAPI(query, 'personComplained'), 500);
watch(personComplainedSearchQuery, (nq) => {
  // If user types, it means they are potentially overriding a selection or typing manually
  selectedPersonComplainedIsResident.value = false; // Assume manual entry until a selection is made
  selectedPersonComplainedId.value = null; // Clear resident ID if user types
  
  if (!nq || nq.trim().length < 2) { personComplainedSearchResults.value = []; }
  else { debouncedPersonComplainedSearch(nq); }
});
const selectPersonComplained = (resident) => {
  selectedPersonComplainedId.value = resident._id;
  const name = `${resident.first_name || ''} ${resident.middle_name || ''} ${resident.last_name || ''}`.trim();
  selectedPersonComplainedName.value = name; // Store for display if needed
  personComplainedSearchQuery.value = name; // Fill input with selected name
  selectedPersonComplainedIsResident.value = true; // Mark as selected from residents
  personComplainedSearchResults.value = [];
};
const clearPersonComplainedSelection = () => {
  personComplainedSearchQuery.value = '';
  selectedPersonComplainedId.value = null;
  selectedPersonComplainedName.value = '';
  selectedPersonComplainedIsResident.value = false;
  personComplainedSearchResults.value = [];
};

async function saveComplaint() {
  const { valid } = await form.value.validate();
  if (!valid) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  if (!selectedComplainantId.value) { $toast.fire({ title: 'Please select a complainant resident.', icon: 'warning' }); return; }
  if (!personComplainedSearchQuery.value.trim()) { $toast.fire({title: 'Person complained against is required.', icon: 'warning'}); return; }

  saving.value = true;
  try {
    const payload = {
      ...complaint.value,
      complainant_resident_id: selectedComplainantId.value,
      complainant_display_name: selectedComplainantName.value,
      person_complained_against_name: personComplainedSearchQuery.value.trim(), // Always use the text from the input field
      person_complained_against_resident_id: selectedPersonComplainedIsResident.value ? selectedPersonComplainedId.value : null, // Send ID only if a resident was selected
      date_of_complaint: new Date(complaint.value.date_of_complaint).toISOString(),
    };
    const { data, error } = await useMyFetch('/api/complaints', { method: 'POST', body: payload });
    if (error.value || data.value?.error) { $toast.fire({ title: data.value?.error || 'Failed to submit complaint', icon: 'error' });
    } else { $toast.fire({ title: 'Complaint submitted successfully!', icon: 'success' }); router.push('/complaints'); }
  } catch (e) { console.error(e); $toast.fire({ title: 'An error occurred.', icon: 'error' }); }
  finally { saving.value = false; }
}
</script>

<style scoped>
.search-results-list { max-height: 150px; overflow-y: auto; border: 1px solid #e0e0e0; margin-top: -1px; background-color: white; z-index: 100; position:absolute; width: calc(100% - 20px); /* Adjust if parent col has padding */ left: 10px; /* Adjust if parent col has padding */ }
.v-label {opacity:var(--v-high-emphasis-opacity);font-size:0.875rem;color:rgba(var(--v-theme-on-surface),var(--v-high-emphasis-opacity));display:block;margin-bottom:4px;}
</style>