<template>
  <v-container class="my-10">
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Loading notification...</p>
    </div>
    <div v-else-if="!notificationData._id && !errorLoading">
      <v-alert type="warning" prominent border="start">
        Notification not found.
        <v-btn color="primary" variant="text" to="/notifications" class="ml-2">Back to List</v-btn>
      </v-alert>
    </div>
     <div v-else-if="errorLoading">
       <v-alert type="error" prominent border="start">
        Error loading notification. Please try again.
        <v-btn color="primary" variant="text" @click="fetchNotification" class="ml-2">Retry</v-btn>
      </v-alert>
    </div>

    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col><h2 class="text-truncate" :title="notificationData.name">Notification: {{ notificationData.name }}</h2></v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2" variant="tonal">Edit</v-btn>
          <v-btn v-if="editMode" color="green" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" variant="tonal" :loading="saving">Save</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="red" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card prepend-icon="mdi-bell-outline" :title="editMode ? 'Edit Notification' : 'Notification Details'">
        <v-card-text>
          <v-form ref="form">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editableNotification.name"
                  label="Notification Name/Title"
                  :rules="[rules.required, rules.nameLength]"
                  :readonly="!editMode"
                  variant="outlined" density="compact"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editableNotification.by"
                  label="Author (Admin Name)"
                  :rules="[rules.required]"
                  :readonly="!editMode"
                  variant="outlined" density="compact"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="editableNotification.content"
                  label="Notification Content"
                  :rules="[rules.required, rules.contentLength]"
                  :readonly="!editMode"
                  variant="outlined" rows="5" auto-grow
                ></v-textarea>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editableNotification.date"
                  label="Notification Date & Time"
                  type="datetime-local"
                  :rules="[rules.required]"
                  :readonly="!editMode"
                  variant="outlined" density="compact"
                ></v-text-field>
              </v-col>
            </v-row>
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

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>
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
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const notificationId = route.params.id;
const form = ref(null);

const notificationData = ref({}); // Original, for display
const editableNotification = ref({}); // For form binding in edit mode
const loading = ref(true);
const errorLoading = ref(false);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

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
    // Format: YYYY-MM-DDTHH:mm (datetime-local input format)
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return isoString; // fallback
  }
}

async function fetchNotification() {
  loading.value = true;
  errorLoading.value = false;
  try {
    const { data, error } = await useMyFetch(`/api/notifications/${notificationId}`);
    if (error.value || !data.value?.notification) {
      errorLoading.value = true;
      notificationData.value = {};
      console.error('Failed to fetch notification:', error.value);
    } else {
      notificationData.value = { ...data.value.notification };
      resetEditableData();
    }
  } catch (e) {
    errorLoading.value = true;
    console.error("Exception fetching notification:", e);
  } finally {
    loading.value = false;
  }
}

function resetEditableData() {
  editableNotification.value = JSON.parse(JSON.stringify(notificationData.value));
  // Ensure date is formatted correctly for datetime-local input
  if (editableNotification.value.date) {
    editableNotification.value.date = formatDateTimeForInput(editableNotification.value.date);
  }
}

function toggleEditMode(enable) {
  editMode.value = enable;
  if (enable) {
    resetEditableData(); // Reset form to current saved data when entering edit mode
  }
}

function cancelEdit() {
  toggleEditMode(false);
  resetEditableData(); // Revert changes
}

async function saveChanges() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...editableNotification.value,
      date: new Date(editableNotification.value.date).toISOString(), // Convert back to ISO for backend
    };
    // Remove _id if it's not expected by PUT or if it's immutable by backend
    // delete payload._id; 
    // delete payload.created_at;
    // delete payload.updated_at;


    const { data, error } = await useMyFetch(`/api/notifications/${notificationId}`, {
      method: 'PUT',
      body: payload,
    });

    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.error || 'Failed to update notification', icon: 'error' });
    } else {
      $toast.fire({ title: 'Notification updated successfully!', icon: 'success' });
      notificationData.value = { ...data.value.notification }; // Update displayed data
      resetEditableData(); // Update editable form with new data
      toggleEditMode(false);
    }
  } catch (e) {
    console.error("Exception saving notification:", e);
    $toast.fire({ title: 'An error occurred while saving.', icon: 'error' });
  } finally {
    saving.value = false;
  }
}

async function deleteNotification() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
    if (error.value) {
      $toast.fire({ title: 'Failed to delete notification', icon: 'error' });
    } else {
      $toast.fire({ title: 'Notification deleted successfully', icon: 'success' });
      router.push('/notifications');
    }
  } catch (e) {
    console.error("Exception deleting notification:", e);
    $toast.fire({ title: 'An error occurred during deletion.', icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}

const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
    }
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    return dateString;
  }
};
</script>