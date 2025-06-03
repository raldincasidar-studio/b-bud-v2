<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Document Requests</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          to="/document-requests/new"
          prepend-icon="mdi-file-document-plus-outline"
          color="primary"
        >
          New Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-text-box-search-outline" class="mr-2"></v-icon>
        Request History
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Requests"
          placeholder="Search by Ref #, requestor, type, status..."
          clearable
          density="compact"
          class="mb-4"
          hide-details
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="requests"
          :items-length="totalItems"
          :loading="loading"
          @update:options="loadRequests"
          class="elevation-1 mt-4"
          item-value="_id"
        >
          <template v-slot:item.reference_number="{ item }">
             <span class="font-weight-medium text-caption copyable-id" @click="copyToClipboard(item._id)" title="Click to copy ID">
                {{ item._id }}
                <v-icon size="x-small" class="ml-1">mdi-content-copy</v-icon>
            </span>
          </template>

          <template v-slot:item.requestor_name="{ item }">
            {{ item.requestor_name || 'N/A' }}
          </template>

          <template v-slot:item.date_of_request="{ item }">
            {{ formatDate(item.date_of_request) }}
          </template>

          <template v-slot:item.purpose_of_request="{ item }">
            <div class="text-truncate" style="max-width: 250px;" :title="item.purpose_of_request">
              {{ item.purpose_of_request }}
            </div>
          </template>

          <template v-slot:item.document_status="{ item }">
            <v-select
                :model-value="item.document_status"
                :items="DOCUMENT_STATUS_OPTIONS"
                @update:modelValue="(newStatus) => updateRequestStatus(item, newStatus)"
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

          <template v-slot:item.processed_by_admin_name="{ item }">
            {{ item.processed_by_admin_name || 'N/A' }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/document-requests/${item._id}`" prepend-icon="mdi-eye-outline">
              View/Manage
            </v-btn>
          </template>

           <template v-slot:no-data>
            <v-alert type="info" class="ma-3" border="start" prominent>
                No document requests found matching your criteria.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path as per your project structure
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);
const requests = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null); // Tracks the ID of the request whose status is being updated

const DOCUMENT_STATUS_OPTIONS = ["Pending", "Processing", "Ready for Pickup", "Released", "Denied"];

const headers = ref([
  { title: 'Ref #', key: 'reference_number', sortable: false, width: '200px' }, // For item._id
  { title: 'Request Type', key: 'request_type', sortable: true },
  { title: 'Requestor Name', key: 'requestor_name', sortable: true },
  { title: 'Date of Request', key: 'date_of_request', sortable: true },
  { title: 'Purpose', key: 'purpose_of_request', sortable: false, width: '20%' },
  { title: 'Processed By', key: 'processed_by_admin_name', sortable: true },
  { title: 'Status', key: 'document_status', sortable: true, align: 'center', width: '220px' },
  { title: 'Actions', key: 'action', sortable: false, align: 'center', width: '150px' },
]);

let searchDebounceTimer = null;
let currentSortBy = ref([{ key: 'date_of_request', order: 'desc' }]); // Default sort for initial load

watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // When searchKey changes, reset to page 1 and use current sort settings
    loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
  }, 500);
});

async function loadRequests(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;

  if (sortBy && sortBy.length) {
    currentSortBy.value = sortBy;
  }

  const queryParams = {
    search: searchKey.value, // Use the current searchKey ref
    page: page,
    itemsPerPage: rpp,
  };

  // Add sorting parameters if your API supports them
  // Example: Assuming API expects 'sortBy' and 'sortOrder'
  if (currentSortBy.value && currentSortBy.value.length > 0) {
    // queryParams.sortBy = currentSortBy.value[0].key;
    // queryParams.sortOrder = currentSortBy.value[0].order;
  } else {
    // Default sort if table doesn't provide one initially (though headers set a default usually)
    // queryParams.sortBy = 'date_of_request';
    // queryParams.sortOrder = 'desc';
  }


  try {
    const { data, error } = await useMyFetch('/api/document-requests', { query: queryParams });
    if (error.value) {
      console.error('Failed to load document requests:', error.value);
      $toast.fire({ title: 'Failed to load requests.', icon: 'error'});
      requests.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      requests.value = data.value.requests || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception loading document requests:', e);
    $toast.fire({ title: 'An error occurred while loading requests.', icon: 'error'});
    requests.value = [];
    totalItems.value = 0;
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
    "Pending": 'orange-darken-1',
    "Processing": 'blue-darken-1',
    "Ready for Pickup": 'teal-darken-1',
    "Released": 'green-darken-1',
    "Denied": 'red-darken-2',
  };
  return colors[status] || 'grey'; // Default color
};

async function updateRequestStatus(requestItem, newStatus) {
  if (requestItem.document_status === newStatus) {
    // $toast.fire({ title: `Status is already '${newStatus}'.`, icon: 'info', timer: 2000 });
    return; // No change needed
  }

  const originalStatus = requestItem.document_status;
  updatingStatusFor.value = requestItem._id;

  // Find index for potential revert and optimistic update
  const itemIndex = requests.value.findIndex(r => r._id === requestItem._id);

  // Optimistic UI update
  if (itemIndex > -1) {
    requests.value[itemIndex].document_status = newStatus;
  }

  try {
    const { data, error } = await useMyFetch(`/api/document-requests/${requestItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value || (data.value && data.value.error)) {
      if (itemIndex > -1) {
        requests.value[itemIndex].document_status = originalStatus; // Revert optimistic update
      }
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to update status.', icon: 'error' });
    } else {
      $toast.fire({ title: data.value?.message || 'Status updated successfully!', icon: 'success' });
      // If API returns the updated request, update the local item for any other changed fields (like updated_at)
      if (data.value && data.value.updatedRequest && itemIndex > -1) {
         requests.value[itemIndex] = { ...requests.value[itemIndex], ...data.value.updatedRequest };
      } else if (itemIndex > -1) {
        // Ensure the status (which was optimistically updated) is correct
        requests.value[itemIndex].document_status = newStatus;
      }
    }
  } catch (e) {
    if (itemIndex > -1) {
      requests.value[itemIndex].document_status = originalStatus; // Revert on exception
    }
    console.error('Exception updating request status:', e);
    $toast.fire({ title: 'An error occurred while updating status.', icon: 'error' });
  } finally {
    updatingStatusFor.value = null; // Clear loading state for this specific row
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    $toast.fire({ title: 'Reference # copied!', icon: 'success', timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error('Failed to copy text: ', err);
    $toast.fire({ title: 'Failed to copy. Your browser might not support this feature or requires HTTPS.', icon: 'error' });
  }
}
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block; /* Necessary for max-width and truncation to work correctly */
}
.status-select {
    min-width: 200px; /* Give select enough space */
    max-width: 220px;
}
.copyable-id {
    cursor: pointer;
    display: inline-flex; /* To keep icon and text on same line nicely */
    align-items: center;
    transition: color 0.2s ease-in-out;
}
.copyable-id:hover {
    color: rgb(var(--v-theme-primary)); /* Use Vuetify theme color for hover */
}
.copyable-id .v-icon {
    opacity: 0.6;
    transition: opacity 0.2s ease-in-out;
}
.copyable-id:hover .v-icon {
    opacity: 1;
}
</style>