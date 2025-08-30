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
          
          label="Search by type, requestor, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <v-card-text>
        <v-chip-group v-model="statusFilter" column>
          <v-chip filter value="All" color="primary" prepend-icon="mdi-filter-variant">All</v-chip>
          <!-- CORRECTED: Comment is now outside the tag -->
          <v-chip
            v-for="status in statusFilters"
            :key="status.name"
            filter
            variant="tonal" 
            :value="status.name"
            :color="status.color"
            :prepend-icon="status.icon"
          >
            {{ status.name }}
          </v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="requests"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadRequests"
        item-value="ref_no"
        :sort-by="initialSortBy"
      >
        <template v-slot:item.ref_no="{ item }">
          <span class="font-weight-medium text-caption">{{ item.ref_no }}</span>
        </template>
        
        <template v-slot:item.requestor_name="{ item }">{{ item.requestor_name || 'N/A' }}</template>

        <template v-slot:item.date_of_request="{ item }">{{ formatTimestamp(item.date_of_request) }}</template>
        
        <template v-slot:item.purpose_of_request="{ item }">
          <div class="text-truncate" style="max-width: 250px;" :title="item.purpose_of_request">
            {{ item.purpose_of_request }}
          </div>
        </template>

        <template v-slot:item.document_status="{ item }">
          <v-chip
            :color="getStatusInfo(item.document_status).color"
            :prepend-icon="getStatusInfo(item.document_status).icon"
            label
            size="small"
            class="font-weight-medium"
          >
            {{ item.document_status }}
          </v-chip>
        </template>
        
        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/document-requests/${item.ref_no}`">
            View / Manage
          </v-btn>
        </template>

        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No document requests found for the selected filters.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router'; 
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();

// --- State Definitions ---
const searchKey = ref('');
const statusFilter = ref(route.query.status || 'All');
const totalItems = ref(0);
const requests = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

const initialSortBy = ref([{ key: 'date_of_request', order: 'desc' }]);

const statusFilters = ref([
  { name: 'Pending', color: 'orange-darken-1', icon: 'mdi-clock-outline' },
  // { name: 'Follow up', color: 'blue-darken-1', icon: 'mdi-account-voice' },
  { name: 'Processing', color: 'blue-darken-1', icon: 'mdi-cogs' },
  { name: 'Approved', color: 'cyan-darken-1', icon: 'mdi-check-circle-outline' },
  { name: 'Ready for Pickup', color: 'teal-darken-1', icon: 'mdi-package-variant-closed' },
  { name: 'Released', color: 'green-darken-1', icon: 'mdi-check-decagram-outline' },
  { name: 'Declined', color: 'red-darken-2', icon: 'mdi-close-octagon-outline' }
]);

const headers = ref([
  { title: 'Ref #', key: 'ref_no', sortable: false, width: '150px' },
  { title: 'Request Type', key: 'request_type', sortable: true },
  { title: 'Requestor', key: 'requestor_name', sortable: true },
  { title: 'Date of Request', key: 'date_of_request', sortable: true },
  { title: 'Status', key: 'document_status', sortable: true, align: 'center' },
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
]);

// --- Data Loading Function ---
async function loadRequests(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  const queryFromUrl = { ...route.query };

  const queryFromUi = {
    search: searchKey.value,
    page,
    itemsPerPage: rpp,
    status: statusFilter.value === 'All' ? undefined : statusFilter.value,
  };
  
  if (sortBy && sortBy.length > 0) {
    queryFromUi.sortBy = sortBy[0].key;
    queryFromUi.sortOrder = sortBy[0].order;
  }
  
  const finalQuery = { ...queryFromUrl, ...queryFromUi };
  
  Object.keys(finalQuery).forEach(key => (finalQuery[key] === undefined || finalQuery[key] === null || finalQuery[key] === '') && delete finalQuery[key]);

  try {
    const { data, error } = await useMyFetch('/api/document-requests', { query: finalQuery });
    if (error.value) throw new Error('Failed to load requests.');
    requests.value = data.value?.requests || [];
    totalItems.value = data.value?.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    requests.value = []; 
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- Watchers ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

watch(statusFilter, () => {
  loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});

watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return; 
    const newStatus = route.query.status || 'All';
    if (newStatus !== statusFilter.value) {
        statusFilter.value = newStatus;
    } else {
        loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
    }
}, { deep: true });


// --- Helper Functions ---
const formatTimestamp = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return dateString; }
};

const getStatusInfo = (status) => {
  const foundStatus = statusFilters.value.find(s => s.name === status);
  return foundStatus || { color: 'grey', icon: 'mdi-help-circle-outline' };
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>