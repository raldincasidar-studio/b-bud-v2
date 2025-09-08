<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Household Account Management</h2>
        <p class="text-grey-darken-1">Activate, deactivate, and view resident accounts.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn to="/new-residents-account" size="large" color="primary" prepend-icon="mdi-account-plus">
          NEW RESIDENT
        </v-btn>
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
          <v-chip filter value="On-hold">On-hold</v-chip>
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
        :items-per-page-options="[10, 25, 50, 100]"
        @update:options="loadResidents"
        item-value="_id"
      >
        <template v-slot:item._id="{ item }">
          #{{ item._id.slice(-4) }}
        </template>

        <template v-slot:item.full_name="{ item }">
          {{ item.first_name }} {{ item.middle_name }} {{ item.last_name }} {{ item.suffix }}
        </template>

        <template v-slot:item.address_house_number="{ item }">
          {{ item.address_house_number }}
        </template>

        <!-- UPDATED SLOT to use getDisplayStatus -->
        <template v-slot:item.status="{ item }">
          <v-chip :color="getStatusColor(getDisplayStatus(item))" label size="small">
            {{ getDisplayStatus(item) }}
          </v-chip>
        </template>

        <template v-slot:item.date_added="{ item }">
            {{ formatDateTime(item.date_added) }}
        </template>

        <template v-slot:item.date_approved="{ item }">
            {{ formatDateTime(item.date_approved) }}
        </template>

        <!-- UPDATED SLOT to include action menu -->
        <template v-slot:item.actions="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/residents/${item._id}`" class="me-2">View</v-btn>
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn icon="mdi-dots-vertical" v-bind="props" variant="tonal" size="small"></v-btn>
              </template>
              <v-list dense v-if="!getDisplayStatus(item) != 'On-hold'">
                <v-list-item
                  v-for="action in getAvailableActions(item)"
                  :key="action.status"
                  @click="handleActionClick(item, action.status)"
                  :disabled="updatingStatusFor === item._id"
                >
                  <template v-slot:prepend>
                    <v-icon :icon="action.icon" :color="action.color"></v-icon>
                  </template>
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

    <!-- Generic Dialog for Actions Requiring a Reason -->
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

const actionReasonDialog = ref(false);
const residentToAction = ref(null);
const actionReason = ref('');
const actionType = ref('');

// UPDATED computed properties for dialog content
const dialogTitle = computed(() => {
    if (actionType.value === 'Pending') return 'Reactivate';
    if (actionType.value === 'Active') return 'Remove Hold';
    return actionType.value;
});

const dialogActionText = computed(() => {
    if (actionType.value === 'Pending') return 'reactivating';
    if (actionType.value === 'Deactivated') return 'deactivating';
    if (actionType.value === 'Active') return 'removing the hold on';
    return 'declining';
});

const dialogButtonColor = computed(() => {
  const colors = {
    Declined: 'error',
    Deactivated: 'warning',
    Pending: 'success',
    Active: 'info'
  };
  return colors[actionType.value] || 'primary';
});

const headers = ref([
  { title: 'Account Number', key: '_id', sortable: false },
  { title: 'Household Name', key: 'full_name', sortable: false },
  { title: 'Household No.', key: 'address_house_number', sortable: false },
  { title: 'Date & Time Added', key: 'date_added', sortable: true },
  { title: 'Date & Time Approved', key: 'date_approved', sortable: true },
  { title: 'Account Status', key: 'status', sortable: true, align: 'center' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center', width: '150px' },
]);

// NEW helper function to determine the displayed status
const getDisplayStatus = (resident) => {
  if (resident.status === 'Approved' && resident.account_status === 'Deactivated') {
    return 'On-hold';
  }
  return resident.status;
};

// UPDATED function to be context-aware of On-Hold status
const getAvailableActions = (resident) => {
    const displayStatus = getDisplayStatus(resident);

    const actions = {
        'Approve': { status: 'Approved', title: 'Approve Account', icon: 'mdi-check-circle-outline', color: 'success' },
        'Decline': { status: 'Declined', title: 'Decline Account', icon: 'mdi-close-circle-outline', color: 'error' },
        'Deactivate': { status: 'Deactivated', title: 'Deactivate Account', icon: 'mdi-account-off-outline', color: 'warning' },
        'Reactivate': { status: 'Pending', title: 'Reactivate (Set to Pending)', icon: 'mdi-account-reactivate-outline', color: 'orange' },
        'RemoveHold': { status: 'Active', title: 'Remove Hold (Set to Active)', icon: 'mdi-lock-open-variant-outline', color: 'info' }
    };

    if (displayStatus === 'Pending') return [actions.Approve, actions.Decline];
    if (displayStatus === 'Approved') return [actions.Deactivate];
    if (displayStatus === 'On-hold') return [actions.RemoveHold];
    if (displayStatus === 'Declined' || displayStatus === 'Deactivated') return [actions.Reactivate];
    return [];
};

const handleActionClick = (resident, newStatus) => {
    if (newStatus === 'Approved') {
        updateResidentStatus(resident, newStatus);
    } else {
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

// UPDATED function to handle updating primary or secondary status
async function updateResidentStatus(resident, newStatus, reason = null) {
  updatingStatusFor.value = resident._id;
  try {
    let payload = {};
    // If the action is to remove the hold, update the `account_status` field.
    if (newStatus === 'Active') {
      payload = { account_status: 'Active' };
    } else {
      // Otherwise, update the primary `status` field.
      payload = { status: newStatus };
    }
    
    if (reason) { 
      payload.reason = reason; 
    }

    // This endpoint must be able to handle updates to both `status` and `account_status`.
    const { error } = await useMyFetch(`/api/residents/${resident._id}/status`, {
      method: 'PATCH',
      body: payload,
    });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
    
    let successMessage = 'Status updated successfully!';
    if (newStatus === 'Deactivated') {
        successMessage = 'Account deactivated. Associated requests are being invalidated.';
    } else if (newStatus === 'Active') {
        successMessage = 'Account hold has been removed successfully.';
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
  'Deactivated': 'grey-darken-1',
  'On-hold': 'orange'
}[s] || 'default');

const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    };
    return new Date(dateString).toLocaleString('en-US', options);
};
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>