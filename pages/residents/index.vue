Of course. Based on the code for /pages/dashboard.vue and /pages/residents/index.vue, the dashboard creates links with various query parameters (is_voter, minAge, maxAge, occupation, etc.) that the residents table needs to respond to.

To achieve this, the residents page must:

Read the query parameters from the URL when it first loads.

Incorporate these parameters into its API requests for data.

React to any changes in the URL (e.g., from browser navigation) while the user is on the page.

Ensure that its own internal filters (the search bar and status chips) work together with the filters from the URL.

I have updated /pages/residents/index.vue to implement this functionality. The new logic is clearly commented for your reference. All existing features, such as the search bar, status chips, and action menus, have been preserved.

Summary of Changes:

useRoute: The useRoute composable is now used to access the current URL's query parameters.

State Initialization: The statusFilter ref is now initialized with the value of the status query parameter from the URL, if it exists. This ensures the filter chips accurately reflect the initial state.

Reactive URL Watcher: A new watcher has been added to monitor route.fullPath. It triggers a data reload whenever the URL changes, ensuring the table updates when navigating from the dashboard or using browser back/forward buttons.

Smarter Data Loading: The loadResidents function has been rewritten to be "filter-aware". It now intelligently merges filters from three sources, with local UI controls taking precedence:

Base filters from the URL (is_voter, minAge, etc.).

Filters from the local UI (searchKey, statusFilter).

Pagination and sorting options from the data table.

Preservation: All other logic, including the table headers, action handlers, and the "Decline with Reason" dialog, remains untouched and will function as before.

Here is the full, revised code for /pages/residents/index.vue. You can copy and paste this directly into your project.

/pages/residents/index.vue (Revised and Ready)
<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Resident Management</h2>
        <p class="text-grey-darken-1">Approve, manage, and view all registered residents.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn size="large" to="/residents/new" prepend-icon="mdi-account-plus" color="primary">
          New Resident
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-account-search-outline" class="mr-2"></v-icon>
        Find Residents
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey" density="compact" label="Search by name, email, etc..."
          prepend-inner-icon="mdi-magnify" variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <!-- Filter Chip Group remains unchanged and will be synced with the URL -->
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
        <template v-slot:item.created_at="{ item }">{{ formatDate(item.created_at) }}</template>

        <template v-slot:item.status="{ item }">
          <div class="d-flex align-center justify-center">
            <v-chip :color="getStatusColor(item.status)" label size="small" class="me-2">
              {{ item.status }}
            </v-chip>
            <v-menu offset-y>
              <template v-slot:activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical" size="small" variant="text" v-bind="props"
                  :loading="updatingStatusFor === item._id" :disabled="updatingStatusFor === item._id"
                ></v-btn>
              </template>
              <v-list density="compact">
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
          </div>
        </template>

        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/residents/${item._id}`">View</v-btn>
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
// --- MODIFIED: Initialize statusFilter from URL query, default to 'All'
const statusFilter = ref(route.query.status || 'All');
const totalItems = ref(0);
const residents = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);

// State for Decline Dialog (unchanged)
const declineDialog = ref(false);
const residentToDecline = ref(null);
const declineReason = ref('');

// Table Headers (unchanged)
const headers = ref([
  { title: 'Full Name', key: 'full_name', sortable: false },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Contact No.', key: 'contact_number', sortable: false },
  { title: 'Household Role', key: 'household_role', sortable: true, align: 'center' },
  { title: 'Date Registered', key: 'created_at', sortable: true },
  { title: 'Status & Actions', key: 'status', sortable: true, align: 'center', width: '200px' },
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
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

// --- REVISED: Data Loading Function ---
// This function now intelligently combines filters from the URL and the local UI.
async function loadResidents(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options; // sortBy is an array in Vuetify 3
  
  try {
    // 1. Start with filters from the URL (e.g., is_voter=true, minAge=60)
    const queryFromUrl = { ...route.query };
    
    // 2. Build query from local UI state. These will override URL params if keys are the same.
    const queryFromUi = {
      search: searchKey.value,
      page,
      itemsPerPage: rpp,
      status: statusFilter.value === 'All' ? undefined : statusFilter.value,
    };

    // Add sorting info from the data table options
    if (sortBy && sortBy.length > 0) {
      queryFromUi.sortBy = sortBy[0].key;
      queryFromUi.sortOrder = sortBy[0].order;
    }

    // 3. Merge, giving local UI filters precedence over URL filters
    const finalQuery = { ...queryFromUrl, ...queryFromUi };
    
    // Clean up empty/null/undefined values before sending to API
    Object.keys(finalQuery).forEach(key => (finalQuery[key] === undefined || finalQuery[key] === null || finalQuery[key] === '') && delete finalQuery[key]);

    // 4. Make the API call with the combined filters
    const { data, error } = await useMyFetch('/api/residents', { query: finalQuery });

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

// --- Watchers for Local UI Filters (Largely unchanged) ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // When search changes, go back to page 1
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

watch(statusFilter, () => {
  // When status chip changes, go back to page 1
  loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});

// --- NEW: Watcher for URL changes ---
// This ensures the table reacts to browser back/forward or new links from the dashboard.
watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return;

    // A. Sync the local status filter UI with the URL's status parameter
    const newStatus = route.query.status || 'All';
    if (newStatus !== statusFilter.value) {
        // This will update the chip group. The `watch(statusFilter)` above will then trigger the reload.
        statusFilter.value = newStatus;
    } else {
        // B. If status didn't change but other params did (e.g. ?is_voter=true), trigger reload manually.
        loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
    }
}, { deep: true });


// --- Helper Functions (unchanged) ---
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
const getStatusColor = (s) => ({ 'Approved': 'success', 'Pending': 'warning', 'Declined': 'error', 'Deactivated': 'grey' }[s] || 'default');
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
