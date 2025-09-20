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

      <!-- Filter for Household Role -->
      <v-card-text>
        <v-chip-group v-model="roleFilter" column color="primary">
          <v-chip filter value="All">All Roles</v-chip>
          <v-chip filter value="Head">Head</v-chip>
          <v-chip filter value="Member">Member</v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <!-- Date Range Selection & Actions for Residents -->
      <v-card-text>
        <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Registration Date Range Selection & Actions</v-card-title>
          
        <!-- First row for Start Date, End Date, Presets, and Print Button -->
        <v-row align="center" justify="center" >
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
                  @click:clear="clearDateRange(); loadResidents()"
                  class="mt-5 pb-0 mb-0 pr-2"
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
                  @click:clear="clearDateRange(); loadResidents()"
                  class="mt-5 pb-0 mb-0 pr-2"
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

          <v-col cols="12" md="6" class="d-flex align-center justify-end flex-wrap">
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
            
            <!-- Print Data Button, now opens the dialog -->
            <v-btn
              color="info"
              prepend-icon="mdi-printer"
              @click="openPrintDialog"
              :disabled="residents.length === 0 && !loading"
              class="mb-2 mb-md-0"
            >
              Print Data
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>
      <!-- End Date Range Selection & Actions -->


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
            <v-menu offset-y>
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
            </v-menu>
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

    <!-- Print Dialog (similar to budget management) -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Resident Report</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Resident Management Report</h3>
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
                    (No specific date filter applied)
                </span>
                <span v-if="roleFilter !== 'All'">
                    for {{ roleFilter }}s
                </span>
            </p>
            <!-- NEW: Total Count for print data -->
            <p class="text-center font-weight-bold mb-4">
                Total Count: {{ residentsForPrint.length }} Residents
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in residentsForPrint" :key="item._id">
                  <td>{{ item.address_house_number }}</td>
                  <td>{{ item.first_name }} {{ item.last_name }}</td>
                  <td>{{ item.email }}</td>
                  <td>{{ item.contact_number }}</td>
                  <td>{{ item.is_household_head ? 'Head' : 'Member' }}</td>
                  <td>{{ formatDateTime(item.date_added) }}</td>
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
import { ref, watch, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router'; 
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';
import logoImage from '~/assets/img/logo.png'; // Import the logo image

const { $toast } = useNuxtApp();

// --- NEW: Route Handling ---
const route = useRoute();

// --- State Definitions ---
const searchKey = ref('');
const roleFilter = ref('All'); 
const totalItems = ref(0);
const residents = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);

// State for Decline Dialog (unchanged)
const declineDialog = ref(false);
const residentToDecline = ref(null);
const declineReason = ref('');

// --- Date Range Selection for printing/filtering ---
const startDate = ref(null); 
const endDate = ref(null);   
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null);

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

// --- Print functionality refs ---
const printDialog = ref(false);
const residentsForPrint = ref([]);


// UPDATED: Table Headers - Removed 'Status' header
const headers = ref([
  { title: 'House No.', key: 'address_house_number', sortable: false },
  { title: 'Full Name', key: 'full_name', sortable: false },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Contact No.', key: 'contact_number', sortable: false },
  { title: 'Household Role', key: 'household_role', sortable: true, align: 'center' },
  { title: 'Date & Time Registered', key: 'date_added', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});


// Action Handlers (status logic retained for existing update functionality)
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

    // Update the resident in the local array (or reload for simplicity)
    const itemIndex = residents.value.findIndex(r => r._id === resident._id);
    if (itemIndex > -1) { 
      residents.value[itemIndex].status = newStatus; 
      // Reload to ensure data consistency with filters
      loadResidents();
    }
    
    $toast.fire({ title: 'Status updated successfully!', icon: 'success' });
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

// REVISED: Data Loading Function to include Role Filter and Date Range
async function loadResidents(options) {
  loading.value = true;
  // Store options for later use, especially for print
  const currentTableOptions = options ? options : {}; 
  const { page = 1, itemsPerPage: rpp = itemsPerPage.value, sortBy = [] } = currentTableOptions; 
  
  try {
    const queryParams = {
      search: searchKey.value,
      page,
      itemsPerPage: rpp,
      is_household_head: roleFilter.value === 'All' ? undefined : (roleFilter.value === 'Head'),
      // Note: statusFilter removed as per request, if backend requires status, it needs to be explicitly added
      // or handled by backend to return all if not specified.
    };

    if (sortBy && sortBy.length > 0) {
      queryParams.sortBy = sortBy[0].key;
      queryParams.sortOrder = sortBy[0].order;
    }

    // Apply date range filter if available
    if (startDate.value) {
      queryParams.start_date = new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString();
    }
    if (endDate.value) {
      queryParams.end_date = new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString();
    }
    
    // Clean up undefined/null/empty string query params
    Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

    const { data, error } = await useMyFetch('/api/residents', { query: queryParams }); // Using a generic /api/residents endpoint

    if (error.value) throw new Error(error.value.data?.message || 'Failed to load residents.');
    
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

// --- Date Filter Functions ---
const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null; 
};

const applyDateFilters = () => {
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null; 
  }
  loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
};

const setDateRangePreset = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 

  let newStartDate = null;
  let newEndDate = null;

  switch (preset) {
    case 'day':
      newStartDate = new Date(today);
      newEndDate = new Date(today); 
      break;
    case 'week':
      newStartDate = new Date(today);
      newStartDate.setDate(today.getDate() - today.getDay()); // Start of the current week (Sunday)
      newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + 6); // End of the current week (Saturday)
      break;
    case 'month':
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
      newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
      break;
    case 'year':
      const targetYear = today.getFullYear(); 
      newStartDate = new Date(targetYear, 0, 1); // First day of current year
      newEndDate = new Date(targetYear, 11, 31); // Last day of current year
      break;
  }
  startDate.value = newStartDate;
  endDate.value = newEndDate;
  selectedDateFilterPreset.value = preset; 
  loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
};


// Watchers for Local UI Filters
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

// Watcher for role filter
watch(roleFilter, () => {
  loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});

// Watcher for URL changes - Removed statusFilter specific watch
watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return;
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
}, { deep: true });


// Helper function to format both date and time
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

// Removed getStatusColor as 'Status' column is removed from display table
// (However, the status functionality for actions is retained)

// --- Print Functionality ---

async function fetchAllResidentsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            is_household_head: roleFilter.value === 'All' ? undefined : (roleFilter.value === 'Head'),
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        // If no date filters are set for printing, do not apply any date filter by default.

        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/residents', { query: queryParams });

        if (error.value) throw new Error(error.value.data?.message || 'Failed to load all residents for printing.');
        
        return data.value?.residents || [];
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
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Resident Management Report</title>
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
            .text-right {
                text-align: right;
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

    printWindow.onafterprint = () => {
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close();
        }
      }, 100); 
    };

    printWindow.print();
  } else {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
  }
};


// Initial load of the table data
onMounted(() => {
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Styles specific for printing the dialog content (from inventory) */
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