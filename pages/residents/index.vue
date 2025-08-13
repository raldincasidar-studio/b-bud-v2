<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Residents Profile</h2>
        <p class="text-grey-darken-1">Approve, manage, and view all registered residents.</p>
      </v-col>
      <!-- <v-col class="text-right">
        <v-btn size="large" to="/residents/new" prepend-icon="mdi-account-plus" color="primary">
          New Resident
        </v-btn>
      </v-col> -->
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-account-search-outline" class="mr-2"></v-icon>
        Find Residents
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"  label="Search by name, email, etc..."
          prepend-inner-icon="mdi-magnify" variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <!-- Filter Chip Group remains unchanged and will be synced with the URL -->
      <!-- <v-card-text>
        <v-chip-group
          v-model="statusFilter"
          column
          color="primary"
        >
          <v-chip filter value="All">All</v-chip>
          <v-chip filter value="Approved">Approved</v-chip>
          <v-chip filter value="Deactivated">Deactivated</v-chip>
        </v-chip-group>
      </v-card-text> -->

      <!-- NEW: Filter for Household Role -->
      <v-card-text>
        <v-chip-group v-model="roleFilter" column color="primary">
          <v-chip filter value="All">All Roles</v-chip>
          <v-chip filter value="Head">Head</v-chip>
          <v-chip filter value="Member">Member</v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <!-- The data table will now fetch data based on URL and local filters -->
      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="residents"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadResidents"
        item-value="_id"
      >
        <template v-slot:item.full_name="{ item }">
          {{ item.first_name }} {{ item.last_name }}
        </template>
        <template v-slot:item.address="{ item }">
          <div class="text-truncate" style="max-width: 250px;">
            {{ item.address_house_number }} {{ item.address_street }}, {{ item.address_subdivision_zone }}
          </div>
        </template>
        <template v-slot:item.household_role="{ item }">
          <v-chip :color="item.is_household_head ? 'blue' : 'grey'" label size="small">{{ item.is_household_head ? 'Head' : 'Member' }}</v-chip>
        </template>
        
        <!-- UPDATED: Template calls the new formatDateTime function -->
        <template v-slot:item.date_added="{ item }">{{ formatDateTime(item.date_added) }}</template>

        <template v-slot:item.action="{ item }">
          <div class="d-flex align-center justify-center">
            <v-btn variant="tonal" color="primary" size="small" :to="`/residents/${item._id}`" class="me-1">View</v-btn>
            <!-- <v-menu offset-y>
              <template v-slot:activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical" size="small" variant="text" v-bind="props"
                  :loading="updatingStatusFor === item._id" :disabled="updatingStatusFor === item._id"
                ></v-btn>
              </template>
              <v-list >
                <v-list-item
                  v-for="action in getAvailableActions(item.status)"
                  :key="action.status"
                  @click="handleActionClick(item, action.status)"
                >
                  <template v-slot:prepend><v-icon :icon="action.icon" :color="action.color" size="small"></v-icon></template>
                  <v-list-item-title>{{ action.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu> -->
          </div>
        </template>

        <template v-slot:no-data>
          <v-alert type="info" class="ma-4">No residents found for the selected filters.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Decline with Reason Dialog (unchanged) -->
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
import { useRoute } from 'vue-router'; // <-- ADDED: To access URL query parameters
import { useMyFetch } from '~/composables/useMyFetch';
const { $toast } = useNuxtApp();

// --- NEW: Route Handling ---
const route = useRoute();

// --- State Definitions ---
const searchKey = ref('');
const statusFilter = ref(route.query.status || 'All');
const roleFilter = ref('All'); // <-- NEW: State for household role filter
const totalItems = ref(0);
const residents = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);

// State for Decline Dialog (unchanged)
const declineDialog = ref(false);
const residentToDecline = ref(null);
const declineReason = ref('');

// UPDATED: Table Headers to reflect Date & Time
const headers = ref([
  { title: 'House No.', key: 'address_house_number', sortable: false },
  { title: 'Full Name', key: 'full_name', sortable: false },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Contact No.', key: 'contact_number', sortable: false },
  { title: 'Household Role', key: 'household_role', sortable: true, align: 'center' },
  { title: 'Date & Time Registered', key: 'date_added', sortable: true }, // <-- UPDATED Title
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// Action Handlers (unchanged)
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

async function updateResidentStatus(resident, newStatus, reason = null) {
  updatingStatusFor.value = resident._id;
  try {
    const payload = { status: newStatus };
    if (reason) { payload.reason = reason; }

    const { data, error } = await useMyFetch(`/api/residents/${resident._id}/status`, {
      method: 'PATCH',
      body: payload,
    });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');

    const itemIndex = residents.value.findIndex(r => r._id === resident._id);
    if (itemIndex > -1) { residents.value[itemIndex].status = newStatus; }
    
    $toast.fire({ title: 'Status updated successfully!', icon: 'success' });
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

// REVISED: Data Loading Function to include Role Filter
async function loadResidents(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options; 
  
  try {
    const queryFromUrl = { ...route.query };
    
    const queryFromUi = {
      search: searchKey.value,
      page,
      itemsPerPage: rpp,
      status: statusFilter.value === 'All' ? undefined : statusFilter.value,
      // NEW: Send role filter to API. 'true' for Head, 'false' for Member, 'undefined' for All.
      is_household_head: roleFilter.value === 'All' ? undefined : (roleFilter.value === 'Head')
    };

    if (sortBy && sortBy.length > 0) {
      queryFromUi.sortBy = sortBy[0].key;
      queryFromUi.sortOrder = sortBy[0].order;
    }

    const finalQuery = { ...queryFromUrl, ...queryFromUi };
    
    Object.keys(finalQuery).forEach(key => (finalQuery[key] === undefined || finalQuery[key] === null || finalQuery[key] === '') && delete finalQuery[key]);

    const { data, error } = await useMyFetch('/api/residents/approved', { query: finalQuery });

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

// Watchers for Local UI Filters
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

watch(statusFilter, () => {
  loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});

// NEW: Watcher for the role filter
watch(roleFilter, () => {
  loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});

// Watcher for URL changes
watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return;

    const newStatus = route.query.status || 'All';
    if (newStatus !== statusFilter.value) {
        statusFilter.value = newStatus;
    } else {
        loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
    }
}, { deep: true });

// UPDATED: Helper function to format both date and time
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

const getStatusColor = (s) => ({ 'Approved': 'success', 'Pending': 'warning', 'Declined': 'error', 'Deactivated': 'grey' }[s] || 'default');
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>