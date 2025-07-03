<template>
  <v-container class="my-10">
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Loading notification details...</p>
    </div>
    <div v-else-if="!notificationData._id && !errorLoading">
      <v-alert type="warning" prominent border="start">
        Notification not found or could not be loaded.
        <v-btn color="primary" variant="text" to="/notifications" class="ml-2">Back to Notifications List</v-btn>
      </v-alert>
    </div>
     <div v-else-if="errorLoading">
       <v-alert type="error" prominent border="start">
        Error loading notification details. Please try again.
        <v-btn color="primary" variant="text" @click="fetchNotification" class="ml-2">Retry</v-btn>
      </v-alert>
    </div>

    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
            <!-- UPDATED: Title wording and chip -->
            <h2 class="text-truncate" :title="notificationData.name">
                Notification: {{ notificationData.name }}
                <v-chip v-if="!editMode" :color="getTypeColor(notificationData.type)" small label class="ml-2">
                    {{ notificationData.type }}
                </v-chip>
            </h2>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2" variant="tonal">Edit</v-btn>
          <v-btn v-if="editMode" color="green" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" variant="tonal" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="red" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <!-- UPDATED: Card Title -->
      <v-card prepend-icon="mdi-bell-outline" :title="editMode ? 'Edit Notification Details' : 'Notification Details'">
        <v-card-text>
          <v-form ref="form">
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-2 font-weight-bold text-black">Notification Name/Title*</label>
                <v-text-field
                  v-model="editableNotification.name"
                  label="Notification Name/Title*"
                  :rules="[rules.required, rules.nameLength]"
                  :readonly="!editMode"
                  variant="outlined"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-2 font-weight-bold text-black">Author (Admin)*</label>
                <v-text-field
                  v-model="editableNotification.by"
                  label="Author (e.g., Admin Name)*"
                  :rules="[rules.required]"
                  :readonly="!editMode"
                  variant="outlined"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-2 font-weight-bold text-black">Announcement Type*</label>
                <v-select
                  v-model="editableNotification.type"
                  :items="NOTIFICATION_TYPES"
                  label="Notification Type*"
                  :rules="[rules.required]"
                  :readonly="!editMode"
                  variant="outlined"
                ></v-select>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-2 font-weight-bold text-black">Effective Date & Time*</label>
                <v-text-field
                  v-model="editableNotification.date"
                  label="Effective Date & Time*"
                  type="datetime-local"
                  :rules="[rules.required]"
                  :readonly="!editMode"
                  variant="outlined"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <label class="v-label mb-2 font-weight-bold text-black">Announcement Content*</label>
                <v-textarea
                  v-model="editableNotification.content"
                  label="Notification Content*"
                  :rules="[rules.required, rules.contentLength]"
                  :readonly="!editMode"
                  variant="outlined" rows="5" auto-grow
                ></v-textarea>
              </v-col>
            </v-row>

            <v-divider class="my-4"></v-divider>
            <h3 class="mb-2">Targeting Information</h3>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="editableNotification.target_audience"
                  :items="TARGET_AUDIENCE_OPTIONS"
                  label="Target Audience*"
                  :rules="[rules.required]"
                  :readonly="!editMode"
                  variant="outlined"
                ></v-select>
              </v-col>
            </v-row>

            <v-row v-if="editableNotification.target_audience === 'SpecificResidents'">
              <v-col cols="12">
                <v-autocomplete
                  v-model="editableSelectedRecipientIds"
                  :items="searchedResidentsForEdit"
                  :loading="isSearchingResidentsForEdit"
                  v-model:search="residentSearchQueryForEdit"
                  chips
                  closable-chips
                  multiple
                  item-title="displayName"
                  item-value="_id"
                  label="Select Specific Residents (Type to search)"
                  placeholder="Search by name or email..."
                  variant="outlined"
                  no-filter
                  hide-no-data
                  :readonly="!editMode"
                  @update:search="debouncedSearchResidentsForEdit"
                >
                  <template v-slot:chip="{ props, item }">
                    <v-chip v-bind="props" :text="item.raw.displayName" :disabled="!editMode"></v-chip>
                  </template>
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :title="item.raw.displayName" :subtitle="item.raw.email"></v-list-item>
                  </template>
                  <template v-slot:no-data>
                    <v-list-item v-if="residentSearchQueryForEdit && residentSearchQueryForEdit.length > 1 && !isSearchingResidentsForEdit">
                        <v-list-item-title>No residents found matching "<strong>{{ residentSearchQueryForEdit }}</strong>".</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-autocomplete>
                 <small v-if="editMode && editableNotification.target_audience === 'SpecificResidents' && editableSelectedRecipientIds.length === 0" class="text-error d-block mt-1">
                    Please select at least one resident if targeting specific residents.
                 </small>
              </v-col>
            </v-row>

            <!-- Display recipient details in VIEW mode -->
            <div v-if="!editMode && notificationData.target_audience === 'SpecificResidents'" class="mt-3">
                <p class="text-subtitle-1">Specifically Targeted Residents:</p>
                <div v-if="loadingRecipients" class="text-center my-2">
                    <v-progress-circular indeterminate color="primary" size="24"></v-progress-circular>
                    <span class="ml-2 text-grey">Loading recipient names...</span>
                </div>
                <div v-else-if="detailedRecipients.length > 0">
                    <v-chip v-for="rec in detailedRecipients" :key="rec._id" class="ma-1" label outlined>
                        <v-icon start icon="mdi-account-circle-outline"></v-icon>
                        {{ rec.first_name }} {{ rec.last_name }} <span class="text-caption ml-1">({{ rec.email }})</span>
                    </v-chip>
                </div>
                <p v-else-if="Array.isArray(notificationData.recipients) && notificationData.recipients.length > 0 && !loadingRecipients">
                    <em>Could not load full details for {{ notificationData.recipients.length }} recipient(s).</em>
                </p>
                <p v-else><em>No specific residents were targeted.</em></p>
            </div>

             <!-- UPDATED: Informational text for all group targets -->
            <small v-if="editableNotification.target_audience === 'All'" class="d-block mt-2 text-info">
                This notification targets all 'Approved' residents. The recipient list is managed by the system.
            </small>
            <small v-if="editableNotification.target_audience === 'PWDResidents'" class="d-block mt-2 text-info">
                This notification targets all residents registered as PWD.
            </small>
            <small v-if="editableNotification.target_audience === 'SeniorResidents'" class="d-block mt-2 text-info">
                This notification targets all residents registered as Senior Citizens.
            </small>
            <small v-if="editableNotification.target_audience === 'VotersResidents'" class="d-block mt-2 text-info">
                This notification targets all residents registered as Voters.
            </small>

            <v-divider v-if="!editMode" class="my-4"></v-divider>
            <v-row v-if="!editMode">
                <v-col cols="12" sm="6">
                    <p class="text-caption text-grey">Created At:</p>
                    <p>{{ formatDate(notificationData.created_at, true) }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                    <p class="text-caption text-grey">Last Updated At:</p>
                    <p>{{ formatDate(notificationData.updated_at, true) }}</p>
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
          <!-- UPDATED: Dialog text -->
          Are you sure you want to delete this notification: "<strong>{{ notificationData.name }}</strong>"? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteNotification" :loading="deleting">Delete</v-btn>
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

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const notificationId = route.params.id;
const form = ref(null);

// UPDATED: Constants now reflect the new system
const NOTIFICATION_TYPES = ['News', 'Events', 'Alert'];
const TARGET_AUDIENCE_OPTIONS = [
  { title: 'All Approved Residents', value: 'All' },
  { title: 'All PWD Residents', value: 'PWDResidents' },
  { title: 'All Senior Citizen Residents', value: 'SeniorResidents' },
  { title: 'All Residents Voters', value: 'VotersResidents' },
  { title: 'Specific Residents', value: 'SpecificResidents' },
];

const notificationData = ref({});
const editableNotification = ref({
  name: '', content: '', date: '', by: '',
  type: NOTIFICATION_TYPES[0],
  target_audience: TARGET_AUDIENCE_OPTIONS[0].value,
  recipients: [],
});

const loading = ref(true);
const errorLoading = ref(false);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

const editableSelectedRecipientIds = ref([]);
const residentSearchQueryForEdit = ref('');
const searchedResidentsForEdit = ref([]);
const isSearchingResidentsForEdit = ref(false);
let searchDebounceTimerEdit = null;

const detailedRecipients = ref([]);
const loadingRecipients = ref(false);

const rules = {
  required: value => !!value || 'This field is required.',
  nameLength: value => (value && value.length <= 100) || 'Name must be less than 100 characters.',
  contentLength: value => (value && value.length <= 1000) || 'Content must be less than 1000 characters.',
};

onMounted(async () => {
  await fetchNotification();
});

function formatDateTimeForInput(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  } catch (e) { return isoString; }
}

async function fetchNotification() {
  loading.value = true; errorLoading.value = false;
  try {
    const { data, error } = await useMyFetch(`/api/notifications/${notificationId}`);
    if (error.value || !data.value?.notification) {
      errorLoading.value = true; notificationData.value = {};
    } else {
      notificationData.value = { ...data.value.notification };
      resetEditableData();
    }
  } catch (e) {
    errorLoading.value = true; console.error("Exception fetching notification:", e);
  } finally {
    loading.value = false;
  }
}

async function fetchRecipientDetails(recipientIdObjects) {
    if (!Array.isArray(recipientIdObjects) || recipientIdObjects.length === 0) {
        detailedRecipients.value = [];
        return;
    }
    loadingRecipients.value = true;
    try {
        const idsToFetch = recipientIdObjects.map(item => item.resident_id).filter(Boolean);
        if (idsToFetch.length === 0) {
            detailedRecipients.value = [];
            loadingRecipients.value = false;
            return;
        }
        // Use a batch fetch endpoint for efficiency
        const { data, error } = await useMyFetch('/api/residents/batch', {
            method: 'POST',
            body: { ids: idsToFetch },
        });

        if (error.value) {
            console.error('Error fetching recipient details:', error.value);
            detailedRecipients.value = [];
        } else {
            detailedRecipients.value = data.value?.residents || [];
        }
    } catch (e) {
        console.error("Exception fetching recipient details:", e);
        detailedRecipients.value = [];
    } finally {
        loadingRecipients.value = false;
    }
}

function resetEditableData() {
  editableNotification.value = JSON.parse(JSON.stringify(notificationData.value));
  if (editableNotification.value.date) {
    editableNotification.value.date = formatDateTimeForInput(editableNotification.value.date);
  }
  if (!editableNotification.value.type) editableNotification.value.type = NOTIFICATION_TYPES[0];
  if (!editableNotification.value.target_audience) editableNotification.value.target_audience = TARGET_AUDIENCE_OPTIONS[0].value;

  if (editableNotification.value.target_audience === 'SpecificResidents' && Array.isArray(editableNotification.value.recipients)) {
    editableSelectedRecipientIds.value = editableNotification.value.recipients.map(r => r.resident_id);
    fetchRecipientDetails(editableNotification.value.recipients);
  } else {
    editableSelectedRecipientIds.value = [];
    detailedRecipients.value = [];
  }

  residentSearchQueryForEdit.value = '';
  searchedResidentsForEdit.value = [];
}

watch(() => editableNotification.value.target_audience, (newVal, oldVal) => {
  if (editMode.value && newVal !== oldVal) {
    if (newVal !== 'SpecificResidents') {
      editableSelectedRecipientIds.value = [];
      residentSearchQueryForEdit.value = '';
      searchedResidentsForEdit.value = [];
    }
  }
});

const searchResidentsAPIEdit = async (query) => {
  if (!query || query.trim().length < 2) {
    searchedResidentsForEdit.value = []; isSearchingResidentsForEdit.value = false;
    return;
  }
  isSearchingResidentsForEdit.value = true;
  try {
    const { data, error } = await useMyFetch('/api/residents/search', {
      query: { q: query, limit: 15 },
    });
    if (error.value) {
      searchedResidentsForEdit.value = [];
    } else {
      searchedResidentsForEdit.value = (data.value?.residents || []).map(r => ({
        ...r,
        displayName: `${r.first_name} ${r.last_name || ''} (${r.email})`,
      }));
    }
  } catch (e) {
    searchedResidentsForEdit.value = [];
  } finally {
    isSearchingResidentsForEdit.value = false;
  }
};

const debouncedSearchResidentsForEdit = (query) => {
  clearTimeout(searchDebounceTimerEdit);
  if (query && query.trim().length > 1) {
    isSearchingResidentsForEdit.value = true;
    searchDebounceTimerEdit = setTimeout(() => {
      searchResidentsAPIEdit(query);
    }, 500);
  } else {
    searchedResidentsForEdit.value = [];
    isSearchingResidentsForEdit.value = false;
  }
};

function toggleEditMode(enable) {
  editMode.value = enable;
  if (enable) {
    resetEditableData();
  }
}

function cancelEdit() {
  toggleEditMode(false);
  resetEditableData();
}

async function saveChanges() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }
  if (editableNotification.value.target_audience === 'SpecificResidents' && editableSelectedRecipientIds.value.length === 0) {
    $toast.fire({ title: 'Please select at least one resident if targeting specific residents.', icon: 'error' });
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...editableNotification.value,
      date: new Date(editableNotification.value.date).toISOString(),
      recipient_ids: editableNotification.value.target_audience === 'SpecificResidents' ? editableSelectedRecipientIds.value : [],
    };
    delete payload.recipients;
    
    const { data, error } = await useMyFetch(`/api/notifications/${notificationId}`, {
      method: 'PUT', body: payload,
    });
    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.message || 'Failed to update notification', icon: 'error' });
    } else {
      $toast.fire({ title: 'Notification updated successfully!', icon: 'success' });
      notificationData.value = { ...data.value.notification };
      toggleEditMode(false);
    }
  } catch (e) {
    $toast.fire({ title: 'An error occurred while saving changes.', icon: 'error' });
  } finally {
    saving.value = false;
  }
}

async function deleteNotification() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
    if (error.value) {
      $toast.fire({ title: 'Failed to delete notification', icon: 'error' });
    } else {
      $toast.fire({ title: 'Notification deleted successfully', icon: 'success' });
      router.push('/notifications');
    }
  } catch (e) {
    $toast.fire({ title: 'An error occurred during deletion.', icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}

const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  if (includeTime) {
    options.hour = '2-digit'; options.minute = '2-digit';
  }
  return new Date(dateString).toLocaleDateString(undefined, options);
};

// UPDATED: Added colors for new types
const getTypeColor = (type) => {
  switch (type) {
    case 'News': return 'blue-darken-1';
    case 'Events': return 'deep-purple-accent-2';
    case 'Alert': return 'error';
    default: return 'grey';
  }
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.v-chip.ma-1 {
  margin: 4px;
}
</style>