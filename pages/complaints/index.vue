<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Complaint Log</h2></v-col>
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" to="/complaints/new" prepend-icon="mdi-comment-alert-outline" color="primary">
          File New Complaint
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-file-chart-outline" class="mr-2"></v-icon>
        Complaint History
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Complaints"
          placeholder="Search by ref #, complainant, person complained, status..."
          clearable
          density="compact"
          class="mb-4"
          hide-details
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="complaints"
          :items-length="totalItems"
          :loading="loading"
          @update:options="loadComplaints"
          class="elevation-1 mt-4"
          item-value="_id"
        >
          <template v-slot:item.reference_number="{ item }">
            <span class="font-weight-medium text-caption">{{ item._id }}</span>
          </template>
          <template v-slot:item.date_of_complaint="{ item }">
            {{ formatDate(item.date_of_complaint) }}
          </template>
          <template v-slot:item.notes_description="{ item }">
            <div class="text-truncate" style="max-width: 250px;" :title="item.notes_description">
              {{ item.notes_description }}
            </div>
          </template>
          <template v-slot:item.status="{ item }">
            <v-select
                :model-value="item.status"
                :items="STATUS_OPTIONS"
                @update:modelValue="(newStatus) => updateComplaintStatus(item, newStatus)"
                density="compact"
                variant="outlined"
                hide-details
                class="status-select"
                :disabled="updatingStatusFor === item._id"
                :loading="updatingStatusFor === item._id"
            >
                <template v-slot:selection="{ item: selItem }">
                    <v-chip :color="getStatusColor(selItem.value)" small label>
                        {{ selItem.title }}
                    </v-chip>
                </template>
            </v-select>
          </template>
          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/complaints/${item._id}`" prepend-icon="mdi-eye-outline">
              View/Manage
            </v-btn>
          </template>
           <template v-slot:no-data>
            <v-alert type="info" class="ma-3">No complaints found matching your criteria.</v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);
const complaints = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null); // To show loading on the specific select being updated

const STATUS_OPTIONS = ['New', 'Under Investigation', 'Resolved', 'Closed', 'Dismissed']; // For the select dropdown

const headers = ref([
  { title: 'Ref #', key: 'reference_number', sortable: false, width: '150px' }, // New column for _id
  { title: 'Complainant', key: 'complainant_name', sortable: true }, // API might need to support sorting by this
  { title: 'Complained Against', key: 'person_complained_against', sortable: true }, // API might need to support sorting by this
  { title: 'Date Filed', key: 'date_of_complaint', sortable: true },
  { title: 'Status', key: 'status', sortable: true, align: 'center', width: '200px'}, // Wider for select
  { title: 'Description Preview', key: 'notes_description', sortable: false },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // The v-data-table-server @update:options will be triggered by itemsPerPage, page, or sortBy changes.
    // If only searchKey changes, we might need to manually trigger load or ensure table options update.
    // Forcing page to 1 on new search is good practice.
    loadComplaints({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500);
});

async function loadComplaints(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  const currentSearchTerm = searchKey.value; // Use the ref for search term

  // Prepare query params
  const queryParams = {
    search: currentSearchTerm,
    page: page,
    itemsPerPage: rpp,
  };
  if (sortBy && sortBy.length > 0) {
    // queryParams.sortBy = sortBy[0].key; // If API supports dynamic sort key
    // queryParams.sortOrder = sortBy[0].order;
  }

  try {
    const { data, error } = await useMyFetch('/api/complaints', { query: queryParams });
    if (error.value) {
      console.error('Failed to load complaints:', error.value);
      $toast.fire({ title: 'Failed to load complaints.', icon: 'error'});
      complaints.value = []; totalItems.value = 0;
    } else if (data.value) {
      complaints.value = data.value.complaints || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception loading complaints:', e);
    $toast.fire({ title: 'An error occurred.', icon: 'error'});
    complaints.value = []; totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) { return dateString; }
};

const getStatusColor = (status) => {
  const colors = {
    "New": 'info', // Blue
    "Under Investigation": 'warning', // Orange
    "Resolved": 'success', // Green
    "Closed": 'grey-darken-1', // Darker Grey
    "Dismissed": 'error' // Red
  };
  return colors[status] || 'default';
};

async function updateComplaintStatus(complaintItem, newStatus) {
  if (complaintItem.status === newStatus) return; // No change needed

  const originalStatus = complaintItem.status;
  updatingStatusFor.value = complaintItem._id; // Set loading state for this specific row's select

  // Optimistic UI update
  const itemIndex = complaints.value.findIndex(c => c._id === complaintItem._id);
  if (itemIndex > -1) {
    complaints.value[itemIndex].status = newStatus;
  }

  try {
    const { data, error } = await useMyFetch(`/api/complaints/${complaintItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value || (data.value && data.value.error)) {
      // Revert optimistic update on error
      if (itemIndex > -1) complaints.value[itemIndex].status = originalStatus;
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to update status.', icon: 'error' });
    } else {
      $toast.fire({ title: data.value?.message || 'Status updated successfully!', icon: 'success' });
      // API should have returned the updated item or at least confirmed, data already optimistically updated
      // If API returns statusChanged: false, you could show a specific info toast.
       if (data.value && data.value.statusChanged === false) {
         $toast.fire({ title: data.value?.message, icon: 'info' });
          // If it was already that status, and optimistic update happened, revert it.
          if (itemIndex > -1 && newStatus === originalStatus) { // Should not happen due to first check
            complaints.value[itemIndex].status = originalStatus;
          } else if (itemIndex > -1 && data.value.message.includes("already")) {
            // API confirmed it's already that status, ensure UI matches if optimistic update went to a different state.
             complaints.value[itemIndex].status = newStatus; // Ensure UI shows the correct "already" status
          }
      }
    }
  } catch (e) {
    if (itemIndex > -1) complaints.value[itemIndex].status = originalStatus; // Revert on exception
    console.error('Exception updating complaint status:', e);
    $toast.fire({ title: 'An error occurred while updating status.', icon: 'error' });
  } finally {
    updatingStatusFor.value = null; // Clear loading state for this row
  }
}

</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block; /* Important for max-width to work with truncation */
}
.status-select {
    min-width: 180px; /* Give enough space for the select dropdown */
}
</style>