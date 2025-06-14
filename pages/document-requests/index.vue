<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Document Requests</h2>
        <p class="text-grey-darken-1">Manage and process all resident document requests.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/document-requests/new"
          prepend-icon="mdi-file-document-plus-outline"
          color="primary"
        >
          New Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-text-box-search-outline" class="mr-2"></v-icon>
        Request History
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          density="compact"
          label="Search by type, requestor, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="requests"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadRequests"
        item-value="_id"
      >
        <!-- REVISION: Renamed key from 'reference_number' to '_id' to match API response if needed -->
        <template v-slot:item._id="{ item }">
          <span class="font-weight-medium text-caption">{{ item._id }}</span>
        </template>
        
        <template v-slot:item.requestor_name="{ item }">{{ item.requestor_name || 'N/A' }}</template>

        <!-- REVISION: Using new formatter to show date and time -->
        <template v-slot:item.date_of_request="{ item }">{{ formatTimestamp(item.date_of_request) }}</template>
        
        <template v-slot:item.purpose_of_request="{ item }">
          <div class="text-truncate" style="max-width: 250px;" :title="item.purpose_of_request">
            {{ item.purpose_of_request }}
          </div>
        </template>

        <!-- REVISION: SIMPLIFIED STATUS COLUMN. No more actions menu. -->
        <template v-slot:item.document_status="{ item }">
          <v-chip :color="getStatusColor(item.document_status)" label size="small" class="font-weight-medium">
            {{ item.document_status }}
          </v-chip>
        </template>
        
        <!-- REVISION: This is the primary action button now. -->
        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/document-requests/${item._id}`">
            View / Manage
          </v-btn>
        </template>

        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No document requests found.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);
const requests = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// REVISION: Simplified headers. Removed the complex "Status & Actions" column.
const headers = ref([
  { title: 'Ref #', key: '_id', sortable: false, width: '150px' },
  { title: 'Request Type', key: 'request_type', sortable: true },
  { title: 'Requestor', key: 'requestor_name', sortable: true },
  { title: 'Date of Request', key: 'date_of_request', sortable: true },
  { title: 'Purpose', key: 'purpose_of_request', sortable: false },
  { title: 'Status', key: 'document_status', sortable: true, align: 'center' },
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
]);

// --- Debounced search and data loading ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // Reset to the first page when searching
    loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

async function loadRequests(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  const queryParams = { search: searchKey.value, page: page, itemsPerPage: rpp };

  // Note: Sorting from the server-side might require API changes.
  // For now, we pass it but it might not be implemented in the provided API.
  if (sortBy && sortBy.length > 0) {
    queryParams.sortBy = sortBy[0].key;
    queryParams.sortOrder = sortBy[0].order;
  }
  
  try {
    const { data, error } = await useMyFetch('/api/document-requests', { query: queryParams });
    if (error.value) throw new Error('Failed to load requests.');
    requests.value = data.value?.requests || [];
    totalItems.value = data.value?.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error'});
    requests.value = []; totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- Helper Functions ---
// REVISION: New formatter to show date and time as requested.
const formatTimestamp = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return dateString; }
};

const getStatusColor = (status) => ({
    "Pending": 'orange-darken-1', 
    "Processing": 'blue-darken-1', 
    "Approved": 'cyan-darken-1', // Added for clarity
    "Ready for Pickup": 'teal-darken-1',
    "Released": 'green-darken-1', 
    "Declined": 'red-darken-2'
  }[status] || 'grey');
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>