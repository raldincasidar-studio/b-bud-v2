<template>
  <v-container class="my-10">
    <!-- Page Header -->
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Audit Log</h2>
        <p class="text-grey-darken-1">Track and review all system and user activities.</p>
      </v-col>
    </v-row>

    <!-- Audit Log Table -->
    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-history" class="mr-2"></v-icon>
        Log History
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          
          label="Search logs by description, user, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="logs"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadLogs"
        item-value="ref_no"
      >
        <!-- Custom slot for Ref # -->
        <template v-slot:item.ref_no="{ item }">
          <span class="font-weight-medium text-caption text-black-darken-1">{{ item.ref_no }}</span>
        </template>
        
        <!-- Custom slot for User Name -->
        <template v-slot:item.user_name="{ item }">
          <div class="font-weight-medium">{{ item.user_name }}</div>
        </template>

        <!-- Custom slot for Description -->
        <template v-slot:item.description="{ item }">
          <div class="text-body-2">{{ item.description }}</div>
        </template>

        <!-- Custom slot for Date -->
        <template v-slot:item.date="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <!-- Custom slot for Time -->
        <template v-slot:item.time="{ item }">
          {{ formatTime(item.createdAt) }}
        </template>

        <!-- No Data Template -->
        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No audit logs found.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
// Assuming useMyFetch is your composable for making API calls to your Express server
import { useMyFetch } from '../../composables/useMyFetch'; 
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

// --- STATE ---
const searchKey = ref('');
const totalItems = ref(0);
const logs = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// --- TABLE HEADERS ---
// Updated to include the 'User' column
const headers = ref([
  { title: 'Ref #', key: 'ref_no', sortable: false, width: '10%' },
  { title: 'User', key: 'user_name', sortable: true, width: '20%' }, // Added User column
  { title: 'Description', key: 'description', sortable: true, width: '45%' },
  { title: 'Date', key: 'date', sortable: true, width: '12%' },
  { title: 'Time', key: 'time', sortable: false, align: 'end', width: '10%' },
]);

// --- DEBOUNCED SEARCH ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadLogs({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

// --- DATA FETCHING ---
async function loadLogs(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  const queryParams = { 
    search: searchKey.value, 
    page: page, 
    itemsPerPage: rpp,
    sortBy: sortBy.length > 0 ? sortBy[0].key : 'createdAt', // Default sort
    sortOrder: sortBy.length > 0 ? sortBy[0].order : 'desc',
  };

  try {
    // The endpoint name matches the new route in index.js
    const { data, error } = await useMyFetch('/api/audit-logs', { query: queryParams });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to load audit logs.');
    
    // The response structure matches what the new API provides
    logs.value = data.value?.logs || [];
    totalItems.value = data.value?.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error'});
    logs.value = []; 
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- HELPER FUNCTIONS ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};
</script>

<style scoped>
/* You can add specific styles here if needed */
</style>