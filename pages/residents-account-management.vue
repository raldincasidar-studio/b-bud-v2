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

      <v-card-text>
  <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Date Range Selection & Actions</v-card-title>

  <v-row align="center" justify="center">
    <v-col cols="12" sm="6" md="3">
      <v-menu
        v-model="startDateMenu"
        :close-on-content-click="false"
        transition="scale-transition"
        offset-y
        min-width="auto"
      >
        <template v-slot:activator="{ props }">
          <v-text-field
            v-model="formattedStartDate"
            label="Start Date"
            prepend-inner-icon="mdi-calendar"
            readonly
            variant="outlined"
            density="compact"
            v-bind="props"
            clearable
            @click:clear="clearDateRange(); applyDateFilters()"
            class="mt-5 pr-2"
          ></v-text-field>
        </template>
        <v-date-picker
          v-model="startDate"
          @update:model-value="startDateMenu = false; applyDateFilters()"
          show-adjacent-months
          :max="endDate ? endDate.toISOString().split('T')[0] : undefined"
        ></v-date-picker>
      </v-menu>
    </v-col>

    <v-col cols="12" sm="6" md="3">
      <v-menu
        v-model="endDateMenu"
        :close-on-content-click="false"
        transition="scale-transition"
        offset-y
        min-width="auto"
      >
        <template v-slot:activator="{ props }">
          <v-text-field
            v-model="formattedEndDate"
            label="End Date"
            prepend-inner-icon="mdi-calendar"
            readonly
            variant="outlined"
            density="compact"
            v-bind="props"
            clearable
            @click:clear="clearDateRange(); applyDateFilters()"
            class="mt-5 pr-2"
          ></v-text-field>
        </template>
        <v-date-picker
          v-model="endDate"
          @update:model-value="endDateMenu = false; applyDateFilters()"
          :min="startDate ? startDate.toISOString().split('T')[0] : undefined"
          show-adjacent-months
        ></v-date-picker>
      </v-menu>
    </v-col>

    <v-col cols="12" md="6" class="d-flex align-center justify-center flex-wrap">
      <!-- <span class="text-subtitle-2 mr-2 mb-2 mb-md-0">Quick Filters:</span> -->
      <v-btn-toggle
        v-model="selectedDateFilterPreset"
        color="primary"
        variant="outlined"
        density="compact"
        group
        class="mr-4 flex-wrap mb-2 mb-md-0"
      >
        <v-btn value="day" @click="setDateRangePreset('day')">Day</v-btn>
        <v-btn value="week" @click="setDateRangePreset('week')">Week</v-btn>
        <v-btn value="month" @click="setDateRangePreset('month')">Month</v-btn>
        <v-btn value="year" @click="setDateRangePreset('year')">Year</v-btn>
      </v-btn-toggle>
      <v-btn
        color="info"
        prepend-icon="mdi-printer"
        @click="openPrintDialog"
        :disabled="residents.length === 0"
        class="mb-2 mb-md-0"
      >
        Print Data
      </v-btn>
    </v-col>
  </v-row>
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
          {{ capitalizeName(item.first_name) }} {{ capitalizeName(item.middle_name) }} {{ capitalizeName(item.last_name) }} {{ capitalizeName(item.suffix) }}
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
            <!-- <v-menu>
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
            </v-menu> -->
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
          <p class="mb-4">Please provide a reason for {{ dialogActionText }} the account for <strong>{{ capitalizeName(residentToAction?.first_name) }} {{ capitalizeName(residentToAction?.last_name) }}</strong>.</p>
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

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Resident Accounts</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="printDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-btn icon dark @click="printContent">
            <v-icon>mdi-printer</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-8">
          <div id="print-area">
            <h3 class="text-h5 text-center mb-6">Household Account Management Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <span v-if="startDate && endDate">
                    (Filtered from {{ formattedStartDate }} to {{ formattedEndDate }})
                </span>
                <span v-else-if="startDate">
                    (Filtered from {{ formattedStartDate }} onwards)
                </span>
                <span v-else-if="endDate">
                    (Filtered up to {{ formattedEndDate }})
                </span>
                <span v-else>
                    (No date filter applied)
                </span>
            </p>
            <p class="text-center font-weight-bold mb-4">
                Total Count: {{ residentsForPrint.length }} Accounts
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in residentsForPrint" :key="item._id"> <!-- Use residentsForPrint here -->
                  <td>#{{ item._id.slice(-4) }}</td>
                  <td>{{ capitalizeName(item.first_name) }} {{ capitalizeName(item.middle_name) }} {{ capitalizeName(item.last_name) }} {{ capitalizeName(item.suffix) }}</td>
                  <td>{{ item.address_house_number }}</td>
                  <td>{{ formatDateTime(item.date_added) }}</td>
                  <td>{{ formatDateTime(item.date_approved) }}</td>
                  <td>{{ getDisplayStatus(item) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="text-caption text-center mt-6">Generated by B-bud System.</p>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useMyFetch } from '~/composables/useMyFetch';
import logoImage from '~/assets/img/logo.png'; // Import the logo image

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

// Print functionality refs and methods
const startDate = ref(null); // Will store Date objects
const endDate = ref(null);   // Will store Date objects
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null); // 'day', 'week', 'month', 'year'
const printDialog = ref(false);
const residentsForPrint = ref([]); // Holds all data for printing

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

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

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'actions');
});

// NEW helper function to capitalize the first letter of each word (uncomment this if retain the original format )
const capitalizeName = (value) => {
  if (!value) return '';
  return String(value)
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
      // Convert Date objects to ISO strings for API, ensuring start/end of day
      start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
      end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
    };

    if (sortBy && sortBy.length > 0) {
      queryParams.sortBy = sortBy[0].key;
      queryParams.sortOrder = sortBy[0].order;
    }

    Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

    const { data, error } = await useMyFetch('/api/residents', { query: queryParams });

    if (error.value) throw new Error('Failed to load residents.');

    residents.value = data.value.residents || [];
    totalItems.value = data.value.total || 0; // Ensure your backend returns the total count for the *filtered* data
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

const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null; // Clear preset when dates are cleared
};

const applyDateFilters = () => {
  // If manual dates are set or cleared, clear any active preset selection
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null; // Also clear if both are null
  }
  loadResidents({ ...currentTableOptions.value, page: 1 });
};

const setDateRangePreset = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let newStartDate = null;
  let newEndDate = null;

  switch (preset) {
    case 'day':
      newStartDate = new Date(today);
      newEndDate = new Date(today);
      break;
    case 'week':
      // Start of the current week (Sunday)
      newStartDate = new Date(today);
      newStartDate.setDate(today.getDate() - today.getDay());
      // End of the current week (Saturday)
      newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + 6);
      break;
    case 'month':
      // Start of the current month
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      // End of the current month
      newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
      break;
    case 'year':
      // Start of the current year
      newStartDate = new Date(today.getFullYear(), 0, 1);
      // End of the current year
      newEndDate = new Date(today.getFullYear(), 11, 31);
      break;
  }
  startDate.value = newStartDate;
  endDate.value = newEndDate;
  selectedDateFilterPreset.value = preset; // Keep preset active
  loadResidents({ ...currentTableOptions.value, page: 1 });
};


// Function to fetch all residents matching current filters for printing
async function fetchAllResidentsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            status: statusFilter.value === 'All' ? undefined : statusFilter.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            // Request a very high number of items to get all data
            itemsPerPage: 999999
        };
        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/residents', { query: queryParams });

        if (error.value) throw new Error('Failed to load all residents for printing.');

        return data.value.residents || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true; // Show loading while fetching all data
  residentsForPrint.value = await fetchAllResidentsForPrint();
  loading.value = false;

  if (residentsForPrint.value.length > 0) {
      printDialog.value = true;
  } else {
      $toast.fire({ title: 'No data to print for the selected filters.', icon: 'info' });
  }
};

const printContent = () => {
  const printContentDiv = document.getElementById('print-area');
  if (printContentDiv) {
    // Open a new window for printing to isolate print styles
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Household Account Management Report</title>
          <style>
            /* Basic print styles */
            body { font-family: sans-serif; margin: 20px; color: #333; }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .print-logo {
              max-width: 100px; /* Adjust size as needed */
              height: auto;
              display: block;
              margin: 0 auto 10px auto; /* Center with some bottom margin */
            }
            .print-app-name {
              font-size: 1.5em; /* Adjust size as needed */
              font-weight: bold;
              margin-bottom: 10px;
            }
            h3 { text-align: center; margin-bottom: 20px; color: #333; }
            p { text-align: center; margin-bottom: 15px; color: #555; }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              page-break-inside: auto; /* Allow table to break across pages */
            }
            .print-table tr { page-break-inside: avoid; page-break-after: auto; }
            .print-table th, .print-table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
              font-size: 0.9em;
            }
            .print-table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .text-caption {
              font-size: 0.75em;
              color: #777;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img src="${logoImage}" alt="B-Bud Logo" class="print-logo" />
            <div class="print-app-name">B-Bud</div>
          </div>
          ${printContentDiv.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Set the onafterprint event handler BEFORE calling print()
    printWindow.onafterprint = () => {
      // Small delay to ensure browser print dialog fully closes before trying to close the window
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close();
        }
      }, 100); // 100ms delay
    };

    printWindow.print();
    // Do NOT close printWindow here. The onafterprint event will handle it.
  } else {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
  }
};


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

/* Styles specific for printing the dialog content */
@media print {
  /* Hide all elements on the page except the active print dialog */
  body > *:not(.v-overlay-container) {
    display: none !important;
  }
  .v-overlay-container {
    display: block !important;
    position: static; /* Important for print to not be fixed */
    top: auto !important;
    left: auto !important;
    width: auto !important;
    height: auto !important;
    transform: none !important;
    overflow: visible !important;
  }

  /* Target the specific dialog for printing */
  .v-dialog--fullscreen.v-overlay__content {
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    height: auto !important;
    width: auto !important;
    max-width: none !important;
    min-width: none !important;
    position: static !important;
    display: block !important;
    overflow: visible !important;
  }

  .v-card {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    height: auto !important;
    width: auto !important;
  }

  .v-toolbar {
    display: none !important; /* Hide toolbar in print */
  }
  .v-card-text {
    padding: 0 !important;
  }
  #print-area {
    width: 100%;
    margin: 0;
    padding: 0;
  }
}
</style>