<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Barangay Officials</h2>
        <p class="text-grey-darken-1">Manage the list of current and past barangay officials.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/barangay-officials/new"
          prepend-icon="mdi-account-plus"
          color="primary"
        >
          New Official
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-account-group-outline" class="mr-2"></v-icon>
        Officials Roster
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          density="compact"
          label="Search by Name, Position..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat
          hide-details
          single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>
      
      <!-- Filter Chip Group -->
      <v-card-text>
        <v-chip-group
          v-model="positionFilter"
          column
          color="primary"
        >
          <v-chip filter value="All">All</v-chip>
          <v-chip filter value="Punong Barangay">Punong Barangay</v-chip>
          <v-chip filter value="Barangay Secretary">Barangay Secretary</v-chip>
          <v-chip filter value="Treasurer">Treasurer</v-chip>
          <v-chip filter value="Sangguniang Barangay Member">Sangguniang Barangay Member</v-chip>
          <v-chip filter value="SK Chairperson">SK Chairperson</v-chip>
          <v-chip filter value="SK Member">SK Member</v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="officials"
        :items-length="totalOfficials"
        :loading="loading"
        :search="searchKey"
        @update:options="updateTable"
        item-value="_id"
      >
        <template v-slot:item.name="{ item }">
          {{ item.last_name }}, {{ item.first_name }} {{ item.middle_name ? item.middle_name[0] + '.' : '' }}
        </template>

        <template v-slot:item.term="{ item }">
          {{ formatDate(item.term_start) }} - {{ formatDate(item.term_end) }}
        </template>
        
        <template v-slot:item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" label size="small">
            {{ item.status }}
          </v-chip>
        </template>
        
        <template v-slot:item.action="{ item }">
          <v-btn
            variant="tonal"
            color="primary"
            size="small"
            :to="`/barangay-officials/${item._id}`"
          >
            View/Edit
          </v-btn>
        </template>
        
        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No officials found matching your criteria.</v-alert>
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
const positionFilter = ref('All'); // For the filter chip group
const totalOfficials = ref(0);
const officials = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// Headers reflecting the new, correct data structure
const headers = ref([
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Position', key: 'position', sortable: true },
  { title: 'Term of Office', key: 'term', sortable: false },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// --- WATCHERS for Search and Filter ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

watch(positionFilter, () => {
  updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});


// --- DATA LOADING ---
async function updateTable(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  // Build query parameters, including the new filter
  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    position: positionFilter.value === 'All' ? '' : positionFilter.value, // Send filter to API
  };
  
  try {
    const { data, error } = await useMyFetch('/api/barangay-officials', { query: queryParams });
    if (error.value) throw new Error('Failed to load barangay officials.');
    
    officials.value = data.value?.officials || [];
    totalOfficials.value = data.value?.totalOfficials || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    officials.value = [];
    totalOfficials.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- HELPER FUNCTIONS ---
const formatDate = (dateString) => {
  if (!dateString) return 'Present';
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getStatusColor = (status) => {
  return status === 'Active' ? 'success' : 'grey';
};
</script>