<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '~/composables/useMyFetch';
const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);
const residents = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const currentPage = ref(1); // For pagination control

const STATUS_OPTIONS = ['Approved', 'Pending', 'Declined', 'Deactivated'];

const headers = ref([
  { title: 'Full Name', key: 'full_name', sortable: false, align: 'start', value: item => `${item.first_name} ${item.middle_name || ''} ${item.last_name}` },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Contact No.', key: 'contact_number', sortable: false },
  { title: 'Address', key: 'address', sortable: false, width: '250px' },
  { title: 'Household Head', key: 'is_household_head', sortable: true, align: 'center' },
  { title: 'Date Added', key: 'created_at', sortable: true },
  { title: 'Status', key: 'status', sortable: true, align: 'center', width: '180px' }, // Added Status
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // Reset to page 1 on new search
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500);
});

async function loadResidents(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy, search } = options;
  currentPage.value = page; // Keep track of current page

  try {
    const { data, error } = await useMyFetch('/api/residents', {
      query: {
        search: search || searchKey.value,
        page: page,
        itemsPerPage: rpp,
        // sortBy: sortKey, // Add if API supports
        // sortOrder: sortOrder, // Add if API supports
      },
    });

    if (error.value) {
      console.error('Failed to load residents:', error.value);
      $toast.fire({ title: 'Failed to load residents.', icon: 'error' });
      residents.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      residents.value = data.value.residents || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception while loading residents:', e);
    $toast.fire({ title: 'Error loading residents.', icon: 'error' });
    residents.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) { return dateString; }
};

const getStatusColor = (status) => {
  if (status === 'Approved') return 'green';
  if (status === 'Pending') return 'orange';
  if (status === 'Declined') return 'red';
  if (status === 'Deactivated') return 'grey';
  return 'blue-grey'; // Default
};

async function updateResidentStatus(residentItem, newStatus) {
  const originalStatus = residentItem?.status || 'Pending';
  // Optimistic UI update
  const residentInList = residents.value.find(r => r._id === residentItem._id);
  if (residentInList) {
    residentInList.status = newStatus;
  }

  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value || (data.value && data.value.error) ) {
      // Revert optimistic update
      if (residentInList) residentInList.status = originalStatus;
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to update status.', icon: 'error' });
    } else {
      $toast.fire({ title: data.value?.message || 'Status updated successfully!', icon: 'success' });
      // Data is already optimistically updated, or re-fetch if needed
      // If API returns statusChanged: false, you might want to show a specific toast
      if (data.value && data.value.statusChanged === false) {
         $toast.fire({ title: data.value?.message, icon: 'info' });
      }
    }
  } catch (e) {
    if (residentInList) residentInList.status = originalStatus; // Revert on exception
    console.error('Exception updating status:', e);
    $toast.fire({ title: 'An error occurred while updating status.', icon: 'error' });
  }
}
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between" class="mb-5">
      <v-col><h2>Residents</h2></v-col>
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" to="/residents/new" prepend-icon="mdi-account-plus" color="primary">
          New Resident
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-account-search-outline" class="mr-2"></v-icon> Find Residents
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="searchKey" prepend-inner-icon="mdi-magnify" variant="outlined" color="primary" label="Search Residents" placeholder="Search by name, email, contact, address..." clearable density="compact" class="mb-4"></v-text-field>
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="residents"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey" 
          @update:options="loadResidents"
          item-value="_id"
        >
          <template v-slot:item.full_name="{ item }">
            <!-- {{ item }} -->
            {{ item.first_name }} {{ item.middle_name ? item.middle_name + ' ' : '' }}{{ item.last_name }}
          </template>
          <template v-slot:item.address="{ item }">
            <div class="text-truncate" style="max-width: 250px;">
              {{ item.address_house_number }} {{ item.address_street }}, {{ item.address_subdivision_zone }}, {{ item.address_city_municipality }}
            </div>
          </template>
          <template v-slot:item.is_household_head="{ item }">
            <v-chip :color="item.is_household_head ? 'green' : 'grey'" small>{{ item.is_household_head ? 'Yes' : 'No' }}</v-chip>
          </template>
          <template v-slot:item.status="{ item }">
             <v-select
                :model-value="item.status"
                :items="STATUS_OPTIONS"
                @update:modelValue="(newStatus) => updateResidentStatus(item, newStatus)"
                density="compact"
                variant="outlined"
                hide-details
                class="status-select"
                :disabled="loading"
              >
                <template v-slot:selection="{ item: selItem }">
                    <v-chip :color="getStatusColor(selItem.value)" label small>
                        {{ selItem.title }}
                    </v-chip>
                </template>
              </v-select>
          </template>
          <template v-slot:item.created_at="{ item }">{{ formatDate(item.created_at) }}</template>
          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/residents/${item._id}`" prepend-icon="mdi-eye-outline">View</v-btn>
          </template>
          <template v-slot:loading><v-skeleton-loader type="table-row@5"></v-skeleton-loader></template>
          <template v-slot:no-data>
            <v-alert type="info" prominent border="start" class="ma-4">No residents found.</v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<style scoped>
.status-select {
    min-width: 160px; /* Adjust as needed */
}
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>