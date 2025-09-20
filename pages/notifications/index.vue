<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Notifications</h2>
        <p class="text-grey-darken-1">Manage all news, events, and alerts for residents.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/notifications/new"
          prepend-icon="mdi-bell-plus-outline"
          color="primary"
        >
          New Notification
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-bell-ring-outline" class="mr-2"></v-icon>
        Manage Notifications
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          label="Search Notifications..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
          style="max-width: 350px;"
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <!-- UPDATED: Filter tabs now include 'All' -->
      <v-tabs v-model="typeFilter" color="primary" class="px-4">
        <v-tab
          v-for="item in NOTIFICATION_TYPE_FILTER_OPTIONS"
          :key="item.title"
          :value="item.value"
          :prepend-icon="item.icon"
          class="text-capitalize"
          @click="loadNotifications({ page: 1, itemsPerPage: itemsPerPage, sortBy: currentSortBy })"
        >
          {{ item.title }}
        </v-tab>
      </v-tabs>
      <v-divider></v-divider>

      <!-- NEW: Date Range Selection & Actions for Notifications -->
      <v-card-text>
        <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Effective Date Range Selection & Actions</v-card-title>
          
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
                  @click:clear="clearDateRange(); loadNotifications()"
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
                  @click:clear="clearDateRange(); loadNotifications()"
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
              :disabled="notifications.length === 0 && !loading"
              class="mb-2 mb-md-0"
            >
              Print Data
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>
      <!-- End Date Range Selection & Actions -->


      <v-card-text>
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="notifications"
          :items-length="totalItems"
          :loading="loading"
          @update:options="loadNotifications"
          item-value="_id"
        >
          <template v-slot:item.name="{ item }">
            <strong>{{ item.name }}</strong>
          </template>

          <template v-slot:item.type="{ item }">
            <v-chip :color="getTypeColor(item.type)" small label>{{ item.type }}</v-chip>
          </template>

          <template v-slot:item.content="{ item }">
            <div class="text-truncate" style="max-width: 300px;" :title="item.content">
              {{ item.content }}
            </div>
          </template>

          <template v-slot:item.target_audience="{ item }">
            {{ formatAudience(item.target_audience, item.recipients) }}
          </template>

          <template v-slot:item.date="{ item }">
            {{ formatDate(item.date) }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              :to="`/notifications/${item._id}`"
            >
              View
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <v-alert type="info" prominent border="start" class="ma-4">
                No notifications found matching your criteria.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Notification Report</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Notification Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <span v-if="startDate && endDate">
                    (Effective from {{ formattedStartDate }} to {{ formattedEndDate }})
                </span>
                <span v-else-if="startDate">
                    (Effective from {{ formattedStartDate }} onwards)
                </span>
                <span v-else-if="endDate">
                    (Effective up to {{ formattedEndDate }})
                </span>
                <span v-else>
                    (No specific date filter applied)
                </span>
                <span v-if="typeFilter === 'All'">
                    for All Types
                </span>
                <span v-else-if="typeFilter">
                    for Type: {{ typeFilter }}
                </span>
            </p>
            <p class="text-center font-weight-bold mb-4">
                Total Count: {{ notificationsForPrint.length }} Notifications
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in notificationsForPrint" :key="item._id">
                  <td>{{ item.name }}</td>
                  <td>{{ item.type }}</td>
                  <td>{{ item.content }}</td>
                  <td>{{ formatAudience(item.target_audience, item.recipients) }}</td>
                  <td>{{ formatDate(item.date) }}</td>
                  <td>{{ item.by }}</td>
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
import { useMyFetch } from '../composables/useMyFetch';
import { useNuxtApp } from '#app';
import logoImage from '~/assets/img/logo.png'; // Make sure this path is correct

const { $toast } = useNuxtApp();

const typeFilter = ref('All'); // Default to 'All'
const searchKey = ref('');
const totalItems = ref(0);
const notifications = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
let currentSortBy = ref([{ key: 'date', order: 'desc' }]);

// --- NEW Date Range Selection ---
const startDate = ref(null); 
const endDate = ref(null);   
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null);

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

// --- Print functionality refs ---
const printDialog = ref(false);
const notificationsForPrint = ref([]);


const NOTIFICATION_TYPE_FILTER_OPTIONS = [
    { title: 'All', value: 'All', icon: 'mdi-format-list-bulleted' }, // Added 'All' option
    { title: 'News', value: 'News', icon: 'mdi-newspaper-variant-outline' },
    { title: 'Events', value: 'Events', icon: 'mdi-calendar-star' },
    { title: 'Alert', value: 'Alert', icon: 'mdi-alert-circle-outline' },
];

const headers = ref([
  { title: 'Name/Title', key: 'name', sortable: true, align: 'start' },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Content Preview', key: 'content', sortable: false, width: '30%' },
  { title: 'Target Audience', key: 'target_audience', sortable: false },
  { title: 'Effective Date', key: 'date', sortable: true },
  { title: 'Author', key: 'by', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center', width: '100px' },
]);

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});


let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
  }, 500);
});

async function loadNotifications(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;

  if (sortBy && sortBy.length) {
    currentSortBy.value = sortBy;
  }

  try {
    const queryParams = {
        search: searchKey.value,
        page: page,
        itemsPerPage: rpp,
        // Only include type filter if it's not 'All'
        type: typeFilter.value === 'All' ? undefined : typeFilter.value,
    };

    if (currentSortBy.value && currentSortBy.value.length > 0) {
      queryParams.sortBy = currentSortBy.value[0].key;
      queryParams.sortOrder = currentSortBy.value[0].order;
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


    const { data, error } = await useMyFetch('/api/notifications', { query: queryParams });

    if (error.value) {
      throw new Error(error.value.data?.message || 'Failed to load notifications.');
    } else if (data.value) {
      notifications.value = data.value.notifications || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    notifications.value = [];
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
  loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
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
      newStartDate.setDate(today.getDate() - today.getDay()); 
      newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + 6);
      break;
    case 'month':
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1); 
      newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
      break;
    case 'year':
      const targetYear = today.getFullYear(); 
      newStartDate = new Date(targetYear, 0, 1); 
      newEndDate = new Date(targetYear, 11, 31); 
      break;
  }
  startDate.value = newStartDate;
  endDate.value = newEndDate;
  selectedDateFilterPreset.value = preset; 
  loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
};


const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

const getTypeColor = (type) => ({
    'News': 'blue-darken-1',
    'Events': 'deep-purple-accent-2',
    'Alert': 'error',
    'All': 'grey', // Added color for 'All' if it somehow appears (though it shouldn't be rendered as a chip normally)
  }[type] || 'grey');


const formatAudience = (target, recipientsArray) => {
    switch(target) {
        case 'All':
            return 'All Approved Residents';
        case 'PWDResidents':
            return 'All PWD Residents';
        case 'SeniorResidents':
            return 'All Senior Citizens';
        case 'VotersResidents':
            return 'All Registered Voters';
        case 'SpecificResidents':
            const count = Array.isArray(recipientsArray) ? recipientsArray.length : 0;
            return `Specific (${count} resident${count === 1 ? '' : 's'})`;
        default:
            return target || 'N/A';
    }
};

// --- Print Functionality ---

async function fetchAllNotificationsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            // Only include type filter if it's not 'All'
            type: typeFilter.value === 'All' ? undefined : typeFilter.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        // Sort order for print
        if (currentSortBy.value && currentSortBy.value.length > 0) {
          queryParams.sortBy = currentSortBy.value[0].key;
          queryParams.sortOrder = currentSortBy.value[0].order;
        }

        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/notifications', { query: queryParams });

        if (error.value) throw new Error(error.value.data?.message || 'Failed to load all notifications for printing.');
        
        return data.value?.notifications || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true;
  notificationsForPrint.value = await fetchAllNotificationsForPrint();
  loading.value = false;

  if (notificationsForPrint.value.length > 0) {
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
          <title>Notification Report</title>
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
    loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
});
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
  body > *:not(.v-overlay-container) {
    display: none !important;
  }
  .v-overlay-container {
    display: block !important;
    position: static;
    top: auto !important;
    left: auto !important;
    width: auto !important;
    height: auto !important;
    transform: none !important;
    overflow: visible !important;
  }

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
    display: none !important;
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