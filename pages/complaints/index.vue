<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Complaint Log</h2>
        <p class="text-grey-darken-1">Track and manage all resident complaints.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn size="large" to="/complaints/new" prepend-icon="mdi-comment-alert-outline" color="primary">
          File New Complaint
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-file-chart-outline" class="mr-2"></v-icon>
        Complaint History
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          density="compact"
          label="Search by ref #, complainant, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="complaints"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadComplaints"
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

        <!-- REWORKED STATUS COLUMN -->
        <template v-slot:item.status="{ item }">
          <div class="d-flex align-center justify-center">
            <v-chip :color="getStatusColor(item.status)" label size="small" class="me-2">
              {{ item.status }}
            </v-chip>
            <v-menu offset-y>
              <template v-slot:activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical"
                  size="small"
                  variant="text"
                  v-bind="props"
                  :loading="updatingStatusFor === item._id"
                  :disabled="updatingStatusFor === item._id"
                ></v-btn>
              </template>
              <v-list density="compact">
                <v-list-item
                  v-for="action in getAvailableActions(item.status)"
                  :key="action.status"
                  @click="updateComplaintStatus(item, action.status)"
                >
                  <template v-slot:prepend>
                    <v-icon :icon="action.icon" :color="action.color" size="small"></v-icon>
                  </template>
                  <v-list-item-title>{{ action.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </template>

        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/complaints/${item._id}`">
            View/Manage
          </v-btn>
        </template>
        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No complaints found matching your criteria.</v-alert>
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
const complaints = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);

// This is no longer used for the UI, but it defines our master list of statuses
const ALL_STATUSES = ['New', 'Under Investigation', 'Resolved', 'Closed', 'Dismissed'];

const headers = ref([
  { title: 'Ref #', key: 'reference_number', sortable: false, width: '150px' },
  { title: 'Complainant', key: 'complainant_name', sortable: true },
  { title: 'Complained Against', key: 'person_complained_against', sortable: true },
  { title: 'Date Filed', key: 'date_of_complaint', sortable: true },
  { title: 'Description Preview', key: 'notes_description', sortable: false },
  { title: 'Status & Actions', key: 'status', sortable: true, align: 'center', width: '220px'},
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
]);

// --- New function to get available actions ---
const getAvailableActions = (currentStatus) => {
  const allActions = {
    'New': { status: 'New', title: 'Mark as New', icon: 'mdi-new-box', color: 'info' },
    'Under Investigation': { status: 'Under Investigation', title: 'Start Investigation', icon: 'mdi-magnify-scan', color: 'warning' },
    'Resolved': { status: 'Resolved', title: 'Mark as Resolved', icon: 'mdi-check-circle-outline', color: 'success' },
    'Closed': { status: 'Closed', title: 'Mark as Closed', icon: 'mdi-archive-outline', color: 'grey-darken-1' },
    'Dismissed': { status: 'Dismissed', title: 'Dismiss Complaint', icon: 'mdi-cancel', color: 'error' },
  };
  // Return all actions that are not the current status
  return Object.values(allActions).filter(action => action.status !== currentStatus);
};

// --- Debounced search ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadComplaints({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

async function loadComplaints(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  const queryParams = { search: searchKey.value, page: page, itemsPerPage: rpp };

  try {
    const { data, error } = await useMyFetch('/api/complaints', { query: queryParams });
    if (error.value) throw new Error('Failed to load complaints.');
    complaints.value = data.value?.complaints || [];
    totalItems.value = data.value?.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error'});
    complaints.value = []; totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

async function updateComplaintStatus(complaintItem, newStatus) {
  updatingStatusFor.value = complaintItem._id;
  try {
    const { data, error } = await useMyFetch(`/api/complaints/${complaintItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
    
    // On success, update the item in the local list to reflect the change
    const itemIndex = complaints.value.findIndex(c => c._id === complaintItem._id);
    if (itemIndex > -1) {
      complaints.value[itemIndex].status = newStatus;
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
    "New": 'info', "Under Investigation": 'warning', "Resolved": 'success',
    "Closed": 'grey-darken-1', "Dismissed": 'error'
  }[status] || 'default');
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>