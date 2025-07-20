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

      <v-card-text>
        <v-chip-group v-model="statusFilter" column color="primary">
          <v-chip filter value="All">All</v-chip>
          <v-chip filter value="Pending">Pending</v-chip>
          <v-chip filter value="Approved">Approved</v-chip>
          <v-chip filter value="Deactivated">Deactivated</v-chip>
          <v-chip filter value="Declined">Declined</v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

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

    <!-- UPDATED: Generic Dialog for Actions Requiring a Reason -->
    <v-dialog v-model="actionReasonDialog" persistent max-width="500px">
      <v-card>
        <v-card-title class="text-h5">{{ dialogTitle }} Account</v-card-title>
        <v-card-text>
          <p class="mb-4">Please provide a reason for {{ dialogActionText }} the account for <strong>{{ residentToAction?.first_name }} {{ residentToAction?.last_name }}</strong>.</p>
          <v-textarea
            v-model="actionReason"
            :label="`Reason for ${dialogActionText}`"
            variant="outlined"
            rows="3"
            counter
            maxlength="250"
            :rules="[v => !!v || 'Reason is required.']"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="actionReasonDialog = false">Cancel</v-btn>
          <v-btn :color="dialogButtonColor" :disabled="!actionReason" :loading="updatingStatusFor === residentToAction?._id" @click="confirmActionWithReason">Confirm {{ dialogTitle }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
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
const currentTableOptions = ref({});

// --- NEW/UPDATED STATE for the Reason Dialog ---
const actionReasonDialog = ref(false);
const residentToAction = ref(null);
const actionReason = ref('');
const actionType = ref(''); // e.g., 'Declined', 'Deactivated', 'Reactivated'

// --- COMPUTED PROPERTIES for the new dialog ---
const dialogTitle = computed(() => {
    if (actionType.value === 'Pending') return 'Reactivate';
    return actionType.value; // 'Decline', 'Deactivate'
});

const dialogActionText = computed(() => {
    if (actionType.value === 'Pending') return 'reactivating';
    if (actionType.value === 'Deactivated') return 'deactivating';
    return 'declining';
});

const dialogButtonColor = computed(() => {
  const colors = {
    Declined: 'error',
    Deactivated: 'warning',
    Pending: 'success'
  };
  return colors[actionType.value] || 'primary';
});


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
        'Deactivate': { status: 'Deactivated', title: 'Deactivate Account', icon: 'mdi-account-off-outline', color: 'warning' },
        // UPDATED: 'Pending' is the status for reactivating
        'Reactivate': { status: 'Pending', title: 'Reactivate (Set to Pending)', icon: 'mdi-account-reactivate-outline', color: 'orange' },
    };
    if (currentStatus === 'Pending') return [actions.Approve, actions.Decline];
    if (currentStatus === 'Approved') return [actions.Deactivate];
    if (currentStatus === 'Declined' || currentStatus === 'Deactivated') return [actions.Reactivate];
    return [];
};

// --- UPDATED: Centralized action handling ---
const handleActionClick = (resident, newStatus) => {
    // Actions that don't need a reason
    if (newStatus === 'Approved') {
        updateResidentStatus(resident, newStatus);
    } 
    // Actions that DO need a reason
    else {
        openActionReasonDialog(resident, newStatus);
    }
};

const openActionReasonDialog = (resident, newStatus) => {
    residentToAction.value = resident;
    actionType.value = newStatus;
    actionReason.value = '';
    actionReasonDialog.value = true;
};

const confirmActionWithReason = async () => {
    if (!actionReason.value) {
        $toast.fire({ title: 'A reason is required.', icon: 'warning' });
        return;
    }
    await updateResidentStatus(residentToAction.value, actionType.value, actionReason.value);
    actionReasonDialog.value = false;
};

// --- UPDATED: Now accepts a reason and sends it in the payload ---
async function updateResidentStatus(resident, newStatus, reason = null) {
  updatingStatusFor.value = resident._id;
  try {
    const payload = { status: newStatus };
    // NEW: Add the reason to the payload if it exists
    if (reason) { 
      payload.reason = reason; 
    }

    const { error } = await useMyFetch(`/api/residents/${resident._id}/status`, {
      method: 'PATCH',
      body: payload,
    });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
    
    // NEW: Provide more specific feedback
    let successMessage = 'Status updated successfully!';
    if (newStatus === 'Deactivated') {
        successMessage = 'Account deactivated. Associated requests are being invalidated.';
    }
    $toast.fire({ title: successMessage, icon: 'success' });
    
    await loadResidents(currentTableOptions.value);

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

async function loadResidents(options) {
  loading.value = true;
  currentTableOptions.value = options;
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
  'Deactivated': 'grey-darken-1'
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