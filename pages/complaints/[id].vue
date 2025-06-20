<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Complaint...</p>
    </div>
    <div v-else-if="!form.complainant_resident_id">
      <v-alert type="warning" prominent border="start" text="Complaint not found or could not be loaded.">
        <template v-slot:append><v-btn to="/complaints">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Complaint Details</h2>
          <p class="text-grey-darken-1">Reference #: {{ complaintId }}</p>
        </v-col>
        <v-col class="text-right">
          <!-- <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn> -->
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
            <!-- Complainant Details -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Complainant Name <span v-if="editMode" class="text-red">*</span></label>
                <v-autocomplete
                  v-if="editMode"
                  v-model="form.complainant_resident_id"
                  v-model:search="complainantSearchQuery"
                  label="Search Complainant..." variant="outlined" :items="complainantSearchResults" item-title="name" item-value="_id"
                  :loading="isLoadingComplainants" :error-messages="v$.complainant_resident_id.$errors.map(e => e.$message)"
                  @blur="v$.complainant_resident_id.$touch" @update:model-value="onComplainantSelect" no-filter
                >
                    <template v-slot:item="{ props, item }"><v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item></template>
                </v-autocomplete>
                <v-text-field v-else :model-value="form.complainant_display_name" variant="outlined" readonly></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Complainant Address <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.complainant_address" :readonly="!editMode" variant="outlined" :error-messages="v$.complainant_address.$errors.map(e => e.$message)" @blur="v$.complainant_address.$touch"></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="4">
                <label class="v-label mb-1">Contact Number <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.contact_number" type="tel" :readonly="!editMode" variant="outlined" :error-messages="v$.contact_number.$errors.map(e => e.$message)" @blur="v$.contact_number.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label mb-1">Date of Complaint <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.date_of_complaint" type="date" :readonly="!editMode" variant="outlined" :error-messages="v$.date_of_complaint.$errors.map(e => e.$message)" @blur="v$.date_of_complaint.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label mb-1">Time of Complaint <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.time_of_complaint" type="time" :readonly="!editMode" variant="outlined" :error-messages="v$.time_of_complaint.$errors.map(e => e.$message)" @blur="v$.time_of_complaint.$touch"></v-text-field>
              </v-col>
            </v-row>
            <v-divider class="my-4"></v-divider>
            <!-- Person Complained Against & Status -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Person Complained Against <span v-if="editMode" class="text-red">*</span></label>
                <v-autocomplete
                  v-if="editMode"
                  v-model:search="personComplainedSearchQuery"
                  label="Search Resident or Enter Name..."
                  variant="outlined" :items="personComplainedSearchResults" item-title="name" item-value="_id"
                  :loading="isLoadingPersonComplained" :error-messages="v$.person_complained_against_name.$errors.map(e => e.$message)"
                  @blur="v$.person_complained_against_name.$touch" @update:model-value="onPersonComplainedSelect" no-filter
                >
                    <template v-slot:item="{ props, item }"><v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item></template>
                    <template v-slot:no-data><v-list-item><v-list-item-title>No resident found. Name will be saved as entered.</v-list-item-title></v-list-item></template>
                </v-autocomplete>
                <v-text-field v-else :model-value="form.person_complained_against_name" variant="outlined" readonly></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Status</label>
                <v-text-field :model-value="form.status" variant="outlined" readonly messages="The status is managed via actions on the main list.">
                  <template v-slot:prepend-inner><v-chip :color="getStatusColor(form.status)" label size="small">{{ form.status }}</v-chip></template>
                </v-text-field>
              </v-col>
            </v-row>
            <!-- Description -->
            <v-row>
              <v-col cols="12">
                <label class="v-label mb-1">Category <span v-if="editMode" class="text-red">*</span></label>
                <v-select :readonly="!editMode" v-model="form.category" :items="complaintCategories" variant="outlined" :error-messages="v$.category.$errors.map(e => e.$message)" @blur="v$.category.$touch"></v-select>
              </v-col>
              <v-col cols="12">
                <label class="v-label mb-1">Description of Complaint <span v-if="editMode" class="text-red">*</span></label>
                <v-textarea v-model="form.notes_description" :readonly="!editMode" variant="outlined" rows="5" auto-grow :error-messages="v$.notes_description.$errors.map(e => e.$message)" @blur="v$.notes_description.$touch"></v-textarea>
              </v-col>
            </v-row>
        </v-card-text>
      </v-card>

      <!-- START: ADDED NOTES SECTION -->
      <v-card v-if="form.status === 'Under Investigation' || form.status === 'Resolved' || form.status === 'Dismissed'" class="mt-4" flat border>
        <v-card-title>Investigation Notes</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
          <!-- Display Notes -->
          <div v-if="notesLoading" class="text-center py-4">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p class="mt-2 text-grey-darken-1 text-caption">Loading Notes...</p>
          </div>
          <v-alert v-else-if="!investigationNotes.length" type="info" variant="tonal"  class="mb-4">
            No investigation notes have been added yet.
          </v-alert>
          <v-timeline v-else side="end" align="start"  class="mb-4">
            <v-timeline-item
              v-for="note in investigationNotes"
              :key="note._id"
              dot-color="blue-grey-lighten-1"
              size="small"
            >
              <template v-slot:opposite>
                <div class="text-caption text-grey-darken-1 pt-1">
                  <div>{{ formatDateTime(note.createdAt) }}</div>
                  <div class="font-weight-bold">{{ note.author?.name || 'System' }}</div>
                </div>
              </template>
              <v-alert class="pa-3" border="start"  color="blue-grey-lighten-5">
                <p class="text-body-2" style="white-space: pre-wrap;">{{ note.content }}</p>
              </v-alert>
            </v-timeline-item>
          </v-timeline>

          <v-divider class="my-4"></v-divider>
          
          <!-- Add Note Form -->
          <h4 class="text-subtitle-1 font-weight-medium mb-2">Add New Note</h4>
          <v-textarea
            v-model="newNoteContent"
            label="Write your note here..."
            variant="outlined"
            rows="3"
            auto-grow
            clearable
          ></v-textarea>
          <div class="d-flex justify-end mt-2">
            <v-btn
              color="primary"
              @click="addNote"
              :disabled="!newNoteContent || !newNoteContent.trim()"
              :loading="addingNote"
              prepend-icon="mdi-plus-circle-outline"
            >
              Add Note
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
      <!-- END: ADDED NOTES SECTION -->

      <!-- add new v-card for actions button -->
      <v-card class="mt-4">
        <v-card-title>Set Action</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
          <v-card-row>
            <v-col cols="12">
              <v-alert v-if="form.status === 'New'" type="info" class="my-2">Current Status: New</v-alert>
              <v-alert v-else-if="form.status === 'Under Investigation'" type="warning" class="my-2">Current Status: Under Investigation</v-alert>
              <v-alert v-else-if="form.status === 'Resolved'" type="success" class="my-2">Current Status: Resolved</v-alert>
              <v-alert v-else-if="form.status === 'Dismissed'" type="success" class="my-2">Current Status: Dismissed</v-alert>
              <v-alert v-else-if="form.status === 'Closed'" type="error" class="my-2">Current Status: Closed</v-alert>
              <!-- <v-alert v-if="form.status === 'Dismissed' || form.status === 'Closed' || form.status === 'Resolved'" type="info" class="my-2">No further action is required</v-alert> -->
            </v-col>
            <v-col cols="12">
              <v-btn v-if="form.status === 'New'" color="yellow-darken-1" size=large class="ma-2" @click="updateComplaintStatus('Under Investigation')" prepend-icon="mdi-magnify">Under Investigation</v-btn>
              <v-btn v-if="form.status === 'Under Investigation'" color="green-darken-1" size=large class="ma-2" @click="updateComplaintStatus('Resolved')" prepend-icon="mdi-check-circle">Resolved</v-btn>
              <v-btn v-if="form.status === 'New'" color="grey-darken-1" size=large class="ma-2" @click="updateComplaintStatus('Closed')" prepend-icon="mdi-archive-outline">Close</v-btn>
              <v-btn v-if="form.status === 'Under Investigation'" color="error" size=large class="ma-2" @click="updateComplaintStatus('Dismissed')" prepend-icon="mdi-cancel">Dismissed</v-btn>
            </v-col>
          </v-card-row>
        </v-card-text>
      </v-card>
    </div>
    
    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>Delete this complaint record? This action cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteComplaint" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const complaintId = route.params.id;

// --- STATE ---
const form = reactive({
  complainant_resident_id: null, complainant_display_name: '', complainant_address: '', contact_number: '',
  date_of_complaint: '', time_of_complaint: '',
  person_complained_against_resident_id: null, person_complained_against_name: '',
  status: 'New', notes_description: '',
  category: '',
});

const complaintCategories = ref([
  'Theft / Robbery',
  'Scam / Fraud',
  'Physical Assault / Violence',
  'Verbal Abuse / Threats',
  'Sexual Harassment / Abuse',
  'Vandalism',
  'Noise Disturbance',
  'Illegal Parking / Obstruction',
  'Drunk and Disorderly Behavior',
  'Curfew Violation / Minor Offenses',
  'Illegal Gambling',
  'Animal Nuisance / Stray Animal Concern',
  'Garbage / Sanitation Complaints',
  'Boundary Disputes / Trespassing',
  'Barangay Staff / Official Misconduct',
  'Others',
]);

const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);

const personComplainedSearchQuery = ref('');
const personComplainedSearchResults = ref([]);
const isLoadingPersonComplained = ref(false);

// START: NOTES STATE
const investigationNotes = ref([]);
const newNoteContent = ref('');
const notesLoading = ref(false);
const addingNote = ref(false);
// END: NOTES STATE

// --- VUELIDATE ---
const rules = {
    complainant_resident_id: { required: helpers.withMessage('A complainant must be selected.', required) },
    complainant_address: { required }, contact_number: { required }, date_of_complaint: { required }, time_of_complaint: { required },
    person_complained_against_name: { required: helpers.withMessage('The person being complained against is required.', required) },
    notes_description: { required },
    category: { required },
};
const v$ = useVuelidate(rules, form);

async function updateComplaintStatus(status){
  const {data, error} = await useMyFetch(`/api/complaints/${complaintId}/status`, { method: 'PATCH', body: { status } });
  if (error.value) $toast.fire({ title: error.value, icon: 'error' });
  if (data.value?.error) $toast.fire({ title: data.value?.error, icon: 'success' });
  await fetchComplaint();
}

// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => { 
  await fetchComplaint(); 
});

async function fetchComplaint(){
    loading.value = true;
    try {
        const { data, error } = await useMyFetch(`/api/complaints/${complaintId}`);
        if (error.value || !data.value?.complaint) throw new Error('Complaint not found.');
        const complaint = data.value.complaint;
        Object.assign(form, { ...complaint, date_of_complaint: formatDateForInput(complaint.date_of_complaint, 'date') });
        originalFormState.value = JSON.parse(JSON.stringify(form));
        complainantSearchQuery.value = form.complainant_display_name;
        personComplainedSearchQuery.value = form.person_complained_against_name;

        // Fetch notes if status is correct on initial load
        if (form.status === 'Under Investigation') {
          await fetchNotes();
        } else {
          investigationNotes.value = []; // Ensure notes are cleared if status is not relevant
        }
        
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); router.push('/complaints'); }
    finally { loading.value = false; }
}

// --- FORM & UI LOGIC ---
const toggleEditMode = (enable) => { editMode.value = enable; if (!enable) resetForm(); };
const cancelEdit = () => { resetForm(); toggleEditMode(false); };
const resetForm = () => { Object.assign(form, originalFormState.value); v$.value.$reset(); };

// --- SEARCH LOGIC ---
const debounce = (fn,delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this,a), delay); }; };
const searchResidentsAPI = debounce(async (query, type) => {
    const loadingRef = type === 'complainant' ? isLoadingComplainants : isLoadingPersonComplained;
    const resultsRef = type === 'complainant' ? complainantSearchResults : personComplainedSearchResults;
    if (!query || query.trim().length < 2) { resultsRef.value = []; return; }
    loadingRef.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error(`Error searching residents.`);
        resultsRef.value = data.value?.residents.map(r => ({
            _id: r._id, name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            email: r.email, address: `${r.address_house_number||''} ${r.address_street||''}, ${r.address_subdivision_zone||''}`, contact_number: r.contact_number
        })) || [];
    } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { loadingRef.value = false; }
}, 500);

watch(complainantSearchQuery, (nq) => { if (editMode.value && nq !== form.complainant_display_name) searchResidentsAPI(nq, 'complainant'); });
watch(personComplainedSearchQuery, (nq) => {
    if (editMode.value) {
        form.person_complained_against_name = nq;
        if (nq !== form.person_complained_against_name) form.person_complained_against_resident_id = null;
        searchResidentsAPI(nq, 'personComplained');
    }
});

// START: NOTES WATCHER
watch(() => form.status, (newStatus, oldStatus) => {
  if (newStatus === 'Under Investigation' && newStatus !== oldStatus) {
    fetchNotes();
  } else if (newStatus !== 'Under Investigation') {
    investigationNotes.value = []; // Clear notes if status changes away
  }
});
// END: NOTES WATCHER

const onComplainantSelect = (selectedId) => {
    const resident = complainantSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;
    form.complainant_resident_id = resident._id; form.complainant_display_name = resident.name;
    form.complainant_address = resident.address; form.contact_number = resident.contact_number;
    complainantSearchQuery.value = resident.name; complainantSearchResults.value = [];
};

const onPersonComplainedSelect = (selectedId) => {
    const resident = personComplainedSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;
    form.person_complained_against_resident_id = resident._id;
    form.person_complained_against_name = resident.name;
    personComplainedSearchQuery.value = resident.name;
    personComplainedSearchResults.value = [];
};

// --- SAVE & DELETE ---
async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  saving.value = true;
  try {
    const payload = { ...form, date_of_complaint: new Date(form.date_of_complaint).toISOString() };
    delete payload.status; 
    const { error } = await useMyFetch(`/api/complaints/${complaintId}`, { method: 'PUT', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update complaint.');
    $toast.fire({ title: 'Complaint updated successfully!', icon: 'success' });
    await fetchComplaint();
    toggleEditMode(false);
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteComplaint(){
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/complaints/${complaintId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete complaint.');
    $toast.fire({ title: 'Complaint deleted successfully!', icon: 'success' });
    router.push('/complaints');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}

// START: NOTES LOGIC
async function fetchNotes() {
  notesLoading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/complaints/${complaintId}/notes`);
    if (error.value) throw new Error('Failed to fetch investigation notes.');
    // Sort by newest first
    investigationNotes.value = (data.value?.notes || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    investigationNotes.value = [];
  } finally {
    notesLoading.value = false;
  }
}

async function addNote() {
  if (!newNoteContent.value.trim()) {
    $toast.fire({ title: 'Note content cannot be empty.', icon: 'warning' });
    return;
  }
  addingNote.value = true;
  try {
    const { error } = await useMyFetch(`/api/complaints/${complaintId}/notes`, {
      method: 'POST',
      body: { content: newNoteContent.value.trim() }
    });
    if (error.value) throw new Error('Failed to add note.');
    $toast.fire({ title: 'Note added successfully!', icon: 'success' });
    newNoteContent.value = '';
    await fetchNotes(); // Refresh the list
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    addingNote.value = false;
  }
}
// END: NOTES LOGIC

// --- HELPER FUNCTIONS ---
const formatDateForInput = (iso, type='date') => { if (!iso) return ''; const d = new Date(iso); return type === 'date' ? d.toISOString().split('T')[0] : d.toTimeString().slice(0,5); };
const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
};
const getStatusColor = (status) => ({ 'New': 'info', 'Under Investigation': 'warning', 'Resolved': 'success', 'Closed': 'grey-darken-1', 'Dismissed': 'error' }[status] || 'default');
</script>

<style scoped>
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
</style>