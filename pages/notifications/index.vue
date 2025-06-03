<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Notifications</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          to="/notifications/new"
          prepend-icon="mdi-bell-plus-outline"
          color="primary"
        >
          New Notification
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-bell-ring-outline" class="mr-2"></v-icon>
        Manage Notifications
      </v-card-title>
      <v-card-text>
        <v-row class="mb-4">
            <v-col cols="12" md="8">
                <v-text-field
                v-model="searchKey"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                color="primary"
                label="Search Notifications"
                placeholder="Search by name, content, author, type..."
                clearable
                density="compact"
                hide-details
                ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
                <v-select
                    v-model="typeFilter"
                    :items="NOTIFICATION_TYPE_FILTER_OPTIONS"
                    label="Filter by Type"
                    variant="outlined"
                    density="compact"
                    clearable
                    hide-details
                    @update:modelValue="filterChanged"
                ></v-select>
            </v-col>
        </v-row>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="notifications"
          :items-length="totalItems"
          :loading="loading"
          @update:options="loadNotifications"
          item-value="_id"
          class="mt-2"
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
              prepend-icon="mdi-eye-outline"
              title="View/Edit Notification"
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
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../composables/useMyFetch'; // Adjust path if needed
import { useNuxtApp } from '#app'; // For $toast, if you want to use it for errors

const { $toast } = useNuxtApp();

const searchKey = ref('');
const typeFilter = ref(null); // For v-select model, null for 'All Types'
const totalItems = ref(0);
const notifications = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
let currentSortBy = [{ key: 'date', order: 'desc' }]; // Default sort

const NOTIFICATION_TYPE_FILTER_OPTIONS = [
    { title: 'All Types', value: null }, // Represents no type filter
    { title: 'Announcement', value: 'Announcement' },
    { title: 'Alert', value: 'Alert' },
    { title: 'Notification', value: 'Notification' },
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

let searchDebounceTimer = null;
// Watch for changes in searchKey or typeFilter to trigger a reload
watch([searchKey, typeFilter], () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // When search or filter changes, v-data-table-server's @update:options
    // might not fire immediately if page/itemsPerPage didn't change.
    // So, we manually call loadNotifications with page 1.
    // The options from v-data-table-server will still be passed eventually for subsequent page changes.
    loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
  }, 500); // 500ms debounce
});

// This function is directly called when the v-select for typeFilter changes.
// It ensures that a new API call is made with the filter, resetting to page 1.
function filterChanged() {
  loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
}

async function loadNotifications(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;

  // Update current sort state
  if (sortBy && sortBy.length) {
    currentSortBy.value = sortBy;
  }

  try {
    const queryParams = {
        search: searchKey.value,
        page: page,
        itemsPerPage: rpp,
    };
    if (typeFilter.value) { // Only add type if it's not null/empty
        queryParams.type = typeFilter.value;
    }

    // Add sorting parameters if your API supports them
    // Example:
    // if (currentSortBy.value && currentSortBy.value.length > 0) {
    //   queryParams.sortBy = currentSortBy.value[0].key;
    //   queryParams.sortOrder = currentSortBy.value[0].order;
    // } else { // Default sort if none provided by table
    //    queryParams.sortBy = 'date';
    //    queryParams.sortOrder = 'desc';
    // }


    const { data, error } = await useMyFetch('/api/notifications', { query: queryParams });

    if (error.value) {
      console.error('Failed to load notifications:', error.value);
      $toast.fire({ title: 'Failed to load notifications.', icon: 'error' });
      notifications.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      notifications.value = data.value.notifications || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception while loading notifications:', e);
    $toast.fire({ title: 'An error occurred while loading notifications.', icon: 'error' });
    notifications.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    // More concise date formatting
    return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString; // Fallback
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'Announcement': return 'primary'; // Or 'blue'
    case 'Alert': return 'error';     // Or 'red'
    case 'Notification': return 'success'; // Or 'green'
    default: return 'grey';
  }
};

const formatAudience = (target, recipientsArray) => {
    if (target === 'All') return 'All Approved Residents';
    if (target === 'SpecificResidents') {
        const count = Array.isArray(recipientsArray) ? recipientsArray.length : 0;
        return `Specific (${count} resident${count === 1 ? '' : 's'})`;
    }
    return target || 'N/A'; // Fallback for any other target values or if target is undefined
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block; /* Ensures it behaves like a block for truncation */
}
/* Optional: Add a little margin between search and filter if they stack on small screens */
.v-select {
    max-width: 100%; /* Ensure select doesn't overflow its column */
}
</style>