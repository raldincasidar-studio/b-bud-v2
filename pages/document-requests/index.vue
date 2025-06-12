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
          label="Search by ref #, requestor, etc..."
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
        <template v-slot:item.reference_number="{ item }">
          <span class="font-weight-medium text-caption">{{ item._id }}</span>
        </template>
        <template v-slot:item.requestor_name="{ item }">{{ item.requestor_name || 'N/A' }}</template>
        <template v-slot:item.date_of_request="{ item }">{{ formatDate(item.date_of_request) }}</template>
        <template v-slot:item.purpose_of_request="{ item }">
          <div class="text-truncate" style="max-width: 250px;" :title="item.purpose_of_request">
            {{ item.purpose_of_request }}
          </div>
        </template>

        <!-- REWORKED STATUS & ACTIONS COLUMN -->
        <template v-slot:item.document_status="{ item }">
          <div class="d-flex align-center justify-center">
            <v-chip :color="getStatusColor(item.document_status)" label size="small" class="me-2">
              {{ item.document_status }}
            </v-chip>
            <v-menu offset-y>
              <template v-slot:activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical"
                  size="small" variant="text"
                  v-bind="props"
                  :loading="updatingStatusFor === item._id"
                  :disabled="updatingStatusFor === item._id"
                ></v-btn>
              </template>
              <v-list density="compact">
                <!-- Special "Generate" action -->
                <v-list-item v-if="item.document_status === 'Ready for Pickup' || item.document_status === 'Released'" :to="`/document-requests/${item._id}?print=true`" target="_blank">
                  <template v-slot:prepend><v-icon icon="mdi-printer-outline" color="primary" size="small"></v-icon></template>
                  <v-list-item-title>Generate Document</v-list-item-title>
                </v-list-item>
                <v-divider v-if="item.document_status === 'Ready for Pickup' || item.document_status === 'Released'"></v-divider>

                <!-- Standard status change actions -->
                <v-list-item
                  v-for="action in getAvailableActions(item.document_status)"
                  :key="action.status"
                  @click="updateRequestStatus(item, action.status)"
                >
                  <template v-slot:prepend><v-icon :icon="action.icon" :color="action.color" size="small"></v-icon></template>
                  <v-list-item-title>{{ action.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </template>

        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/document-requests/${item._id}`">
            View/Manage
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
const updatingStatusFor = ref(null);

const headers = ref([
  { title: 'Ref #', key: 'reference_number', sortable: false, width: '150px' },
  { title: 'Request Type', key: 'request_type', sortable: true },
  { title: 'Requestor', key: 'requestor_name', sortable: true },
  { title: 'Date of Request', key: 'date_of_request', sortable: true },
  { title: 'Purpose', key: 'purpose_of_request', sortable: false },
  { title: 'Status & Actions', key: 'document_status', sortable: true, align: 'center', width: '220px' },
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
]);

// --- NEW FUNCTION for available actions ---
const getAvailableActions = (currentStatus) => {
  const allActions = {
    'Processing': { status: 'Processing', title: 'Mark as Processing', icon: 'mdi-cogs', color: 'blue-darken-1' },
    'Ready for Pickup': { status: 'Ready for Pickup', title: 'Set to Ready for Pickup', icon: 'mdi-account-check-outline', color: 'teal-darken-1' },
    'Released': { status: 'Released', title: 'Mark as Released', icon: 'mdi-check-all', color: 'green-darken-1' },
    'Denied': { status: 'Denied', title: 'Deny Request', icon: 'mdi-cancel', color: 'red-darken-2' },
  };
  // Exclude current status and "Released" if it's already denied, etc.
  return Object.values(allActions).filter(action => action.status !== currentStatus);
};

// --- Debounced search and data loading ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

async function loadRequests(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  const queryParams = { search: searchKey.value, page: page, itemsPerPage: rpp };
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

async function updateRequestStatus(requestItem, newStatus) {
  updatingStatusFor.value = requestItem._id;
  try {
    // NOTE: If "Denied", you might want to open a dialog to get a reason first.
    // For now, it updates status directly.
    const { data, error } = await useMyFetch(`/api/document-requests/${requestItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
    const itemIndex = requests.value.findIndex(r => r._id === requestItem._id);
    if (itemIndex > -1) {
      requests.value[itemIndex].document_status = newStatus;
    }
    $toast.fire({ title: 'Status updated successfully!', icon: 'success' });
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

// --- Helper Functions ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getStatusColor = (status) => ({
    "Pending": 'orange-darken-1', "Processing": 'blue-darken-1', "Ready for Pickup": 'teal-darken-1',
    "Released": 'green-darken-1', "Denied": 'red-darken-2'
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