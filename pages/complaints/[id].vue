<template>
  <v-container class="my-10">
    <!-- Loading / Error States (similar to your original) -->
    <div v-if="loading" class="text-center pa-10"><v-progress-circular indeterminate color="primary" size="64"></v-progress-circular><p class="mt-2">Loading...</p></div>
    <div v-else-if="!complaintData._id && !errorLoading"><v-alert type="warning" prominent border="start">Not found. <v-btn color="primary" variant="text" to="/complaints" class="ml-2">Back to List</v-btn></v-alert></div>
    <div v-else-if="errorLoading"><v-alert type="error" prominent border="start">Error loading. <v-btn color="primary" variant="text" @click="fetchComplaint" class="ml-2">Retry</v-btn></v-alert></div>

    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
            <h2 class="text-truncate" :title="`Complaint by ${complaintData.complainant_display_name || 'N/A'}`">
                Complaint Details
                <span v-if="complaintData._id" class="text-subtitle-1 text-grey-darken-1 ml-2">
                    (Ref #: {{ complaintData._id }})
                </span>
            </h2>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2" variant="tonal">Edit</v-btn>
          <v-btn v-if="editMode" color="green" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" variant="tonal" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="red" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card prepend-icon="mdi-comment-text-multiple-outline" :title="editMode ? 'Edit Complaint Information' : 'View Complaint Information'">
        <v-card-text>
          <v-form ref="form">
            <!-- Reference Number (View Mode Only) -->
            <v-row v-if="!editMode && complaintData._id">
                <v-col cols="12">
                     <v-text-field
                        :model-value="complaintData._id"
                        label="Reference Number"
                        variant="outlined" density="compact" readonly filled
                    ></v-text-field>
                </v-col>
            </v-row>

            <!-- Complainant Details -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Complainant Name <span v-if="editMode" class="text-red">*</span></label>
                 <v-text-field
                  v-if="editMode"
                  v-model="complainantSearchQuery"
                  label="Search to Change Complainant..."
                  prepend-inner-icon="mdi-account-search-outline"
                  variant="outlined" density="compact"
                  clearable @click:clear="clearComplainantSelection"
                  :loading="isLoadingComplainants"
                  :rules="[rules.complainantSelected]"
                  :hint="editableComplaint.complainant_display_name ? `Selected: ${editableComplaint.complainant_display_name}` : 'Type to search resident'"
                  persistent-hint
                ></v-text-field>
                <v-text-field
                    v-else
                    :model-value="editableComplaint.complainant_display_name || 'N/A'"
                    label="Complainant Name"
                    variant="outlined" density="compact" readonly
                ></v-text-field>
                 <div v-if="editMode && complainantSearchQuery && complainantSearchQuery.trim().length >= 2 && !isLoadingComplainants" class="search-results-container">
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
                <v-text-field v-model="editableComplaint.complainant_address" label="Complainant Address" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableComplaint.contact_number" label="Contact Number" :rules="[rules.required, rules.contactFormat]" :readonly="!editMode" variant="outlined" density="compact" type="tel"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableComplaint.date_of_complaint" label="Date of Complaint" type="date" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>
            <!-- Complaint Specific Details -->
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableComplaint.time_of_complaint" label="Time of Complaint" type="time" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Person Complained Against <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field
                  v-if="editMode"
                  v-model="personComplainedSearchQuery"
                  label="Search Resident or Enter Name..."
                  prepend-inner-icon="mdi-account-search-outline"
                  variant="outlined" density="compact"
                  clearable @click:clear="clearPersonComplainedSelection"
                  :loading="isLoadingPersonComplained"
                  :rules="[rules.personComplainedRequired]"
                  :hint="editableComplaint.person_complained_against_resident_id ? `Selected Resident: ${editableComplaint.person_complained_against_name}` : (personComplainedSearchQuery ? `Entered: ${personComplainedSearchQuery}` : 'Search or type full name')"
                  persistent-hint
                ></v-text-field>
                <v-text-field
                    v-else
                    :model-value="editableComplaint.person_complained_against_name || 'N/A'"
                    label="Person Complained Against"
                    variant="outlined" density="compact" readonly
                ></v-text-field>
                <div v-if="editMode && personComplainedSearchQuery && personComplainedSearchQuery.trim().length >= 2 && !isLoadingPersonComplained" class="search-results-container">
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
                <v-select v-model="editableComplaint.status" label="Status" :items="statusOptions" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-select>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-textarea v-model="editableComplaint.notes_description" label="Notes / Description" :rules="[rules.required]" :readonly="!editMode" variant="outlined" rows="5" auto-grow></v-textarea>
              </v-col>
            </v-row>
             <v-divider v-if="!editMode && (complaintData.created_at || complaintData.updated_at)" class="my-4"></v-divider>
            <v-row v-if="!editMode">
                <v-col cols="12" sm="6" v-if="complaintData.created_at">
                    <p class="text-caption text-grey">Filed On:</p>
                    <p>{{ formatDate(complaintData.created_at, true) }}</p>
                </v-col>
                <v-col cols="12" sm="6" v-if="complaintData.updated_at">
                    <p class="text-caption text-grey">Last Updated:</p>
                    <p>{{ formatDate(complaintData.updated_at, true) }}</p>
                </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete this complaint (Ref #: <strong>{{ complaintData._id }}</strong>)? This action cannot be undone.
        </v-card-text>
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
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp(); // Removed $swal as it wasn't used in the delete logic
const route = useRoute();
const router = useRouter();
const complaintId = route.params.id;
const form = ref(null);

const complaintData = ref({});
const editableComplaint = ref({
    complainant_resident_id: null,
    complainant_display_name: '',
    person_complained_against_resident_id: null,
    person_complained_against_name: '',
    complainant_address: '',
    contact_number: '',
    date_of_complaint: '',
    time_of_complaint: '',
    status: 'New',
    notes_description: ''
});
const loading = ref(true);
const errorLoading = ref(false);
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
const selectedPersonComplainedIsResident = ref(false);

const statusOptions = ['New','Under Investigation','Resolved','Closed','Dismissed'];
const rules = {
    required: value => !!String(value || '').trim() || 'This field is required.', // Improved required rule
    complainantSelected: value => !!editableComplaint.value.complainant_resident_id || 'A complainant (resident) must be selected.',
    personComplainedRequired: value => !!editableComplaint.value.person_complained_against_name?.trim() || 'Person complained against is required.',
    contactFormat: value => (/^\+?[0-9\s-]{7,15}$/.test(value) || !value) || 'Invalid contact number format (allow empty).', // Allow empty
};

onMounted(async () => { await fetchComplaint(); });

function formatDateForInput(isoString, type = 'date') {
    if (!isoString) return '';
    try {
        const dateObj = new Date(isoString);
        if (isNaN(dateObj.getTime())) return isoString;

        // For datetime-local, it needs YYYY-MM-DDTHH:mm but input type="date" needs YYYY-MM-DD
        // and type="time" needs HH:mm
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');

        if (type === 'date') return `${year}-${month}-${day}`;
        if (type === 'time') return `${hours}:${minutes}`;
        return `${year}-${month}-${day}T${hours}:${minutes}`; // For datetime-local (not used here currently)
    } catch (e) { return isoString; }
};

async function fetchComplaint(){
    loading.value = true; errorLoading.value = false;
    try {
        const { data, error } = await useMyFetch(`/api/complaints/${complaintId}`);
        if (error.value || !data.value?.complaint) {
            errorLoading.value = true; complaintData.value = {};
            console.error('Fetch error:', error.value || 'No complaint data');
        } else {
            complaintData.value = { ...data.value.complaint };
            resetEditableData();
        }
    } catch (e) { errorLoading.value = true; console.error("Exception fetching complaint:", e); }
    finally { loading.value = false; }
}

function resetEditableData() {
    editableComplaint.value = JSON.parse(JSON.stringify(complaintData.value));
    // Format dates for their respective input types
    if (editableComplaint.value.date_of_complaint) {
        editableComplaint.value.date_of_complaint = formatDateForInput(editableComplaint.value.date_of_complaint, 'date');
    }
    if (editableComplaint.value.time_of_complaint) { // Assuming time_of_complaint is stored as HH:MM string or derived
        // If time_of_complaint is part of a datetime field, extract it:
        // editableComplaint.value.time_of_complaint = formatDateForInput(complaintData.value.some_datetime_field_for_time, 'time');
    } else if (complaintData.value.date_of_complaint && !editableComplaint.value.time_of_complaint) {
        // If time is not a separate field but part of date_of_complaint (which is unusual if you have separate date/time inputs)
        // editableComplaint.value.time_of_complaint = formatDateForInput(complaintData.value.date_of_complaint, 'time');
    }


    complainantSearchQuery.value = editableComplaint.value.complainant_display_name || '';
    personComplainedSearchQuery.value = editableComplaint.value.person_complained_against_name || '';
    selectedPersonComplainedIsResident.value = !!editableComplaint.value.person_complained_against_resident_id;

    complainantSearchResults.value = [];
    personComplainedSearchResults.value = [];
}

function toggleEditMode(enable){ editMode.value=enable; if(enable) resetEditableData(); }
function cancelEdit(){ toggleEditMode(false); resetEditableData(); }

function debounce(fn,delay){ let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),delay); }; }

const searchResidentsAPI = async(q, type)=>{
    const tq=typeof q==='string'?q.trim():'';
    if(tq.length<2){
        if(type==='complainant') complainantSearchResults.value=[];
        if(type==='personComplained') personComplainedSearchResults.value=[];
        if(type==='complainant') isLoadingComplainants.value=false;
        if(type==='personComplained') isLoadingPersonComplained.value=false;
        return;
    }
    if(type==='complainant') isLoadingComplainants.value=true;
    if(type==='personComplained') isLoadingPersonComplained.value=true;
    if(type==='complainant') complainantSearchResults.value=[];
    if(type==='personComplained') personComplainedSearchResults.value=[];

    try{
        const{data,error}=await useMyFetch('/api/residents/search',{query:{q:tq, limit: 10}}); // Added limit
        if(error.value){console.error(`Error searching ${type}:`, error.value)}
        else{
            const results = data.value?.residents || [];
            if(type==='complainant') complainantSearchResults.value=results;
            if(type==='personComplained') personComplainedSearchResults.value=results;
        }
    } catch(e){console.error(`Exception searching ${type}:`, e)}
    finally{
        if(type==='complainant') isLoadingComplainants.value=false;
        if(type==='personComplained') isLoadingPersonComplained.value=false;
    }
};

const debouncedComplainantSearch=debounce((q)=>searchResidentsAPI(q,'complainant'),500);
watch(complainantSearchQuery,(nq,oq)=>{
    if(editMode.value) { // Only search when in edit mode
        if(nq === editableComplaint.value.complainant_display_name && editableComplaint.value.complainant_resident_id){
            if(nq !== oq && oq === editableComplaint.value.complainant_display_name) {} else { complainantSearchResults.value = []; return; }
        }
        if(!nq||typeof nq!=='string'||nq.trim().length<2){complainantSearchResults.value=[];return;}
        debouncedComplainantSearch(nq);
    } else {
        complainantSearchResults.value = [];
    }
});

const selectComplainant=(res)=>{
    editableComplaint.value.complainant_resident_id=res._id;
    const n=`${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();
    editableComplaint.value.complainant_display_name=n;
    complainantSearchQuery.value=n; // Update search query to reflect selection
    editableComplaint.value.complainant_address=`${res.address_house_number||''} ${res.address_street||''}, ${res.address_subdivision_zone||''}, ${res.address_city_municipality||''}`.replace(/ ,/g,',').replace(/^,|,$/g,'').trim();
    editableComplaint.value.contact_number=res.contact_number||'';
    complainantSearchResults.value=[];
};
const clearComplainantSelection=()=>{
    complainantSearchQuery.value=''; // Clear the input field
    editableComplaint.value.complainant_resident_id=null;
    editableComplaint.value.complainant_display_name='';
    editableComplaint.value.complainant_address='';
    editableComplaint.value.contact_number='';
    complainantSearchResults.value=[];
};

const debouncedPersonComplainedSearch=debounce((q)=>searchResidentsAPI(q,'personComplained'),500);
watch(personComplainedSearchQuery,(nq, oq)=>{
    if(editMode.value) { // Only search when in edit mode
        // If text changes and it's different from a previously selected resident's name,
        // it means the user is typing a new name or searching again.
        if (nq !== editableComplaint.value.person_complained_against_name && selectedPersonComplainedIsResident.value) {
            editableComplaint.value.person_complained_against_resident_id = null;
            selectedPersonComplainedIsResident.value = false;
        }
        editableComplaint.value.person_complained_against_name = nq; // Always update the name from input

        if (selectedPersonComplainedIsResident.value && nq === editableComplaint.value.person_complained_against_name) {
             if(nq !== oq) {} else { personComplainedSearchResults.value = []; return; }
        }
        if(!nq||typeof nq!=='string'||nq.trim().length<2){personComplainedSearchResults.value=[];return;}
        debouncedPersonComplainedSearch(nq);
    } else {
        personComplainedSearchResults.value = [];
    }
});
const selectPersonComplained=(res)=>{
    editableComplaint.value.person_complained_against_resident_id=res._id;
    const n=`${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();
    editableComplaint.value.person_complained_against_name=n;
    personComplainedSearchQuery.value=n; // Update search query to reflect selection
    selectedPersonComplainedIsResident.value=true;
    personComplainedSearchResults.value=[];
};
const clearPersonComplainedSelection=()=>{
    personComplainedSearchQuery.value=''; // Clear the input field
    editableComplaint.value.person_complained_against_resident_id=null;
    editableComplaint.value.person_complained_against_name='';
    selectedPersonComplainedIsResident.value=false;
    personComplainedSearchResults.value=[];
};

async function saveChanges() {
  const { valid } = await form.value.validate();
  if (!valid) { $toast.fire({ title: 'Please correct the form errors.', icon: 'error' }); return; }
  if (!editableComplaint.value.complainant_resident_id) { $toast.fire({ title: 'A complainant (resident) must be selected.', icon: 'warning' }); return; }
  if (!editableComplaint.value.person_complained_against_name?.trim()) { $toast.fire({ title: 'Person complained against name is required.', icon: 'warning'}); return; }

  saving.value = true;
  try {
    const payload = { ...editableComplaint.value };
    // Combine date and time for the API if your API expects a single datetime for date_of_complaint
    // For now, assuming API handles separate date and time, or date_of_complaint is just date part
    if(payload.date_of_complaint) payload.date_of_complaint = new Date(payload.date_of_complaint).toISOString().split('T')[0]; // Send only date part

    if (!selectedPersonComplainedIsResident.value) {
        payload.person_complained_against_resident_id = null;
    }
    // person_complained_against_name is already correctly set in editableComplaint from the text input

    const { data, error } = await useMyFetch(`/api/complaints/${complaintId}`, { method: 'PUT', body: payload });
    if (error.value || data.value?.error) { $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to update complaint.', icon: 'error' });
    } else {
      $toast.fire({ title: 'Complaint updated successfully!', icon: 'success' });
      complaintData.value = { ...data.value.complaint };
      toggleEditMode(false); // This calls resetEditableData
    }
  } catch (e) { console.error("Exception saving complaint:", e); $toast.fire({ title: 'An error occurred while saving.', icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteComplaint(){
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/complaints/${complaintId}`, { method: 'DELETE' });
    if (error.value) { $toast.fire({ title: 'Failed to delete complaint.', icon: 'error' }); }
    else { $toast.fire({ title: 'Complaint deleted successfully!', icon: 'success' }); router.push('/complaints'); }
  } catch (e) { console.error("Exception deleting complaint:", e); $toast.fire({ title: 'An error occurred during deletion.', icon: 'error' }); }
  finally { deleting.value = false; confirmDeleteDialog.value = false; }
}

const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) { return dateString; }
};

</script>

<style scoped>
.search-results-container {
  position: relative;
}
.search-results-list {
  max-height: 150px; /* Or adjust as needed */
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  background-color: white;
  z-index: 1000; /* Ensure it's above other elements */
  position: absolute;
  width: 100%; /* Make it full width of its parent container/column */
  margin-top: -1px; /* Slightly overlap the text field */
  border-radius: 0 0 4px 4px; /* Optional: round bottom corners */
}
.v-label { /* Style for custom label tags */
    opacity:var(--v-high-emphasis-opacity); /* From Vuetify's default label style */
    font-size:0.875rem;
    color:rgba(var(--v-theme-on-surface),var(--v-high-emphasis-opacity));
    display:block;
    margin-bottom:4px;
}
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>