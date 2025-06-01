<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Document Requests</h2></v-col>
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" to="/document-requests/new" prepend-icon="mdi-file-document-plus-outline" color="primary">
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
          placeholder="Search by requestor, type, status..."
          clearable
          density="compact"
          class="mb-4"
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="requests"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey"
          @update:options="loadRequests"
          class="elevation-1"
          item-value="_id"
        >
          <template v-slot:item.date_of_request="{ item }">
            {{ formatDate(item.date_of_request) }}
          </template>
          <template v-slot:item.purpose_of_request="{ item }">
            <div class="text-truncate" style="max-width: 250px;" :title="item.purpose_of_request">
              {{ item.purpose_of_request }}
            </div>
          </template>
          <template v-slot:item.document_status="{ item }">
            <v-chip :color="getStatusColor(item.document_status)" small label>{{ item.document_status }}</v-chip>
          </template>
          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/document-requests/${item._id}`" prepend-icon="mdi-eye-outline">
              View/Edit
            </v-btn>
          </template>
           <template v-slot:no-data>
            <v-alert type="info" class="ma-3">No document requests found.</v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path

const searchKey = ref('');
const totalItems = ref(0);
const requests = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

const headers = ref([
  { title: 'Request Type', key: 'request_type', sortable: true },
  { title: 'Requestor Name', key: 'requestor_name', sortable: true }, // API returns looked-up name
  { title: 'Date of Request', key: 'date_of_request', sortable: true },
  { title: 'Status', key: 'document_status', sortable: true, align: 'center' },
  { title: 'Purpose', key: 'purpose_of_request', sortable: false },
  { title: 'Processed By', key: 'requested_by_name', sortable: true }, // API returns looked-up name
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadRequests({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500);
});

async function loadRequests(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy, search } = options;
  const currentSearchTerm = searchKey.value;

  try {
    const { data, error } = await useMyFetch('/api/document-requests', {
      query: {
        search: currentSearchTerm,
        page: page,
        itemsPerPage: rpp,
      },
    });
    if (error.value) {
      console.error('Failed to load document requests:', error.value);
      requests.value = []; totalItems.value = 0;
    } else if (data.value) {
      requests.value = data.value.requests || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception loading document requests:', e);
    requests.value = []; totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) { return dateString; }
};

const getStatusColor = (status) => {
  const colors = {
    "Pending": 'orange',
    "Processing": 'blue',
    "Ready for Pickup": 'teal',
    "Released": 'green',
    "Denied": 'red',
  };
  return colors[status] || 'default';
};
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>