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
      <v-divider></v-divider>

      <!-- Date Range Selection & Actions for Complaints -->
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
              :disabled="complaints.length === 0 && !loading"
              class="mb-2 mb-md-0"
            >
              Print Data
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>
      <!-- End Date Range Selection & Actions -->

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
          {{ formatDateTime(item.date_of_complaint) }}
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

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Complaint Log</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Complaint Log Report</h3>
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
                Total Count: {{ complaintsForPrint.length }} Complaints
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in complaintsForPrint" :key="item.ref_no">
                  <td>{{ item.ref_no }}</td>
                  <td>{{ item.complainant_name || 'N/A' }}</td>
                  <td>{{ item.person_complained_against || 'N/A' }}</td>
                  <td>{{ formatDateTime(item.date_of_complaint) }}</td>
                  <td>{{ item.category || 'N/A' }}</td>
                  <td>{{ item.status }}</td>
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
import { ref, watch, onMounted, computed } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';
import { useRoute } from 'vue-router';
import logoImage from '~/assets/img/logo.png'; // Import the logo image

const { $toast } = useNuxtApp();
const route = useRoute();

const searchKey = ref('');
const selectedStatus = ref('All');
const totalItems = ref(0);
const complaints = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);
const currentTableOptions = ref({}); // To store current table options for reloading

const initialSortBy = ref([{ key: 'date_of_complaint', order: 'desc' }]);

// Print functionality refs and methods
const startDate = ref(null); // Will store Date objects
const endDate = ref(null);   // Will store Date objects
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null); // 'day', 'week', 'month', 'year'
const printDialog = ref(false);
const complaintsForPrint = ref([]); // Holds all data for printing

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');


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

// Headers to be displayed in the print view (excluding 'Details/Actions')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});

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
    loadComplaints({ ...currentTableOptions.value, page: 1 });
  }, 500);
});

watch(selectedStatus, () => {
  loadComplaints({ ...currentTableOptions.value, page: 1 });
});

watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return; 
    const newStatus = route.query.status || 'All';
    if (newStatus !== selectedStatus.value) {
        selectedStatus.value = newStatus;
    } else {
        loadComplaints({ ...currentTableOptions.value, page: 1 });
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
  currentTableOptions.value = options; // Store current options
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  const queryFromUrl = { ...route.query };

  const queryFromUi = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    status: selectedStatus.value === 'All' ? undefined : selectedStatus.value,
    // Add date filters
    start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
    end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
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

// --- Date Filter Functions ---
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
  loadComplaints({ ...currentTableOptions.value, page: 1 });
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
  loadComplaints({ ...currentTableOptions.value, page: 1 });
};

// Function to fetch all complaints matching current filters for printing
async function fetchAllComplaintsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            status: selectedStatus.value === 'All' ? undefined : selectedStatus.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/complaints', { query: queryParams });

        if (error.value) throw new Error('Failed to load all complaints for printing.');
        
        return data.value?.complaints || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true; // Show loading while fetching all data
  complaintsForPrint.value = await fetchAllComplaintsForPrint();
  loading.value = false;

  if (complaintsForPrint.value.length > 0) {
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
          <title>Complaint Log Report</title>
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
  } else {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
  }
};

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

const formatDateTime = (dateString) => { // Renamed from formatDate to formatDateTime for consistency
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
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