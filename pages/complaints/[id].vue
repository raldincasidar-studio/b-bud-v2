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
          <p class="text-grey-darken-1">Reference #: {{ form.ref_no }}</p>
        </v-col>
        <v-col class="text-right">
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
                <v-text-field :model-value="form.status" variant="outlined" readonly messages="The status is managed via actions on this page.">
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

      <!-- Proof of Complaint Section -->
      <v-card class="mt-4" flat border>
        <v-card-title>Proof of Complaint</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
          <div v-if="form.proofs_base64 && form.proofs_base64.length > 0">
            <v-row>
              <v-col
                v-for="(proof, index) in form.proofs_base64"
                :key="index"
                cols="6" sm="4" md="3"
              >
                <v-img
                  :src="proof"
                  aspect-ratio="1"
                  class="grey lighten-2 cursor-pointer"
                  cover
                  @click="openProofDialog(proof)"
                >
                  <template v-slot:placeholder>
                    <v-row class="fill-height ma-0" align="center" justify="center">
                      <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                    </v-row>
                  </template>
                </v-img>
              </v-col>
            </v-row>
          </div>
          <v-alert v-else type="info" variant="tonal">
            No proof was attached to this complaint.
          </v-alert>
        </v-card-text>
      </v-card>

      <!-- Investigation Notes Section -->
      <v-card v-if="form.status === 'Under Investigation' || form.status === 'Resolved' || form.status === 'Dismissed'" class="mt-4" flat border>
        <v-card-title>Investigation Notes</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
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
      
      <!-- Actions Card -->
      <v-card class="mt-4">
        <v-card-title>Complaint Actions</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
            <div class="d-flex align-center mb-3">
              <span class="text-subtitle-1 mr-4">Current Status:</span>
              <v-chip :color="getStatusColor(form.status)" label size="large" class="font-weight-bold">{{ form.status }}</v-chip>
            </div>
             <p class="text-caption text-grey-darken-1 mb-3">Select an action to change the complaint's status.</p>
             <v-btn v-if="form.status === 'New'" color="yellow-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Under Investigation')" prepend-icon="mdi-magnify">Start Investigation</v-btn>
             <v-btn v-if="form.status === 'Under Investigation'" color="green-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Resolved')" prepend-icon="mdi-check-circle">Mark as Resolved</v-btn>
             <v-btn v-if="form.status === 'Under Investigation'" color="error" size="large" class="ma-2" @click="updateComplaintStatus('Dismissed')" prepend-icon="mdi-cancel">Dismiss Complaint</v-btn>
             <v-btn v-if="form.status === 'Resolved' || form.status === 'New' || form.status === 'Dismissed'" color="grey-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Closed')" prepend-icon="mdi-archive-outline">Close Complaint</v-btn>
             
             <v-alert v-if="form.status === 'Closed'" type="info" variant="tonal" class="mt-4">
               This complaint is closed and no further actions can be taken.
             </v-alert>
        </v-card-text>
      </v-card>
    </div>
    
    <!-- Deletion Dialog -->
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

    <!-- UPDATED: Proof Image Viewer Dialog with Zoom -->
    <v-dialog v-model="showProofDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dark color="primary">
          <v-toolbar-title>Proof of Complaint</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="showProofDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text
          class="d-flex justify-center align-center"
          style="background-color: rgba(0,0,0,0.8); position: relative; overflow: auto;"
        >
          <v-img
            :src="selectedProofUrl"
            contain
            max-height="90vh"
            max-width="90vw"
            :style="imageStyle"
          ></v-img>
          <div class="zoom-controls">
            <v-btn icon="mdi-magnify-minus-outline" @click="zoomOut" class="mx-1" title="Zoom Out"></v-btn>
            <v-btn icon="mdi-fit-to-screen-outline" @click="resetZoom" class="mx-1" title="Reset Zoom"></v-btn>
            <v-btn icon="mdi-magnify-plus-outline" @click="zoomIn" class="mx-1" title="Zoom In"></v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch, computed } from 'vue'; // <-- Added computed
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
  ref_no: '',
  complainant_resident_id: null,
  complainant_display_name: '',
  complainant_address: '',
  contact_number: '',
  date_of_complaint: '',
  time_of_complaint: '',
  person_complained_against_resident_id: null,
  person_complained_against_name: '',
  status: 'New',
  notes_description: '',
  category: '',
  proofs_base64: [], 
});

const complaintCategories = ref([
  'Theft / Robbery', 'Scam / Fraud', 'Physical Assault / Violence', 'Verbal Abuse / Threats',
  'Sexual Harassment / Abuse', 'Vandalism', 'Noise Disturbance', 'Illegal Parking / Obstruction',
  'Drunk and Disorderly Behavior', 'Curfew Violation / Minor Offenses', 'Illegal Gambling',
  'Animal Nuisance / Stray Animal Concern', 'Garbage / Sanitation Complaints',
  'Boundary Disputes / Trespassing', 'Barangay Staff / Official Misconduct', 'Others',
]);

const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);
const showProofDialog = ref(false);
const selectedProofUrl = ref('');

// --- NEW: State for Zoom Viewer ---
const zoomLevel = ref(1);

const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);

const personComplainedSearchQuery = ref('');
const personComplainedSearchResults = ref([]);
const isLoadingPersonComplained = ref(false);

const investigationNotes = ref([]);
const newNoteContent = ref('');
const notesLoading = ref(false);
const addingNote = ref(false);

// --- VUELIDATE ---
const rules = {
    complainant_resident_id: { required: helpers.withMessage('A complainant must be selected.', required) },
    complainant_address: { required },
    contact_number: { required },
    date_of_complaint: { required },
    time_of_complaint: { required },
    person_complained_against_name: { required: helpers.withMessage('The person being complained against is required.', required) },
    notes_description: { required },
    category: { required },
};
const v$ = useVuelidate(rules, form);

// --- COMPUTED PROPERTIES ---
const imageStyle = computed(() => ({
  transform: `scale(${zoomLevel.value})`,
  transition: 'transform 0.2s ease-out'
}));

// --- FUNCTIONS ---
async function updateComplaintStatus(status){
  const {data, error} = await useMyFetch(`/api/complaints/${complaintId}/status`, { method: 'PATCH', body: { status } });
  if (error.value) $toast.fire({ title: error.value.data?.error || 'Failed to update status', icon: 'error' });
  if (data.value) $toast.fire({ title: data.value.message, icon: 'success' });
  await fetchComplaint();
}

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
        if (form.status === 'Under Investigation' || form.status === 'Resolved' || form.status === 'Dismissed') {
          await fetchNotes();
        } else {
          investigationNotes.value = [];
        }
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); router.push('/complaints'); }
    finally { loading.value = false; }
}

const cancelEdit = () => { Object.assign(form, originalFormState.value); v$.value.$reset(); editMode.value = false; };

const openProofDialog = (url) => {
  selectedProofUrl.value = url;
  zoomLevel.value = 1; // Reset zoom when opening
  showProofDialog.value = true;
};

// --- NEW: Zoom control functions ---
const zoomIn = () => { zoomLevel.value += 0.2; };
const zoomOut = () => { zoomLevel.value = Math.max(0.2, zoomLevel.value - 0.2); };
const resetZoom = () => { zoomLevel.value = 1; };

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

watch(() => form.status, (newStatus, oldStatus) => {
  if (newStatus !== oldStatus && (newStatus === 'Under Investigation' || newStatus === 'Resolved' || newStatus === 'Dismissed')) {
    fetchNotes();
  } else if (newStatus === 'New' || newStatus === 'Closed') {
    investigationNotes.value = [];
  }
});

const onComplainantSelect = (selectedId) => {
    const resident = complainantSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;
    form.complainant_resident_id = resident._id; form.complainant_display_name = resident.name;
    form.complainant_address = resident.address; form.contact_number = resident.contact.number;
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
    editMode.value = false;
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

async function fetchNotes() {
  notesLoading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/complaints/${complaintId}/notes`);
    if (error.value) throw new Error('Failed to fetch investigation notes.');
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
    await fetchNotes();
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    addingNote.value = false;
  }
}

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
.cursor-pointer {
  cursor: pointer;
}
.zoom-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(40, 40, 40, 0.75);
  padding: 8px;
  border-radius: 24px;
  z-index: 10;
  display: flex;
  gap: 8px;
}
</style>