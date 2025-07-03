<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Household Account Management</h2>
        <p class="text-grey-darken-1">Activate, deactivate, and view resident accounts.</p>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-account-search-outline" class="mr-2"></v-icon>
        Find Resident Accounts
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          label="Search by name, email, etc..."
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
          v-model="statusFilter"
          column
          color="primary"
        >
          <v-chip filter value="All">All</v-chip>
          <v-chip filter value="Pending">Pending</v-chip>
          <v-chip filter value="Approved">Approved</v-chip>
          <v-chip filter value="Deactivated">Deactivated</v-chip>
          <v-chip filter value="Declined">Declined</v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <!-- REVISED: Data table for Account Management -->
      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="residents"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadResidents"
        item-value="_id"
      >
        <template v-slot:item._id="{ item }">
          #{{ item._id.slice(-4) }}
        </template>

        <template v-slot:item.full_name="{ item }">
          {{ item.first_name }} {{ item.last_name }}
        </template>

        <template v-slot:item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" label size="small">
            {{ item.status }}
          </v-chip>
        </template>

        <!-- UPDATE: Slots for date_added and date_approved -->
        <template v-slot:item.date_added="{ item }">
            {{ formatDate(item.date_added) }}
        </template>

        <template v-slot:item.date_approved="{ item }">
            {{ formatDate(item.date_approved) }}
        </template>

        <template v-slot:item.actions="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/residents/${item._id}`" class="me-2">View</v-btn>
            <v-menu offset-y>
              <template v-slot:activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical" size="small" variant="text" v-bind="props"
                  :loading="updatingStatusFor === item._id" :disabled="updatingStatusFor === item._id"
                ></v-btn>
              </template>
              <v-list dense>
                <v-list-item
                  v-for="action in getAvailableActions(item.status)"
                  :key="action.status"
                  @click="handleActionClick(item, action.status)"
                >
                  <template v-slot:prepend><v-icon :icon="action.icon" :color="action.color" size="small"></v-icon></template>
                  <v-list-item-title>{{ action.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
        </template>

        <template v-slot:no-data>
          <v-alert type="info" class="ma-4">No resident accounts found for the selected filters.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Decline with Reason Dialog -->
    <v-dialog v-model="declineDialog" persistent max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Decline Account</v-card-title>
        <v-card-text>
          <p class="mb-4">Please provide a reason for declining the account for <strong>{{ residentToDecline?.first_name }} {{ residentToDecline?.last_name }}</strong>. This reason will be sent in the notification.</p>
          <v-textarea
            v-model="declineReason"
            label="Reason for Decline"
            variant="outlined"
            rows="3"
            counter
            maxlength="250"
            :rules="[v => !!v || 'Reason is required.']"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="declineDialog = false">Cancel</v-btn>
          <v-btn color="error" :disabled="!declineReason" :loading="updatingStatusFor === residentToDecline?._id" @click="confirmDecline">Confirm Decline</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMyFetch } from '~/composables/useMyFetch';

const { $toast } = useNuxtApp();
const route = useRoute();

const searchKey = ref('');
const statusFilter = ref(route.query.status || 'All');
const totalItems = ref(0);
const residents = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);
const currentTableOptions = ref({}); // To store table state for reloading

const declineDialog = ref(false);
const residentToDecline = ref(null);
const declineReason = ref('');

// REVISED: Table Headers for Account Management
const headers = ref([
  { title: 'Acc Number', key: '_id', sortable: false },
  { title: 'Resident Name', key: 'full_name', sortable: false },
  { title: 'Email', key: 'email', sortable: false },
  { title: 'Date Added', key: 'date_added', sortable: true },
  { title: 'Date Approved', key: 'date_approved', sortable: true },
  { title: 'Account Status', key: 'status', sortable: true, align: 'center' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center', width: '150px' },
]);

const getAvailableActions = (currentStatus) => {
    const actions = {
        'Approve': { status: 'Approved', title: 'Approve Account', icon: 'mdi-check-circle-outline', color: 'success' },
        'Decline': { status: 'Declined', title: 'Decline Account', icon: 'mdi-close-circle-outline', color: 'error' },
        'Deactivate': { status: 'Deactivated', title: 'Deactivate Account', icon: 'mdi-account-off-outline', color: 'grey' },
        'Reactivate': { status: 'Pending', title: 'Reactivate (Set to Pending)', icon: 'mdi-account-reactivate-outline', color: 'orange' },
    };
    if (currentStatus === 'Pending') return [actions.Approve, actions.Decline];
    if (currentStatus === 'Approved') return [actions.Deactivate];
    if (currentStatus === 'Declined' || currentStatus === 'Deactivated') return [actions.Reactivate];
    return [];
};

const handleActionClick = (resident, newStatus) => {
    if (newStatus === 'Declined') {
        openDeclineDialog(resident);
    } else {
        updateResidentStatus(resident, newStatus);
    }
};

const openDeclineDialog = (resident) => {
    residentToDecline.value = resident;
    declineReason.value = '';
    declineDialog.value = true;
};

const confirmDecline = async () => {
    if (!declineReason.value) {
        $toast.fire({ title: 'A reason is required to decline.', icon: 'warning' });
        return;
    }
    await updateResidentStatus(residentToDecline.value, 'Declined', declineReason.value);
    declineDialog.value = false;
};

// UPDATE: This function now reloads the table to get fresh data
async function updateResidentStatus(resident, newStatus, reason = null) {
  updatingStatusFor.value = resident._id;
  try {
    const payload = { status: newStatus };
    if (reason) { payload.reason = reason; }

    const { error } = await useMyFetch(`/api/residents/${resident._id}/status`, {
      method: 'PATCH',
      body: payload,
    });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
    
    $toast.fire({ title: 'Status updated successfully!', icon: 'success' });
    
    // Refresh the table data to show the new date_approved value
    await loadResidents(currentTableOptions.value);

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

// UPDATE: This function now stores the latest options for refresh
async function loadResidents(options) {
  loading.value = true;
  currentTableOptions.value = options; // Store current options for refresh
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  try {
    const queryParams = {
      search: searchKey.value,
      page,
      itemsPerPage: rpp,
      status: statusFilter.value === 'All' ? undefined : statusFilter.value,
    };

    if (sortBy && sortBy.length > 0) {
      queryParams.sortBy = sortBy[0].key;
      queryParams.sortOrder = sortBy[0].order;
    }

    Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

    const { data, error } = await useMyFetch('/api/residents', { query: queryParams });

    if (error.value) throw new Error('Failed to load residents.');
    
    residents.value = data.value.residents || [];
    totalItems.value = data.value.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    residents.value = []; 
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadResidents({ ...currentTableOptions.value, page: 1 });
  }, 500);
});

watch(statusFilter, () => {
  loadResidents({ ...currentTableOptions.value, page: 1 });
});

const getStatusColor = (s) => ({
  'Approved': 'success',
  'Pending': 'warning',
  'Declined': 'error',
  'Deactivated': 'grey'
}[s] || 'default');

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>