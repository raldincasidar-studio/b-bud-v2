// filed complaints index.vue
<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Complaint Log</h2>
        <p class="text-grey-darken-1">Track and manage all resident complaints.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/complaints/new"
          prepend-icon="mdi-comment-alert-outline"
          color="primary"
          >
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
          label="Search by ref #, complainant, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <div class="pa-4">
        <v-chip-group
          v-model="selectedStatus"
          mandatory
          column
        >
          <v-chip
            v-for="status in statusFilterItems"
            :key="status"
            :value="status"
            :color="getStatusColor(status)"
            :prepend-icon="getStatusIcon(status)"
            filter
            variant="tonal"
            size="large"
            class="ma-1"
          >
            {{ status }}
          </v-chip>
        </v-chip-group>
      </div>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="complaints"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadComplaints"
        item-value="_id"
        :sort-by="initialSortBy"
      >
        <template v-slot:item.ref_no="{ item }">
          <span class="font-weight-medium text-caption">{{ item.ref_no }}</span>
        </template>
        <template v-slot:item.date_of_complaint="{ item }">
          {{ formatDate(item.date_of_complaint) }}
        </template>
        <!-- The notes_description slot has been removed to match your old UI -->

        <template v-slot:item.status="{ item }">
          <div class="d-flex align-center justify-center">
            <v-chip
              :color="getStatusColor(item.status)"
              :prepend-icon="getStatusIcon(item.status)"
              label
              size="small"
              class="font-weight-bold"
            >
              {{ item.status }}
            </v-chip>
          </div>
        </template>

        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/complaints/${item.ref_no}`">
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
import { ref, watch, onMounted } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';
import { useRoute } from 'vue-router';

const { $toast } = useNuxtApp();
const route = useRoute();

const searchKey = ref('');
const selectedStatus = ref('All');
const totalItems = ref(0);
const complaints = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);

const initialSortBy = ref([{ key: 'date_of_complaint', order: 'desc' }]);

// No longer fetching current user status on this page, per previous request.

// UPDATED: Added 'Unresolved' status
const STATUS_CONFIG = {
  'All':                 { color: 'primary', icon: 'mdi-filter-variant' },
  'New':                 { color: 'info', icon: 'mdi-bell-ring-outline' },
  'Under Investigation': { color: 'warning', icon: 'mdi-magnify-scan' },
  'Unresolved':          { color: 'blue-grey-darken-3', icon: 'mdi-alert-circle-outline' }, // NEW STATUS
  'Resolved':            { color: 'success', icon: 'mdi-check-circle-outline' },
  'Closed':              { color: 'grey-darken-1', icon: 'mdi-archive-outline' },
  'Dismissed':           { color: 'error', icon: 'mdi-cancel' },
};

const statusFilterItems = ref(Object.keys(STATUS_CONFIG));

const headers = ref([
  { title: 'Ref #', key: 'ref_no', sortable: false, width: '150px' },
  { title: 'Complainant', key: 'complainant_name', sortable: true },
  { title: 'Complained Against', key: 'person_complained_against', sortable: true },
  { title: 'Date Filed', key: 'date_of_complaint', sortable: true },
  { title: 'Category', key: 'category', sortable: false },
  // The 'Description' header entry has been removed to match your old UI.
  { title: 'Status', key: 'status', sortable: true, align: 'center', width: '220px'},
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
]);

const getAvailableActions = (currentStatus) => {
  const allActions = {
    'New': { status: 'New', title: 'Mark as New' },
    'Under Investigation': { status: 'Under Investigation', title: 'Start Investigation' },
    'Unresolved': { status: 'Unresolved', title: 'Mark as Unresolved' }, // NEW ACTION
    'Resolved': { status: 'Resolved', title: 'Mark as Resolved' },
    'Closed': { status: 'Closed', title: 'Mark as Closed' },
    'Dismissed': { status: 'Dismissed', title: 'Dismiss Complaint' },
  };

  return Object.values(allActions)
    .filter(action => action.status !== currentStatus)
    .map(action => ({
      ...action,
      icon: getStatusIcon(action.status),
      color: getStatusColor(action.status)
    }));
};

let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadComplaints({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

watch(selectedStatus, () => {
  loadComplaints({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});

watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return; 
    const newStatus = route.query.status || 'All';
    if (newStatus !== selectedStatus.value) {
        selectedStatus.value = newStatus;
    } else {
        loadComplaints({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
    }
}, { deep: true });

onMounted(() => {
    const statusQuery = new URLSearchParams(window.location.search).get('status');
    if (statusQuery) {
        setTimeout(() => {
            selectedStatus.value = statusQuery;
        }, 1000)
    }    
})

async function loadComplaints(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  const queryFromUrl = { ...route.query };

  const queryFromUi = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    status: selectedStatus.value === 'All' ? undefined : selectedStatus.value,
  };

  if (sortBy && sortBy.length > 0) {
    queryFromUi.sortBy = sortBy[0].key;
    queryFromUi.sortOrder = sortBy[0].order;
  }
  
  const finalQuery = { ...queryFromUrl, ...queryFromUi };
  
  Object.keys(finalQuery).forEach(key => (finalQuery[key] === undefined || finalQuery[key] === null || finalQuery[key] === '') && delete finalQuery[key]);

  try {
    const { data, error } = await useMyFetch('/api/complaints', { query: finalQuery });
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

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'grey';
const getStatusIcon = (status) => STATUS_CONFIG[status]?.icon || 'mdi-help-circle-outline';

</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>