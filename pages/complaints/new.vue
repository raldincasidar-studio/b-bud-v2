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
                v-model="form.complainant_resident_id"
                v-model:search="complainantSearchQuery"
                label="Search Complainant (Resident)..."
                variant="outlined"
                :items="complainantSearchResults"
                item-title="name"
                item-value="_id"
                :loading="isLoadingComplainants"
                :error-messages="v$.complainant_resident_id.$errors.map(e => e.$message)"
                @blur="v$.complainant_resident_id.$touch"
                @update:model-value="onComplainantSelect"
                no-filter
              >
                  <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item>
                  </template>
              </v-autocomplete>
            </v-col>
             <v-col cols="12" md="6">
                <v-text-field
                    v-model="form.complainant_address"
                    label="Complainant Address"
                    variant="outlined"
                    :error-messages="v$.complainant_address.$errors.map(e => e.$message)"
                    @blur="v$.complainant_address.$touch"
                ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
             <v-col cols="12" md="6">
                <v-text-field
                    v-model="form.contact_number"
                    label="Complainant Contact Number"
                    variant="outlined"
                    type="tel"
                    :error-messages="v$.contact_number.$errors.map(e => e.$message)"
                    @blur="v$.contact_number.$touch"
                ></v-text-field>
            </v-col>
            <v-col cols="12" md="3">
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
              <v-autocomplete
                v-model:search="personComplainedSearchQuery"
                label="Search Resident or Enter Name..."
                variant="outlined"
                :items="personComplainedSearchResults"
                item-title="name"
                item-value="_id"
                :loading="isLoadingPersonComplained"
                :error-messages="v$.person_complained_against_name.$errors.map(e => e.$message)"
                @blur="v$.person_complained_against_name.$touch"
                @update:model-value="onPersonComplainedSelect"
                no-filter
              >
                  <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item>
                  </template>
                  <template v-slot:no-data>
                    <v-list-item>
                        <v-list-item-title>No resident found. Name will be saved as entered.</v-list-item-title>
                    </v-list-item>
                  </template>
              </v-autocomplete>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.status"
                label="Initial Status"
                :items="['New']"
                variant="outlined"
                :error-messages="v$.status.$errors.map(e => e.$message)"
                @blur="v$.status.$touch"
              ></v-select>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.notes_description"
                label="Notes / Description of Complaint"
                variant="outlined" rows="5" auto-grow
                :error-messages="v$.notes_description.$errors.map(e => e.$message)"
                @blur="v$.notes_description.$touch"
              ></v-textarea>
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
  complainant_resident_id: null, complainant_display_name: '', complainant_address: '', contact_number: '',
  date_of_complaint: new Date().toISOString().split('T')[0],
  time_of_complaint: new Date().toTimeString().slice(0,5),
  person_complained_against_resident_id: null, person_complained_against_name: '',
  status: 'New', notes_description: '',
});
const saving = ref(false);

const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);

const personComplainedSearchQuery = ref('');
const personComplainedSearchResults = ref([]);
const isLoadingPersonComplained = ref(false);

// Vuelidate Rules
const rules = {
    complainant_resident_id: { required: helpers.withMessage('A complainant must be selected.', required) },
    complainant_address: { required }, contact_number: { required }, date_of_complaint: { required }, time_of_complaint: { required },
    person_complained_against_name: { required: helpers.withMessage('The person being complained against is required.', required) },
    status: { required }, notes_description: { required }
};
const v$ = useVuelidate(rules, form);

// --- Debounced Search ---
const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };

const searchResidentsAPI = debounce(async (query, type) => {
    const loadingRef = type === 'complainant' ? isLoadingComplainants : isLoadingPersonComplained;
    const resultsRef = type === 'complainant' ? complainantSearchResults : personComplainedSearchResults;
    if (!query || query.trim().length < 2) { resultsRef.value = []; return; }
    
    loadingRef.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error(`Error searching for ${type}.`);
        resultsRef.value = data.value?.residents.map(r => ({
            _id: r._id, name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            email: r.email, address: `${r.address_house_number||''} ${r.address_street||''}, ${r.address_subdivision_zone||''}`, contact_number: r.contact_number
        })) || [];
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { loadingRef.value = false; }
}, 500);

// --- Watchers for Search Fields ---
watch(complainantSearchQuery, (newQuery) => {
    if (form.complainant_resident_id && newQuery === form.complainant_display_name) return;
    if (!newQuery) clearComplainantSelection();
    searchResidentsAPI(newQuery, 'complainant');
});

watch(personComplainedSearchQuery, (newQuery) => {
    form.person_complained_against_name = newQuery;
    if (form.person_complained_against_resident_id && newQuery !== form.person_complained_against_name) {
        form.person_complained_against_resident_id = null;
    }
    searchResidentsAPI(newQuery, 'personComplained');
});

// --- Selection Handlers ---
const clearComplainantSelection = () => {
    form.complainant_resident_id = null; form.complainant_display_name = '';
    form.complainant_address = ''; form.contact_number = '';
    complainantSearchResults.value = [];
};

const onComplainantSelect = (selectedId) => {
    if (!selectedId) { clearComplainantSelection(); return; }
    const resident = complainantSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;
    
    form.complainant_display_name = resident.name;
    form.complainant_address = resident.address;
    form.contact_number = resident.contact_number;
    complainantSearchQuery.value = resident.name; // Sync search text
    complainantSearchResults.value = [];
};

const onPersonComplainedSelect = (selectedId) => {
    if (!selectedId) { form.person_complained_against_resident_id = null; return; }
    const resident = personComplainedSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;

    form.person_complained_against_resident_id = resident._id;
    form.person_complained_against_name = resident.name;
    personComplainedSearchQuery.value = resident.name; // Sync search text
    personComplainedSearchResults.value = [];
};

// --- Save Logic ---
async function saveComplaint() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct all errors on the form.', icon: 'error' }); return; }
  
  saving.value = true;
  try {
    const payload = { ...form, date_of_complaint: new Date(form.date_of_complaint).toISOString() };
    const { error } = await useMyFetch('/api/complaints', { method: 'POST', body: payload });
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
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
</style>